import { EventEmitter } from 'events';
import { MetricsCollector } from './metrics';
import { LoggingService } from './logs';
import { AlertingService } from './alerts';
import { TracingService } from './traces';
import { HealthCheckService } from './health';

export interface MonitoringServiceConfig {
  metrics: MetricsCollector;
  logging: LoggingService;
  alerting: AlertingService;
  tracing: TracingService;
  health: HealthCheckService;
}

export class MonitoringService extends EventEmitter {
  private config: MonitoringServiceConfig;
  private metrics: MetricsCollector;
  private logging: LoggingService;
  private alerting: AlertingService;
  private tracing: TracingService;
  private health: HealthCheckService;
  private monitoringInterval?: NodeJS.Timeout;
  private running = false;

  constructor(config: MonitoringServiceConfig) {
    super();
    this.config = config;
    this.metrics = config.metrics;
    this.logging = config.logging;
    this.alerting = config.alerting;
    this.tracing = config.tracing;
    this.health = config.health;

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Health check alerts
    this.health.on('healthCheck', (healthCheck) => {
      if (healthCheck.status === 'unhealthy' && healthCheck.metadata?.critical) {
        this.alerting.sendAlert({
          name: `Health Check Failed: ${healthCheck.name}`,
          severity: 'critical',
          message: healthCheck.message || 'Critical health check failed',
          metadata: { healthCheck }
        });
      }
    });

    // Metrics-based alerts
    this.metrics.on('started', () => {
      this.logging.info('Metrics collection started');
    });

    // Log-based alerts
    this.logging.on('log', (entry) => {
      if (entry.level === 'error') {
        this.metrics.recordError('application', entry.service || 'unknown', 'high');
        
        // Send alert for critical errors
        if (entry.metadata?.critical) {
          this.alerting.sendAlert({
            name: 'Critical Application Error',
            severity: 'critical',
            message: entry.message,
            metadata: { logEntry: entry }
          });
        }
      }
    });

    // Tracing-based monitoring
    this.tracing.on('trace', (trace) => {
      // Alert on slow requests
      if (trace.duration > 5000) { // 5 seconds
        this.alerting.sendAlert({
          name: 'Slow Request Detected',
          severity: 'medium',
          message: `Request took ${trace.duration}ms: ${trace.endpoint}`,
          metadata: { trace }
        });
      }

      // Alert on high error rates
      if (trace.error && trace.statusCode >= 500) {
        this.metrics.recordError('http', 'api-service', 'high');
      }
    });
  }

  async start(): Promise<void> {
    if (this.running) return;

    this.running = true;

    // Start periodic system monitoring
    this.startSystemMonitoring();

    this.logging.info('Monitoring service started', {
      components: ['metrics', 'logging', 'alerting', 'tracing', 'health']
    });

    this.emit('started');
  }

  async stop(): Promise<void> {
    if (!this.running) return;

    this.running = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    this.logging.info('Monitoring service stopped');
    this.emit('stopped');
  }

  private startSystemMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performSystemChecks();
      } catch (error: any) {
        this.logging.error('System monitoring failed', { error: error.message });
      }
    }, 60000); // Check every minute
  }

  private async performSystemChecks(): Promise<void> {
    try {
      // Get system metrics
      const systemMetrics = await this.metrics.getSystemMetrics();

      // Check thresholds and send alerts
      await this.checkSystemThresholds(systemMetrics);

      // Get health status
      const overallHealth = this.health.getOverallHealth();

      // Record health metrics
      this.metrics.setActiveUsers(overallHealth.summary.healthy, 'daily');

      // Check for degraded services
      if (overallHealth.status === 'degraded') {
        await this.alerting.sendAlert({
          name: 'System Degraded',
          severity: 'medium',
          message: `${overallHealth.summary.degraded} services are degraded`,
          metadata: { health: overallHealth.summary }
        });
      }

      // Get performance stats
      const perfStats = this.tracing.getPerformanceStats();
      
      // Alert on high error rates
      if (perfStats.errorRate > 5) {
        await this.alerting.sendSystemAlert('network', perfStats.errorRate, 5);
      }

      // Alert on slow response times
      if (perfStats.p95ResponseTime > 2000) {
        await this.alerting.sendAlert({
          name: 'High Response Times',
          severity: 'medium',
          message: `P95 response time is ${perfStats.p95ResponseTime}ms`,
          metadata: { performanceStats: perfStats }
        });
      }

    } catch (error: any) {
      this.logging.error('System checks failed', { error: error.message });
    }
  }

  private async checkSystemThresholds(metrics: any): Promise<void> {
    // CPU threshold check
    if (metrics.cpu.usage > 90) {
      await this.alerting.sendSystemAlert('cpu', metrics.cpu.usage, 90);
    }

    // Memory threshold check
    if (metrics.memory.percentage > 95) {
      await this.alerting.sendSystemAlert('memory', metrics.memory.percentage, 95);
    }

    // Disk threshold check
    if (metrics.disk.percentage > 95) {
      await this.alerting.sendSystemAlert('disk', metrics.disk.percentage, 95);
    }
  }

  // Express middleware for monitoring HTTP requests
  createHttpMonitoringMiddleware() {
    return (req: any, res: any, next: any) => {
      const startTime = Date.now();
      
      // Start tracing
      const span = this.tracing.traceHttpRequest(req, res);
      
      // Increment active requests
      this.metrics.recordApiCall(req.path, req.tenantId, req.userId);

      // Track response
      const originalSend = res.send;
      res.send = function(body: any) {
        const duration = Date.now() - startTime;
        
        // Record metrics
        this.metrics.recordHttpRequest(
          req.method,
          req.route?.path || req.path,
          res.statusCode,
          duration,
          req.tenantId
        );

        // Log request
        this.logging.logHttpRequest(req, res, duration);

        // Record error if applicable
        if (res.statusCode >= 400) {
          this.metrics.recordError('http', 'api-service', res.statusCode >= 500 ? 'high' : 'medium');
        }

        return originalSend.call(this, body);
      }.bind(this);

      next();
    };
  }

  // Error handling middleware
  createErrorMonitoringMiddleware() {
    return (error: Error, req: any, res: any, next: any) => {
      // Log error
      this.logging.logError(error, {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        tenantId: req.tenantId,
        userId: req.userId
      });

      // Record error metric
      this.metrics.recordError('application', 'api-service', 'high');

      // Record trace exception
      this.tracing.recordException(error);

      // Send alert for critical errors
      if (error.name === 'ValidationError' || error.message.includes('CRITICAL')) {
        this.alerting.sendApplicationAlert('api-service', error, {
          method: req.method,
          url: req.url,
          tenantId: req.tenantId
        });
      }

      next(error);
    };
  }

  // Business logic monitoring
  async monitorBusinessOperation(operation: string, fn: () => Promise<any>, metadata?: Record<string, any>): Promise<any> {
    const startTime = Date.now();
    
    return await this.tracing.traceFunction(
      `business.${operation}`,
      async (span) => {
        try {
          const result = await fn();
          const duration = Date.now() - startTime;

          // Log successful operation
          this.logging.logBusinessEvent(operation, {
            duration,
            success: true,
            ...metadata
          });

          // Record metrics
          this.metrics.recordBackgroundJob(operation, 'success');

          return result;
        } catch (error: any) {
          const duration = Date.now() - startTime;

          // Log failed operation
          this.logging.logBusinessEvent(operation, {
            duration,
            success: false,
            error: error.message,
            ...metadata
          });

          // Record metrics
          this.metrics.recordBackgroundJob(operation, 'failure');

          // Send alert for business operation failures
          await this.alerting.sendBusinessAlert(operation, 0, 1, {
            error: error.message,
            duration,
            ...metadata
          });

          throw error;
        }
      },
      { attributes: metadata }
    );
  }

  // Database operation monitoring
  async monitorDatabaseOperation(operation: string, query: string, fn: () => Promise<any>): Promise<any> {
    const startTime = Date.now();
    
    return await this.tracing.traceFunction(
      `db.${operation}`,
      async (span) => {
        try {
          const result = await fn();
          const duration = Date.now() - startTime;

          // Log successful query
          this.logging.logDatabaseQuery(query, duration, true);

          // Record performance metric
          this.logging.logPerformanceMetric('db_query_duration', duration, 'ms', {
            operation,
            query: query.substring(0, 100)
          });

          return result;
        } catch (error: any) {
          const duration = Date.now() - startTime;

          // Log failed query
          this.logging.logDatabaseQuery(query, duration, false, {
            error: error.message
          });

          // Send alert for database failures
          await this.alerting.sendAlert({
            name: 'Database Query Failed',
            severity: 'high',
            message: `Database ${operation} failed: ${error.message}`,
            metadata: { operation, query: query.substring(0, 200), duration }
          });

          throw error;
        }
      },
      {
        attributes: {
          'db.operation': operation,
          'db.statement': query.substring(0, 500)
        }
      }
    );
  }

  // AI model monitoring
  async monitorAIModelCall(
    provider: string, 
    model: string, 
    tokens: { input: number; output: number }, 
    fn: () => Promise<any>
  ): Promise<any> {
    const startTime = Date.now();
    
    return await this.tracing.traceFunction(
      `ai.${provider}.${model}`,
      async (span) => {
        try {
          const result = await fn();
          const duration = Date.now() - startTime;

          // Log AI call
          this.logging.logAIModelCall(model, provider, tokens, duration);

          // Record metrics
          this.metrics.recordTokenUsage(model, provider, 'input', tokens.input, 'default');
          this.metrics.recordTokenUsage(model, provider, 'output', tokens.output, 'default');

          return result;
        } catch (error: any) {
          const duration = Date.now() - startTime;

          // Log failed AI call
          this.logging.error('AI model call failed', {
            provider,
            model,
            tokens,
            duration,
            error: error.message
          });

          // Send alert for AI failures
          await this.alerting.sendAlert({
            name: 'AI Model Call Failed',
            severity: 'high',
            message: `${provider}/${model} call failed: ${error.message}`,
            metadata: { provider, model, tokens, duration }
          });

          throw error;
        }
      },
      {
        attributes: {
          'ai.provider': provider,
          'ai.model': model,
          'ai.tokens.input': tokens.input,
          'ai.tokens.output': tokens.output
        }
      }
    );
  }

  // Tool execution monitoring
  async monitorToolExecution(
    toolName: string,
    parameters: Record<string, any>,
    tenantId: string,
    fn: () => Promise<any>
  ): Promise<any> {
    const startTime = Date.now();
    
    return await this.tracing.traceFunction(
      `tool.${toolName}`,
      async (span) => {
        try {
          const result = await fn();
          const duration = Date.now() - startTime;

          // Log successful execution
          this.logging.logToolExecution(toolName, duration, true, {
            parameters,
            tenantId,
            result: typeof result === 'object' ? '[object]' : result
          });

          // Record metrics
          this.metrics.recordToolExecution(toolName, 'success', tenantId);

          return result;
        } catch (error: any) {
          const duration = Date.now() - startTime;

          // Log failed execution
          this.logging.logToolExecution(toolName, duration, false, {
            parameters,
            tenantId,
            error: error.message
          });

          // Record metrics
          this.metrics.recordToolExecution(toolName, 'failure', tenantId);

          // Send alert for tool failures (if critical)
          if (error.message.includes('CRITICAL') || duration > 30000) {
            await this.alerting.sendAlert({
              name: `Tool Execution Failed: ${toolName}`,
              severity: 'medium',
              message: `Tool ${toolName} failed: ${error.message}`,
              metadata: { toolName, parameters, tenantId, duration }
            });
          }

          throw error;
        }
      },
      {
        attributes: {
          'tool.name': toolName,
          'tool.parameters': JSON.stringify(parameters),
          'tenant.id': tenantId
        }
      }
    );
  }

  // Get monitoring dashboard data
  async getDashboardData(): Promise<{
    systemHealth: any;
    performanceStats: any;
    errorRates: any;
    businessMetrics: any;
  }> {
    const [systemHealth, perfStats, alertStats] = await Promise.all([
      this.health.getOverallHealth(),
      this.tracing.getPerformanceStats(),
      this.alerting.getAlertStats()
    ]);

    return {
      systemHealth,
      performanceStats: perfStats,
      errorRates: {
        total: alertStats.total,
        critical: alertStats.bySeverity.critical || 0,
        high: alertStats.bySeverity.high || 0,
        unresolved: alertStats.unresolved
      },
      businessMetrics: {
        // These would come from your business metrics
        activeUsers: Math.floor(Math.random() * 1000),
        apiCalls: Math.floor(Math.random() * 10000),
        revenue: Math.random() * 100000
      }
    };
  }

  // Export monitoring data
  exportMonitoringData(format: 'json' | 'csv' = 'json'): any {
    const data = {
      timestamp: new Date().toISOString(),
      systemHealth: this.health.getOverallHealth(),
      performanceStats: this.tracing.getPerformanceStats(),
      alertStats: this.alerting.getAlertStats(),
      logs: this.logging.getLogs({ limit: 1000 }),
      traces: this.tracing.exportTraces('json')
    };

    if (format === 'json') {
      return data;
    }

    // Convert to CSV format (simplified)
    return this.convertToCSV(data);
  }

  private convertToCSV(data: any): string {
    // Simplified CSV conversion
    const rows = [
      ['timestamp', 'metric', 'value'],
      [data.timestamp, 'system_health_status', data.systemHealth.status],
      [data.timestamp, 'total_requests', data.performanceStats.totalRequests],
      [data.timestamp, 'error_rate', data.performanceStats.errorRate],
      [data.timestamp, 'avg_response_time', data.performanceStats.averageResponseTime]
    ];

    return rows.map(row => row.join(',')).join('
');
  }

  // Cleanup old data
  async cleanupOldData(retentionDays: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    this.logging.info('Starting monitoring data cleanup', {
      retentionDays,
      cutoffDate: cutoffDate.toISOString()
    });

    // This would integrate with your data storage to clean up old:
    // - Traces
    // - Logs
    // - Metrics
    // - Alerts

    this.emit('cleanupCompleted', { retentionDays, cutoffDate });
  }
}