import { z } from 'zod';
import type { ToolDefinition, ToolContext, ToolResult } from '../types.js';

const JiraIntegrationParamsSchema = z.object({
  action: z.enum(['create_issue', 'update_issue', 'get_issue', 'search_issues', 'add_comment']),
  issueKey: z.string().optional(),
  projectKey: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  issueType: z.string().optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
  assignee: z.string().optional(),
  labels: z.array(z.string()).optional(),
  jql: z.string().optional(),
  comment: z.string().optional()
});

async function jiraIntegrationHandler(params: z.infer<typeof JiraIntegrationParamsSchema>, context: ToolContext): Promise<ToolResult> {
  try {
    const { action, issueKey, projectKey, summary, description, issueType, priority, assignee, labels, jql, comment } = params;
    
    // Mock Jira operations
    switch (action) {
      case 'create_issue':
        return {
          success: true,
          data: {
            key: 'PROJ-123',
            summary,
            status: 'To Do',
            created: new Date().toISOString()
          },
          usage: { credits: 10 }
        };
        
      case 'search_issues':
        return {
          success: true,
          data: {
            issues: [
              { key: 'PROJ-123', summary: 'Sample Issue 1', status: 'In Progress' },
              { key: 'PROJ-124', summary: 'Sample Issue 2', status: 'Done' }
            ],
            total: 2
          },
          usage: { credits: 5 }
        };
        
      default:
        return {
          success: true,
          data: { message: `${action} completed successfully` },
          usage: { credits: 5 }
        };
    }
  } catch (error: any) {
    return {
      success: false,
      error: { code: 'JIRA_ERROR', message: error.message, category: 'integration' }
    };
  }
}

export const jiraIntegrationTool: ToolDefinition = {
  name: 'jira_integration',
  displayName: 'Jira Integration',
  description: 'Create, update, and manage Jira issues and projects',
  category: 'integration',
  version: '1.0.0',
  schema: JiraIntegrationParamsSchema,
  handler: jiraIntegrationHandler,
  config: {
    requiresAuth: true,
    permissions: ['jira:access'],
    rateLimit: { requests: 100, window: 3600 },
    timeout: 15000
  }
};