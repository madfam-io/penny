#!/usr/bin/env node

import { getPgPool, executeRawSQL, checkDatabaseHealth } from '../utils/connection.js';
import { createBackup } from '../utils/backup.js';
import { MigrationRunner } from './migrate.js';
import { SeederRunner } from './seed.js';

interface ResetOptions {
  backup?: boolean;
  force?: boolean;
  seeders?: boolean;
  production?: boolean;
}

class DatabaseReset {
  private migrationRunner: MigrationRunner;
  private seederRunner: SeederRunner;

  constructor() {
    this.migrationRunner = new MigrationRunner();
    this.seederRunner = new SeederRunner();
  }

  async run(options: ResetOptions = {}) {
    const { backup = true, force = false, seeders = true, production = false } = options;

    console.log('🔄 PENNY Database Reset');
    console.log('=======================');

    // Safety check for production
    if (production && !force) {
      console.error('❌ Production reset requires --force flag for safety');
      console.error('⚠️  WARNING: This will destroy ALL data in the database!');
      process.exit(1);
    }

    if (!force) {
      console.log('⚠️  WARNING: This operation will destroy ALL data in the database!');
      console.log('Use --force to proceed or Ctrl+C to cancel');
      
      // In a real CLI, you might want to add a confirmation prompt here
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Check database connectivity
    console.log('🔍 Checking database connection...');
    const health = await checkDatabaseHealth();
    
    if (!health.postgres) {
      console.error('❌ Database connection failed:', health.details?.postgresError);
      process.exit(1);
    }

    console.log(`✅ Database connected (${health.latency}ms)`);

    // Create backup before reset
    if (backup && !production) {
      console.log('\n📦 Creating backup before reset...');
      try {
        const backupInfo = await createBackup({
          compress: true,
          includeData: true
        });
        console.log(`✅ Backup created: ${backupInfo.filePath}`);
      } catch (error) {
        console.warn('⚠️  Failed to create backup:', error);
        console.log('Continuing with reset...');
      }
    }

    // Drop and recreate database schema
    await this.resetSchema();

    // Run migrations
    console.log('\n🚀 Running migrations...');
    await this.migrationRunner.run();

    // Run seeders if requested
    if (seeders) {
      console.log('\n🌱 Running seeders...');
      if (production) {
        await this.seederRunner.runProduction();
      } else {
        await this.seederRunner.runDevelopment();
      }
    }

    console.log('\n🎉 Database reset completed successfully!');
    console.log('✅ Your database is now clean and ready to use');
  }

  private async resetSchema() {
    console.log('\n🗑️  Resetting database schema...');

    try {
      // Get all tables to drop
      const tables = await executeRawSQL(`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY tablename
      `);

      if (tables.length > 0) {
        console.log(`📋 Found ${tables.length} tables to drop`);

        // Drop all tables with CASCADE
        const tableNames = tables.map(t => t.tablename).join(', ');
        await executeRawSQL(`DROP TABLE IF EXISTS ${tableNames} CASCADE`);
        console.log('🗑️  Dropped all tables');
      }

      // Get all views to drop
      const views = await executeRawSQL(`
        SELECT viewname 
        FROM pg_views 
        WHERE schemaname = 'public'
        ORDER BY viewname
      `);

      if (views.length > 0) {
        console.log(`📋 Found ${views.length} views to drop`);
        
        for (const view of views) {
          try {
            await executeRawSQL(`DROP VIEW IF EXISTS ${view.viewname} CASCADE`);
          } catch (error) {
            // Some views might be already dropped due to CASCADE
            console.warn(`⚠️  Could not drop view ${view.viewname}:`, error);
          }
        }
        console.log('🗑️  Dropped all views');
      }

      // Get all materialized views to drop
      const matViews = await executeRawSQL(`
        SELECT matviewname 
        FROM pg_matviews 
        WHERE schemaname = 'public'
        ORDER BY matviewname
      `);

      if (matViews.length > 0) {
        console.log(`📋 Found ${matViews.length} materialized views to drop`);
        
        for (const matView of matViews) {
          try {
            await executeRawSQL(`DROP MATERIALIZED VIEW IF EXISTS ${matView.matviewname} CASCADE`);
          } catch (error) {
            console.warn(`⚠️  Could not drop materialized view ${matView.matviewname}:`, error);
          }
        }
        console.log('🗑️  Dropped all materialized views');
      }

      // Get all functions to drop
      const functions = await executeRawSQL(`
        SELECT proname, oidvectortypes(proargtypes) as args
        FROM pg_proc 
        INNER JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid 
        WHERE pg_namespace.nspname = 'public'
        ORDER BY proname
      `);

      if (functions.length > 0) {
        console.log(`📋 Found ${functions.length} functions to drop`);
        
        for (const func of functions) {
          try {
            await executeRawSQL(`DROP FUNCTION IF EXISTS ${func.proname}(${func.args || ''}) CASCADE`);
          } catch (error) {
            console.warn(`⚠️  Could not drop function ${func.proname}:`, error);
          }
        }
        console.log('🗑️  Dropped all functions');
      }

      // Get all types to drop
      const types = await executeRawSQL(`
        SELECT typname 
        FROM pg_type 
        WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        AND typtype = 'e'  -- enum types
        ORDER BY typname
      `);

      if (types.length > 0) {
        console.log(`📋 Found ${types.length} custom types to drop`);
        
        for (const type of types) {
          try {
            await executeRawSQL(`DROP TYPE IF EXISTS ${type.typname} CASCADE`);
          } catch (error) {
            console.warn(`⚠️  Could not drop type ${type.typname}:`, error);
          }
        }
        console.log('🗑️  Dropped all custom types');
      }

      // Get all sequences to drop
      const sequences = await executeRawSQL(`
        SELECT sequencename 
        FROM pg_sequences 
        WHERE schemaname = 'public'
        ORDER BY sequencename
      `);

      if (sequences.length > 0) {
        console.log(`📋 Found ${sequences.length} sequences to drop`);
        
        for (const seq of sequences) {
          try {
            await executeRawSQL(`DROP SEQUENCE IF EXISTS ${seq.sequencename} CASCADE`);
          } catch (error) {
            console.warn(`⚠️  Could not drop sequence ${seq.sequencename}:`, error);
          }
        }
        console.log('🗑️  Dropped all sequences');
      }

      console.log('✅ Schema reset completed');

    } catch (error) {
      console.error('❌ Error during schema reset:', error);
      throw error;
    }
  }

  async softReset(options: { seeders?: boolean } = {}) {
    console.log('🧹 PENNY Database Soft Reset');
    console.log('=============================');
    console.log('This will clear data but keep the schema intact');

    const { seeders = true } = options;

    // Check database connectivity
    const health = await checkDatabaseHealth();
    if (!health.postgres) {
      console.error('❌ Database connection failed:', health.details?.postgresError);
      process.exit(1);
    }

    // Truncate all tables (preserve schema)
    await this.truncateAllTables();

    // Run seeders if requested
    if (seeders) {
      console.log('\n🌱 Running seeders...');
      await this.seederRunner.runDevelopment();
    }

    console.log('\n🎉 Soft reset completed successfully!');
  }

  private async truncateAllTables() {
    console.log('\n🧹 Truncating all tables...');

    try {
      // Get all table names
      const tables = await executeRawSQL(`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
        AND tablename != 'schema_migrations'
        ORDER BY tablename
      `);

      if (tables.length === 0) {
        console.log('No tables found to truncate');
        return;
      }

      console.log(`📋 Found ${tables.length} tables to truncate`);

      // Disable foreign key checks temporarily
      await executeRawSQL('SET session_replication_role = replica');

      // Truncate all tables
      for (const table of tables) {
        try {
          await executeRawSQL(`TRUNCATE TABLE ${table.tablename} RESTART IDENTITY CASCADE`);
          console.log(`  🧹 Truncated ${table.tablename}`);
        } catch (error) {
          console.warn(`  ⚠️  Could not truncate ${table.tablename}:`, error);
        }
      }

      // Re-enable foreign key checks
      await executeRawSQL('SET session_replication_role = DEFAULT');

      console.log('✅ All tables truncated');

    } catch (error) {
      // Make sure to re-enable foreign key checks
      try {
        await executeRawSQL('SET session_replication_role = DEFAULT');
      } catch {}
      
      console.error('❌ Error during table truncation:', error);
      throw error;
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'full';

  const reset = new DatabaseReset();

  try {
    switch (command) {
      case 'full':
      case 'hard':
        await reset.run({
          backup: !args.includes('--no-backup'),
          force: args.includes('--force'),
          seeders: !args.includes('--no-seeders'),
          production: args.includes('--production')
        });
        break;

      case 'soft':
        await reset.softReset({
          seeders: !args.includes('--no-seeders')
        });
        break;

      case 'help':
      default:
        console.log(`
PENNY Database Reset Tool

Usage: 
  npm run db:reset [command] [options]

Commands:
  full, hard      Complete database reset (drops all schema)
  soft            Truncate data only (keeps schema intact)
  help            Show this help

Options:
  --force         Skip safety confirmations
  --no-backup     Skip backup creation
  --no-seeders    Skip running seeders after reset
  --production    Allow reset in production (requires --force)

Examples:
  npm run db:reset                    # Full reset with backup and seeders
  npm run db:reset --force            # Full reset without confirmations
  npm run db:reset soft               # Truncate data only
  npm run db:reset --no-seeders       # Reset without seeders
  npm run db:reset --production --force  # Production reset (dangerous!)

WARNING: These operations will destroy data! Always backup first.
        `);
        break;
    }

  } catch (error) {
    console.error('\n❌ Database reset failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { DatabaseReset };