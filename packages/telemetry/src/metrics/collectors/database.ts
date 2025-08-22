import { getMetrics } from '../metrics.js';

export interface DatabaseMetricsOptions {
  client: 'prisma' | 'postgres' | 'mysql' | 'mongodb';
  includeOperation?: boolean;
  includeModel?: boolean;
}

export function createDatabaseMetricsCollector(options: DatabaseMetricsOptions) {
  const metrics = getMetrics();
  
  // Create metrics
  const queryDuration = metrics.histogram(
    'database_query_duration_milliseconds',
    'Duration of database queries in milliseconds',
    [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]
  );
  
  const queryCount = metrics.counter(
    'database_queries_total',
    'Total number of database queries'
  );
  
  const queryErrors = metrics.counter(
    'database_query_errors_total',
    'Total number of database query errors'
  );
  
  const connectionPool = metrics.gauge(
    'database_connection_pool_size',
    'Number of connections in the pool'
  );
  
  const activeConnections = metrics.gauge(
    'database_active_connections',
    'Number of active database connections'
  );

  return {
    recordQuery(operation: string, model: string, duration: number, error?: Error) {
      const tags: Record<string, string> = {
        client: options.client,
      };
      
      if (options.includeOperation) {
        tags.operation = operation;
      }
      
      if (options.includeModel) {
        tags.model = model;
      }
      
      // Record metrics
      queryDuration.observe(duration, { tags });
      queryCount.increment(1, { tags });
      
      if (error) {
        queryErrors.increment(1, { 
          tags: { 
            ...tags, 
            error_type: error.name,
          },
        });
      }
    },
    
    updateConnectionPool(size: number, active: number) {
      connectionPool.set(size, {
        tags: { client: options.client },
      });
      
      activeConnections.set(active, {
        tags: { client: options.client },
      });
    },
  };
}

// Prisma middleware for automatic metrics collection
export function createPrismaMetricsMiddleware() {
  const collector = createDatabaseMetricsCollector({
    client: 'prisma',
    includeOperation: true,
    includeModel: true,
  });

  return async (params: any, next: any) => {
    const start = Date.now();
    
    try {
      const result = await next(params);
      const duration = Date.now() - start;
      
      collector.recordQuery(
        params.action,
        params.model || 'unknown',
        duration
      );
      
      return result;
    } catch (error: any) {
      const duration = Date.now() - start;
      
      collector.recordQuery(
        params.action,
        params.model || 'unknown',
        duration,
        error
      );
      
      throw error;
    }
  };
}