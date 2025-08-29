import * as promClient from 'prom-client';
import * as si from 'systeminformation';
import { EventEmitter } from 'events';
import { MetricValue, SystemMetrics, PerformanceMetrics } from './types';

export interface MetricsConfig {
  port?: number;
  prefix?: string;
  collectDefaultMetrics?: boolean;
  gcMetrics?: boolean;
  systemMetrics?: boolean;
  customMetrics?: Array<{
    name: string;
    type: 'counter' | 'gauge' | 'histogram' | 'summary';
    help: string;
    labelNames?: string[];
  }>;
}

export class MetricsCollector extends EventEmitter {
  private registry: promClient.Registry;
  private server?: any;
  private config: Required<MetricsConfig>;
  private systemMetricsInterval?: NodeJS.Timeout;
  
  // Built-in metrics
  private httpRequestsTotal: promClient.Counter;
  private httpRequestDuration: promClient.Histogram;
  private httpRequestsActive: promClient.Gauge;
  private errorCount: promClient.Counter;
  private cpuUsage: promClient.Gauge;
  private memoryUsage: promClient.Gauge;
  private diskUsage: promClient.Gauge;
  private networkBytesTotal: promClient.Counter;
  
  // Business metrics
  private activeUsers: promClient.Gauge;
  private apiCallsTotal: promClient.Counter;
  private tokensProcessed: promClient.Counter;
  private conversationsActive: promClient.Gauge;
  private artifactsCreated: promClient.Counter;
  private toolExecutions: promClient.Counter;
  private billingEvents: promClient.Counter;
  
  // Performance metrics
  private databaseConnections: promClient.Gauge;
  private cacheHitRate: promClient.Gauge;
  private queueDepth: promClient.Gauge;
  private backgroundJobsTotal: promClient.Counter;

  constructor(config: MetricsConfig = {}) {
    super();
    
    this.config = {
      port: config.port || 9090,
      prefix: config.prefix || 'penny_',
      collectDefaultMetrics: config.collectDefaultMetrics !== false,
      gcMetrics: config.gcMetrics !== false,
      systemMetrics: config.systemMetrics !== false,
      customMetrics: config.customMetrics || []
    };

    this.registry = new promClient.Registry();
    
    if (this.config.collectDefaultMetrics) {
      promClient.collectDefaultMetrics({
        register: this.registry,
        prefix: this.config.prefix
      });
    }

    this.initializeBuiltinMetrics();
    this.initializeBusinessMetrics();
    this.initializePerformanceMetrics();
    this.initializeCustomMetrics();
  }

  private initializeBuiltinMetrics(): void {
    // HTTP metrics
    this.httpRequestsTotal = new promClient.Counter({
      name: `${this.config.prefix}http_requests_total`,
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'tenant_id'],
      registers: [this.registry]
    });

    this.httpRequestDuration = new promClient.Histogram({
      name: `${this.config.prefix}http_request_duration_seconds`,
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.001, 0.005, 0.015, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 1, 2, 5],
      registers: [this.registry]
    });

    this.httpRequestsActive = new promClient.Gauge({
      name: `${this.config.prefix}http_requests_active`,
      help: 'Number of active HTTP requests',
      registers: [this.registry]
    });

    this.errorCount = new promClient.Counter({
      name: `${this.config.prefix}errors_total`,
      help: 'Total number of errors',
      labelNames: ['type', 'service', 'severity'],
      registers: [this.registry]
    });

    // System metrics
    this.cpuUsage = new promClient.Gauge({
      name: `${this.config.prefix}cpu_usage_percent`,
      help: 'CPU usage percentage',
      registers: [this.registry]
    });

    this.memoryUsage = new promClient.Gauge({
      name: `${this.config.prefix}memory_usage_bytes`,
      help: 'Memory usage in bytes',
      labelNames: ['type'],
      registers: [this.registry]
    });

    this.diskUsage = new promClient.Gauge({
      name: `${this.config.prefix}disk_usage_bytes`,
      help: 'Disk usage in bytes',
      labelNames: ['type', 'device'],
      registers: [this.registry]
    });

    this.networkBytesTotal = new promClient.Counter({
      name: `${this.config.prefix}network_bytes_total`,
      help: 'Total network bytes transferred',
      labelNames: ['direction', 'interface'],
      registers: [this.registry]
    });
  }

  private initializeBusinessMetrics(): void {
    this.activeUsers = new promClient.Gauge({
      name: `${this.config.prefix}active_users`,
      help: 'Number of active users',
      labelNames: ['period', 'tenant_id'],
      registers: [this.registry]
    });

    this.apiCallsTotal = new promClient.Counter({
      name: `${this.config.prefix}api_calls_total`,
      help: 'Total API calls made',
      labelNames: ['endpoint', 'tenant_id', 'user_id'],
      registers: [this.registry]
    });

    this.tokensProcessed = new promClient.Counter({
      name: `${this.config.prefix}tokens_processed_total`,
      help: 'Total tokens processed by AI models',
      labelNames: ['model', 'provider', 'type', 'tenant_id'],
      registers: [this.registry]
    });

    this.conversationsActive = new promClient.Gauge({
      name: `${this.config.prefix}conversations_active`,
      help: 'Number of active conversations',
      labelNames: ['tenant_id'],
      registers: [this.registry]
    });

    this.artifactsCreated = new promClient.Counter({
      name: `${this.config.prefix}artifacts_created_total`,
      help: 'Total artifacts created',
      labelNames: ['type', 'tenant_id'],
      registers: [this.registry]
    });

    this.toolExecutions = new promClient.Counter({
      name: `${this.config.prefix}tool_executions_total`,
      help: 'Total tool executions',
      labelNames: ['tool_name', 'status', 'tenant_id'],
      registers: [this.registry]
    });

    this.billingEvents = new promClient.Counter({
      name: `${this.config.prefix}billing_events_total`,
      help: 'Total billing events',
      labelNames: ['event_type', 'plan', 'tenant_id'],
      registers: [this.registry]
    });
  }

  private initializePerformanceMetrics(): void {
    this.databaseConnections = new promClient.Gauge({
      name: `${this.config.prefix}database_connections`,
      help: 'Number of database connections',
      labelNames: ['pool', 'status'],
      registers: [this.registry]
    });

    this.cacheHitRate = new promClient.Gauge({
      name: `${this.config.prefix}cache_hit_rate`,
      help: 'Cache hit rate percentage',
      labelNames: ['cache_type'],
      registers: [this.registry]
    });

    this.queueDepth = new promClient.Gauge({
      name: `${this.config.prefix}queue_depth`,
      help: 'Number of items in queue',
      labelNames: ['queue_name'],
      registers: [this.registry]
    });

    this.backgroundJobsTotal = new promClient.Counter({
      name: `${this.config.prefix}background_jobs_total`,
      help: 'Total background jobs processed',
      labelNames: ['job_type', 'status'],
      registers: [this.registry]
    });
  }

  private initializeCustomMetrics(): void {
    for (const metric of this.config.customMetrics) {
      let promMetric;
      
      switch (metric.type) {
        case 'counter':
          promMetric = new promClient.Counter({
            name: `${this.config.prefix}${metric.name}`,
            help: metric.help,
            labelNames: metric.labelNames,
            registers: [this.registry]
          });
          break;
        case 'gauge':
          promMetric = new promClient.Gauge({
            name: `${this.config.prefix}${metric.name}`,
            help: metric.help,
            labelNames: metric.labelNames,
            registers: [this.registry]
          });
          break;
        case 'histogram':
          promMetric = new promClient.Histogram({
            name: `${this.config.prefix}${metric.name}`,
            help: metric.help,
            labelNames: metric.labelNames,
            registers: [this.registry]
          });
          break;
        case 'summary':
          promMetric = new promClient.Summary({
            name: `${this.config.prefix}${metric.name}`,
            help: metric.help,
            labelNames: metric.labelNames,
            registers: [this.registry]
          });
          break;
      }
    }
  }

  async start(): Promise<void> {
    // Start Prometheus metrics server
    const express = require('express');
    const app = express();
    
    app.get('/metrics', async (req: any, res: any) => {
      res.set('Content-Type', this.registry.contentType);
      res.end(await this.registry.metrics());
    });

    app.get('/health', (req: any, res: any) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    this.server = app.listen(this.config.port, () => {
      this.emit('started', { port: this.config.port });
    });

    // Start system metrics collection
    if (this.config.systemMetrics) {
      this.startSystemMetricsCollection();
    }
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.close();
    }
    
    if (this.systemMetricsInterval) {
      clearInterval(this.systemMetricsInterval);
    }
    
    this.emit('stopped');
  }

  private startSystemMetricsCollection(): void {
    this.systemMetricsInterval = setInterval(async () => {
      try {
        await this.collectSystemMetrics();
      } catch (error) {
        this.emit('error', error);
      }
    }, 10000); // Collect every 10 seconds
  }

  private async collectSystemMetrics(): Promise<void> {
    try {
      // CPU metrics
      const cpuLoad = await si.currentLoad();
      this.cpuUsage.set(cpuLoad.currentLoad);

      // Memory metrics
      const memory = await si.mem();
      this.memoryUsage.set({ type: 'used' }, memory.used);
      this.memoryUsage.set({ type: 'total' }, memory.total);
      this.memoryUsage.set({ type: 'available' }, memory.available);

      // Disk metrics
      const diskLayout = await si.diskLayout();
      const fsStats = await si.fsStats();
      
      for (const disk of diskLayout) {
        this.diskUsage.set({ type: 'total', device: disk.device }, disk.size);
      }

      // Network metrics
      const networkStats = await si.networkStats();
      for (const iface of networkStats) {
        this.networkBytesTotal.inc({ direction: 'rx', interface: iface.iface }, iface.rx_bytes);
        this.networkBytesTotal.inc({ direction: 'tx', interface: iface.iface }, iface.tx_bytes);
      }
    } catch (error) {
      this.emit('error', new Error(`Failed to collect system metrics: ${error}`));
    }
  }

  // Public metric recording methods
  recordHttpRequest(method: string, route: string, statusCode: number, duration: number, tenantId?: string): void {
    const labels = { method, route, status_code: statusCode.toString() };
    if (tenantId) {
      (labels as any).tenant_id = tenantId;
    }
    
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDuration.observe({ method, route, status_code: statusCode.toString() }, duration);
  }

  recordError(type: string, service: string, severity: string = 'medium'): void {
    this.errorCount.inc({ type, service, severity });
  }

  recordApiCall(endpoint: string, tenantId: string, userId?: string): void {
    const labels = { endpoint, tenant_id: tenantId };
    if (userId) {
      (labels as any).user_id = userId;
    }
    this.apiCallsTotal.inc(labels);
  }

  recordTokenUsage(model: string, provider: string, type: 'input' | 'output', count: number, tenantId: string): void {
    this.tokensProcessed.inc({ model, provider, type, tenant_id: tenantId }, count);
  }

  recordToolExecution(toolName: string, status: 'success' | 'failure', tenantId: string): void {
    this.toolExecutions.inc({ tool_name: toolName, status, tenant_id: tenantId });
  }

  recordArtifactCreation(type: string, tenantId: string): void {
    this.artifactsCreated.inc({ type, tenant_id: tenantId });
  }

  recordBillingEvent(eventType: string, plan: string, tenantId: string): void {
    this.billingEvents.inc({ event_type: eventType, plan, tenant_id: tenantId });
  }

  setActiveUsers(count: number, period: 'daily' | 'weekly' | 'monthly', tenantId?: string): void {
    const labels = { period };
    if (tenantId) {
      (labels as any).tenant_id = tenantId;
    }
    this.activeUsers.set(labels, count);
  }

  setActiveConversations(count: number, tenantId: string): void {
    this.conversationsActive.set({ tenant_id: tenantId }, count);
  }

  setCacheHitRate(rate: number, cacheType: string): void {
    this.cacheHitRate.set({ cache_type: cacheType }, rate);
  }

  setQueueDepth(depth: number, queueName: string): void {
    this.queueDepth.set({ queue_name: queueName }, depth);
  }

  recordBackgroundJob(jobType: string, status: 'success' | 'failure'): void {
    this.backgroundJobsTotal.inc({ job_type: jobType, status });
  }

  async getMetrics(): Promise<string> {
    return await this.registry.metrics();
  }

  getRegistry(): promClient.Registry {
    return this.registry;
  }

  async getSystemMetrics(): Promise<SystemMetrics> {
    const cpu = await si.currentLoad();
    const memory = await si.mem();
    const disk = await si.fsSize();
    const network = await si.networkStats();

    return {
      cpu: {
        usage: cpu.currentLoad,
        cores: cpu.cpus.length
      },
      memory: {
        used: memory.used,
        total: memory.total,
        percentage: (memory.used / memory.total) * 100
      },
      disk: {
        used: disk.reduce((acc, d) => acc + d.used, 0),
        total: disk.reduce((acc, d) => acc + d.size, 0),
        percentage: disk.reduce((acc, d) => acc + (d.used / d.size), 0) / disk.length * 100
      },
      network: {
        bytesReceived: network.reduce((acc, n) => acc + n.rx_bytes, 0),
        bytesSent: network.reduce((acc, n) => acc + n.tx_bytes, 0)
      }
    };
  }
}