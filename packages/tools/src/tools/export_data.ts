import { z } from 'zod';
import type { ToolDefinition, ToolContext, ToolResult } from '../types.js';

const ExportDataParamsSchema = z.object({
  data: z.array(z.record(z.any())),
  format: z.enum(['csv', 'xlsx', 'json', 'pdf']),
  filename: z.string().optional(),
  options: z.object({
    includeHeaders: z.boolean().default(true),
    delimiter: z.string().default(','),
    encoding: z.string().default('utf-8'),
    compress: z.boolean().default(false)
  }).optional()
});

async function exportDataHandler(params: z.infer<typeof ExportDataParamsSchema>, context: ToolContext): Promise<ToolResult> {
  try {
    const { data, format, filename, options } = params;
    const defaultFilename = `export_${Date.now()}.${format}`;
    const finalFilename = filename || defaultFilename;
    
    let exportedContent: string;
    let mimeType: string;
    
    switch (format) {
      case 'csv':
        exportedContent = convertToCSV(data, options);
        mimeType = 'text/csv';
        break;
      case 'json':
        exportedContent = JSON.stringify(data, null, 2);
        mimeType = 'application/json';
        break;
      default:
        exportedContent = JSON.stringify(data);
        mimeType = 'application/json';
    }
    
    return {
      success: true,
      data: { filename: finalFilename, recordCount: data.length, format },
      artifacts: [{
        type: 'file',
        name: finalFilename,
        content: exportedContent,
        mimeType,
        downloadable: true,
        size: exportedContent.length
      }],
      usage: { credits: Math.ceil(data.length / 100) + 3 }
    };
  } catch (error: any) {
    return {
      success: false,
      error: { code: 'EXPORT_ERROR', message: error.message, category: 'internal' }
    };
  }
}

function convertToCSV(data: any[], options: any = {}): string {
  if (!data.length) return '';
  const headers = Object.keys(data[0]);
  const delimiter = options.delimiter || ',';
  
  let csv = '';
  if (options.includeHeaders !== false) {
    csv += headers.join(delimiter) + '
';
  }
  
  data.forEach(row => {
    csv += headers.map(header => `"${row[header] || ''}"`).join(delimiter) + '
';
  });
  
  return csv;
}

export const exportDataTool: ToolDefinition = {
  name: 'export_data',
  displayName: 'Export Data',
  description: 'Export data in various formats including CSV, Excel, JSON, and PDF',
  category: 'data',
  version: '1.0.0',
  schema: ExportDataParamsSchema,
  handler: exportDataHandler,
  config: {
    requiresAuth: true,
    permissions: ['data:export'],
    rateLimit: { requests: 20, window: 3600 },
    timeout: 30000
  }
};