import { z } from 'zod';
import axios from 'axios';
import type { ToolDefinition, ToolHandler } from '../types.js';
import { prisma } from '@penny/database';

const jiraTicketSchema = z.object({
  project: z.string(),
  summary: z.string(),
  description: z.string(),
  issueType: z.enum(['Bug', 'Task', 'Story', 'Epic']).default('Task'),
  priority: z.enum(['Highest', 'High', 'Medium', 'Low', 'Lowest']).default('Medium'),
  assignee: z.string().optional(),
  labels: z.array(z.string()).optional(),
  components: z.array(z.string()).optional(),
  customFields: z.record(z.any()).optional(),
});

const handler: ToolHandler = async (params, context) => {
  const ticketData = jiraTicketSchema.parse(params);

  try {
    // Get Jira integration settings for tenant
    const integration = await prisma.integration.findFirst({
      where: {
        tenantId: context.tenantId,
        provider: 'jira',
        isActive: true,
      },
    });

    if (!integration) {
      throw new Error('Jira integration not configured');
    }

    const config = integration.config as any;
    const auth = context.auth?.credentials || config.credentials;

    // Create Jira ticket
    const response = await axios.post(
      `${config.baseUrl}/rest/api/3/issue`,
      {
        fields: {
          project: { key: ticketData.project },
          summary: ticketData.summary,
          description: {
            type: 'doc',
            version: 1,
            content: [{
              type: 'paragraph',
              content: [{
                type: 'text',
                text: ticketData.description,
              }],
            }],
          },
          issuetype: { name: ticketData.issueType },
          priority: { name: ticketData.priority },
          ...(ticketData.assignee && {
            assignee: { accountId: ticketData.assignee },
          }),
          ...(ticketData.labels && { labels: ticketData.labels }),
          ...(ticketData.components && {
            components: ticketData.components.map(c => ({ name: c })),
          }),
          ...ticketData.customFields,
        },
      },
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(
            `${auth.email}:${auth.apiToken}`
          ).toString('base64')}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      }
    );

    const ticketKey = response.data.key;
    const ticketUrl = `${config.baseUrl}/browse/${ticketKey}`;

    return {
      success: true,
      data: {
        key: ticketKey,
        id: response.data.id,
        url: ticketUrl,
      },
      artifacts: [{
        type: 'link',
        name: `Jira Ticket: ${ticketKey}`,
        content: ticketUrl,
        mimeType: 'text/uri-list',
      }],
      usage: {
        credits: 2,
        apiCalls: 1,
      },
    };
  } catch (error: any) {
    const isRetryable = error.response?.status >= 500 || 
                       error.code === 'ECONNREFUSED';

    return {
      success: false,
      error: {
        code: 'JIRA_API_ERROR',
        message: error.response?.data?.errorMessages?.[0] || error.message,
        details: error.response?.data,
        retryable: isRetryable,
      },
    };
  }
};

export const createJiraTicketTool: ToolDefinition = {
  name: 'create_jira_ticket',
  displayName: 'Create Jira Ticket',
  description: 'Create a new ticket in Jira',
  category: 'productivity',
  icon: 'ticket',
  schema: jiraTicketSchema,
  handler,
  config: {
    requiresAuth: true,
    requiresConfirmation: true,
    permissions: ['integration:jira:write'],
    rateLimit: {
      requests: 50,
      window: 3600,
    },
    timeout: 15000,
    maxRetries: 2,
    cost: 2,
  },
};