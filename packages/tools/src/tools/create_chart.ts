import { z } from 'zod';
import type { ToolDefinition, ToolContext, ToolResult } from '../types.js';

const CreateChartParamsSchema = z.object({
  type: z.enum(['line', 'bar', 'pie', 'scatter', 'area', 'histogram', 'heatmap']),
  data: z.array(z.record(z.any())),
  title: z.string().optional(),
  xAxis: z.string(),
  yAxis: z.string().optional(),
  groupBy: z.string().optional(),
  colors: z.array(z.string()).optional(),
  width: z.number().default(800),
  height: z.number().default(600),
  theme: z.enum(['light', 'dark']).default('light'),
  interactive: z.boolean().default(true)
});

async function createChartHandler(params: z.infer<typeof CreateChartParamsSchema>, context: ToolContext): Promise<ToolResult> {
  try {
    const chartConfig = {
      type: params.type,
      title: params.title,
      data: params.data,
      xAxis: params.xAxis,
      yAxis: params.yAxis,
      theme: params.theme,
      dimensions: { width: params.width, height: params.height }
    };
    
    return {
      success: true,
      data: chartConfig,
      artifacts: [{
        type: 'visualization',
        name: params.title || `${params.type} Chart`,
        content: chartConfig,
        mimeType: 'application/json',
        preview: `${params.type} chart with ${params.data.length} data points`
      }],
      usage: { credits: Math.ceil(params.data.length / 10) + 5 }
    };
  } catch (error: any) {
    return {
      success: false,
      error: { code: 'CHART_CREATE_ERROR', message: error.message, category: 'internal' }
    };
  }
}

export const createChartTool: ToolDefinition = {
  name: 'create_chart',
  displayName: 'Create Chart',
  description: 'Generate interactive charts and visualizations from data',
  category: 'visualization',
  version: '1.0.0',
  schema: CreateChartParamsSchema,
  handler: createChartHandler,
  config: {
    requiresAuth: true,
    permissions: ['chart:create'],
    rateLimit: { requests: 100, window: 3600 },
    timeout: 10000
  }
};