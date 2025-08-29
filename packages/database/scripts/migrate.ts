#!/usr/bin/env node

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { executeRawSQL, checkDatabaseHealth, getPgPool } from '../utils/connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Migration {
  version: string;
  filename: string;
  path: string;
  applied: boolean;
  appliedAt?: Date;
}

class MigrationRunner {
  private migrationsDir: string;

  constructor() {
    this.migrationsDir = path.join(__dirname, '..', 'migrations');
  }

  async run(options: {
    target?: string;
    dryRun?: boolean;
    rollback?: boolean;
    force?: boolean;
  } = {}) {
    const { target, dryRun = false, rollback = false, force = false } = options;

    console.log('🚀 PENNY Database Migration Runner');
    console.log('================================');

    // Check database connectivity
    console.log('🔍 Checking database connection...');
    const health = await checkDatabaseHealth();
    
    if (!health.postgres) {
      console.error('❌ Database connection failed:', health.details?.postgresError);
      process.exit(1);
    }

    console.log(`✅ Database connected (${health.latency}ms)`);

    // Ensure migrations table exists
    await this.ensureMigrationsTable();

    // Get available and applied migrations
    const migrations = await this.getMigrations();
    const appliedMigrations = await this.getAppliedMigrations();

    // Mark applied migrations
    migrations.forEach(migration => {
      const applied = appliedMigrations.find(am => am.version === migration.version);
      migration.applied = !!applied;
      migration.appliedAt = applied?.applied_at;
    });

    if (rollback) {
      await this.rollbackMigrations(migrations, target);
    } else {
      await this.applyMigrations(migrations, target, dryRun, force);
    }
  }

  private async ensureMigrationsTable() {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) NOT NULL PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        checksum VARCHAR(255)
      );
    `;

    await executeRawSQL(createTableSQL);
  }

  private async getMigrations(): Promise<Migration[]> {
    try {
      const files = await fs.readdir(this.migrationsDir);
      const migrationFiles = files
        .filter(file => file.endsWith('.sql'))
        .sort();

      return migrationFiles.map(filename => {
        const version = filename.split('_')[0];
        return {
          version,
          filename,
          path: path.join(this.migrationsDir, filename),
          applied: false
        };
      });
    } catch (error) {
      console.error('❌ Error reading migrations directory:', error);
      throw error;
    }
  }

  private async getAppliedMigrations(): Promise<Array<{ version: string; applied_at: Date }>> {
    try {
      const result = await executeRawSQL(`
        SELECT version, applied_at 
        FROM schema_migrations 
        ORDER BY applied_at ASC
      `);

      return result.map(row => ({
        version: row.version,
        applied_at: new Date(row.applied_at)
      }));
    } catch (error) {
      // Table might not exist yet
      return [];
    }
  }

  private async applyMigrations(
    migrations: Migration[],
    target?: string,
    dryRun: boolean = false,
    force: boolean = false
  ) {
    const pendingMigrations = target
      ? migrations.filter(m => !m.applied && m.version <= target)
      : migrations.filter(m => !m.applied);

    if (pendingMigrations.length === 0) {
      console.log('✅ No pending migrations to apply');
      return;
    }

    console.log(`\n📋 Found ${pendingMigrations.length} pending migration(s):`);
    pendingMigrations.forEach(migration => {
      console.log(`   • ${migration.version}: ${migration.filename}`);
    });

    if (dryRun) {
      console.log('\n🔍 DRY RUN MODE - No changes will be applied');
      return;
    }

    console.log('\n🔄 Applying migrations...');

    for (const migration of pendingMigrations) {
      await this.applyMigration(migration, force);
    }

    console.log('\n✅ All migrations applied successfully!');
  }

  private async applyMigration(migration: Migration, force: boolean = false) {
    console.log(`\n📦 Applying migration ${migration.version}...`);

    try {
      // Read migration file
      const sql = await fs.readFile(migration.path, 'utf-8');
      
      // Calculate checksum
      const checksum = this.calculateChecksum(sql);

      // Check if migration was already applied with different checksum
      const existing = await executeRawSQL(`
        SELECT checksum FROM schema_migrations WHERE version = $1
      `, [migration.version]);

      if (existing.length > 0 && existing[0].checksum !== checksum && !force) {
        throw new Error(`Migration ${migration.version} has been modified since it was applied. Use --force to override.`);
      }

      // Apply migration in transaction
      const pool = getPgPool();
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        // Execute migration SQL
        const statements = this.splitSQLStatements(sql);
        for (const statement of statements) {
          if (statement.trim()) {
            await client.query(statement);
          }
        }

        // Record migration
        await client.query(`
          INSERT INTO schema_migrations (version, checksum, applied_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (version) 
          DO UPDATE SET 
            checksum = EXCLUDED.checksum, 
            applied_at = EXCLUDED.applied_at
        `, [migration.version, checksum]);

        await client.query('COMMIT');
        console.log(`✅ Migration ${migration.version} applied successfully`);

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      console.error(`❌ Failed to apply migration ${migration.version}:`, error);
      throw error;
    }
  }

  private async rollbackMigrations(migrations: Migration[], target?: string) {
    const appliedMigrations = migrations
      .filter(m => m.applied)
      .sort((a, b) => b.version.localeCompare(a.version)); // Reverse order

    if (appliedMigrations.length === 0) {
      console.log('✅ No migrations to rollback');
      return;
    }

    const toRollback = target
      ? appliedMigrations.filter(m => m.version > target)
      : [appliedMigrations[0]]; // Just rollback the last one

    if (toRollback.length === 0) {
      console.log(`✅ No migrations to rollback (target: ${target})`);
      return;
    }

    console.log(`\n📋 Rolling back ${toRollback.length} migration(s):`);
    toRollback.forEach(migration => {
      console.log(`   • ${migration.version}: ${migration.filename} (applied: ${migration.appliedAt?.toISOString()})`);
    });

    console.warn('\n⚠️  WARNING: Rolling back migrations can result in data loss!');
    console.log('This operation will remove the migration records but cannot automatically undo schema changes.');
    
    // In a real implementation, you might want to add confirmation here
    // For now, we'll just remove the migration records
    
    for (const migration of toRollback) {
      await this.rollbackMigration(migration);
    }

    console.log('\n✅ Rollback completed!');
    console.log('⚠️  Remember to manually verify your schema if needed.');
  }

  private async rollbackMigration(migration: Migration) {
    console.log(`\n📦 Rolling back migration ${migration.version}...`);

    try {
      await executeRawSQL(`
        DELETE FROM schema_migrations WHERE version = $1
      `, [migration.version]);

      console.log(`✅ Migration ${migration.version} rollback completed`);

    } catch (error) {
      console.error(`❌ Failed to rollback migration ${migration.version}:`, error);
      throw error;
    }
  }

  private calculateChecksum(content: string): string {
    // Simple checksum calculation (in production, use crypto.createHash)
    const crypto = require('crypto');
    return crypto.createHash('md5').update(content).digest('hex');
  }

  private splitSQLStatements(sql: string): string[] {
    // Simple SQL statement splitter
    // In production, you might want a more sophisticated parser
    return sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
  }

  async status() {
    console.log('📊 Migration Status');
    console.log('==================');

    const migrations = await this.getMigrations();
    const appliedMigrations = await this.getAppliedMigrations();

    // Mark applied migrations
    migrations.forEach(migration => {
      const applied = appliedMigrations.find(am => am.version === migration.version);
      migration.applied = !!applied;
      migration.appliedAt = applied?.applied_at;
    });

    if (migrations.length === 0) {
      console.log('No migrations found');
      return;
    }

    console.log('\nMigration Status:');
    migrations.forEach(migration => {
      const status = migration.applied ? '✅ Applied' : '⏳ Pending';
      const date = migration.appliedAt ? ` (${migration.appliedAt.toISOString()})` : '';
      console.log(`   ${migration.version}: ${status}${date} - ${migration.filename}`);
    });

    const appliedCount = migrations.filter(m => m.applied).length;
    const pendingCount = migrations.filter(m => !m.applied).length;

    console.log(`\nSummary: ${appliedCount} applied, ${pendingCount} pending`);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'up';

  const runner = new MigrationRunner();

  try {
    switch (command) {
      case 'up':
      case 'apply':
        await runner.run({
          target: args.find(arg => arg.startsWith('--target='))?.split('=')[1],
          dryRun: args.includes('--dry-run'),
          force: args.includes('--force')
        });
        break;

      case 'down':
      case 'rollback':
        await runner.run({
          target: args.find(arg => arg.startsWith('--target='))?.split('=')[1],
          rollback: true
        });
        break;

      case 'status':
        await runner.status();
        break;

      case 'help':
      default:
        console.log(`
PENNY Database Migration Runner

Usage: 
  npm run db:migrate [command] [options]

Commands:
  up, apply    Apply pending migrations (default)
  down         Rollback the last migration
  status       Show migration status
  help         Show this help

Options:
  --target=XXX    Migrate up to specific version
  --dry-run       Show what would be migrated without applying
  --force         Force apply migrations even if checksums don't match

Examples:
  npm run db:migrate                    # Apply all pending migrations
  npm run db:migrate up --dry-run       # Show pending migrations
  npm run db:migrate up --target=005    # Migrate up to version 005
  npm run db:migrate down               # Rollback last migration
  npm run db:migrate status             # Show migration status
        `);
        break;
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { MigrationRunner };