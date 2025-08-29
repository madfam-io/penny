import { PrismaClient } from '@prisma/client';
import { Pool, PoolConfig } from 'pg';

// Singleton pattern for Prisma client
let prismaClient: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prismaClient) {
    prismaClient = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn'] : ['warn', 'error'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    });

    // Graceful shutdown
    process.on('beforeExit', async () => {
      await prismaClient?.$disconnect();
    });

    process.on('SIGINT', async () => {
      await prismaClient?.$disconnect();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await prismaClient?.$disconnect();
      process.exit(0);
    });
  }

  return prismaClient;
}

// Raw PostgreSQL connection pool for direct SQL operations
let pgPool: Pool | null = null;

export function getPgPool(config?: PoolConfig): Pool {
  if (!pgPool) {
    const defaultConfig: PoolConfig = {
      connectionString: process.env.DATABASE_URL,
      min: 2,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ...config
    };

    pgPool = new Pool(defaultConfig);

    pgPool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });

    // Graceful shutdown
    process.on('beforeExit', async () => {
      await pgPool?.end();
    });
  }

  return pgPool;
}

// Connection health check
export async function checkDatabaseHealth(): Promise<{
  prisma: boolean;
  postgres: boolean;
  latency: number;
  details?: any;
}> {
  const startTime = Date.now();
  let prismaHealthy = false;
  let postgresHealthy = false;
  let details: any = {};

  try {
    // Check Prisma connection
    const prisma = getPrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    prismaHealthy = true;
  } catch (error) {
    details.prismaError = error instanceof Error ? error.message : 'Unknown error';
  }

  try {
    // Check raw PostgreSQL connection
    const pool = getPgPool();
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    postgresHealthy = true;
  } catch (error) {
    details.postgresError = error instanceof Error ? error.message : 'Unknown error';
  }

  const latency = Date.now() - startTime;

  return {
    prisma: prismaHealthy,
    postgres: postgresHealthy,
    latency,
    ...(Object.keys(details).length > 0 && { details })
  };
}

// Database connection info
export async function getDatabaseInfo(): Promise<{
  version: string;
  size: string;
  connections: number;
  maxConnections: number;
  uptime: string;
  extensions: string[];
}> {
  const pool = getPgPool();
  const client = await pool.connect();

  try {
    const queries = await Promise.all([
      // PostgreSQL version
      client.query('SELECT version()'),
      
      // Database size
      client.query(`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size
      `),
      
      // Connection info
      client.query(`
        SELECT 
          count(*) as current_connections,
          setting::integer as max_connections
        FROM pg_stat_activity, pg_settings 
        WHERE name = 'max_connections'
        GROUP BY setting
      `),
      
      // Uptime
      client.query(`
        SELECT date_trunc('second', now() - pg_postmaster_start_time()) as uptime
      `),
      
      // Installed extensions
      client.query(`
        SELECT extname 
        FROM pg_extension 
        ORDER BY extname
      `)
    ]);

    return {
      version: queries[0].rows[0].version,
      size: queries[1].rows[0].size,
      connections: queries[2].rows[0]?.current_connections || 0,
      maxConnections: queries[2].rows[0]?.max_connections || 0,
      uptime: queries[3].rows[0].uptime,
      extensions: queries[4].rows.map(row => row.extname)
    };
  } finally {
    client.release();
  }
}

// Execute raw SQL with proper error handling
export async function executeRawSQL(sql: string, params: any[] = []): Promise<any[]> {
  const pool = getPgPool();
  const client = await pool.connect();

  try {
    const result = await client.query(sql, params);
    return result.rows;
  } catch (error) {
    console.error('SQL execution error:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Transaction wrapper
export async function executeInTransaction<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  const pool = getPgPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Tenant-scoped connection (sets tenant context)
export async function withTenantContext<T>(
  tenantId: string,
  callback: (prisma: PrismaClient) => Promise<T>
): Promise<T> {
  const prisma = getPrismaClient();
  
  // Set tenant context for RLS
  await prisma.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
  
  try {
    return await callback(prisma);
  } finally {
    // Clear tenant context
    await prisma.$executeRaw`SELECT set_config('app.current_tenant_id', '', true)`;
  }
}

// Connection pool monitoring
export function getPoolStats(): {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
} {
  const pool = getPgPool();
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  };
}

// Graceful shutdown
export async function disconnectAll(): Promise<void> {
  const promises: Promise<any>[] = [];

  if (prismaClient) {
    promises.push(prismaClient.$disconnect());
  }

  if (pgPool) {
    promises.push(pgPool.end());
  }

  await Promise.all(promises);
  
  prismaClient = null;
  pgPool = null;
}