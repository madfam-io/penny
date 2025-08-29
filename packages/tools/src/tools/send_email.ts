import { z } from 'zod';
import type { ToolDefinition, ToolContext, ToolResult } from '../types.js';

const SendEmailParamsSchema = z.object({
  to: z.array(z.string().email()).min(1),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  subject: z.string().min(1),
  body: z.string(),
  bodyType: z.enum(['text', 'html']).default('html'),
  attachments: z.array(z.object({
    name: z.string(),
    content: z.string(),
    mimeType: z.string()
  })).optional(),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  schedule: z.string().datetime().optional(),
  template: z.string().optional(),
  variables: z.record(z.any()).optional()
});

async function sendEmailHandler(params: z.infer<typeof SendEmailParamsSchema>, context: ToolContext): Promise<ToolResult> {
  try {
    // Mock email sending
    const emailId = `email_${Date.now()}`;
    
    return {
      success: true,
      data: {
        emailId,
        recipients: params.to.length + (params.cc?.length || 0) + (params.bcc?.length || 0),
        status: 'sent',
        sentAt: new Date().toISOString()
      },
      usage: { credits: params.to.length * 2 + 5 }
    };
  } catch (error: any) {
    return {
      success: false,
      error: { code: 'EMAIL_SEND_ERROR', message: error.message, category: 'external' }
    };
  }
}

export const sendEmailTool: ToolDefinition = {
  name: 'send_email',
  displayName: 'Send Email',
  description: 'Send emails with support for HTML content, attachments, and scheduling',
  category: 'communication',
  version: '1.0.0',
  schema: SendEmailParamsSchema,
  handler: sendEmailHandler,
  config: {
    requiresAuth: true,
    permissions: ['email:send'],
    rateLimit: { requests: 50, window: 3600 },
    timeout: 15000
  }
};