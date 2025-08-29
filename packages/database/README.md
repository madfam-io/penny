# PENNY Database Package

Comprehensive database migration and seeding system for the PENNY platform.

## Overview

This package provides:
- 🗄️ **Sequential Migrations** - Schema versioning and rollback support
- 🌱 **Comprehensive Seeders** - Development and production data
- 🔧 **Database Utilities** - Backup, cleanup, and validation tools
- 📊 **Health Monitoring** - Connection health and performance checks

## Architecture

### Migration System
- **Sequential execution** with version tracking
- **Rollback support** for safe schema changes
- **Checksum validation** to prevent conflicts
- **Dry-run mode** for testing migrations

### Multi-Tenant Setup
- Row-level security (RLS) policies
- Tenant isolation at every layer
- Per-tenant vector namespaces
- Secure data segregation

## Quick Start

### Prerequisites
```bash
# Required environment variables
DATABASE_URL=postgresql://user:password@localhost:5432/penny
```

### Installation
```bash
npm install
```

### Database Setup
```bash
# Run all migrations
npm run db:migrate

# Seed with development data
npm run db:seed

# Or reset everything and start fresh
npm run db:reset
```

## Commands

### Migration Commands
```bash
# Apply migrations
npm run migrate:up               # Apply all pending migrations
npm run migrate:status           # Show migration status
npm run migrate:down            # Rollback last migration

# Alternative syntax
npm run db:migrate              # Apply all pending migrations
npm run db:migrate:status       # Show migration status
npm run db:migrate:rollback     # Rollback last migration
```

### Seeding Commands
```bash
# Development seeding (includes sample data)
npm run seed:dev                # Full development seed
npm run db:seed                 # Same as seed:dev

# Production seeding (essential data only)
npm run seed:prod               # Production-safe seeders only
npm run db:seed:prod            # Same as seed:prod

# Utility commands
npm run seed:list               # List available seeders
```

### Database Management
```bash
# Database reset
npm run db:reset                # Full reset with backup
npm run db:reset:soft           # Truncate data only (keep schema)

# Backup and restore
npm run db:backup               # Create compressed backup
npm run db:restore backup.sql   # Restore from backup

# Maintenance
npm run db:cleanup              # Clean expired data
npm run db:validate             # Validate data integrity
npm run db:health               # Check database health
```

## Migrations

### Structure
```
migrations/
├── 001_initial_schema.sql      # Extensions and base types
├── 002_user_management.sql     # Users, roles, authentication
├── 003_tenant_system.sql       # Multi-tenant setup
├── 004_conversation_system.sql # Chat and messages
├── 005_artifact_system.sql     # Artifact storage/versioning
├── 006_tool_registry.sql       # Tool system
├── 007_billing_system.sql      # Billing and subscriptions
├── 008_monitoring_system.sql   # Monitoring and analytics
├── 009_webhooks_notifications.sql # Webhooks and notifications
└── 010_indexes_performance.sql # Performance optimization
```

### Migration Features
- **PostgreSQL Extensions**: pgvector, btree_gin, pgcrypto
- **Row Level Security**: Tenant isolation policies
- **Performance Indexes**: Optimized for common queries
- **Data Integrity**: Foreign keys and constraints
- **Audit Trail**: Comprehensive logging

## Seeders

### Structure
```
seeders/
├── 001_admin_user.ts           # System administrator
├── 002_default_tenant.ts       # Default tenant setup
├── 003_sample_users.ts         # Sample users (dev only)
├── 004_built_in_tools.ts       # System tools
├── 005_pricing_plans.ts        # Subscription plans
├── 006_feature_flags.ts        # Feature flags
├── 007_sample_conversations.ts # Sample chat data (dev only)
└── 008_sample_artifacts.ts     # Sample artifacts (dev only)
```

### Seeder Categories

#### Production-Safe Seeders
- Admin user creation
- Default tenant setup
- Built-in tools registration
- Pricing plans
- Feature flags

#### Development Seeders
- Sample users and roles
- Sample conversations
- Sample artifacts and collections
- Demo data for testing

## Database Schema

### Core Tables

#### Multi-Tenant Core
- `tenants` - Tenant organizations
- `users` - User accounts with tenant isolation
- `workspaces` - Team workspaces within tenants
- `roles` & `user_roles` - RBAC system

#### Conversation System
- `conversations` - Chat conversations
- `messages` - Individual messages
- `conversation_memory` - Context storage with vector embeddings
- `message_attachments` - File attachments

#### Artifact System
- `artifacts` - Versioned artifacts with metadata
- `artifact_collections` - Grouped artifacts
- `artifact_comments` - Collaboration features
- `artifact_relationships` - Inter-artifact dependencies

#### Tool System
- `tools` - Tool registry with JSON schemas
- `tool_executions` - Execution history and results
- `tool_permissions` - Access control
- `tool_usage_limits` - Rate limiting

#### Billing System
- `subscription_plans` - Available plans
- `subscriptions` - Active subscriptions
- `invoices` & `invoice_line_items` - Billing records
- `payment_methods` & `payment_transactions` - Payment processing

## Utilities

### Connection Management
```typescript
import { getPrismaClient, getPgPool, withTenantContext } from '@penny/database/utils/connection';

// Prisma client (recommended)
const prisma = getPrismaClient();

// Raw PostgreSQL for complex queries
const pool = getPgPool();

// Tenant-scoped operations
await withTenantContext('tenant-id', async (prisma) => {
  // All queries here are tenant-scoped
  const users = await prisma.user.findMany();
});
```

### Backup and Restore
```typescript
import { createBackup, restoreBackup, listBackups } from '@penny/database/utils/backup';

// Create backup
const backup = await createBackup({
  compress: true,
  includeData: true
});

// Restore backup
await restoreBackup({
  backupPath: './backups/backup-2024-01-01.sql.gz'
});

// List available backups
const backups = await listBackups();
```

### Data Cleanup
```typescript
import { cleanupExpiredData, cleanupOrphanedRecords } from '@penny/database/utils/cleanup';

// Clean expired data
const results = await cleanupExpiredData({
  olderThanDays: 30,
  dryRun: false
});

// Clean orphaned records
await cleanupOrphanedRecords();
```

### Validation
```typescript
import { validateDatabase, validateTenantData } from '@penny/database/utils/validator';

// Full database validation
const validation = await validateDatabase();

// Tenant-specific validation
const tenantValidation = await validateTenantData('tenant-id');
```

## Advanced Features

### Vector Embeddings
- pgvector extension for similarity search
- Conversation memory with embeddings
- Document search capabilities

### Row Level Security (RLS)
- Automatic tenant isolation
- Policy-based access control
- Secure multi-tenancy

### Performance Optimization
- Composite indexes for common queries
- Materialized views for analytics
- Connection pooling
- Query optimization

### Monitoring and Analytics
- System health checks
- Performance metrics
- Audit logging
- Error tracking

## Development

### Adding Migrations
1. Create new migration file: `XXX_description.sql`
2. Use sequential numbering (e.g., `011_new_feature.sql`)
3. Include both UP and rollback considerations
4. Test with dry-run first

### Adding Seeders
1. Create new seeder: `XXX_seeder_name.ts`
2. Export function with naming convention: `seedSeederName`
3. Make idempotent (can run multiple times)
4. Mark as production-safe or dev-only

### Best Practices
- Always backup before major changes
- Test migrations in development first
- Use transactions for data consistency
- Monitor performance impact
- Validate data integrity regularly

## Troubleshooting

### Common Issues

#### Migration Failures
```bash
# Check migration status
npm run migrate:status

# Rollback failed migration
npm run migrate:down

# Force apply (if checksum mismatch)
npm run migrate:up -- --force
```

#### Connection Issues
```bash
# Check database health
npm run db:health

# Verify connection settings
echo $DATABASE_URL
```

#### Data Integrity Issues
```bash
# Validate database
npm run db:validate

# Clean up orphaned records
npm run db:cleanup
```

## Security Considerations

- All migrations use RLS for tenant isolation
- Passwords are hashed with bcrypt
- API keys are hashed before storage
- Audit logging for all data changes
- Encrypted backup support

## Performance Notes

- Indexes optimized for common query patterns
- Materialized views for heavy analytics
- Connection pooling configured
- Query performance monitoring
- Regular VACUUM and ANALYZE operations

## License

This database system is part of the PENNY platform and follows the project's licensing terms.