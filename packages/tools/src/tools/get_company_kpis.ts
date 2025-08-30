import { z } from 'zod';
import type { ToolDefinition, ToolContext, ToolResult } from '../types.js';

// Parameter schema
const CompanyKpisParamsSchema = z.object({
  timeframe: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']).default('monthly'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  metrics: z.array(z.enum([
    'revenue',
    'profit',
    'expenses',
    'users',
    'retention',
    'churn',
    'conversion',
    'growth',
    'satisfaction',
    'nps',
    'arpu',
    'ltv',
    'cac',
    'mrr',
    'arr'
  ])).optional(),
  departments: z.array(z.string()).optional(),
  format: z.enum(['json', 'csv', 'chart']).default('json'),
  includeProjections: z.boolean().default(false),
  includeBenchmarks: z.boolean().default(false),
});

type CompanyKpisParams = z.infer<typeof CompanyKpisParamsSchema>;

/**
 * Company KPIs Tool Handler
 */
async function getCompanyKpisHandler(
  params: CompanyKpisParams,
  context: ToolContext
): Promise<ToolResult> {
  try {
    const { 
      timeframe, 
      startDate, 
      endDate, 
      metrics, 
      departments, 
      format, 
      includeProjections,
      includeBenchmarks 
    } = params;

    // Validate date range
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return {
        success: false,
        error: {
          code: 'INVALID_DATE_RANGE',
          message: 'Start date must be before end date',
          category: 'validation'
        }
      };
    }

    // Mock KPI data generation (in real implementation, this would connect to actual data sources)
    const kpiData = await generateMockKpiData({
      timeframe,
      startDate,
      endDate,
      metrics,
      departments,
      includeProjections,
      includeBenchmarks,
      tenantId: context.tenantId
    });

    // Format data based on requested format
    let formattedData: any;
    let artifacts: any[] = [];
    let mimeType = 'application/json';

    switch (format) {
      case 'csv':
        formattedData = convertToCSV(kpiData);
        mimeType = 'text/csv';
        artifacts.push({
          type: 'file',
          name: `company_kpis_${timeframe}_${Date.now()}.csv`,
          content: formattedData,
          mimeType: 'text/csv',
          downloadable: true
        });
        break;
        
      case 'chart':
        const chartConfig = generateChartConfig(kpiData, metrics);
        formattedData = chartConfig;
        artifacts.push({
          type: 'visualization',
          name: `Company KPIs - ${timeframe}`,
          content: chartConfig,
          mimeType: 'application/json',
          preview: 'Chart showing company KPIs over time'
        });
        break;
        
      default:
        formattedData = kpiData;
    }

    // Calculate usage metrics
    const usage = {
      credits: metrics?.length ? metrics.length * 10 : 50,
      apiCalls: 1,
      duration: Date.now() - (context.executionId ? parseInt(context.executionId.split('_')[1]) : Date.now()),
    };

    return {
      success: true,
      data: formattedData,
      artifacts,
      usage,
      metadata: {
        timeframe,
        metricsCount: kpiData.metrics?.length || 0,
        dataPoints: kpiData.timeSeries?.length || 0,
        departments: departments || [],
        generatedAt: new Date().toISOString(),
        cached: false
      }
    };

  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'KPI_FETCH_ERROR',
        message: `Failed to fetch company KPIs: ${error.message}`,
        details: error,
        category: 'internal',
        retryable: true
      }
    };
  }
}

/**
 * Generate mock KPI data (replace with real data fetching in production)
 */
async function generateMockKpiData(options: {
  timeframe: string;
  startDate?: string;
  endDate?: string;
  metrics?: string[];
  departments?: string[];
  includeProjections: boolean;
  includeBenchmarks: boolean;
  tenantId: string;
}): Promise<any> {
  const { timeframe, metrics, departments, includeProjections, includeBenchmarks } = options;

  // Generate time series data
  const now = new Date();
  const periods = getPeriodsForTimeframe(timeframe, now);
  
  const timeSeries = periods.map(period => ({
    period: period.toISOString(),
    revenue: Math.floor(Math.random() * 1000000) + 500000,
    profit: Math.floor(Math.random() * 300000) + 100000,
    expenses: Math.floor(Math.random() * 200000) + 50000,
    users: Math.floor(Math.random() * 10000) + 5000,
    retention: Math.random() * 0.3 + 0.7, // 70-100%
    churn: Math.random() * 0.1, // 0-10%
    conversion: Math.random() * 0.1 + 0.05, // 5-15%
    growth: (Math.random() - 0.5) * 0.4, // -20% to +20%
    satisfaction: Math.random() * 2 + 3, // 3-5 scale
    nps: Math.random() * 60 + 20, // 20-80
    arpu: Math.floor(Math.random() * 100) + 50,
    ltv: Math.floor(Math.random() * 1000) + 500,
    cac: Math.floor(Math.random() * 200) + 50,
    mrr: Math.floor(Math.random() * 100000) + 50000,
    arr: Math.floor(Math.random() * 1200000) + 600000,
  }));

  // Filter metrics if specified
  const selectedMetrics = metrics || Object.keys(timeSeries[0]).filter(key => key !== 'period');
  
  const filteredTimeSeries = timeSeries.map(data => {
    const filtered: any = { period: data.period };
    selectedMetrics.forEach(metric => {
      if (metric in data) {
        filtered[metric] = (data as any)[metric];
      }
    });
    return filtered;
  });

  // Calculate summary statistics
  const summary: any = {};
  selectedMetrics.forEach(metric => {
    if (metric === 'period') return;
    
    const values = filteredTimeSeries.map(d => d[metric]).filter(v => typeof v === 'number');
    summary[metric] = {
      current: values[values.length - 1],
      previous: values[values.length - 2],
      average: values.reduce((sum, v) => sum + v, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      trend: values.length > 1 ? 
        ((values[values.length - 1] - values[values.length - 2]) / values[values.length - 2] * 100) : 0
    };
  });

  const result: any = {
    timeframe,
    summary,
    timeSeries: filteredTimeSeries,
    metadata: {
      generatedAt: new Date().toISOString(),
      dataPoints: filteredTimeSeries.length,
      metricsIncluded: selectedMetrics
    }
  };

  // Add projections if requested
  if (includeProjections) {
    result.projections = generateProjections(filteredTimeSeries, selectedMetrics, timeframe);
  }

  // Add benchmarks if requested
  if (includeBenchmarks) {
    result.benchmarks = generateBenchmarks(selectedMetrics);
  }

  // Add department breakdown if specified
  if (departments?.length) {
    result.departmentBreakdown = generateDepartmentData(departments, selectedMetrics);
  }

  return result;
}

/**
 * Generate periods based on timeframe
 */
function getPeriodsForTimeframe(timeframe: string, endDate: Date): Date[] {
  const periods: Date[] = [];
  const count = 12; // Show last 12 periods
  
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(endDate);
    
    switch (timeframe) {
      case 'daily':
        date.setDate(date.getDate() - i);
        break;
      case 'weekly':
        date.setDate(date.getDate() - (i * 7));
        break;
      case 'monthly':
        date.setMonth(date.getMonth() - i);
        break;
      case 'quarterly':
        date.setMonth(date.getMonth() - (i * 3));
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() - i);
        break;
    }
    
    periods.push(date);
  }
  
  return periods;
}

/**
 * Generate projections for the next periods
 */
function generateProjections(timeSeries: any[], metrics: string[], timeframe: string): any {
  const projections: any = {};
  
  metrics.forEach(metric => {
    if (metric === 'period') return;
    
    const values = timeSeries.map(d => d[metric]).filter(v => typeof v === 'number');
    if (values.length < 2) return;
    
    // Simple linear trend projection
    const trend = (values[values.length - 1] - values[values.length - 2]) / values[values.length - 2];
    const nextValue = values[values.length - 1] * (1 + trend);
    
    projections[metric] = {
      nextPeriod: nextValue,
      confidence: Math.random() * 0.3 + 0.7, // 70-100% confidence
      trend: trend > 0 ? 'increasing' : trend < 0 ? 'decreasing' : 'stable'
    };
  });
  
  return projections;
}

/**
 * Generate industry benchmarks
 */
function generateBenchmarks(metrics: string[]): any {
  const benchmarks: any = {};
  
  // Mock industry benchmarks
  const industryBenchmarks: any = {
    retention: { industry: 0.85, percentile75: 0.90, percentile50: 0.80 },
    churn: { industry: 0.05, percentile75: 0.03, percentile50: 0.07 },
    conversion: { industry: 0.08, percentile75: 0.12, percentile50: 0.06 },
    nps: { industry: 45, percentile75: 60, percentile50: 35 },
    satisfaction: { industry: 4.2, percentile75: 4.5, percentile50: 3.8 }
  };
  
  metrics.forEach(metric => {
    if (industryBenchmarks[metric]) {
      benchmarks[metric] = industryBenchmarks[metric];
    }
  });
  
  return benchmarks;
}

/**
 * Generate department breakdown data
 */
function generateDepartmentData(departments: string[], metrics: string[]): any {
  const departmentData: any = {};
  
  departments.forEach(dept => {
    departmentData[dept] = {};
    metrics.forEach(metric => {
      if (metric === 'period') return;
      
      // Generate department-specific values
      const baseValue = Math.random() * 100000;
      departmentData[dept][metric] = {
        value: baseValue,
        percentage: Math.random() * 100,
        trend: (Math.random() - 0.5) * 0.2
      };
    });
  });
  
  return departmentData;
}

/**
 * Convert KPI data to CSV format
 */
function convertToCSV(kpiData: any): string {
  if (!kpiData.timeSeries?.length) return '';
  
  const headers = Object.keys(kpiData.timeSeries[0]);
  const rows = kpiData.timeSeries.map((row: any) =>
    headers.map(header => `"${row[header] || ''}"`)
  );
  
  return [headers.join(','), ...rows.map(row => row.join(','))].join('
');
}

/**
 * Generate chart configuration for visualization
 */
function generateChartConfig(kpiData: any, selectedMetrics?: string[]): any {
  const metrics = selectedMetrics || Object.keys(kpiData.timeSeries[0]).filter(key => key !== 'period');
  
  return {
    type: 'line',
    title: 'Company KPIs Over Time',
    data: kpiData.timeSeries,
    xAxis: 'period',
    yAxes: metrics.map(metric => ({
      field: metric,
      label: metric.toUpperCase(),
      color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`
    })),
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'top' },
        tooltip: { mode: 'index', intersect: false }
      },
      scales: {
        x: { type: 'time', time: { unit: 'month' } },
        y: { beginAtZero: true }
      }
    }
  };
}

/**
 * Company KPIs Tool Definition
 */
export const getCompanyKpisTool: ToolDefinition = {
  name: 'get_company_kpis',
  displayName: 'Get Company KPIs',
  description: 'Retrieve and analyze company key performance indicators (KPIs) across various timeframes and departments',
  category: 'analytics',
  version: '1.0.0',
  icon: '📊',
  tags: ['analytics', 'kpis', 'metrics', 'business', 'reporting'],
  author: 'PENNY Core',
  
  schema: CompanyKpisParamsSchema,
  handler: getCompanyKpisHandler,
  
  config: {
    requiresAuth: true,
    permissions: ['analytics:read', 'kpi:view'],
    rateLimit: {
      requests: 100,
      window: 3600 // 1 hour
    },
    timeout: 15000, // 15 seconds
    maxRetries: 2,
    cost: 10,
    cacheable: true,
    cacheTTL: 300, // 5 minutes
    showInMarketplace: true,
    featured: true
  },
  
  metadata: {
    examples: [
      {
        title: 'Get monthly revenue metrics',
        description: 'Fetch monthly revenue data for the current year',
        parameters: {
          timeframe: 'monthly',
          metrics: ['revenue', 'profit', 'growth'],
          format: 'json'
        },
        expectedOutput: {
          success: true,
          data: {
            timeframe: 'monthly',
            summary: { revenue: { current: 850000, trend: 5.2 } }
          }
        }
      },
      {
        title: 'Generate KPI chart',
        description: 'Create a visualization of key metrics',
        parameters: {
          timeframe: 'quarterly',
          metrics: ['revenue', 'users', 'retention'],
          format: 'chart',
          includeProjections: true
        }
      }
    ],
    troubleshooting: [
      {
        issue: 'No data returned for specified timeframe',
        solution: 'Check if the date range contains valid data periods. Ensure start date is not too far in the past.',
        category: 'common'
      },
      {
        issue: 'Permission denied error',
        solution: 'Verify that your user role includes analytics:read and kpi:view permissions.',
        category: 'permissions'
      }
    ]
  }
};