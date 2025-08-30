import { Request, Response, NextFunction } from 'fastify';
import { pennyMonitoring } from '@penny/monitoring';
import { performance } from 'perf_hooks';

// Extend the Request type to include monitoring properties
declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number;
    monitoringContext?: {
      traceId?: string;
      spanId?: string;
      tenantId?: string;
      userId?: string;
    };
  }
}

export interface MonitoringConfig {
  enableMetrics?: boolean;
  enableTracing?: boolean;
  enableLogging?: boolean;
  enableAlerting?: boolean;
  excludePaths?: string[];
  slowRequestThreshold?: number;
  errorAlertThreshold?: number;
}

/**
 * HTTP Request Monitoring Middleware
 */
export const createHttpMonitoringMiddleware = (config: MonitoringConfig = {}) => {
  const {
    enableMetrics = true,
    enableTracing = true,
    enableLogging = true,
    enableAlerting = true,\n    excludePaths = ['/health', '/metrics', '/ping'],
    slowRequestThreshold = 1000, // 1 second
    errorAlertThreshold = 100 // Alert after 100 errors
  } = config;

  const monitoring = pennyMonitoring.getMonitoring();
  const metrics = pennyMonitoring.getMetrics();
  const logging = pennyMonitoring.getLogging();
  const tracing = pennyMonitoring.getTracing();
  const alerting = pennyMonitoring.getAlerting();

  return async (request: any, reply: any, next: NextFunction) => {
    const startTime = performance.now();
    const path = request.url.split('?')[0];
    
    // Skip monitoring for excluded paths
    if (excludePaths.includes(path)) {
      return next();
    }

    // Set monitoring context
    request.startTime = startTime;
    request.monitoringContext = {
      tenantId: request.headers['x-tenant-id'] || request.query?.tenantId,
      userId: request.user?.id || request.headers['x-user-id']
    };

    // Start tracing span if enabled
    let span: any = null;
    if (enableTracing) {
      span = tracing.traceHttpRequest(request, reply);
      if (span) {
        const spanContext = span.spanContext();
        request.monitoringContext.traceId = spanContext.traceId;
        request.monitoringContext.spanId = spanContext.spanId;
      }
    }

    // Increment active requests metric
    if (enableMetrics) {
      metrics.recordApiCall(
        path,
        request.monitoringContext.tenantId || 'unknown',
        request.monitoringContext.userId
      );
    }

    // Handle response completion
    const onResponse = () => {
      const duration = performance.now() - startTime;
      const statusCode = reply.statusCode || 200;
      
      try {
        // Record metrics
        if (enableMetrics) {
          metrics.recordHttpRequest(
            request.method,
            path,
            statusCode,
            duration,
            request.monitoringContext?.tenantId
          );

          // Record error metrics
          if (statusCode >= 400) {
            const severity = statusCode >= 500 ? 'high' : 'medium';
            metrics.recordError('http', 'api-service', severity);
          }
        }

        // Log request
        if (enableLogging) {
          logging.logHttpRequest(request, reply, duration);
        }

        // Alert on slow requests
        if (enableAlerting && duration > slowRequestThreshold) {
          alerting.sendAlert({
            name: 'Slow HTTP Request',
            severity: duration > slowRequestThreshold * 2 ? 'high' : 'medium',
            message: `Request to ${path} took ${duration.toFixed(2)}ms`,
            metadata: {
              method: request.method,
              path,
              duration,
              statusCode,
              tenantId: request.monitoringContext?.tenantId,
              userId: request.monitoringContext?.userId
            }
          });
        }
      } catch (error) {
        logging.error('Monitoring middleware error', { error: error.message });
      }
    };

    // Attach response handler
    reply.raw.on('finish', onResponse);

    next();
  };
};

/**
 * Error Monitoring Middleware
 */
export const createErrorMonitoringMiddleware = (config: MonitoringConfig = {}) => {
  const {
    enableLogging = true,
    enableMetrics = true,
    enableAlerting = true
  } = config;

  const monitoring = pennyMonitoring.getMonitoring();
  const metrics = pennyMonitoring.getMetrics();
  const logging = pennyMonitoring.getLogging();
  const tracing = pennyMonitoring.getTracing();
  const alerting = pennyMonitoring.getAlerting();

  return async (error: Error, request: any, reply: any, next: NextFunction) => {
    try {
      const context = {
        method: request.method,
        url: request.url,
        userAgent: request.headers['user-agent'],
        ip: request.ip,
        tenantId: request.monitoringContext?.tenantId,
        userId: request.monitoringContext?.userId,
        traceId: request.monitoringContext?.traceId,
        spanId: request.monitoringContext?.spanId
      };

      // Log error
      if (enableLogging) {
        logging.logError(error, context);
      }

      // Record error metrics
      if (enableMetrics) {
        const errorType = error.name || 'UnknownError';
        metrics.recordError('application', 'api-service', 'high');
      }

      // Record tracing exception
      tracing.recordException(error);

      // Send alert for critical errors
      if (enableAlerting) {
        const isCritical = error.message.includes('CRITICAL') || 
                          error.name === 'DatabaseError' ||
                          error.name === 'SecurityError';
        
        if (isCritical) {
          await alerting.sendApplicationAlert('api-service', error, context);
        }
      }
    } catch (monitoringError) {
      console.error('Error in error monitoring middleware:', monitoringError);
    }

    next(error);
  };
};

/**
 * Performance Monitoring Middleware
 */
export const createPerformanceMonitoringMiddleware = () => {
  const monitoring = pennyMonitoring.getMonitoring();
  const metrics = pennyMonitoring.getMetrics();
  const logging = pennyMonitoring.getLogging();

  return async (request: any, reply: any, next: NextFunction) => {
    const startMemory = process.memoryUsage();
    const startCpu = process.cpuUsage();
    
    const onResponse = () => {
      const endMemory = process.memoryUsage();
      const endCpu = process.cpuUsage(startCpu);
      const duration = performance.now() - request.startTime;
      
      // Log performance metrics
      logging.logPerformanceMetric('request_memory_delta', endMemory.heapUsed - startMemory.heapUsed, 'bytes', {
        method: request.method,\n        path: request.url.split('?')[0],
        duration
      });

      logging.logPerformanceMetric('request_cpu_time', endCpu.user + endCpu.system, 'microseconds', {
        method: request.method,\n        path: request.url.split('?')[0],
        duration
      });
    };

    reply.raw.on('finish', onResponse);
    next();
  };
};

/**
 * Database Query Monitoring Wrapper
 */
export const monitorDatabaseQuery = async <T>(
  operation: string,
  query: string,
  executor: () => Promise<T>
): Promise<T> => {
  const monitoring = pennyMonitoring.getMonitoring();
  return monitoring.monitorDatabaseOperation(operation, query, executor);
};

/**
 * AI Model Call Monitoring Wrapper
 */
export const monitorAIModelCall = async <T>(
  provider: string,
  model: string,
  tokens: { input: number; output: number },
  executor: () => Promise<T>
): Promise<T> => {
  const monitoring = pennyMonitoring.getMonitoring();
  return monitoring.monitorAIModelCall(provider, model, tokens, executor);
};

/**
 * Tool Execution Monitoring Wrapper
 */
export const monitorToolExecution = async <T>(
  toolName: string,
  parameters: Record<string, any>,
  tenantId: string,
  executor: () => Promise<T>
): Promise<T> => {
  const monitoring = pennyMonitoring.getMonitoring();
  return monitoring.monitorToolExecution(toolName, parameters, tenantId, executor);
};

/**
 * Business Operation Monitoring Wrapper
 */
export const monitorBusinessOperation = async <T>(
  operation: string,
  executor: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> => {
  const monitoring = pennyMonitoring.getMonitoring();
  return monitoring.monitorBusinessOperation(operation, executor, metadata);
};

/**
 * Rate Limiting with Monitoring
 */
export const createRateLimitingMiddleware = (options: {
  windowMs: number;
  max: number;
  keyGenerator?: (request: any) => string;
}) => {
  const { windowMs, max, keyGenerator = (req) => req.ip } = options;
  const requests = new Map<string, { count: number; resetTime: number }>();
  const metrics = pennyMonitoring.getMetrics();
  const alerting = pennyMonitoring.getAlerting();

  return async (request: any, reply: any, next: NextFunction) => {
    const key = keyGenerator(request);
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean up old entries
    for (const [k, v] of requests.entries()) {
      if (v.resetTime < now) {
        requests.delete(k);
      }
    }
    
    const current = requests.get(key) || { count: 0, resetTime: now + windowMs };
    
    if (current.count >= max) {
      // Rate limit exceeded
      metrics.recordError('rate_limit', 'api-service', 'medium');
      
      // Alert if too many rate limit violations
      if (current.count === max + 10) { // Alert after 10 additional attempts
        await alerting.sendSecurityAlert('Rate Limit Exceeded', {
          key,
          attempts: current.count,
          window: windowMs,
          ip: request.ip,
          userAgent: request.headers['user-agent']
        });
      }
      
      reply.status(429).send({
        error: 'Too Many Requests',
        retryAfter: Math.ceil((current.resetTime - now) / 1000)
      });
      return;
    }
    
    current.count++;
    requests.set(key, current);
    
    next();
  };
};

/**
 * Health Check Endpoint
 */
export const createHealthCheckEndpoint = () => {
  const health = pennyMonitoring.getHealth();
  
  return async (request: any, reply: any) => {
    const healthData = health.getOverallHealth();
    const systemHealth = await health.getSystemHealth();
    
    const status = healthData.status === 'healthy' ? 200 : 
                  healthData.status === 'degraded' ? 200 : 503;
    
    reply.status(status).send({
      status: healthData.status,
      timestamp: new Date().toISOString(),
      service: 'penny-api',\n      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      system: systemHealth,
      checks: healthData.checks.map(check => ({
        name: check.name,
        status: check.status,
        message: check.message,
        responseTime: check.responseTime
      })),
      summary: healthData.summary
    });
  };
};

/**
 * Metrics Endpoint
 */
export const createMetricsEndpoint = () => {
  const metrics = pennyMonitoring.getMetrics();
  
  return async (request: any, reply: any) => {
    const prometheusMetrics = await metrics.getMetrics();
    reply.header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    reply.send(prometheusMetrics);
  };
};

export {
  pennyMonitoring
};"