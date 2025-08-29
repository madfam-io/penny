import { z } from 'zod';
import type { ToolDefinition, ToolHandler, ToolResult } from '../types.js';
import { prisma } from '@penny/database';

const kpiSchema = z.object({
  period: z.enum(['MTD', 'QTD', 'YTD', 'custom']).default('MTD'),
  unit: z.enum(['company', 'bu', 'project']).default('company'),
  id: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  metrics: z.array(z.enum([
    'revenue',
    'mrr',
    'arr',
    'churn_rate',
    'customer_count',
    'average_revenue_per_user',
    'customer_acquisition_cost',
    'lifetime_value',
    'profit_margin',
    'operational_efficiency',
  ])).optional(),
  groupBy: z.enum(['day', 'week', 'month', 'quarter', 'year']).optional(),
});

const handler: ToolHandler = async (params, context) => {
  const { period, unit, id, startDate, endDate, metrics, groupBy = 'month' } = kpiSchema.parse(params);

  try {
    // Calculate date range based on period
    const now = new Date();
    let periodStart: Date;
    let periodEnd = now;
    
    if (period === 'custom' && startDate && endDate) {
      periodStart = new Date(startDate);
      periodEnd = new Date(endDate);
    } else {
      switch (period) {
        case 'MTD':
          periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'QTD':
          const quarter = Math.floor(now.getMonth() / 3);
          periodStart = new Date(now.getFullYear(), quarter * 3, 1);
          break;
        case 'YTD':
        default:
          periodStart = new Date(now.getFullYear(), 0, 1);
      }
    }

    // Generate comprehensive KPI data
    const multiplier = period === 'MTD' ? 1 : period === 'QTD' ? 3 : 12;
    const baseRevenue = 1250000;
    
    const mockData = {
      period: {
        type: period,
        start: periodStart.toISOString(),
        end: periodEnd.toISOString(),
      },
      unit: {
        type: unit,
        id: id || 'global',
        name: unit === 'company' ? 'PENNY Corp' : `${unit}-${id}`,
      },
      metrics: {
        revenue: baseRevenue * multiplier,
        mrr: 125000,
        arr: 1500000,
        churn_rate: 0.045,
        customer_count: 450 + (multiplier * 30),
        average_revenue_per_user: 2780,
        customer_acquisition_cost: 1200,
        lifetime_value: 25000,
        profit_margin: 0.229,
        operational_efficiency: 0.785,
      },
      trend: {
        revenue: 0.125,
        mrr: 0.082,
        customer_count: 0.153,
        churn_rate: -0.012,
        profit_margin: 0.018,
      },
      breakdown: {
        revenue_by_segment: [
          { name: 'Enterprise', value: baseRevenue * multiplier * 0.6 },
          { name: 'SMB', value: baseRevenue * multiplier * 0.3 },
          { name: 'Startup', value: baseRevenue * multiplier * 0.1 },
        ],
        customer_by_tier: [
          { name: 'Platinum', count: 45, revenue: baseRevenue * multiplier * 0.4 },
          { name: 'Gold', count: 120, revenue: baseRevenue * multiplier * 0.35 },
          { name: 'Silver', count: 285, revenue: baseRevenue * multiplier * 0.25 },
        ],
      },
    };

    // Log tool usage
    await prisma.toolExecution.create({
      data: {
        toolId: 'get_company_kpis',
        userId: context.userId,
        conversationId: context.conversationId,
        status: 'completed',
        parameters: params,
        result: mockData,
        startedAt: new Date(),
        completedAt: new Date(),
        duration: 150,
      },
    });

    return {
      success: true,
      data: mockData,
      artifacts: [{
        type: 'dashboard',
        name: `KPI Dashboard - ${period}`,
        content: {
          layout: 'grid',
          widgets: [
            {
              type: 'metric',
              title: 'Revenue',
              value: mockData.metrics.revenue,
              change: mockData.trend.revenue,
              format: 'currency',
            },
            {
              type: 'metric',
              title: 'Customers',
              value: mockData.metrics.customer_count,
              change: mockData.trend.customer_count,
              format: 'number',
            },
            {
              type: 'chart',
              title: 'Revenue Trend',
              chartType: 'line',
              data: generateTrendData(30, baseRevenue / 30),
            },
            {
              type: 'chart',
              title: 'Revenue by Segment',
              chartType: 'pie',
              data: mockData.breakdown.revenue_by_segment,
            },
            {
              type: 'gauge',
              title: 'Profit Margin',
              value: mockData.metrics.profit_margin * 100,
              min: 0,
              max: 50,
              thresholds: [10, 20, 30],
            },
            {
              type: 'metric',
              title: 'Churn Rate',
              value: mockData.metrics.churn_rate,
              change: mockData.trend.churn_rate,
              format: 'percentage',
              inverse: true, // Lower is better
            },
          ],
        },
        mimeType: 'application/vnd.penny.dashboard+json',
      }],
      usage: {
        credits: 1,
        duration: 150,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'KPI_FETCH_ERROR',
        message: error.message,
        retryable: true,
      },
    };
  }
};

// Helper function to generate trend data
function generateTrendData(points: number, baseValue: number): Array<{x: string; y: number}> {
  const data = [];
  const now = new Date();
  for (let i = 0; i < points; i++) {
    const date = new Date(now.getTime() - (points - i) * 86400000);
    const variance = (Math.random() - 0.5) * 0.2; // ±10% variance
    data.push({
      x: date.toISOString().split('T')[0],
      y: Math.round(baseValue * (1 + variance)),
    });
  }
  return data;
}

export const getCompanyKPIsTool: ToolDefinition = {
  name: 'get_company_kpis',
  displayName: 'Get Company KPIs',
  description: 'Retrieve comprehensive key performance indicators for specified period and business unit',
  category: 'analytics',
  icon: 'chart-line',
  schema: kpiSchema,
  handler,
  config: {
    requiresAuth: true,
    permissions: ['analytics:view'],
    rateLimit: {
      requests: 100,
      window: 3600,
    },
    timeout: 30000,
    cost: 1,
  },
};