import { EventEmitter } from 'events';
import { Dashboard, DashboardWidget } from './types';
import { MetricsCollector } from './metrics';

export interface DashboardConfig {
  metricsCollector: MetricsCollector;
  enableDefaultDashboards?: boolean;
  customDashboards?: Dashboard[];
}

export class DashboardService extends EventEmitter {
  private config: DashboardConfig;
  private dashboards: Map<string, Dashboard> = new Map();
  private metricsCollector: MetricsCollector;

  constructor(config: DashboardConfig) {
    super();
    this.config = config;
    this.metricsCollector = config.metricsCollector;

    if (config.enableDefaultDashboards !== false) {
      this.initializeDefaultDashboards();
    }

    if (config.customDashboards) {
      for (const dashboard of config.customDashboards) {
        this.dashboards.set(dashboard.id, dashboard);
      }
    }
  }

  async start(): Promise<void> {
    this.emit('started');
  }

  async stop(): Promise<void> {
    this.emit('stopped');
  }

  private initializeDefaultDashboards(): void {
    // System Overview Dashboard
    const systemOverview: Dashboard = {
      id: 'system-overview',
      name: 'System Overview',
      description: 'Overall system health and performance metrics',
      widgets: [
        {
          id: 'cpu-usage',
          type: 'metric',
          title: 'CPU Usage',
          config: {
            metric: 'penny_cpu_usage_percent',
            unit: '%',
            thresholds: { warning: 70, critical: 90 }
          },
          position: { x: 0, y: 0, width: 6, height: 3 }
        },
        {
          id: 'memory-usage',
          type: 'metric',
          title: 'Memory Usage',
          config: {
            metric: 'penny_memory_usage_bytes{type="used"}',
            unit: 'bytes',
            thresholds: { warning: 80, critical: 95 }
          },
          position: { x: 6, y: 0, width: 6, height: 3 }
        },
        {
          id: 'http-requests',
          type: 'chart',
          title: 'HTTP Requests per Second',
          config: {
            metric: 'penny_http_requests_total',
            chartType: 'line',
            timeRange: '1h',
            groupBy: ['status_code']
          },
          position: { x: 0, y: 3, width: 12, height: 4 }
        },
        {
          id: 'response-times',
          type: 'chart',
          title: 'Response Time Distribution',
          config: {
            metric: 'penny_http_request_duration_seconds',
            chartType: 'histogram',
            timeRange: '1h'
          },
          position: { x: 0, y: 7, width: 12, height: 4 }
        }
      ],
      tags: ['system', 'overview'],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Business Metrics Dashboard
    const businessMetrics: Dashboard = {
      id: 'business-metrics',
      name: 'Business Metrics',
      description: 'Key business performance indicators',
      widgets: [
        {
          id: 'active-users',
          type: 'metric',
          title: 'Active Users (24h)',
          config: {
            metric: 'penny_active_users{period="daily"}',
            unit: 'users',
            sparkline: true
          },
          position: { x: 0, y: 0, width: 3, height: 3 }
        },
        {
          id: 'api-calls',
          type: 'metric',
          title: 'API Calls Today',
          config: {
            metric: 'penny_api_calls_total',
            unit: 'calls',
            sparkline: true
          },
          position: { x: 3, y: 0, width: 3, height: 3 }
        },
        {
          id: 'tokens-processed',
          type: 'metric',
          title: 'Tokens Processed',
          config: {
            metric: 'penny_tokens_processed_total',
            unit: 'tokens',
            sparkline: true
          },
          position: { x: 6, y: 0, width: 3, height: 3 }
        },
        {
          id: 'active-conversations',
          type: 'metric',
          title: 'Active Conversations',
          config: {
            metric: 'penny_conversations_active',
            unit: 'conversations'
          },
          position: { x: 9, y: 0, width: 3, height: 3 }
        },
        {
          id: 'usage-by-tenant',
          type: 'table',
          title: 'Top Tenants by Usage',
          config: {
            query: 'topk(10, sum by(tenant_id) (penny_api_calls_total))',
            columns: ['Tenant ID', 'API Calls'],
            sortBy: 'API Calls'
          },
          position: { x: 0, y: 3, width: 6, height: 4 }
        },
        {
          id: 'model-usage',
          type: 'chart',
          title: 'AI Model Usage',
          config: {
            metric: 'penny_tokens_processed_total',
            chartType: 'pie',
            groupBy: ['model', 'provider'],
            timeRange: '24h'
          },
          position: { x: 6, y: 3, width: 6, height: 4 }
        }
      ],
      tags: ['business', 'kpi'],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Error Monitoring Dashboard
    const errorMonitoring: Dashboard = {
      id: 'error-monitoring',
      name: 'Error Monitoring',
      description: 'Error rates, types, and trends',
      widgets: [
        {
          id: 'error-rate',
          type: 'metric',
          title: 'Error Rate',
          config: {
            metric: 'rate(penny_errors_total[5m])',
            unit: 'errors/sec',
            thresholds: { warning: 0.1, critical: 1.0 }
          },
          position: { x: 0, y: 0, width: 4, height: 3 }
        },
        {
          id: 'http-error-rate',
          type: 'metric',
          title: 'HTTP 5xx Rate',
          config: {
            metric: 'rate(penny_http_requests_total{status_code=~"5.."}[5m])',
            unit: 'req/sec',
            thresholds: { warning: 0.01, critical: 0.1 }
          },
          position: { x: 4, y: 0, width: 4, height: 3 }
        },
        {
          id: 'tool-failures',
          type: 'metric',
          title: 'Tool Execution Failures',
          config: {
            metric: 'penny_tool_executions_total{status="failure"}',
            unit: 'failures'
          },
          position: { x: 8, y: 0, width: 4, height: 3 }
        },
        {
          id: 'error-trends',
          type: 'chart',
          title: 'Error Trends (24h)',
          config: {
            metric: 'penny_errors_total',
            chartType: 'line',
            timeRange: '24h',
            groupBy: ['type', 'service']
          },
          position: { x: 0, y: 3, width: 12, height: 4 }
        },
        {
          id: 'top-errors',
          type: 'table',
          title: 'Most Common Errors',
          config: {
            query: 'topk(10, sum by(type) (increase(penny_errors_total[1h])))',
            columns: ['Error Type', 'Count'],
            sortBy: 'Count'
          },
          position: { x: 0, y: 7, width: 6, height: 4 }
        },
        {
          id: 'error-distribution',
          type: 'chart',
          title: 'Error Distribution by Service',
          config: {
            metric: 'penny_errors_total',
            chartType: 'bar',
            groupBy: ['service'],
            timeRange: '1h'
          },
          position: { x: 6, y: 7, width: 6, height: 4 }
        }
      ],
      tags: ['errors', 'monitoring'],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Performance Dashboard
    const performance: Dashboard = {
      id: 'performance',
      name: 'Performance',
      description: 'Application performance metrics and APM data',
      widgets: [
        {
          id: 'avg-response-time',
          type: 'metric',
          title: 'Avg Response Time',
          config: {
            metric: 'avg(penny_http_request_duration_seconds)',
            unit: 'ms',
            thresholds: { warning: 500, critical: 1000 }
          },
          position: { x: 0, y: 0, width: 3, height: 3 }
        },
        {
          id: 'p95-response-time',
          type: 'metric',
          title: 'P95 Response Time',
          config: {
            metric: 'histogram_quantile(0.95, penny_http_request_duration_seconds)',
            unit: 'ms',
            thresholds: { warning: 1000, critical: 2000 }
          },
          position: { x: 3, y: 0, width: 3, height: 3 }
        },
        {
          id: 'throughput',
          type: 'metric',
          title: 'Requests/sec',
          config: {
            metric: 'rate(penny_http_requests_total[5m])',
            unit: 'req/sec',
            sparkline: true
          },
          position: { x: 6, y: 0, width: 3, height: 3 }
        },
        {
          id: 'active-connections',
          type: 'metric',
          title: 'Active Connections',
          config: {
            metric: 'penny_http_requests_active',
            unit: 'connections'
          },
          position: { x: 9, y: 0, width: 3, height: 3 }
        },
        {
          id: 'response-time-heatmap',
          type: 'chart',
          title: 'Response Time Heatmap',
          config: {
            metric: 'penny_http_request_duration_seconds',
            chartType: 'heatmap',
            timeRange: '6h'
          },
          position: { x: 0, y: 3, width: 12, height: 4 }
        },
        {
          id: 'slowest-endpoints',
          type: 'table',
          title: 'Slowest Endpoints',
          config: {
            query: 'topk(10, avg by(route) (penny_http_request_duration_seconds))',
            columns: ['Endpoint', 'Avg Response Time'],
            sortBy: 'Avg Response Time'
          },
          position: { x: 0, y: 7, width: 6, height: 4 }
        },
        {
          id: 'database-performance',
          type: 'chart',
          title: 'Database Query Performance',
          config: {
            metric: 'penny_database_query_duration',
            chartType: 'line',
            timeRange: '1h',
            groupBy: ['operation']
          },
          position: { x: 6, y: 7, width: 6, height: 4 }
        }
      ],
      tags: ['performance', 'apm'],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Infrastructure Dashboard
    const infrastructure: Dashboard = {
      id: 'infrastructure',
      name: 'Infrastructure',
      description: 'Infrastructure and resource utilization',
      widgets: [
        {
          id: 'pod-status',
          type: 'status',
          title: 'Pod Status',
          config: {
            items: [
              { name: 'API', status: 'healthy' },
              { name: 'Web', status: 'healthy' },
              { name: 'Worker', status: 'degraded' },
              { name: 'Database', status: 'healthy' }
            ]
          },
          position: { x: 0, y: 0, width: 3, height: 4 }
        },
        {
          id: 'resource-usage',
          type: 'chart',
          title: 'Resource Usage Trends',
          config: {
            metrics: [
              'penny_cpu_usage_percent',
              'penny_memory_usage_bytes',
              'penny_disk_usage_bytes'
            ],
            chartType: 'line',
            timeRange: '6h'
          },
          position: { x: 3, y: 0, width: 9, height: 4 }
        },
        {
          id: 'network-io',
          type: 'chart',
          title: 'Network I/O',
          config: {
            metric: 'penny_network_bytes_total',
            chartType: 'area',
            groupBy: ['direction'],
            timeRange: '1h'
          },
          position: { x: 0, y: 4, width: 6, height: 4 }
        },
        {
          id: 'cache-performance',
          type: 'chart',
          title: 'Cache Performance',
          config: {
            metrics: [
              'penny_cache_hit_rate',
              'penny_cache_operations_total'
            ],
            chartType: 'line',
            timeRange: '1h'
          },
          position: { x: 6, y: 4, width: 6, height: 4 }
        }
      ],
      tags: ['infrastructure', 'resources'],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Store dashboards
    this.dashboards.set(systemOverview.id, systemOverview);
    this.dashboards.set(businessMetrics.id, businessMetrics);
    this.dashboards.set(errorMonitoring.id, errorMonitoring);
    this.dashboards.set(performance.id, performance);
    this.dashboards.set(infrastructure.id, infrastructure);
  }

  // Dashboard management
  createDashboard(dashboard: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>): Dashboard {
    const newDashboard: Dashboard = {
      ...dashboard,
      id: this.generateDashboardId(dashboard.name),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.dashboards.set(newDashboard.id, newDashboard);
    this.emit('dashboardCreated', newDashboard);

    return newDashboard;
  }

  updateDashboard(id: string, updates: Partial<Omit<Dashboard, 'id' | 'createdAt'>>): Dashboard | null {
    const dashboard = this.dashboards.get(id);
    if (!dashboard) return null;

    const updatedDashboard: Dashboard = {
      ...dashboard,
      ...updates,
      updatedAt: new Date()
    };

    this.dashboards.set(id, updatedDashboard);
    this.emit('dashboardUpdated', updatedDashboard);

    return updatedDashboard;
  }

  deleteDashboard(id: string): boolean {
    const deleted = this.dashboards.delete(id);
    if (deleted) {
      this.emit('dashboardDeleted', id);
    }
    return deleted;
  }

  getDashboard(id: string): Dashboard | null {
    return this.dashboards.get(id) || null;
  }

  getAllDashboards(): Dashboard[] {
    return Array.from(this.dashboards.values());
  }

  getDashboardsByTag(tag: string): Dashboard[] {
    return Array.from(this.dashboards.values()).filter(d => 
      d.tags?.includes(tag)
    );
  }

  // Widget management
  addWidget(dashboardId: string, widget: Omit<DashboardWidget, 'id'>): Dashboard | null {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) return null;

    const newWidget: DashboardWidget = {
      ...widget,
      id: this.generateWidgetId(widget.title)
    };

    dashboard.widgets.push(newWidget);
    dashboard.updatedAt = new Date();

    this.emit('widgetAdded', { dashboardId, widget: newWidget });
    return dashboard;
  }

  updateWidget(dashboardId: string, widgetId: string, updates: Partial<Omit<DashboardWidget, 'id'>>): Dashboard | null {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) return null;

    const widgetIndex = dashboard.widgets.findIndex(w => w.id === widgetId);
    if (widgetIndex === -1) return null;

    dashboard.widgets[widgetIndex] = {
      ...dashboard.widgets[widgetIndex],
      ...updates
    };
    dashboard.updatedAt = new Date();

    this.emit('widgetUpdated', { dashboardId, widget: dashboard.widgets[widgetIndex] });
    return dashboard;
  }

  removeWidget(dashboardId: string, widgetId: string): Dashboard | null {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) return null;

    const widgetIndex = dashboard.widgets.findIndex(w => w.id === widgetId);
    if (widgetIndex === -1) return null;

    dashboard.widgets.splice(widgetIndex, 1);
    dashboard.updatedAt = new Date();

    this.emit('widgetRemoved', { dashboardId, widgetId });
    return dashboard;
  }

  // Data fetching for widgets
  async getWidgetData(widget: DashboardWidget, timeRange?: string): Promise<any> {
    switch (widget.type) {
      case 'metric':
        return await this.getMetricWidgetData(widget, timeRange);
      case 'chart':
        return await this.getChartWidgetData(widget, timeRange);
      case 'table':
        return await this.getTableWidgetData(widget);
      case 'status':
        return await this.getStatusWidgetData(widget);
      case 'log':
        return await this.getLogWidgetData(widget, timeRange);
      default:
        throw new Error(`Unknown widget type: ${widget.type}`);
    }
  }

  private async getMetricWidgetData(widget: DashboardWidget, timeRange?: string): Promise<{
    value: number;
    unit: string;
    status?: 'normal' | 'warning' | 'critical';
    sparklineData?: Array<{ timestamp: number; value: number }>;
  }> {
    // In a real implementation, this would query your metrics backend
    // For now, we'll return mock data based on the metric name
    const metricName = widget.config.metric;
    
    // Simulate metric values
    let value = 0;
    if (metricName.includes('cpu')) {
      value = Math.random() * 100;
    } else if (metricName.includes('memory')) {
      value = Math.random() * 8 * 1024 * 1024 * 1024; // 8GB
    } else if (metricName.includes('requests')) {
      value = Math.floor(Math.random() * 1000);
    } else {
      value = Math.random() * 100;
    }

    // Determine status based on thresholds
    let status: 'normal' | 'warning' | 'critical' = 'normal';
    if (widget.config.thresholds) {
      if (widget.config.thresholds.critical && value >= widget.config.thresholds.critical) {
        status = 'critical';
      } else if (widget.config.thresholds.warning && value >= widget.config.thresholds.warning) {
        status = 'warning';
      }
    }

    // Generate sparkline data if requested
    let sparklineData;
    if (widget.config.sparkline) {
      const now = Date.now();
      sparklineData = Array.from({ length: 20 }, (_, i) => ({
        timestamp: now - (19 - i) * 60000, // 1 minute intervals
        value: value + (Math.random() - 0.5) * value * 0.2 // ±20% variation
      }));
    }

    return {
      value,
      unit: widget.config.unit || '',
      status,
      sparklineData
    };
  }

  private async getChartWidgetData(widget: DashboardWidget, timeRange?: string): Promise<{
    series: Array<{
      name: string;
      data: Array<{ timestamp: number; value: number }>;
    }>;
    chartType: string;
  }> {
    // Mock chart data generation
    const now = Date.now();
    const points = 50;
    const interval = 60000; // 1 minute

    const series = [];
    const groupBy = widget.config.groupBy || ['default'];

    for (const group of groupBy) {
      const data = Array.from({ length: points }, (_, i) => {
        const timestamp = now - (points - 1 - i) * interval;
        let value = Math.random() * 100;
        
        // Add some realistic patterns
        if (widget.config.metric?.includes('request')) {
          // Simulate request patterns with peaks
          const hour = new Date(timestamp).getHours();
          const peakMultiplier = hour >= 9 && hour <= 17 ? 2 : 1;
          value *= peakMultiplier;
        }

        return { timestamp, value };
      });

      series.push({
        name: group,
        data
      });
    }

    return {
      series,
      chartType: widget.config.chartType || 'line'
    };
  }

  private async getTableWidgetData(widget: DashboardWidget): Promise<{
    columns: string[];
    rows: any[][];
  }> {
    // Mock table data
    const columns = widget.config.columns || ['Name', 'Value'];
    const rows = [
      ['API Service', '123'],
      ['Web Service', '456'],
      ['Worker Service', '789'],
      ['Database', '321']
    ];

    return { columns, rows };
  }

  private async getStatusWidgetData(widget: DashboardWidget): Promise<{
    items: Array<{
      name: string;
      status: 'healthy' | 'warning' | 'critical';
      message?: string;
    }>;
  }> {
    return {
      items: widget.config.items || []
    };
  }

  private async getLogWidgetData(widget: DashboardWidget, timeRange?: string): Promise<{
    logs: Array<{
      timestamp: string;
      level: string;
      message: string;
      service?: string;
    }>;
  }> {
    // Mock log data
    const logs = [
      {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'User login successful',
        service: 'auth-service'
      },
      {
        timestamp: new Date(Date.now() - 60000).toISOString(),
        level: 'error',
        message: 'Database connection failed',
        service: 'api-service'
      }
    ];

    return { logs };
  }

  // Export/Import dashboards
  exportDashboard(id: string): string | null {
    const dashboard = this.dashboards.get(id);
    if (!dashboard) return null;

    return JSON.stringify(dashboard, null, 2);
  }

  importDashboard(dashboardJson: string): Dashboard {
    const dashboard = JSON.parse(dashboardJson) as Dashboard;
    
    // Generate new ID and timestamps
    dashboard.id = this.generateDashboardId(dashboard.name);
    dashboard.createdAt = new Date();
    dashboard.updatedAt = new Date();

    this.dashboards.set(dashboard.id, dashboard);
    this.emit('dashboardImported', dashboard);

    return dashboard;
  }

  // Utility methods
  private generateDashboardId(name: string): string {
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `${slug}-${Date.now()}`;
  }

  private generateWidgetId(title: string): string {
    const slug = title.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `${slug}-${Date.now()}`;
  }

  // Dashboard templates
  getDefaultDashboards(): Dashboard[] {
    return [
      'system-overview',
      'business-metrics',
      'error-monitoring',
      'performance',
      'infrastructure'
    ].map(id => this.dashboards.get(id)!).filter(Boolean);
  }

  createDashboardFromTemplate(templateId: string, name: string): Dashboard | null {
    const template = this.dashboards.get(templateId);
    if (!template) return null;

    return this.createDashboard({
      name,
      description: `Dashboard based on ${template.name} template`,
      widgets: template.widgets.map(widget => ({
        ...widget,
        id: this.generateWidgetId(widget.title)
      })),
      tags: [...(template.tags || []), 'custom']
    });
  }
}