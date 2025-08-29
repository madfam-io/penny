import { z } from 'zod';
import axios from 'axios';
import type { ToolDefinition, ToolHandler } from '../types.js';
import { prisma } from '@penny/database';

// Slack message schema
const slackMessageSchema = z.object({
  channel: z.string().describe('Channel name (e.g., "#general") or user ID'),
  text: z.string().describe('Message text (supports markdown)'),
  thread_ts: z.string().optional().describe('Thread timestamp to reply to'),
  attachments: z.array(z.object({
    title: z.string().optional(),
    text: z.string().optional(),
    color: z.string().optional(),
    fields: z.array(z.object({
      title: z.string(),
      value: z.string(),
      short: z.boolean().optional(),
    })).optional(),
  })).optional(),
  blocks: z.array(z.any()).optional().describe('Rich message blocks'),
  unfurl_links: z.boolean().default(true),
  unfurl_media: z.boolean().default(true),
});

// Slack channel operations
const slackChannelSchema = z.object({
  operation: z.enum(['list', 'info', 'history', 'members']),
  channel: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

// Slack user operations
const slackUserSchema = z.object({
  operation: z.enum(['list', 'info', 'presence']),
  user: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
});

// Slack file upload schema
const slackFileSchema = z.object({
  channels: z.array(z.string()).describe('Channels to share the file in'),
  content: z.string().describe('File content'),
  filename: z.string().describe('Name of the file'),
  title: z.string().optional(),
  initial_comment: z.string().optional(),
  filetype: z.string().optional().describe('File type (e.g., "text", "pdf", "png")'),
});

class SlackClient {
  private token: string;
  private baseUrl = 'https://slack.com/api';

  constructor(token: string) {
    this.token = token;
  }

  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  async postMessage(params: any) {
    const response = await axios.post(
      `${this.baseUrl}/chat.postMessage`,
      params,
      { headers: this.getHeaders() }
    );
    
    if (!response.data.ok) {
      throw new Error(response.data.error || 'Failed to send message');
    }
    
    return response.data;
  }

  async getChannels(limit: number = 100, cursor?: string) {
    const response = await axios.get(
      `${this.baseUrl}/conversations.list`,
      {
        params: {
          limit,
          cursor,
          exclude_archived: true,
          types: 'public_channel,private_channel',
        },
        headers: this.getHeaders(),
      }
    );
    
    if (!response.data.ok) {
      throw new Error(response.data.error || 'Failed to get channels');
    }
    
    return response.data;
  }

  async getChannelHistory(channel: string, limit: number = 20) {
    const response = await axios.get(
      `${this.baseUrl}/conversations.history`,
      {
        params: { channel, limit },
        headers: this.getHeaders(),
      }
    );
    
    if (!response.data.ok) {
      throw new Error(response.data.error || 'Failed to get channel history');
    }
    
    return response.data;
  }

  async getUsers(limit: number = 100, cursor?: string) {
    const response = await axios.get(
      `${this.baseUrl}/users.list`,
      {
        params: { limit, cursor },
        headers: this.getHeaders(),
      }
    );
    
    if (!response.data.ok) {
      throw new Error(response.data.error || 'Failed to get users');
    }
    
    return response.data;
  }

  async uploadFile(params: any) {
    const formData = new FormData();
    Object.keys(params).forEach(key => {
      formData.append(key, params[key]);
    });

    const response = await axios.post(
      `${this.baseUrl}/files.upload`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    
    if (!response.data.ok) {
      throw new Error(response.data.error || 'Failed to upload file');
    }
    
    return response.data;
  }
}

// Send Slack message handler
const sendMessageHandler: ToolHandler = async (params, context) => {
  const message = slackMessageSchema.parse(params);

  try {
    // Get Slack integration for tenant
    const integration = await prisma.integration.findFirst({
      where: {
        tenantId: context.tenantId,
        provider: 'slack',
        isActive: true,
      },
    });

    if (!integration || !integration.config) {
      // Return mock response if no integration
      return {
        success: true,
        data: {
          channel: message.channel,
          text: message.text,
          ts: Date.now().toString(),
          mock: true,
        },
        artifacts: [{
          type: 'document',
          name: 'Slack Message',
          content: {
            channel: message.channel,
            text: message.text,
            sent_at: new Date().toISOString(),
          },
          mimeType: 'application/json',
        }],
      };
    }

    const config = integration.config as any;
    const client = new SlackClient(config.botToken || config.accessToken);

    // Send message
    const result = await client.postMessage({
      channel: message.channel,
      text: message.text,
      thread_ts: message.thread_ts,
      attachments: message.attachments,
      blocks: message.blocks,
      unfurl_links: message.unfurl_links,
      unfurl_media: message.unfurl_media,
    });

    // Log execution
    await prisma.toolExecution.create({
      data: {
        toolId: 'send_slack_message',
        userId: context.userId,
        conversationId: context.conversationId,
        status: 'completed',
        parameters: params,
        result: { ts: result.ts, channel: result.channel },
        startedAt: new Date(),
        completedAt: new Date(),
        duration: 500,
      },
    });

    return {
      success: true,
      data: {
        channel: result.channel,
        ts: result.ts,
        message: result.message,
      },
      artifacts: [{
        type: 'document',
        name: 'Slack Message Sent',
        content: {
          channel: message.channel,
          text: message.text,
          timestamp: result.ts,
          permalink: result.permalink,
        },
        mimeType: 'application/json',
      }],
      usage: {
        credits: 1,
        duration: 500,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'SLACK_API_ERROR',
        message: error.message,
        retryable: error.response?.status >= 500,
      },
    };
  }
};

// Get Slack channels handler
const getChannelsHandler: ToolHandler = async (params, context) => {
  const request = slackChannelSchema.parse(params);

  try {
    const integration = await prisma.integration.findFirst({
      where: {
        tenantId: context.tenantId,
        provider: 'slack',
        isActive: true,
      },
    });

    if (!integration) {
      return {
        success: false,
        error: {
          code: 'SLACK_NOT_CONFIGURED',
          message: 'Slack integration not configured',
          retryable: false,
        },
      };
    }

    const config = integration.config as any;
    const client = new SlackClient(config.botToken || config.accessToken);

    let result;
    switch (request.operation) {
      case 'list':
        result = await client.getChannels(request.limit, request.cursor);
        return {
          success: true,
          data: {
            channels: result.channels.map((ch: any) => ({
              id: ch.id,
              name: ch.name,
              is_private: ch.is_private,
              num_members: ch.num_members,
              topic: ch.topic?.value,
              purpose: ch.purpose?.value,
            })),
            cursor: result.response_metadata?.next_cursor,
          },
          artifacts: [{
            type: 'table',
            name: 'Slack Channels',
            content: {
              columns: ['Name', 'Type', 'Members', 'Topic'],
              rows: result.channels.map((ch: any) => [
                ch.name,
                ch.is_private ? 'Private' : 'Public',
                ch.num_members || 0,
                ch.topic?.value || '',
              ]),
            },
            mimeType: 'application/json',
          }],
        };

      case 'history':
        if (!request.channel) {
          throw new Error('Channel ID required for history operation');
        }
        result = await client.getChannelHistory(request.channel, request.limit);
        return {
          success: true,
          data: {
            messages: result.messages.map((msg: any) => ({
              ts: msg.ts,
              user: msg.user,
              text: msg.text,
              thread_ts: msg.thread_ts,
              reply_count: msg.reply_count,
            })),
          },
        };

      default:
        throw new Error(`Unsupported operation: ${request.operation}`);
    }
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'SLACK_CHANNEL_ERROR',
        message: error.message,
        retryable: true,
      },
    };
  }
};

// Get Slack users handler
const getUsersHandler: ToolHandler = async (params, context) => {
  const request = slackUserSchema.parse(params);

  try {
    const integration = await prisma.integration.findFirst({
      where: {
        tenantId: context.tenantId,
        provider: 'slack',
        isActive: true,
      },
    });

    if (!integration) {
      return {
        success: false,
        error: {
          code: 'SLACK_NOT_CONFIGURED',
          message: 'Slack integration not configured',
          retryable: false,
        },
      };
    }

    const config = integration.config as any;
    const client = new SlackClient(config.botToken || config.accessToken);

    if (request.operation === 'list') {
      const result = await client.getUsers(request.limit);
      return {
        success: true,
        data: {
          users: result.members
            .filter((user: any) => !user.is_bot && !user.deleted)
            .map((user: any) => ({
              id: user.id,
              name: user.name,
              real_name: user.real_name,
              email: user.profile?.email,
              title: user.profile?.title,
              status: user.profile?.status_text,
              is_admin: user.is_admin,
              is_owner: user.is_owner,
            })),
        },
        artifacts: [{
          type: 'table',
          name: 'Slack Users',
          content: {
            columns: ['Name', 'Real Name', 'Email', 'Title'],
            rows: result.members
              .filter((user: any) => !user.is_bot && !user.deleted)
              .map((user: any) => [
                user.name,
                user.real_name || '',
                user.profile?.email || '',
                user.profile?.title || '',
              ]),
          },
          mimeType: 'application/json',
        }],
      };
    }

    throw new Error(`Unsupported operation: ${request.operation}`);
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'SLACK_USER_ERROR',
        message: error.message,
        retryable: true,
      },
    };
  }
};

// Tool definitions
export const sendSlackMessage: ToolDefinition = {
  name: 'send_slack_message',
  displayName: 'Send Slack Message',
  description: 'Send a message to a Slack channel or user',
  category: 'communication',
  icon: 'message-square',
  schema: slackMessageSchema,
  handler: sendMessageHandler,
  config: {
    requiresAuth: true,
    requiresConfirmation: true,
    permissions: ['slack:write'],
    rateLimit: {
      requests: 60,
      window: 60,
    },
    timeout: 10000,
    cost: 1,
  },
};

export const getSlackChannels: ToolDefinition = {
  name: 'get_slack_channels',
  displayName: 'Get Slack Channels',
  description: 'List Slack channels or get channel information',
  category: 'communication',
  icon: 'hash',
  schema: slackChannelSchema,
  handler: getChannelsHandler,
  config: {
    requiresAuth: true,
    permissions: ['slack:read'],
    rateLimit: {
      requests: 100,
      window: 3600,
    },
    timeout: 10000,
    cost: 1,
  },
};

export const getSlackUsers: ToolDefinition = {
  name: 'get_slack_users',
  displayName: 'Get Slack Users',
  description: 'List Slack users in the workspace',
  category: 'communication',
  icon: 'users',
  schema: slackUserSchema,
  handler: getUsersHandler,
  config: {
    requiresAuth: true,
    permissions: ['slack:read'],
    rateLimit: {
      requests: 100,
      window: 3600,
    },
    timeout: 10000,
    cost: 1,
  },
};