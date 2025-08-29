import { getPrismaClient, executeRawSQL } from './connection.js';

export interface ValidationResult {
  table: string;
  check: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  count?: number;
  details?: any;
}

export interface SchemaValidationResult {
  valid: boolean;
  results: ValidationResult[];
  summary: {
    passed: number;
    failed: number;
    warnings: number;
  };
}

// Validate database schema and data integrity
export async function validateDatabase(options: {
  checkConstraints?: boolean;
  checkIndexes?: boolean;
  checkData?: boolean;
  tables?: string[];
} = {}): Promise<SchemaValidationResult> {
  const { 
    checkConstraints = true, 
    checkIndexes = true, 
    checkData = true,
    tables 
  } = options;

  console.log('🔍 Starting database validation...');
  
  const results: ValidationResult[] = [];

  if (checkConstraints) {
    results.push(...await validateConstraints(tables));
  }

  if (checkIndexes) {
    results.push(...await validateIndexes(tables));
  }

  if (checkData) {
    results.push(...await validateDataIntegrity(tables));
  }

  // Additional system checks
  results.push(...await validateSystemHealth());

  const summary = {
    passed: results.filter(r => r.status === 'pass').length,
    failed: results.filter(r => r.status === 'fail').length,
    warnings: results.filter(r => r.status === 'warning').length
  };

  const valid = summary.failed === 0;

  console.log(`✅ Database validation completed:`);
  console.log(`   Passed: ${summary.passed}`);
  console.log(`   Failed: ${summary.failed}`);
  console.log(`   Warnings: ${summary.warnings}`);

  return { valid, results, summary };
}

// Validate foreign key constraints
async function validateConstraints(tables?: string[]): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  try {
    // Get all foreign key constraints
    const constraintsQuery = `
      SELECT 
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        ${tables ? `AND tc.table_name = ANY($1)` : ''}
      ORDER BY tc.table_name, tc.constraint_name
    `;

    const constraints = await executeRawSQL(
      constraintsQuery, 
      tables ? [tables] : []
    );

    for (const constraint of constraints) {
      // Check for orphaned records
      const orphanQuery = `
        SELECT COUNT(*) as count
        FROM ${constraint.table_name} t
        WHERE t.${constraint.column_name} IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM ${constraint.foreign_table_name} ft
          WHERE ft.${constraint.foreign_column_name} = t.${constraint.column_name}
        )
      `;

      const orphanResult = await executeRawSQL(orphanQuery);
      const orphanCount = parseInt(orphanResult[0].count);

      if (orphanCount > 0) {
        results.push({
          table: constraint.table_name,
          check: `FK_${constraint.constraint_name}`,
          status: 'fail',
          message: `Found ${orphanCount} orphaned records violating foreign key constraint`,
          count: orphanCount,
          details: {
            constraint: constraint.constraint_name,
            column: constraint.column_name,
            references: `${constraint.foreign_table_name}.${constraint.foreign_column_name}`
          }
        });
      } else {
        results.push({
          table: constraint.table_name,
          check: `FK_${constraint.constraint_name}`,
          status: 'pass',
          message: 'Foreign key constraint is valid'
        });
      }
    }

  } catch (error) {
    results.push({
      table: 'system',
      check: 'constraints_validation',
      status: 'fail',
      message: `Failed to validate constraints: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }

  return results;
}

// Validate indexes
async function validateIndexes(tables?: string[]): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  try {
    // Check for missing indexes on foreign keys
    const missingIndexesQuery = `
      SELECT 
        t.table_name,
        kcu.column_name,
        tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      LEFT JOIN pg_indexes pi 
        ON t.table_name = pi.tablename 
        AND kcu.column_name = ANY(string_to_array(replace(pi.indexdef, ' ', ''), ','))
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND pi.indexname IS NULL
        ${tables ? `AND t.table_name = ANY($1)` : ''}
    `;

    const missingIndexes = await executeRawSQL(
      missingIndexesQuery,
      tables ? [tables] : []
    );

    for (const missing of missingIndexes) {
      results.push({
        table: missing.table_name,
        check: 'missing_fk_index',
        status: 'warning',
        message: `Missing index on foreign key column: ${missing.column_name}`,
        details: {
          column: missing.column_name,
          constraint: missing.constraint_name
        }
      });
    }

    // Check for unused indexes
    const unusedIndexesQuery = `
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_tup_read,
        idx_tup_fetch
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
        AND idx_tup_read = 0
        AND idx_tup_fetch = 0
        ${tables ? `AND tablename = ANY($1)` : ''}
        AND indexname NOT LIKE '%_pkey'
    `;

    const unusedIndexes = await executeRawSQL(
      unusedIndexesQuery,
      tables ? [tables] : []
    );

    for (const unused of unusedIndexes) {
      results.push({
        table: unused.tablename,
        check: 'unused_index',
        status: 'warning',
        message: `Potentially unused index: ${unused.indexname}`,
        details: {
          index: unused.indexname,
          reads: unused.idx_tup_read,
          fetches: unused.idx_tup_fetch
        }
      });
    }

  } catch (error) {
    results.push({
      table: 'system',
      check: 'indexes_validation',
      status: 'fail',
      message: `Failed to validate indexes: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }

  return results;
}

// Validate data integrity
async function validateDataIntegrity(tables?: string[]): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  // Define integrity checks
  const integrityChecks = [
    {
      name: 'users_tenant_isolation',
      table: 'users',
      query: `
        SELECT COUNT(*) as count
        FROM users u
        LEFT JOIN tenants t ON u.tenant_id = t.id
        WHERE t.id IS NULL
      `,
      description: 'Users without valid tenants'
    },
    {
      name: 'conversations_workspace_consistency',
      table: 'conversations',
      query: `
        SELECT COUNT(*) as count
        FROM conversations c
        LEFT JOIN workspaces w ON c.workspace_id = w.id
        WHERE w.id IS NULL OR w.tenant_id != c.tenant_id
      `,
      description: 'Conversations with invalid workspace references'
    },
    {
      name: 'messages_conversation_consistency',
      table: 'messages',
      query: `
        SELECT COUNT(*) as count
        FROM messages m
        LEFT JOIN conversations c ON m.conversation_id = c.id
        WHERE c.id IS NULL
      `,
      description: 'Messages without valid conversations'
    },
    {
      name: 'artifacts_tenant_consistency',
      table: 'artifacts',
      query: `
        SELECT COUNT(*) as count
        FROM artifacts a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE u.id IS NULL OR u.tenant_id != a.tenant_id
      `,
      description: 'Artifacts with tenant inconsistency'
    },
    {
      name: 'subscriptions_single_active',
      table: 'subscriptions',
      query: `
        SELECT tenant_id, COUNT(*) as count
        FROM subscriptions
        WHERE status = 'active'
        GROUP BY tenant_id
        HAVING COUNT(*) > 1
      `,
      description: 'Tenants with multiple active subscriptions'
    },
    {
      name: 'email_uniqueness',
      table: 'users',
      query: `
        SELECT email, COUNT(*) as count
        FROM users
        WHERE status = 'active'
        GROUP BY email
        HAVING COUNT(*) > 1
      `,
      description: 'Duplicate active user emails'
    },
    {
      name: 'workspace_default_uniqueness',
      table: 'workspaces',
      query: `
        SELECT tenant_id, COUNT(*) as count
        FROM workspaces
        WHERE is_default = true
        GROUP BY tenant_id
        HAVING COUNT(*) > 1
      `,
      description: 'Tenants with multiple default workspaces'
    }
  ];

  for (const check of integrityChecks) {
    try {
      // Skip table-specific checks if tables filter is provided and doesn't include this table
      if (tables && !tables.includes(check.table)) {
        continue;
      }

      const result = await executeRawSQL(check.query);
      
      if (check.name === 'subscriptions_single_active' || 
          check.name === 'email_uniqueness' ||
          check.name === 'workspace_default_uniqueness') {
        // These queries return multiple rows if there are violations
        if (result.length > 0) {
          results.push({
            table: check.table,
            check: check.name,
            status: 'fail',
            message: `${check.description}: ${result.length} violations found`,
            count: result.length,
            details: result
          });
        } else {
          results.push({
            table: check.table,
            check: check.name,
            status: 'pass',
            message: check.description + ': OK'
          });
        }
      } else {
        // These queries return a count
        const count = parseInt(result[0]?.count || '0');
        if (count > 0) {
          results.push({
            table: check.table,
            check: check.name,
            status: 'fail',
            message: `${check.description}: ${count} violations found`,
            count
          });
        } else {
          results.push({
            table: check.table,
            check: check.name,
            status: 'pass',
            message: check.description + ': OK'
          });
        }
      }

    } catch (error) {
      results.push({
        table: check.table,
        check: check.name,
        status: 'fail',
        message: `Failed to run integrity check: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  return results;
}

// Validate system health
async function validateSystemHealth(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  try {
    // Check database connection count
    const connectionsResult = await executeRawSQL(`
      SELECT 
        count(*) as current_connections,
        (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
    `);

    const { current_connections, max_connections } = connectionsResult[0];
    const connectionUsage = (current_connections / max_connections) * 100;

    if (connectionUsage > 80) {
      results.push({
        table: 'system',
        check: 'connection_usage',
        status: 'warning',
        message: `High connection usage: ${current_connections}/${max_connections} (${connectionUsage.toFixed(1)}%)`,
        count: current_connections
      });
    } else {
      results.push({
        table: 'system',
        check: 'connection_usage',
        status: 'pass',
        message: `Connection usage normal: ${current_connections}/${max_connections} (${connectionUsage.toFixed(1)}%)`
      });
    }

    // Check for long-running queries
    const longQueriesResult = await executeRawSQL(`
      SELECT COUNT(*) as count
      FROM pg_stat_activity
      WHERE state = 'active'
        AND query_start < NOW() - INTERVAL '5 minutes'
        AND query NOT LIKE '%pg_stat_activity%'
    `);

    const longQueriesCount = parseInt(longQueriesResult[0].count);
    if (longQueriesCount > 0) {
      results.push({
        table: 'system',
        check: 'long_running_queries',
        status: 'warning',
        message: `${longQueriesCount} queries running longer than 5 minutes`,
        count: longQueriesCount
      });
    } else {
      results.push({
        table: 'system',
        check: 'long_running_queries',
        status: 'pass',
        message: 'No long-running queries detected'
      });
    }

    // Check database size
    const sizeResult = await executeRawSQL(`
      SELECT pg_database_size(current_database()) as size_bytes
    `);

    const sizeBytes = parseInt(sizeResult[0].size_bytes);
    const sizeGB = sizeBytes / (1024 * 1024 * 1024);

    if (sizeGB > 100) {
      results.push({
        table: 'system',
        check: 'database_size',
        status: 'warning',
        message: `Large database size: ${sizeGB.toFixed(2)} GB`,
        details: { size_bytes: sizeBytes, size_gb: sizeGB }
      });
    } else {
      results.push({
        table: 'system',
        check: 'database_size',
        status: 'pass',
        message: `Database size normal: ${sizeGB.toFixed(2)} GB`
      });
    }

    // Check for deadlocks
    const deadlocksResult = await executeRawSQL(`
      SELECT deadlocks FROM pg_stat_database WHERE datname = current_database()
    `);

    const deadlocks = parseInt(deadlocksResult[0]?.deadlocks || '0');
    if (deadlocks > 0) {
      results.push({
        table: 'system',
        check: 'deadlocks',
        status: 'warning',
        message: `${deadlocks} deadlocks detected since last stats reset`,
        count: deadlocks
      });
    } else {
      results.push({
        table: 'system',
        check: 'deadlocks',
        status: 'pass',
        message: 'No deadlocks detected'
      });
    }

  } catch (error) {
    results.push({
      table: 'system',
      check: 'system_health',
      status: 'fail',
      message: `Failed to check system health: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }

  return results;
}

// Validate specific tenant data
export async function validateTenantData(tenantId: string): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  try {
    // Check tenant exists and is valid
    const tenantResult = await executeRawSQL(`
      SELECT id, name, status FROM tenants WHERE id = $1
    `, [tenantId]);

    if (tenantResult.length === 0) {
      results.push({
        table: 'tenants',
        check: 'tenant_exists',
        status: 'fail',
        message: `Tenant ${tenantId} not found`
      });
      return results;
    }

    const tenant = tenantResult[0];
    results.push({
      table: 'tenants',
      check: 'tenant_exists',
      status: 'pass',
      message: `Tenant '${tenant.name}' found with status: ${tenant.status}`
    });

    // Check tenant has at least one workspace
    const workspacesResult = await executeRawSQL(`
      SELECT COUNT(*) as count FROM workspaces WHERE tenant_id = $1
    `, [tenantId]);

    const workspaceCount = parseInt(workspacesResult[0].count);
    if (workspaceCount === 0) {
      results.push({
        table: 'workspaces',
        check: 'tenant_workspaces',
        status: 'fail',
        message: 'Tenant has no workspaces',
        count: 0
      });
    } else {
      results.push({
        table: 'workspaces',
        check: 'tenant_workspaces',
        status: 'pass',
        message: `Tenant has ${workspaceCount} workspace(s)`,
        count: workspaceCount
      });
    }

    // Check for default workspace
    const defaultWorkspaceResult = await executeRawSQL(`
      SELECT COUNT(*) as count FROM workspaces WHERE tenant_id = $1 AND is_default = true
    `, [tenantId]);

    const defaultWorkspaceCount = parseInt(defaultWorkspaceResult[0].count);
    if (defaultWorkspaceCount !== 1) {
      results.push({
        table: 'workspaces',
        check: 'default_workspace',
        status: 'fail',
        message: `Tenant should have exactly 1 default workspace, found ${defaultWorkspaceCount}`,
        count: defaultWorkspaceCount
      });
    } else {
      results.push({
        table: 'workspaces',
        check: 'default_workspace',
        status: 'pass',
        message: 'Tenant has exactly one default workspace'
      });
    }

    // Check subscription
    const subscriptionResult = await executeRawSQL(`
      SELECT COUNT(*) as count FROM subscriptions WHERE tenant_id = $1 AND status = 'active'
    `, [tenantId]);

    const activeSubscriptionCount = parseInt(subscriptionResult[0].count);
    if (activeSubscriptionCount !== 1) {
      results.push({
        table: 'subscriptions',
        check: 'active_subscription',
        status: activeSubscriptionCount === 0 ? 'fail' : 'warning',
        message: `Tenant should have exactly 1 active subscription, found ${activeSubscriptionCount}`,
        count: activeSubscriptionCount
      });
    } else {
      results.push({
        table: 'subscriptions',
        check: 'active_subscription',
        status: 'pass',
        message: 'Tenant has exactly one active subscription'
      });
    }

  } catch (error) {
    results.push({
      table: 'system',
      check: 'tenant_validation',
      status: 'fail',
      message: `Failed to validate tenant data: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }

  return results;
}