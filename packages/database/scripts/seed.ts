#!/usr/bin/env node

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { checkDatabaseHealth } from '../utils/connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Seeder {
  filename: string;
  name: string;
  order: number;
  run: () => Promise<any>;
}

class SeederRunner {
  private seedersDir: string;
  private seeders: Seeder[] = [];

  constructor() {
    this.seedersDir = path.join(__dirname, '..', 'seeders');
  }

  async run(options: {
    seeder?: string;
    dryRun?: boolean;
    fresh?: boolean;
    production?: boolean;
  } = {}) {
    const { seeder, dryRun = false, fresh = false, production = false } = options;

    console.log('🌱 PENNY Database Seeder Runner');
    console.log('===============================');

    // Check database connectivity
    console.log('🔍 Checking database connection...');
    const health = await checkDatabaseHealth();
    
    if (!health.postgres) {
      console.error('❌ Database connection failed:', health.details?.postgresError);
      process.exit(1);
    }

    console.log(`✅ Database connected (${health.latency}ms)`);

    // Load seeders
    await this.loadSeeders();

    if (this.seeders.length === 0) {
      console.log('No seeders found');
      return;
    }

    // Filter seeders based on options
    let selectedSeeders = this.seeders;

    if (seeder) {
      selectedSeeders = this.seeders.filter(s => 
        s.name === seeder || s.filename === seeder
      );
      
      if (selectedSeeders.length === 0) {
        console.error(`❌ Seeder not found: ${seeder}`);
        process.exit(1);
      }
    }

    // Filter out production-unsafe seeders in production mode
    if (production) {
      // Only run specific production-safe seeders
      const productionSafeSeeders = [
        '001_admin_user',
        '002_default_tenant', 
        '004_built_in_tools',
        '005_pricing_plans',
        '006_feature_flags'
      ];
      
      selectedSeeders = selectedSeeders.filter(s => 
        productionSafeSeeders.some(safe => s.name.startsWith(safe))
      );
      
      console.log(`⚠️  Production mode: Running only ${selectedSeeders.length} production-safe seeders`);
    }

    console.log(`\n📋 Found ${selectedSeeders.length} seeder(s) to run:`);
    selectedSeeders.forEach(seeder => {
      console.log(`   • ${seeder.order.toString().padStart(3, '0')}: ${seeder.name}`);
    });

    if (dryRun) {
      console.log('\n🔍 DRY RUN MODE - No data will be seeded');
      return;
    }

    if (fresh) {
      console.log('\n🧹 Fresh mode: This will clear existing data');
      console.log('⚠️  WARNING: This operation may result in data loss!');
      // In a real implementation, you might want to add confirmation here
    }

    console.log('\n🌱 Running seeders...');

    const startTime = Date.now();
    let successCount = 0;
    let failureCount = 0;

    for (const seederInstance of selectedSeeders) {
      try {
        console.log(`\n📦 Running seeder: ${seederInstance.name}`);
        const seederStartTime = Date.now();
        
        const result = await seederInstance.run();
        
        const duration = Date.now() - seederStartTime;
        console.log(`✅ Completed ${seederInstance.name} (${duration}ms)`);
        
        if (result && typeof result === 'object' && result.length !== undefined) {
          console.log(`   Created ${result.length} records`);
        }
        
        successCount++;

      } catch (error) {
        console.error(`❌ Failed to run seeder ${seederInstance.name}:`, error);
        failureCount++;
        
        // Continue with other seeders unless it's a critical failure
        if (seederInstance.name.includes('001_admin_user') || seederInstance.name.includes('002_default_tenant')) {
          console.error('❌ Critical seeder failed, stopping execution');
          break;
        }
      }
    }

    const totalDuration = Date.now() - startTime;
    
    console.log(`\n🎉 Seeding completed in ${totalDuration}ms`);
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Failed: ${failureCount}`);

    if (failureCount > 0) {
      process.exit(1);
    }
  }

  private async loadSeeders() {
    try {
      const files = await fs.readdir(this.seedersDir);
      const seederFiles = files
        .filter(file => file.endsWith('.ts') && !file.includes('index'))
        .sort();

      for (const filename of seederFiles) {
        try {
          const order = parseInt(filename.split('_')[0]) || 999;
          const name = filename.replace('.ts', '');
          const filePath = path.join(this.seedersDir, filename);
          
          // Dynamic import of the seeder
          const seederModule = await import(filePath);
          
          // Look for the main export function (should be named seed{SeederName})
          const functionName = this.getSeederFunctionName(filename);
          const seederFunction = seederModule[functionName];
          
          if (typeof seederFunction !== 'function') {
            console.warn(`⚠️  Seeder ${filename} does not export function ${functionName}, skipping`);
            continue;
          }
          
          this.seeders.push({
            filename,
            name,
            order,
            run: seederFunction
          });

        } catch (error) {
          console.error(`❌ Failed to load seeder ${filename}:`, error);
        }
      }

      // Sort seeders by order
      this.seeders.sort((a, b) => a.order - b.order);

    } catch (error) {
      console.error('❌ Error loading seeders:', error);
      throw error;
    }
  }

  private getSeederFunctionName(filename: string): string {
    // Convert filename like "001_admin_user.ts" to function name like "seedAdminUser"
    const parts = filename.replace('.ts', '').split('_').slice(1); // Remove order number
    const camelCase = parts.map((part, index) => 
      index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
    ).join('');
    
    return `seed${camelCase.charAt(0).toUpperCase() + camelCase.slice(1)}`;
  }

  async list() {
    console.log('📋 Available Seeders');
    console.log('====================');

    await this.loadSeeders();

    if (this.seeders.length === 0) {
      console.log('No seeders found');
      return;
    }

    console.log('\nSeeders:');
    this.seeders.forEach(seeder => {
      console.log(`   ${seeder.order.toString().padStart(3, '0')}: ${seeder.name}`);
    });

    console.log(`\nTotal: ${this.seeders.length} seeders`);
  }

  async runSpecific(seederName: string) {
    await this.run({ seeder: seederName });
  }

  async runDevelopment() {
    await this.run({ production: false });
  }

  async runProduction() {
    await this.run({ production: true });
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'run';

  const runner = new SeederRunner();

  try {
    switch (command) {
      case 'run':
      case 'seed':
        await runner.run({
          seeder: args.find(arg => arg.startsWith('--seeder='))?.split('=')[1],
          dryRun: args.includes('--dry-run'),
          fresh: args.includes('--fresh'),
          production: args.includes('--production')
        });
        break;

      case 'dev':
      case 'development':
        await runner.runDevelopment();
        break;

      case 'prod':
      case 'production':
        await runner.runProduction();
        break;

      case 'list':
        await runner.list();
        break;

      case 'help':
      default:
        console.log(`
PENNY Database Seeder Runner

Usage: 
  npm run db:seed [command] [options]

Commands:
  run, seed       Run all seeders (default)
  dev             Run development seeders (includes sample data)
  prod            Run production-safe seeders only
  list            List available seeders
  help            Show this help

Options:
  --seeder=NAME   Run specific seeder
  --dry-run       Show what would be seeded without running
  --fresh         Clear existing data before seeding
  --production    Run only production-safe seeders

Examples:
  npm run db:seed                           # Run all seeders
  npm run db:seed dev                       # Run development seeders
  npm run db:seed prod                      # Run production-safe seeders
  npm run db:seed --seeder=001_admin_user   # Run specific seeder
  npm run db:seed --dry-run                 # Show seeders without running
  npm run db:seed list                      # List available seeders
        `);
        break;
    }

  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { SeederRunner };