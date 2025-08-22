import { PrismaClient } from '@prisma/client';

// Connection pool configuration
const connectionPoolConfig = {
  // Connection pool settings
  connection_limit: parseInt(process.env.DATABASE_POOL_LIMIT || '10'),
  
  // Prisma-specific settings via connection string
  // These will be appended to the DATABASE_URL
  pgbouncer: process.env.DATABASE_USE_PGBOUNCER === 'true',
  
  // Timeout settings
  connect_timeout: parseInt(process.env.DATABASE_CONNECT_TIMEOUT || '30'),
  pool_timeout: parseInt(process.env.DATABASE_POOL_TIMEOUT || '30'),
  statement_timeout: parseInt(process.env.DATABASE_STATEMENT_TIMEOUT || '30000'),
};

// Build connection URL with pool settings
export function buildDatabaseUrl(): string {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  
  const url = new URL(baseUrl);
  
  // Add connection pool parameters
  url.searchParams.set('connection_limit', connectionPoolConfig.connection_limit.toString());
  url.searchParams.set('connect_timeout', connectionPoolConfig.connect_timeout.toString());
  url.searchParams.set('pool_timeout', connectionPoolConfig.pool_timeout.toString());
  url.searchParams.set('statement_timeout', connectionPoolConfig.statement_timeout.toString());
  
  // PgBouncer compatibility mode
  if (connectionPoolConfig.pgbouncer) {
    url.searchParams.set('pgbouncer', 'true');
  }
  
  return url.toString();
}

// Prisma client configuration
export const prismaConfig = {
  datasources: {
    db: {
      url: buildDatabaseUrl(),
    },
  },
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'info', 'warn', 'error']
    : ['error'],
  errorFormat: process.env.NODE_ENV === 'development' ? 'pretty' : 'minimal',
};