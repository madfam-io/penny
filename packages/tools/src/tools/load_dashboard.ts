import { z } from 'zod';
import type { ToolDefinition, ToolContext, ToolResult } from '../types.js';

// Parameter schema
const LoadDashboardParamsSchema = z.object({
  dashboardId: z.string().optional(),
  dashboardName: z.string().optional(),
  category: z.enum(['analytics', 'sales', 'marketing', 'operations', 'finance', 'hr', 'custom']).optional(),
  filters: z.record(z.any()).optional(),
  dateRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime()
  }).optional(),
  refreshData: z.boolean().default(false),
  includeMetadata: z.boolean().default(true),
  layout: z.enum(['grid', 'list', 'cards']).default('grid'),
  theme: z.enum(['light', 'dark', 'auto']).default('auto')
}).refine(
  data => data.dashboardId || data.dashboardName,
  { message: "Either dashboardId or dashboardName must be provided" }
);

type LoadDashboardParams = z.infer<typeof LoadDashboardParamsSchema>;

/**
 * Load Dashboard Tool Handler
 */
async function loadDashboardHandler(
  params: LoadDashboardParams,
  context: ToolContext
): Promise<ToolResult> {
  try {
    const { 
      dashboardId, 
      dashboardName, 
      category, 
      filters, 
      dateRange, 
      refreshData,
      includeMetadata,
      layout,
      theme 
    } = params;

    // Find dashboard by ID or name
    const dashboard = await findDashboard(dashboardId, dashboardName, context.tenantId);
    
    if (!dashboard) {
      return {
        success: false,
        error: {
          code: 'DASHBOARD_NOT_FOUND',
          message: `Dashboard not found: ${dashboardId || dashboardName}`,
          category: 'validation'
        }
      };
    }

    // Check permissions
    const hasAccess = await checkDashboardAccess(dashboard, context);
    if (!hasAccess) {
      return {
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'Insufficient permissions to access this dashboard',
          category: 'auth'
        }
      };
    }

    // Apply filters and date range
    let dashboardData = { ...dashboard };
    if (filters) {
      dashboardData = await applyFilters(dashboardData, filters);
    }

    if (dateRange) {
      dashboardData = await applyDateRange(dashboardData, dateRange);
    }

    // Refresh data if requested
    if (refreshData) {
      dashboardData = await refreshDashboardData(dashboardData, context);
    }

    // Load widget data
    const widgets = await loadWidgets(dashboardData.widgets, context);

    // Calculate performance metrics
    const performanceMetrics = calculateDashboardMetrics(widgets);

    // Create dashboard artifact
    const dashboardArtifact = {
      type: 'dashboard',
      name: dashboardData.name,
      content: {
        ...dashboardData,
        widgets,
        layout,
        theme,
        filters: filters || {},
        dateRange,
        performanceMetrics
      },
      mimeType: 'application/json',
      preview: `Dashboard: ${dashboardData.name} with ${widgets.length} widgets`
    };

    // Generate additional artifacts based on dashboard content
    const artifacts = [dashboardArtifact];

    // Add chart artifacts if dashboard contains visualizations
    const chartWidgets = widgets.filter(w => w.type === 'chart');
    if (chartWidgets.length > 0) {
      artifacts.push({
        type: 'visualization',
        name: `${dashboardData.name} - Charts`,
        content: {
          type: 'dashboard_charts',
          charts: chartWidgets.map(w => w.chartConfig)
        },
        mimeType: 'application/json'
      });
    }

    // Add export options
    if (dashboard.exportable) {
      artifacts.push({
        type: 'file',
        name: `${dashboardData.name.replace(/\s+/g, '_')}_export.json`,
        content: JSON.stringify(dashboardData, null, 2),
        mimeType: 'application/json',
        downloadable: true
      });
    }

    // Calculate usage
    const usage = {
      credits: widgets.length * 5 + (refreshData ? 20 : 0),
      apiCalls: widgets.length + 1,
      duration: Date.now() - (context.executionId ? parseInt(context.executionId.split('_')[1]) : Date.now()),
    };

    const result = {
      success: true,
      data: {
        dashboard: dashboardData,
        widgets,
        layout,
        theme,
        metadata: includeMetadata ? {
          loadedAt: new Date().toISOString(),
          widgetCount: widgets.length,
          performanceMetrics,
          filters: filters || {},
          dateRange,
          refreshed: refreshData
        } : undefined
      },
      artifacts,
      usage,
      metadata: {
        dashboardId: dashboard.id,
        dashboardName: dashboard.name,
        category: dashboard.category,
        widgetCount: widgets.length,
        cached: !refreshData
      }
    };

    return result;

  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'DASHBOARD_LOAD_ERROR',
        message: `Failed to load dashboard: ${error.message}`,
        details: error,
        category: 'internal',
        retryable: true
      }
    };
  }
}

/**
 * Find dashboard by ID or name
 */
async function findDashboard(dashboardId?: string, dashboardName?: string, tenantId?: string): Promise<any> {
  // In real implementation, this would query the database
  // For now, return mock dashboard data
  
  const mockDashboards = [
    {
      id: 'dash_001',
      name: 'Sales Performance',
      category: 'sales',
      description: 'Track sales metrics and performance indicators',
      widgets: ['widget_001', 'widget_002', 'widget_003'],
      exportable: true,
      shared: false,
      createdBy: 'user_001',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-08-29T00:00:00Z'
    },
    {
      id: 'dash_002',
      name: 'Marketing Analytics',
      category: 'marketing',
      description: 'Monitor marketing campaigns and ROI',
      widgets: ['widget_004', 'widget_005'],
      exportable: true,
      shared: true,
      createdBy: 'user_002',
      createdAt: '2024-02-01T00:00:00Z',
      updatedAt: '2024-08-28T00:00:00Z'
    },
    {
      id: 'dash_003',
      name: 'Financial Overview',
      category: 'finance',
      description: 'Financial metrics and budget tracking',
      widgets: ['widget_006', 'widget_007', 'widget_008', 'widget_009'],
      exportable: false,
      shared: false,
      createdBy: 'user_003',
      createdAt: '2024-03-01T00:00:00Z',
      updatedAt: '2024-08-27T00:00:00Z'
    }
  ];

  if (dashboardId) {
    return mockDashboards.find(d => d.id === dashboardId);
  }
  
  if (dashboardName) {
    return mockDashboards.find(d => 
      d.name.toLowerCase().includes(dashboardName.toLowerCase())
    );
  }
  
  return null;
}

/**
 * Check dashboard access permissions
 */
async function checkDashboardAccess(dashboard: any, context: ToolContext): Promise<boolean> {
  // In real implementation, this would check RBAC permissions
  // For now, allow access to all dashboards for demo purposes
  return true;
}

/**
 * Apply filters to dashboard data
 */
async function applyFilters(dashboard: any, filters: Record<string, any>): Promise<any> {
  // In real implementation, this would apply filters to the dashboard query
  return {
    ...dashboard,
    appliedFilters: filters
  };
}

/**
 * Apply date range to dashboard data
 */
async function applyDateRange(dashboard: any, dateRange: { start: string; end: string }): Promise<any> {
  return {
    ...dashboard,
    dateRange
  };
}

/**
 * Refresh dashboard data
 */
async function refreshDashboardData(dashboard: any, context: ToolContext): Promise<any> {
  // In real implementation, this would trigger data refresh
  return {
    ...dashboard,
    lastRefreshed: new Date().toISOString()
  };
}

/**
 * Load widgets for the dashboard
 */
async function loadWidgets(widgetIds: string[], context: ToolContext): Promise<any[]> {
  // Mock widget data
  const mockWidgets = [
    {
      id: 'widget_001',
      type: 'metric',
      title: 'Total Revenue',
      value: '$1,234,567',
      change: '+12.5%',
      changeType: 'positive'
    },
    {
      id: 'widget_002',
      type: 'chart',
      title: 'Sales Trend',
      chartType: 'line',
      chartConfig: {
        type: 'line',
        data: [
          { month: 'Jan', sales: 45000 },
          { month: 'Feb', sales: 52000 },
          { month: 'Mar', sales: 48000 },
          { month: 'Apr', sales: 61000 },
          { month: 'May', sales: 55000 },
          { month: 'Jun', sales: 67000 }
        ]
      }
    },
    {
      id: 'widget_003',
      type: 'table',
      title: 'Top Products',
      columns: ['Product', 'Revenue', 'Units Sold'],
      data: [
        ['Product A', '$125,000', '250'],
        ['Product B', '$98,500', '197'],
        ['Product C', '$87,300', '146']
      ]
    },
    {
      id: 'widget_004',
      type: 'metric',
      title: 'Campaign ROI',
      value: '245%',
      change: '+18.2%',
      changeType: 'positive'
    },
    {
      id: 'widget_005',
      type: 'chart',
      title: 'Traffic Sources',
      chartType: 'pie',
      chartConfig: {
        type: 'pie',
        data: [
          { source: 'Organic', visitors: 45 },
          { source: 'Paid', visitors: 30 },
          { source: 'Social', visitors: 15 },
          { source: 'Direct', visitors: 10 }
        ]
      }
    },
    {
      id: 'widget_006',
      type: 'metric',
      title: 'Monthly Expenses',
      value: '$234,567',
      change: '-5.3%',
      changeType: 'negative'
    },
    {
      id: 'widget_007',
      type: 'chart',
      title: 'Budget vs Actual',
      chartType: 'bar',
      chartConfig: {
        type: 'bar',
        data: [
          { category: 'Marketing', budget: 50000, actual: 47500 },
          { category: 'Sales', budget: 75000, actual: 82000 },
          { category: 'Operations', budget: 60000, actual: 58500 },
          { category: 'R&D', budget: 40000, actual: 39200 }
        ]
      }
    },
    {
      id: 'widget_008',
      type: 'table',
      title: 'Expense Categories',
      columns: ['Category', 'Budget', 'Actual', 'Variance'],
      data: [
        ['Marketing', '$50,000', '$47,500', '-$2,500'],
        ['Sales', '$75,000', '$82,000', '+$7,000'],
        ['Operations', '$60,000', '$58,500', '-$1,500']
      ]
    },
    {
      id: 'widget_009',
      type: 'metric',
      title: 'Profit Margin',
      value: '23.4%',
      change: '+2.1%',
      changeType: 'positive'
    }
  ];

  return mockWidgets.filter(widget => widgetIds.includes(widget.id));
}

/**
 * Calculate dashboard performance metrics
 */
function calculateDashboardMetrics(widgets: any[]): any {
  return {
    totalWidgets: widgets.length,
    widgetTypes: widgets.reduce((acc: any, widget) => {
      acc[widget.type] = (acc[widget.type] || 0) + 1;
      return acc;
    }, {}),
    loadTime: Math.random() * 2000 + 500, // Mock load time
    dataFreshness: Math.random() * 3600 + 300 // Mock data age in seconds
  };
}

/**
 * Load Dashboard Tool Definition
 */
export const loadDashboardTool: ToolDefinition = {
  name: 'load_dashboard',
  displayName: 'Load Dashboard',
  description: 'Load and display interactive dashboards with widgets, charts, and real-time data',
  category: 'analytics',
  version: '1.0.0',
  icon: '📊',
  tags: ['dashboard', 'analytics', 'visualization', 'widgets', 'reporting'],
  author: 'PENNY Core',
  
  schema: LoadDashboardParamsSchema,
  handler: loadDashboardHandler,
  
  config: {
    requiresAuth: true,
    permissions: ['dashboard:read', 'analytics:view'],
    rateLimit: {
      requests: 50,
      window: 3600 // 1 hour
    },
    timeout: 20000, // 20 seconds
    maxRetries: 2,
    cost: 15,
    cacheable: true,
    cacheTTL: 600, // 10 minutes
    showInMarketplace: true,
    featured: true
  },
  
  metadata: {
    examples: [
      {
        title: 'Load sales dashboard',
        description: 'Load the sales performance dashboard with current month data',
        parameters: {
          dashboardName: 'Sales Performance',
          dateRange: {
            start: '2024-08-01T00:00:00Z',
            end: '2024-08-31T23:59:59Z'
          },
          refreshData: true
        }
      },
      {
        title: 'Load dashboard with filters',
        description: 'Load marketing dashboard with specific filters applied',
        parameters: {
          dashboardId: 'dash_002',
          filters: {
            campaign_type: 'paid',
            region: 'north_america'
          },
          layout: 'grid',
          theme: 'dark'
        }
      }
    ],
    troubleshooting: [
      {
        issue: 'Dashboard not found',
        solution: 'Verify the dashboard ID or name is correct. Check if you have access to the dashboard.',
        category: 'common'
      },
      {
        issue: 'Widgets not loading',
        solution: 'Try refreshing the dashboard data. Check if the data sources are accessible.',
        category: 'performance'
      },
      {
        issue: 'Permission denied',
        solution: 'Ensure your user role has dashboard:read and analytics:view permissions.',
        category: 'permissions'
      }
    ]
  }
};