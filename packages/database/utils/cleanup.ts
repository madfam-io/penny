import { getPrismaClient, executeRawSQL } from './connection.js';

export interface CleanupOptions {
  dryRun?: boolean;
  batchSize?: number;
  olderThanDays?: number;
}

export interface CleanupResult {
  table: string;
  deleted: number;
  skipped?: number;
  error?: string;
}

// Clean up expired data across the system
export async function cleanupExpiredData(options: CleanupOptions = {}): Promise<CleanupResult[]> {
  const { dryRun = false, batchSize = 1000, olderThanDays = 30 } = options;
  const results: CleanupResult[] = [];
  const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

  console.log(`🧹 Starting cleanup of data older than ${olderThanDays} days (${cutoffDate.toISOString()})`);
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No data will be deleted');
  }

  // Clean up expired verification tokens
  results.push(await cleanupTable({
    table: 'verification_tokens',
    condition: 'expires < $1',
    params: [cutoffDate],
    dryRun,
    batchSize
  }));

  // Clean up expired password reset tokens
  results.push(await cleanupTable({
    table: 'password_reset_tokens',
    condition: 'expires < $1 OR used_at IS NOT NULL',
    params: [cutoffDate],
    dryRun,
    batchSize
  }));

  // Clean up expired sessions
  results.push(await cleanupTable({
    table: 'sessions',
    condition: 'expires < $1',
    params: [cutoffDate],
    dryRun,
    batchSize
  }));

  // Clean up old webhook deliveries
  results.push(await cleanupTable({
    table: 'webhook_deliveries',
    condition: 'created_at < $1 AND status IN ($2, $3)',
    params: [cutoffDate, 'delivered', 'failed'],
    dryRun,
    batchSize
  }));

  // Clean up expired notifications
  results.push(await cleanupTable({
    table: 'notifications',
    condition: 'expires_at < $1',
    params: [new Date()],
    dryRun,
    batchSize
  }));

  // Clean up old audit logs (keep more recent ones)
  const auditCutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days
  results.push(await cleanupTable({
    table: 'audit_logs',
    condition: 'timestamp < $1',
    params: [auditCutoffDate],
    dryRun,
    batchSize
  }));

  // Clean up old error logs
  results.push(await cleanupTable({
    table: 'error_logs',
    condition: 'created_at < $1 AND resolved_at IS NOT NULL',
    params: [cutoffDate],
    dryRun,
    batchSize
  }));

  // Clean up old performance metrics
  const metricsCutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
  results.push(await cleanupTable({
    table: 'performance_metrics',
    condition: 'recorded_at < $1',
    params: [metricsCutoffDate],
    dryRun,
    batchSize
  }));

  // Clean up old system metrics
  results.push(await cleanupTable({
    table: 'system_metrics',
    condition: 'recorded_at < $1',
    params: [metricsCutoffDate],
    dryRun,
    batchSize
  }));

  // Clean up expired conversation memory
  results.push(await cleanupTable({
    table: 'conversation_memory',
    condition: 'expires_at < $1',
    params: [new Date()],
    dryRun,
    batchSize
  }));

  // Clean up old feature usage data
  results.push(await cleanupTable({
    table: 'feature_usage',
    condition: 'recorded_at < $1',
    params: [cutoffDate],
    dryRun,
    batchSize
  }));

  // Clean up old API usage logs
  const apiLogsCutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
  results.push(await cleanupTable({
    table: 'api_usage_logs',
    condition: 'recorded_at < $1',
    params: [apiLogsCutoffDate],
    dryRun,
    batchSize
  }));

  // Clean up expired artifact exports
  results.push(await cleanupTable({
    table: 'artifact_exports',
    condition: 'expires_at < $1 OR (status = $2 AND created_at < $3)',
    params: [new Date(), 'completed', cutoffDate],
    dryRun,
    batchSize
  }));

  // Clean up old event log entries
  results.push(await cleanupTable({
    table: 'event_log',
    condition: 'occurred_at < $1',
    params: [cutoffDate],
    dryRun,
    batchSize
  }));

  const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);
  console.log(`✅ Cleanup completed. Total records ${dryRun ? 'would be' : ''} deleted: ${totalDeleted}`);

  return results;
}

// Clean up soft-deleted records
export async function cleanupSoftDeleted(options: CleanupOptions = {}): Promise<CleanupResult[]> {
  const { dryRun = false, batchSize = 1000, olderThanDays = 30 } = options;
  const results: CleanupResult[] = [];
  const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

  console.log(`🗑️ Cleaning up soft-deleted records older than ${olderThanDays} days`);

  // Clean up soft-deleted tenants and their related data
  results.push(await cleanupTable({
    table: 'tenants',
    condition: 'deleted_at IS NOT NULL AND deleted_at < $1',
    params: [cutoffDate],
    dryRun,
    batchSize
  }));

  // Clean up soft-deleted users
  results.push(await cleanupTable({
    table: 'users',
    condition: 'deleted_at IS NOT NULL AND deleted_at < $1',
    params: [cutoffDate],
    dryRun,
    batchSize
  }));

  // Clean up soft-deleted workspaces
  results.push(await cleanupTable({
    table: 'workspaces',
    condition: 'deleted_at IS NOT NULL AND deleted_at < $1',
    params: [cutoffDate],
    dryRun,
    batchSize
  }));

  const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);
  console.log(`✅ Soft-deleted cleanup completed. Total records ${dryRun ? 'would be' : ''} deleted: ${totalDeleted}`);

  return results;
}

// Clean up orphaned records
export async function cleanupOrphanedRecords(options: CleanupOptions = {}): Promise<CleanupResult[]> {
  const { dryRun = false, batchSize = 1000 } = options;
  const results: CleanupResult[] = [];

  console.log('🔗 Cleaning up orphaned records');

  // Messages without conversations
  results.push(await cleanupTable({
    table: 'messages',
    condition: 'conversation_id NOT IN (SELECT id FROM conversations)',
    params: [],
    dryRun,
    batchSize
  }));

  // Artifacts without users
  results.push(await cleanupTable({
    table: 'artifacts',
    condition: 'user_id NOT IN (SELECT id FROM users)',
    params: [],
    dryRun,
    batchSize
  }));

  // Tool executions without tools
  results.push(await cleanupTable({
    table: 'tool_executions',
    condition: 'tool_id NOT IN (SELECT id FROM tools)',
    params: [],
    dryRun,
    batchSize
  }));

  // User roles without users or roles
  results.push(await cleanupTable({
    table: 'user_roles',
    condition: 'user_id NOT IN (SELECT id FROM users) OR role_id NOT IN (SELECT id FROM roles)',
    params: [],
    dryRun,
    batchSize
  }));

  // Webhook deliveries without webhooks
  results.push(await cleanupTable({
    table: 'webhook_deliveries',
    condition: 'webhook_id NOT IN (SELECT id FROM webhooks)',
    params: [],
    dryRun,
    batchSize
  }));

  // Notification history without rules (if rule was deleted)
  results.push(await cleanupTable({
    table: 'notification_history',
    condition: 'rule_id IS NOT NULL AND rule_id NOT IN (SELECT id FROM notification_rules)',
    params: [],
    dryRun,
    batchSize
  }));

  const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);
  console.log(`✅ Orphaned records cleanup completed. Total records ${dryRun ? 'would be' : ''} deleted: ${totalDeleted}`);

  return results;
}

// Vacuum and analyze database
export async function optimizeDatabase(options: { 
  analyze?: boolean;
  vacuum?: boolean;
  full?: boolean;
  tables?: string[];
} = {}): Promise<void> {
  const { analyze = true, vacuum = true, full = false, tables } = options;

  console.log('⚡ Optimizing database...');

  try {
    if (vacuum) {
      const vacuumCommand = full ? 'VACUUM FULL' : 'VACUUM';
      
      if (tables && tables.length > 0) {
        for (const table of tables) {
          console.log(`🧹 Vacuuming table: ${table}`);
          await executeRawSQL(`${vacuumCommand} ${table}`);
        }
      } else {
        console.log(`🧹 Running ${vacuumCommand} on database`);
        await executeRawSQL(vacuumCommand);
      }
    }

    if (analyze) {
      if (tables && tables.length > 0) {
        for (const table of tables) {
          console.log(`📊 Analyzing table: ${table}`);
          await executeRawSQL(`ANALYZE ${table}`);
        }
      } else {
        console.log('📊 Analyzing database statistics');
        await executeRawSQL('ANALYZE');
      }
    }

    console.log('✅ Database optimization completed');
  } catch (error) {
    console.error('❌ Database optimization failed:', error);
    throw error;
  }
}

// Update table statistics
export async function updateStatistics(tables?: string[]): Promise<void> {
  console.log('📊 Updating table statistics...');

  try {
    if (tables && tables.length > 0) {
      for (const table of tables) {
        await executeRawSQL(`ANALYZE ${table}`);
        console.log(`✅ Updated statistics for table: ${table}`);
      }
    } else {
      await executeRawSQL('ANALYZE');
      console.log('✅ Updated statistics for all tables');
    }
  } catch (error) {
    console.error('❌ Failed to update statistics:', error);
    throw error;
  }
}

// Helper function to clean up a specific table
async function cleanupTable(params: {
  table: string;
  condition: string;
  params: any[];
  dryRun: boolean;
  batchSize: number;
}): Promise<CleanupResult> {
  const { table, condition, params, dryRun, batchSize } = params;

  try {
    // First, count how many records would be affected
    const countQuery = `SELECT COUNT(*) as count FROM ${table} WHERE ${condition}`;
    const countResult = await executeRawSQL(countQuery, params);
    const totalCount = parseInt(countResult[0].count);

    if (totalCount === 0) {
      return { table, deleted: 0 };
    }

    console.log(`📋 Table ${table}: ${totalCount} records to ${dryRun ? 'be deleted (DRY RUN)' : 'delete'}`);

    if (dryRun) {
      return { table, deleted: 0, skipped: totalCount };
    }

    // Delete in batches to avoid locking issues
    let totalDeleted = 0;
    const deleteQuery = `DELETE FROM ${table} WHERE ${condition} LIMIT ${batchSize}`;

    while (totalDeleted < totalCount) {
      const result = await executeRawSQL(`
        WITH deleted AS (
          DELETE FROM ${table} 
          WHERE ${condition} 
          AND id IN (
            SELECT id FROM ${table} 
            WHERE ${condition} 
            LIMIT ${batchSize}
          )
          RETURNING id
        )
        SELECT COUNT(*) as deleted FROM deleted
      `, params);

      const batchDeleted = parseInt(result[0]?.deleted || '0');
      if (batchDeleted === 0) {
        break; // No more records to delete
      }

      totalDeleted += batchDeleted;
      console.log(`  🗑️ Deleted ${totalDeleted}/${totalCount} records from ${table}`);

      // Small delay to prevent overwhelming the database
      if (totalDeleted < totalCount) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return { table, deleted: totalDeleted };

  } catch (error) {
    console.error(`❌ Error cleaning up table ${table}:`, error);
    return {
      table,
      deleted: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Get database size information
export async function getDatabaseSizes(): Promise<{
  total: string;
  tables: Array<{
    table: string;
    size: string;
    rows: number;
  }>;
}> {
  try {
    // Get total database size
    const totalResult = await executeRawSQL(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `);

    // Get table sizes
    const tablesResult = await executeRawSQL(`
      SELECT 
        schemaname,
        tablename as table_name,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
        n_tup_ins + n_tup_upd as rows
      FROM pg_tables
      LEFT JOIN pg_stat_user_tables ON pg_tables.tablename = pg_stat_user_tables.relname
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    `);

    return {
      total: totalResult[0].size,
      tables: tablesResult.map(row => ({
        table: row.table_name,
        size: row.size,
        rows: parseInt(row.rows || '0')
      }))
    };
  } catch (error) {
    console.error('Failed to get database sizes:', error);
    throw error;
  }
}