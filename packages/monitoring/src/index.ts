import { MonitoringService } from './monitoring';
import { MetricsCollector } from './metrics';
import { LoggingService } from './logs';
import { AlertingService } from './alerts';
import { TracingService } from './traces';
import { HealthCheckService } from './health';
import { DashboardService } from './dashboards';

export * from './monitoring';
export * from './metrics';
export * from './logs';
export * from './alerts';
export * from './traces';
export * from './health';
export * from './dashboards';
export * from './types';

/**
 * Initialize and configure the complete monitoring stack
 */
export class PennyMonitoring {
  private monitoring: MonitoringService;
  private metrics: MetricsCollector;
  private logging: LoggingService;
  private alerting: AlertingService;
  private tracing: TracingService;
  private health: HealthCheckService;
  private dashboards: DashboardService;

  constructor(config?: {
    serviceName?: string;
    environment?: string;
    jaegerEndpoint?: string;
    prometheusPort?: number;
    logLevel?: string;
    alertChannels?: Array<{
      type: 'email' | 'slack' | 'webhook';
      config: any;
    }>;
  }) {
    const {
      serviceName = 'penny-platform',
      environment = process.env.NODE_ENV || 'development',
      jaegerEndpoint = process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
      prometheusPort = parseInt(process.env.PROMETHEUS_PORT || '9090'),
      logLevel = process.env.LOG_LEVEL || 'info',
      alertChannels = []
    } = config || {};

    // Initialize services
    this.tracing = new TracingService({
      serviceName,
      environment,
      jaegerEndpoint
    });

    this.metrics = new MetricsCollector({
      port: prometheusPort,
      prefix: 'penny_'
    });

    this.logging = new LoggingService({
      level: logLevel,
      serviceName,
      environment
    });

    this.alerting = new AlertingService({
      channels: alertChannels
    });

    this.health = new HealthCheckService({
      checkInterval: 30000 // 30 seconds
    });

    this.dashboards = new DashboardService({
      metricsCollector: this.metrics
    });

    this.monitoring = new MonitoringService({
      metrics: this.metrics,
      logging: this.logging,
      alerting: this.alerting,
      tracing: this.tracing,
      health: this.health
    });
  }

  /**
   * Start all monitoring services
   */
  async start(): Promise<void> {
    await this.tracing.start();
    await this.metrics.start();
    await this.logging.start();
    await this.alerting.start();
    await this.health.start();
    await this.dashboards.start();
    await this.monitoring.start();

    this.logging.info('PENNY monitoring stack started successfully', {
      services: ['tracing', 'metrics', 'logging', 'alerting', 'health', 'dashboards']
    });
  }

  /**
   * Stop all monitoring services
   */
  async stop(): Promise<void> {
    await this.monitoring.stop();
    await this.dashboards.stop();
    await this.health.stop();
    await this.alerting.stop();
    await this.logging.stop();
    await this.metrics.stop();
    await this.tracing.stop();

    this.logging.info('PENNY monitoring stack stopped');
  }

  /**
   * Get monitoring service instance
   */
  getMonitoring(): MonitoringService {
    return this.monitoring;
  }

  /**
   * Get metrics collector instance
   */
  getMetrics(): MetricsCollector {
    return this.metrics;
  }

  /**
   * Get logging service instance
   */
  getLogging(): LoggingService {
    return this.logging;
  }

  /**
   * Get alerting service instance
   */
  getAlerting(): AlertingService {
    return this.alerting;
  }

  /**
   * Get tracing service instance
   */
  getTracing(): TracingService {
    return this.tracing;
  }

  /**
   * Get health check service instance
   */
  getHealth(): HealthCheckService {
    return this.health;
  }

  /**
   * Get dashboards service instance
   */
  getDashboards(): DashboardService {
    return this.dashboards;
  }
}

// Export default instance
export const pennyMonitoring = new PennyMonitoring();