import { z } from 'zod';
import type { ToolDefinition, ToolHandler, ToolResult } from '../types.js';
import { prisma } from '@penny/database';

const kpiSchema = z.object({
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
  ])).optional(),
  groupBy: z.enum(['day', 'week', 'month', 'quarter', 'year']).optional(),
});

const handler: ToolHandler = async (params, context) => {
  const { startDate, endDate, metrics, groupBy = 'month' } = kpiSchema.parse(params);

  try {
    // In a real implementation, this would query actual KPI data
    // For now, return mock data
    const mockData = {
      period: {
        start: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        end: endDate || new Date().toISOString(),
      },
      metrics: {
        revenue: 1250000,
        mrr: 125000,
        arr: 1500000,
        churn_rate: 0.05,
        customer_count: 450,
        average_revenue_per_user: 278,
        customer_acquisition_cost: 1200,
        lifetime_value: 25000,
      },
      trend: {
        revenue: 0.12,
        mrr: 0.08,
        customer_count: 0.15,
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
        type: 'chart',
        name: 'KPI Dashboard',
        content: {
          type: 'line',
          data: mockData,
        },
        mimeType: 'application/vnd.penny.chart+json',
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

export const getCompanyKPIsTool: ToolDefinition = {
  name: 'get_company_kpis',
  displayName: 'Get Company KPIs',
  description: 'Retrieve key performance indicators for the company',
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