import { EventEmitter } from 'events';
import { HealthCheck, SystemMetrics } from './types';

export interface HealthCheckConfig {
  checkInterval?: number;
  timeout?: number;
  retries?: number;
  checks: Array<{
    name: string;
    type: 'http' | 'database' | 'redis' | 'custom' | 'dependency';
    config: any;
    critical?: boolean;
    enabled?: boolean;
  }>;
}

export interface CustomHealthCheck {
  name: string;
  check: () => Promise<{ status: 'healthy' | 'unhealthy' | 'degraded'; message?: string; metadata?: any }>;
}

export class HealthCheckService extends EventEmitter {
  private config: HealthCheckConfig;
  private checkInterval?: NodeJS.Timeout;
  private healthChecks: Map<string, HealthCheck> = new Map();
  private customChecks: Map<string, CustomHealthCheck> = new Map();
  private running = false;

  constructor(config: HealthCheckConfig) {
    super();
    this.config = {
      checkInterval: 30000, // 30 seconds
      timeout: 5000, // 5 seconds
      retries: 3,
      ...config
    };
  }

  async start(): Promise<void> {
    if (this.running) return;

    this.running = true;
    
    // Run initial checks
    await this.runAllChecks();
    
    // Start periodic checks
    this.checkInterval = setInterval(async () => {
      try {
        await this.runAllChecks();
      } catch (error) {
        this.emit('error', error);
      }
    }, this.config.checkInterval);

    this.emit('started');
  }

  async stop(): Promise<void> {
    if (!this.running) return;

    this.running = false;
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }

    this.emit('stopped');
  }

  private async runAllChecks(): Promise<void> {
    const promises = this.config.checks.map(checkConfig => 
      this.runHealthCheck(checkConfig)
    );

    // Add custom checks
    for (const [name, customCheck] of this.customChecks) {
      promises.push(this.runCustomCheck(name, customCheck));
    }

    await Promise.allSettled(promises);
    this.emit('checksCompleted', this.getOverallHealth());
  }

  private async runHealthCheck(checkConfig: any): Promise<void> {
    if (checkConfig.enabled === false) return;

    const startTime = Date.now();
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < (this.config.retries || 3)) {
      try {
        attempt++;
        const result = await this.executeHealthCheck(checkConfig);
        const responseTime = Date.now() - startTime;

        const healthCheck: HealthCheck = {
          name: checkConfig.name,
          status: result.status,
          lastCheck: new Date(),
          responseTime,
          message: result.message,
          metadata: {
            ...result.metadata,
            attempt,
            type: checkConfig.type,
            critical: checkConfig.critical
          }
        };

        this.healthChecks.set(checkConfig.name, healthCheck);
        this.emit('healthCheck', healthCheck);
        return;

      } catch (error: any) {
        lastError = error;
        if (attempt < (this.config.retries || 3)) {
          await this.sleep(1000 * attempt); // Exponential backoff
        }
      }
    }

    // All attempts failed
    const responseTime = Date.now() - startTime;
    const healthCheck: HealthCheck = {
      name: checkConfig.name,
      status: 'unhealthy',
      lastCheck: new Date(),
      responseTime,
      message: lastError?.message || 'Health check failed',
      metadata: {
        error: lastError?.name,
        attempts: attempt,
        type: checkConfig.type,
        critical: checkConfig.critical
      }
    };

    this.healthChecks.set(checkConfig.name, healthCheck);
    this.emit('healthCheck', healthCheck);
  }

  private async executeHealthCheck(checkConfig: any): Promise<{
    status: 'healthy' | 'unhealthy' | 'degraded';
    message?: string;
    metadata?: any;
  }> {
    switch (checkConfig.type) {
      case 'http':
        return await this.httpHealthCheck(checkConfig.config);
      case 'database':
        return await this.databaseHealthCheck(checkConfig.config);
      case 'redis':
        return await this.redisHealthCheck(checkConfig.config);
      case 'dependency':
        return await this.dependencyHealthCheck(checkConfig.config);
      default:
        throw new Error(`Unknown health check type: ${checkConfig.type}`);
    }
  }

  private async httpHealthCheck(config: {
    url: string;
    method?: string;
    expectedStatus?: number;
    timeout?: number;
    headers?: Record<string, string>;
  }): Promise<{ status: 'healthy' | 'unhealthy' | 'degraded'; message?: string; metadata?: any }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeout || this.config.timeout);

    try {
      const response = await fetch(config.url, {
        method: config.method || 'GET',
        headers: config.headers,
        signal: controller.signal
      });

      clearTimeout(timeout);

      const expectedStatus = config.expectedStatus || 200;
      const isHealthy = response.status === expectedStatus;

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        message: isHealthy ? 'HTTP endpoint is healthy' : `HTTP ${response.status} != ${expectedStatus}`,
        metadata: {
          statusCode: response.status,
          statusText: response.statusText,
          responseTime: Date.now()
        }
      };
    } catch (error: any) {
      clearTimeout(timeout);
      return {
        status: 'unhealthy',
        message: `HTTP check failed: ${error.message}`,
        metadata: { error: error.name }
      };
    }
  }

  private async databaseHealthCheck(config: {
    connectionString?: string;
    query?: string;
    timeout?: number;
  }): Promise<{ status: 'healthy' | 'unhealthy' | 'degraded'; message?: string; metadata?: any }> {
    try {
      // This is a simplified example - in practice, you'd use your actual database client
      // const client = new Pool({ connectionString: config.connectionString });
      // const result = await client.query(config.query || 'SELECT 1');
      // client.end();

      // Simulated database check
      const query = config.query || 'SELECT 1';
      const startTime = Date.now();
      
      // Simulate database query
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
      
      const responseTime = Date.now() - startTime;

      return {
        status: responseTime < 1000 ? 'healthy' : 'degraded',
        message: responseTime < 1000 ? 'Database is healthy' : 'Database response is slow',
        metadata: {
          query,
          responseTime,
          connectionString: config.connectionString ? '[REDACTED]' : undefined
        }
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        message: `Database check failed: ${error.message}`,
        metadata: { error: error.name }
      };
    }
  }

  private async redisHealthCheck(config: {
    host?: string;
    port?: number;
    timeout?: number;
  }): Promise<{ status: 'healthy' | 'unhealthy' | 'degraded'; message?: string; metadata?: any }> {
    try {
      // This is a simplified example - in practice, you'd use your actual Redis client
      // const Redis = require('ioredis');
      // const redis = new Redis({ host: config.host, port: config.port });
      // const result = await redis.ping();
      // redis.disconnect();

      // Simulated Redis check
      const startTime = Date.now();
      await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
      const responseTime = Date.now() - startTime;

      return {
        status: responseTime < 100 ? 'healthy' : 'degraded',
        message: responseTime < 100 ? 'Redis is healthy' : 'Redis response is slow',
        metadata: {
          host: config.host,
          port: config.port,
          responseTime
        }
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        message: `Redis check failed: ${error.message}`,
        metadata: { error: error.name }
      };
    }
  }

  private async dependencyHealthCheck(config: {
    service: string;
    url: string;
    timeout?: number;
  }): Promise<{ status: 'healthy' | 'unhealthy' | 'degraded'; message?: string; metadata?: any }> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeout || this.config.timeout);

      const response = await fetch(config.url, {
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (response.ok) {
        return {
          status: 'healthy',
          message: `Dependency ${config.service} is healthy`,
          metadata: { service: config.service, statusCode: response.status }
        };
      } else {
        return {
          status: 'degraded',
          message: `Dependency ${config.service} returned ${response.status}`,
          metadata: { service: config.service, statusCode: response.status }
        };
      }
    } catch (error: any) {
      return {
        status: 'unhealthy',
        message: `Dependency ${config.service} is unreachable: ${error.message}`,
        metadata: { service: config.service, error: error.name }
      };
    }
  }

  private async runCustomCheck(name: string, customCheck: CustomHealthCheck): Promise<void> {
    const startTime = Date.now();
    
    try {
      const result = await Promise.race([
        customCheck.check(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), this.config.timeout)
        )
      ]) as { status: 'healthy' | 'unhealthy' | 'degraded'; message?: string; metadata?: any };

      const responseTime = Date.now() - startTime;

      const healthCheck: HealthCheck = {
        name,
        status: result.status,
        lastCheck: new Date(),
        responseTime,
        message: result.message,
        metadata: {
          ...result.metadata,
          type: 'custom'
        }
      };

      this.healthChecks.set(name, healthCheck);
      this.emit('healthCheck', healthCheck);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      const healthCheck: HealthCheck = {
        name,
        status: 'unhealthy',
        lastCheck: new Date(),
        responseTime,
        message: error.message,
        metadata: {
          error: error.name,
          type: 'custom'
        }
      };

      this.healthChecks.set(name, healthCheck);
      this.emit('healthCheck', healthCheck);
    }
  }

  // Public methods
  addCustomCheck(customCheck: CustomHealthCheck): void {
    this.customChecks.set(customCheck.name, customCheck);
  }

  removeCustomCheck(name: string): boolean {
    return this.customChecks.delete(name);
  }

  async runCheck(name: string): Promise<HealthCheck | null> {
    const checkConfig = this.config.checks.find(c => c.name === name);
    if (checkConfig) {
      await this.runHealthCheck(checkConfig);
      return this.healthChecks.get(name) || null;
    }

    const customCheck = this.customChecks.get(name);
    if (customCheck) {
      await this.runCustomCheck(name, customCheck);
      return this.healthChecks.get(name) || null;
    }

    return null;
  }

  getHealthCheck(name: string): HealthCheck | null {
    return this.healthChecks.get(name) || null;
  }

  getAllHealthChecks(): HealthCheck[] {
    return Array.from(this.healthChecks.values());
  }

  getOverallHealth(): {
    status: 'healthy' | 'unhealthy' | 'degraded';
    checks: HealthCheck[];
    summary: {
      total: number;
      healthy: number;
      unhealthy: number;
      degraded: number;
      critical: number;
    };
  } {
    const checks = this.getAllHealthChecks();
    let healthy = 0;
    let unhealthy = 0;
    let degraded = 0;
    let critical = 0;

    for (const check of checks) {
      switch (check.status) {
        case 'healthy':
          healthy++;
          break;
        case 'unhealthy':
          unhealthy++;
          if (check.metadata?.critical) {
            critical++;
          }
          break;
        case 'degraded':
          degraded++;
          break;
      }
    }

    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    
    if (critical > 0 || unhealthy > 0) {
      overallStatus = 'unhealthy';
    } else if (degraded > 0) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      checks,
      summary: {
        total: checks.length,
        healthy,
        unhealthy,
        degraded,
        critical
      }
    };
  }

  // System health checks
  async getSystemHealth(): Promise<{
    cpu: { status: 'healthy' | 'unhealthy' | 'degraded'; usage: number };
    memory: { status: 'healthy' | 'unhealthy' | 'degraded'; usage: number; available: number };
    disk: { status: 'healthy' | 'unhealthy' | 'degraded'; usage: number };
    uptime: number;
  }> {
    const si = require('systeminformation');
    
    const [cpuLoad, memory, diskLayout] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize()
    ]);

    const cpuUsage = cpuLoad.currentLoad;
    const memoryUsage = (memory.used / memory.total) * 100;
    const diskUsage = diskLayout.reduce((total: number, disk: any) => 
      total + ((disk.used / disk.size) * 100), 0) / diskLayout.length;

    return {
      cpu: {
        status: cpuUsage > 90 ? 'unhealthy' : cpuUsage > 70 ? 'degraded' : 'healthy',
        usage: cpuUsage
      },
      memory: {
        status: memoryUsage > 95 ? 'unhealthy' : memoryUsage > 80 ? 'degraded' : 'healthy',
        usage: memoryUsage,
        available: memory.available
      },
      disk: {
        status: diskUsage > 95 ? 'unhealthy' : diskUsage > 85 ? 'degraded' : 'healthy',
        usage: diskUsage
      },
      uptime: process.uptime()
    };
  }

  // Health check endpoints for external monitoring
  getHealthEndpoint(): any {
    return async (req: any, res: any) => {
      const health = this.getOverallHealth();
      const statusCode = health.status === 'healthy' ? 200 : 
                         health.status === 'degraded' ? 200 : 503;

      res.status(statusCode).json({
        status: health.status,
        timestamp: new Date().toISOString(),
        service: 'penny-platform',
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        checks: health.checks.map(check => ({
          name: check.name,
          status: check.status,
          message: check.message,
          lastCheck: check.lastCheck,
          responseTime: check.responseTime
        })),
        summary: health.summary
      });
    };
  }

  getReadinessEndpoint(): any {
    return async (req: any, res: any) => {
      const health = this.getOverallHealth();
      const critical = health.checks.filter(c => c.metadata?.critical && c.status === 'unhealthy');

      if (critical.length > 0) {
        res.status(503).json({
          status: 'not_ready',
          message: 'Critical health checks failing',
          failedChecks: critical.map(c => c.name)
        });
      } else {
        res.status(200).json({
          status: 'ready',
          message: 'Service is ready to serve traffic'
        });
      }
    };
  }

  getLivenessEndpoint(): any {
    return async (req: any, res: any) => {
      // Simple liveness check - just verify the service is running
      res.status(200).json({
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Metrics integration
  getHealthMetrics(): Record<string, number> {
    const health = this.getOverallHealth();
    const metrics: Record<string, number> = {
      health_checks_total: health.summary.total,
      health_checks_healthy: health.summary.healthy,
      health_checks_unhealthy: health.summary.unhealthy,
      health_checks_degraded: health.summary.degraded,
      health_checks_critical: health.summary.critical
    };

    // Individual check metrics
    for (const check of health.checks) {
      const metricName = `health_check_${check.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      metrics[metricName] = check.status === 'healthy' ? 1 : 0;
      metrics[`${metricName}_response_time`] = check.responseTime;
    }

    return metrics;
  }
}