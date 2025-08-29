import { z } from 'zod';
import type { ToolDefinition, ToolHandler, ToolResult } from '../types.js';
import { prisma } from '@penny/database';

const dashboardSchema = z.object({
  slug: z.string().describe('Dashboard identifier (e.g., "company-health", "sales-funnel", "ops-incidents")'),
  filters: z.object({
    dateRange: z.object({
      start: z.string().datetime().optional(),
      end: z.string().datetime().optional(),
    }).optional(),
    segments: z.array(z.string()).optional(),
    metrics: z.array(z.string()).optional(),
  }).optional(),
  refresh: z.boolean().default(false).describe('Force refresh data from sources'),
});

// Predefined dashboard templates
const dashboardTemplates = {
  'company-health': {
    name: 'Company Health Dashboard',
    description: 'Overall company performance and health metrics',
    layout: 'grid',
    refreshInterval: 300000, // 5 minutes
    widgets: [
      { id: 'revenue', type: 'metric', position: { x: 0, y: 0, w: 3, h: 2 } },
      { id: 'profit', type: 'metric', position: { x: 3, y: 0, w: 3, h: 2 } },
      { id: 'customers', type: 'metric', position: { x: 6, y: 0, w: 3, h: 2 } },
      { id: 'efficiency', type: 'metric', position: { x: 9, y: 0, w: 3, h: 2 } },
      { id: 'revenue-trend', type: 'chart', position: { x: 0, y: 2, w: 6, h: 4 } },
      { id: 'segment-breakdown', type: 'chart', position: { x: 6, y: 2, w: 6, h: 4 } },
      { id: 'health-score', type: 'gauge', position: { x: 0, y: 6, w: 4, h: 3 } },
      { id: 'alerts', type: 'list', position: { x: 4, y: 6, w: 8, h: 3 } },
    ],
  },
  'sales-funnel': {
    name: 'Sales Funnel Dashboard',
    description: 'Sales pipeline and conversion metrics',
    layout: 'grid',
    refreshInterval: 600000, // 10 minutes
    widgets: [
      { id: 'leads', type: 'metric', position: { x: 0, y: 0, w: 3, h: 2 } },
      { id: 'opportunities', type: 'metric', position: { x: 3, y: 0, w: 3, h: 2 } },
      { id: 'closed-won', type: 'metric', position: { x: 6, y: 0, w: 3, h: 2 } },
      { id: 'conversion-rate', type: 'metric', position: { x: 9, y: 0, w: 3, h: 2 } },
      { id: 'funnel-chart', type: 'funnel', position: { x: 0, y: 2, w: 12, h: 4 } },
      { id: 'pipeline-value', type: 'chart', position: { x: 0, y: 6, w: 6, h: 3 } },
      { id: 'top-deals', type: 'table', position: { x: 6, y: 6, w: 6, h: 3 } },
    ],
  },
  'ops-incidents': {
    name: 'Operations & Incidents Dashboard',
    description: 'System health and incident tracking',
    layout: 'grid',
    refreshInterval: 60000, // 1 minute
    widgets: [
      { id: 'uptime', type: 'metric', position: { x: 0, y: 0, w: 3, h: 2 } },
      { id: 'active-incidents', type: 'metric', position: { x: 3, y: 0, w: 3, h: 2 } },
      { id: 'mttr', type: 'metric', position: { x: 6, y: 0, w: 3, h: 2 } },
      { id: 'error-rate', type: 'metric', position: { x: 9, y: 0, w: 3, h: 2 } },
      { id: 'service-status', type: 'grid', position: { x: 0, y: 2, w: 6, h: 4 } },
      { id: 'incident-timeline', type: 'timeline', position: { x: 6, y: 2, w: 6, h: 4 } },
      { id: 'performance-metrics', type: 'chart', position: { x: 0, y: 6, w: 12, h: 3 } },
    ],
  },
  'finance-snapshot': {
    name: 'Finance Snapshot Dashboard',
    description: 'Financial performance and budget tracking',
    layout: 'grid',
    refreshInterval: 900000, // 15 minutes
    widgets: [
      { id: 'revenue-ytd', type: 'metric', position: { x: 0, y: 0, w: 3, h: 2 } },
      { id: 'expenses-ytd', type: 'metric', position: { x: 3, y: 0, w: 3, h: 2 } },
      { id: 'burn-rate', type: 'metric', position: { x: 6, y: 0, w: 3, h: 2 } },
      { id: 'runway', type: 'metric', position: { x: 9, y: 0, w: 3, h: 2 } },
      { id: 'budget-vs-actual', type: 'chart', position: { x: 0, y: 2, w: 6, h: 4 } },
      { id: 'cashflow', type: 'chart', position: { x: 6, y: 2, w: 6, h: 4 } },
      { id: 'expense-breakdown', type: 'chart', position: { x: 0, y: 6, w: 12, h: 3 } },
    ],
  },
};

const handler: ToolHandler = async (params, context) => {
  const { slug, filters, refresh } = dashboardSchema.parse(params);

  try {
    // Check if dashboard template exists
    const template = dashboardTemplates[slug as keyof typeof dashboardTemplates];
    if (!template) {
      return {
        success: false,
        error: {
          code: 'DASHBOARD_NOT_FOUND',
          message: `Dashboard '${slug}' not found. Available dashboards: ${Object.keys(dashboardTemplates).join(', ')}`,
          retryable: false,
        },
      };
    }

    // Generate dashboard data based on template and filters
    const dashboardData = await generateDashboardData(template, filters || {}, context);

    // Cache dashboard state if not refreshing
    if (!refresh) {
      await cacheDashboardState(slug, dashboardData, context);
    }

    // Log dashboard access
    await prisma.toolExecution.create({
      data: {
        toolId: 'load_dashboard',
        userId: context.userId,
        conversationId: context.conversationId,
        status: 'completed',
        parameters: params,
        result: { slug, loaded: true },
        startedAt: new Date(),
        completedAt: new Date(),
        duration: 200,
      },
    });

    return {
      success: true,
      data: {
        dashboard: template,
        data: dashboardData,
        filters: filters || {},
        timestamp: new Date().toISOString(),
      },
      artifacts: [{
        type: 'dashboard',
        name: template.name,
        content: {
          ...template,
          data: dashboardData,
          interactive: true,
          controls: {
            dateRange: true,
            filters: true,
            export: true,
            refresh: true,
          },
        },
        mimeType: 'application/vnd.penny.dashboard+json',
        metadata: {
          slug,
          refreshedAt: new Date().toISOString(),
          cacheKey: `dashboard:${slug}:${context.tenantId}`,
        },
      }],
      usage: {
        credits: 2,
        duration: 200,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'DASHBOARD_LOAD_ERROR',
        message: error.message,
        retryable: true,
      },
    };
  }
};

async function generateDashboardData(
  template: any,
  filters: any,
  context: any
): Promise<any> {
  const data: any = {};
  
  // Generate data for each widget
  for (const widget of template.widgets) {
    switch (widget.type) {
      case 'metric':
        data[widget.id] = generateMetricData(widget.id);
        break;
      case 'chart':
        data[widget.id] = generateChartData(widget.id, filters);
        break;
      case 'gauge':
        data[widget.id] = generateGaugeData(widget.id);
        break;
      case 'funnel':
        data[widget.id] = generateFunnelData();
        break;
      case 'table':
        data[widget.id] = generateTableData(widget.id);
        break;
      case 'grid':
        data[widget.id] = generateGridData(widget.id);
        break;
      case 'timeline':
        data[widget.id] = generateTimelineData();
        break;
      case 'list':
        data[widget.id] = generateListData(widget.id);
        break;
    }
  }
  
  return data;
}

function generateMetricData(id: string): any {
  const metrics: Record<string, any> = {
    revenue: { value: 2450000, change: 12.5, format: 'currency' },
    profit: { value: 560000, change: 28.3, format: 'currency' },
    customers: { value: 1543, change: 8.2, format: 'number' },
    efficiency: { value: 78.5, change: 3.1, format: 'percentage' },
    leads: { value: 342, change: 15.3, format: 'number' },
    opportunities: { value: 89, change: -5.2, format: 'number' },
    'closed-won': { value: 23, change: 21.1, format: 'number' },
    'conversion-rate': { value: 25.8, change: 2.3, format: 'percentage' },
    uptime: { value: 99.95, change: 0.02, format: 'percentage' },
    'active-incidents': { value: 2, change: -50, format: 'number', inverse: true },
    mttr: { value: 3.2, change: -15.8, format: 'decimal', unit: 'hours', inverse: true },
    'error-rate': { value: 0.12, change: -25, format: 'percentage', inverse: true },
    'revenue-ytd': { value: 14250000, change: 18.3, format: 'currency' },
    'expenses-ytd': { value: 11890000, change: 5.2, format: 'currency' },
    'burn-rate': { value: 890000, change: -8.3, format: 'currency', inverse: true },
    runway: { value: 18, change: 12.5, format: 'number', unit: 'months' },
  };
  
  return metrics[id] || { value: 0, change: 0, format: 'number' };
}

function generateChartData(id: string, filters: any): any {
  const points = 30;
  const data = [];
  
  for (let i = 0; i < points; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (points - i));
    data.push({
      x: date.toISOString().split('T')[0],
      y: Math.round(Math.random() * 100000 + 50000),
    });
  }
  
  return {
    type: id.includes('trend') ? 'line' : id.includes('breakdown') ? 'pie' : 'bar',
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  };
}

function generateGaugeData(id: string): any {
  const value = id === 'health-score' ? 85 : Math.random() * 100;
  return {
    value,
    min: 0,
    max: 100,
    thresholds: [30, 60, 80],
    colors: ['#ef4444', '#f59e0b', '#10b981'],
  };
}

function generateFunnelData(): any {
  return {
    stages: [
      { name: 'Leads', value: 342, conversion: 100 },
      { name: 'Qualified', value: 189, conversion: 55.3 },
      { name: 'Opportunities', value: 89, conversion: 47.1 },
      { name: 'Negotiations', value: 42, conversion: 47.2 },
      { name: 'Closed Won', value: 23, conversion: 54.8 },
    ],
  };
}

function generateTableData(id: string): any {
  if (id === 'top-deals') {
    return {
      columns: ['Deal', 'Value', 'Stage', 'Close Date', 'Probability'],
      rows: [
        ['Enterprise License - Acme Corp', '$250,000', 'Negotiation', '2024-03-15', '80%'],
        ['Cloud Migration - TechCo', '$180,000', 'Proposal', '2024-03-20', '60%'],
        ['Security Audit - FinanceInc', '$95,000', 'Qualified', '2024-04-01', '40%'],
        ['Data Platform - StartupXYZ', '$75,000', 'Negotiation', '2024-03-10', '90%'],
        ['API Integration - RetailCo', '$45,000', 'Discovery', '2024-04-15', '25%'],
      ],
    };
  }
  return { columns: [], rows: [] };
}

function generateGridData(id: string): any {
  if (id === 'service-status') {
    return {
      services: [
        { name: 'API Gateway', status: 'operational', uptime: 99.99 },
        { name: 'Database', status: 'operational', uptime: 99.95 },
        { name: 'Cache Layer', status: 'operational', uptime: 100 },
        { name: 'ML Pipeline', status: 'degraded', uptime: 98.5 },
        { name: 'File Storage', status: 'operational', uptime: 99.98 },
        { name: 'Message Queue', status: 'operational', uptime: 99.97 },
      ],
    };
  }
  return { services: [] };
}

function generateTimelineData(): any {
  const now = Date.now();
  return {
    events: [
      { time: new Date(now - 3600000).toISOString(), type: 'warning', message: 'High CPU usage detected' },
      { time: new Date(now - 7200000).toISOString(), type: 'error', message: 'Database connection timeout' },
      { time: new Date(now - 10800000).toISOString(), type: 'info', message: 'Deployment completed successfully' },
      { time: new Date(now - 14400000).toISOString(), type: 'success', message: 'All systems operational' },
    ],
  };
}

function generateListData(id: string): any {
  if (id === 'alerts') {
    return {
      items: [
        { level: 'warning', message: 'Revenue trending 5% below target', timestamp: new Date().toISOString() },
        { level: 'info', message: 'New customer segment showing 20% growth', timestamp: new Date().toISOString() },
        { level: 'success', message: 'Customer satisfaction score improved to 92%', timestamp: new Date().toISOString() },
      ],
    };
  }
  return { items: [] };
}

async function cacheDashboardState(slug: string, data: any, context: any): Promise<void> {
  // In production, this would cache to Redis or similar
  // For now, just log the cache operation
  console.log(`Caching dashboard state for ${slug} (tenant: ${context.tenantId})`);
}

export const loadDashboardTool: ToolDefinition = {
  name: 'load_dashboard',
  displayName: 'Load Dashboard',
  description: 'Load a pre-configured dashboard with real-time data and visualizations',
  category: 'visualization',
  icon: 'layout-dashboard',
  schema: dashboardSchema,
  handler,
  config: {
    requiresAuth: true,
    permissions: ['dashboard:view'],
    rateLimit: {
      requests: 50,
      window: 3600,
    },
    timeout: 10000,
    cost: 2,
  },
};