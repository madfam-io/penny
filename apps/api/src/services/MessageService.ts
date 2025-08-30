import { PrismaClient } from '@prisma/client';\nimport { AIService } from './AIService';\nimport { ToolService } from './ToolService';\nimport { UsageService } from './UsageService';
import { Readable } from 'stream';

interface GetMessagesOptions {
  role?: string;
  parentMessageId?: string;
  limit: number;
  offset: number;
  before?: string;
  after?: string;
  search?: string;
}

interface CreateMessageData {
  conversationId: string;
  userId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  parentMessageId?: string;
  toolCalls?: any;
  metadata?: Record<string, unknown>;
}

interface StreamCompletionData {
  conversationId: string;
  tenantId: string;
  userId: string;
  content: string;
  toolsAllowed?: string[];
  artifactsExpected?: string[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, unknown>;
}

interface VerifyAccessOptions {
  tenantId: string;
  userId: string;
}

interface UpdateMessageData {
  tenantId: string;
  userId: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export class MessageService {
  private prisma: PrismaClient;
  private aiService: AIService;
  private toolService: ToolService;
  private usageService: UsageService;

  constructor() {
    this.prisma = new PrismaClient();
    this.aiService = new AIService();
    this.toolService = new ToolService();
    this.usageService = new UsageService();
  }

  async verifyConversationAccess(conversationId: string, options: VerifyAccessOptions): Promise<boolean> {
    const { tenantId, userId } = options;
    
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        tenantId,
        userId,
      },
    });

    return !!conversation;
  }

  async getMessages(conversationId: string, options: GetMessagesOptions) {
    const {
      role,
      parentMessageId,
      limit,
      offset,
      before,
      after,
      search,
    } = options;

    const where: any = {
      conversationId,
      ...(role && { role }),
      ...(parentMessageId && { parentMessageId }),
      ...(search && {
        content: { contains: search, mode: 'insensitive' },
      }),
    };

    // Cursor-based pagination
    if (before) {
      where.id = { lt: before };
    } else if (after) {
      where.id = { gt: after };
    }

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: cursor-based ? 0 : offset,
        include: {
          replies: {
            take: 3,
            select: {
              id: true,
              content: true,
              role: true,
              createdAt: true,
            },
          },
          artifacts: {
            select: {
              id: true,
              type: true,
              name: true,
              storageUrl: true,
            },
          },
        },
      }),
      this.prisma.message.count({ where }),
    ]);

    const hasMore = messages.length === limit;
    const nextCursor = hasMore ? messages[messages.length - 1].id : undefined;
    const prevCursor = messages.length > 0 ? messages[0].id : undefined;

    return {
      data: messages.map(msg => ({
        id: msg.id,
        conversationId: msg.conversationId,
        userId: msg.userId,
        role: msg.role,
        content: msg.content,
        metadata: msg.metadata as Record<string, unknown>,
        parentMessageId: msg.parentMessageId,
        toolCalls: msg.toolCalls as any,
        tokenCount: msg.tokenCount,
        createdAt: msg.createdAt.toISOString(),
        replies: msg.replies?.map(reply => ({
          id: reply.id,
          content: reply.content,
          role: reply.role,
          createdAt: reply.createdAt.toISOString(),
        })),
        artifacts: msg.artifacts?.map(artifact => ({
          id: artifact.id,
          type: artifact.type,
          name: artifact.name,
          url: artifact.storageUrl,
        })),
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore,
        nextCursor,
        prevCursor,
      },
    };
  }

  async getMessage(id: string, options: VerifyAccessOptions) {
    const { tenantId, userId } = options;

    const message = await this.prisma.message.findFirst({
      where: {
        id,
        conversation: {
          tenantId,
          userId,
        },
      },
      include: {
        replies: {
          select: {
            id: true,
            content: true,
            role: true,
            createdAt: true,
          },
        },
        artifacts: {
          select: {
            id: true,
            type: true,
            name: true,
            storageUrl: true,
          },
        },
      },
    });

    if (!message) {
      return null;
    }

    return {
      id: message.id,
      conversationId: message.conversationId,
      userId: message.userId,
      role: message.role,
      content: message.content,
      metadata: message.metadata as Record<string, unknown>,
      parentMessageId: message.parentMessageId,
      toolCalls: message.toolCalls as any,
      tokenCount: message.tokenCount,
      createdAt: message.createdAt.toISOString(),
      replies: message.replies?.map(reply => ({
        id: reply.id,
        content: reply.content,
        role: reply.role,
        createdAt: reply.createdAt.toISOString(),
      })),
      artifacts: message.artifacts?.map(artifact => ({
        id: artifact.id,
        type: artifact.type,
        name: artifact.name,
        url: artifact.storageUrl,
      })),
    };
  }

  async createMessage(data: CreateMessageData) {
    const {
      conversationId,
      userId,
      role,
      content,
      parentMessageId,
      toolCalls,
      metadata = {},
    } = data;

    // Calculate token count
    const tokenCount = await this.aiService.countTokens(content);

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        userId,
        role,
        content,
        parentMessageId,
        toolCalls,
        metadata,
        tokenCount,
      },
    });

    // Record usage
    await this.usageService.recordUsage({
      tenantId: (await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { tenantId: true },
      }))!.tenantId,
      userId,
      resourceType: 'messages',
      resourceId: conversationId,
      quantity: 1,
      unit: 'count',
    });

    await this.usageService.recordUsage({
      tenantId: (await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { tenantId: true },
      }))!.tenantId,
      userId,
      resourceType: 'tokens',
      resourceId: message.id,
      quantity: tokenCount,
      unit: 'tokens',
    });

    return {
      id: message.id,
      conversationId: message.conversationId,
      userId: message.userId,
      role: message.role,
      content: message.content,
      metadata: message.metadata as Record<string, unknown>,
      parentMessageId: message.parentMessageId,
      toolCalls: message.toolCalls as any,
      tokenCount: message.tokenCount,
      createdAt: message.createdAt.toISOString(),
    };
  }

  async streamCompletion(data: StreamCompletionData): Promise<Readable> {
    const {
      conversationId,
      tenantId,
      userId,
      content,
      toolsAllowed,
      artifactsExpected,
      model,
      temperature,
      maxTokens,
      metadata = {},
    } = data;

    // Create user message first
    const userMessage = await this.createMessage({
      conversationId,
      userId,
      role: 'user',
      content,
      metadata,
    });

    // Get conversation context
    const context = await this.getConversationContext(conversationId);

    // Prepare tools if allowed
    let availableTools = [];
    if (toolsAllowed && toolsAllowed.length > 0) {
      availableTools = await this.toolService.getToolsForExecution(
        toolsAllowed,
        tenantId
      );
    }

    // Create a readable stream
    const stream = new Readable({
      objectMode: false,
      read() {},
    });

    // Start AI completion in background
    this.processStreamCompletion({
      stream,
      conversationId,
      tenantId,
      userId,
      context,
      availableTools,
      model,
      temperature,
      maxTokens,
      metadata,
    });

    return stream;
  }

  private async processStreamCompletion(options: {
    stream: Readable;
    conversationId: string;
    tenantId: string;
    userId: string;
    context: any;
    availableTools: any[];
    model?: string;
    temperature?: number;
    maxTokens?: number;
    metadata: Record<string, unknown>;
  }) {
    const {
      stream,
      conversationId,
      tenantId,
      userId,
      context,
      availableTools,
      model,
      temperature,
      maxTokens,
      metadata,
    } = options;

    try {\n      let assistantContent = '';
      let toolCalls: any[] = [];

      // Stream AI completion
      const completionStream = await this.aiService.streamCompletion({
        messages: context.messages,
        tools: availableTools,
        model,
        temperature,
        maxTokens,
      });

      for await (const chunk of completionStream) {
        if (chunk.type === 'content') {
          assistantContent += chunk.content;
          stream.push(`data: ${JSON.stringify({
            type: 'content',
            content: chunk.content,
          })}

`);
        } else if (chunk.type === 'tool_call') {
          toolCalls.push(chunk.toolCall);
          stream.push(`data: ${JSON.stringify({
            type: 'tool_call',
            toolCall: chunk.toolCall,
          })}

`);
        } else if (chunk.type === 'done') {
          // Save assistant message
          const assistantMessage = await this.createMessage({
            conversationId,
            userId: null, // Assistant message
            role: 'assistant',
            content: assistantContent,
            toolCalls: toolCalls.length > 0 ? toolCalls : null,
            metadata,
          });

          // Execute tool calls if any
          if (toolCalls.length > 0) {
            await this.executeToolCalls(toolCalls, {
              stream,
              conversationId,
              tenantId,
              userId,
              parentMessageId: assistantMessage.id,
            });
          }

          stream.push(`data: ${JSON.stringify({
            type: 'done',
            messageId: assistantMessage.id,
          })}

`);

          stream.push(null); // End stream
        }
      }
    } catch (error) {
      stream.push(`data: ${JSON.stringify({
        type: 'error',
        error: error.message,
      })}

`);
      
      stream.push(null);
    }
  }

  private async executeToolCalls(toolCalls: any[], options: {
    stream: Readable;
    conversationId: string;
    tenantId: string;
    userId: string;
    parentMessageId: string;
  }) {
    const { stream, conversationId, tenantId, userId, parentMessageId } = options;

    for (const toolCall of toolCalls) {
      try {
        stream.push(`data: ${JSON.stringify({
          type: 'tool_execution_start',
          toolCallId: toolCall.id,
          toolName: toolCall.function.name,
        })}

`);

        const result = await this.toolService.executeTool({
          name: toolCall.function.name,
          parameters: JSON.parse(toolCall.function.arguments),
          tenantId,
          userId,
          conversationId,
        });

        // Create tool result message
        await this.createMessage({
          conversationId,
          userId,
          role: 'tool',
          content: JSON.stringify(result),
          parentMessageId,
          metadata: {
            toolCallId: toolCall.id,
            toolName: toolCall.function.name,
          },
        });

        stream.push(`data: ${JSON.stringify({
          type: 'tool_execution_complete',
          toolCallId: toolCall.id,
          result,
        })}

`);

      } catch (error) {
        stream.push(`data: ${JSON.stringify({
          type: 'tool_execution_error',
          toolCallId: toolCall.id,
          error: error.message,
        })}

`);
      }
    }
  }

  async updateMessage(id: string, data: UpdateMessageData) {
    const { tenantId, userId, content, metadata } = data;

    const message = await this.prisma.message.findFirst({
      where: {
        id,
        userId, // Only allow updating own messages
        conversation: {
          tenantId,
          userId,
        },
      },
    });

    if (!message) {
      return null;
    }

    // Recalculate token count
    const tokenCount = await this.aiService.countTokens(content);

    const updated = await this.prisma.message.update({
      where: { id },
      data: {
        content,
        tokenCount,
        ...(metadata && { metadata }),
      },
    });

    return {
      id: updated.id,
      conversationId: updated.conversationId,
      userId: updated.userId,
      role: updated.role,
      content: updated.content,
      metadata: updated.metadata as Record<string, unknown>,
      parentMessageId: updated.parentMessageId,
      toolCalls: updated.toolCalls as any,
      tokenCount: updated.tokenCount,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  async deleteMessage(id: string, options: VerifyAccessOptions) {
    const { tenantId, userId } = options;

    const message = await this.prisma.message.findFirst({
      where: {
        id,
        userId, // Only allow deleting own messages
        conversation: {
          tenantId,
          userId,
        },
      },
    });

    if (!message) {
      return false;
    }

    // Delete message and all replies
    await this.prisma.message.deleteMany({
      where: {
        OR: [
          { id },
          { parentMessageId: id },
        ],
      },
    });

    return true;
  }

  async getMessageThread(id: string, options: VerifyAccessOptions) {
    const { tenantId, userId } = options;

    const message = await this.prisma.message.findFirst({
      where: {
        id,
        conversation: {
          tenantId,
          userId,
        },
      },
    });

    if (!message) {
      return null;
    }

    // Get the root message and all replies in thread
    const rootId = message.parentMessageId || message.id;
    
    const thread = await this.prisma.message.findMany({
      where: {
        OR: [
          { id: rootId },
          { parentMessageId: rootId },
        ],
      },
      orderBy: { createdAt: 'asc' },
      include: {
        artifacts: {
          select: {
            id: true,
            type: true,
            name: true,
            storageUrl: true,
          },
        },
      },
    });

    return thread.map(msg => ({
      id: msg.id,
      conversationId: msg.conversationId,
      userId: msg.userId,
      role: msg.role,
      content: msg.content,
      metadata: msg.metadata as Record<string, unknown>,
      parentMessageId: msg.parentMessageId,
      toolCalls: msg.toolCalls as any,
      tokenCount: msg.tokenCount,
      createdAt: msg.createdAt.toISOString(),
      artifacts: msg.artifacts?.map(artifact => ({
        id: artifact.id,
        type: artifact.type,
        name: artifact.name,
        url: artifact.storageUrl,
      })),
    }));
  }

  async regenerateResponse(id: string, options: {
    tenantId: string;
    userId: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }) {
    const { tenantId, userId, model, temperature, maxTokens } = options;

    const message = await this.prisma.message.findFirst({
      where: {
        id,
        role: 'user', // Only regenerate for user messages
        conversation: {
          tenantId,
          userId,
        },
      },
      include: {
        replies: {
          where: { role: 'assistant' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!message) {
      return null;
    }

    // Delete previous assistant response if exists
    if (message.replies.length > 0) {
      await this.prisma.message.delete({
        where: { id: message.replies[0].id },
      });
    }

    // Get conversation context up to this message
    const context = await this.getConversationContext(message.conversationId);
    const contextMessages = context.messages.filter(
      (msg: any) => new Date(msg.createdAt) <= message.createdAt
    );

    // Generate new response
    const completion = await this.aiService.generateCompletion({
      messages: contextMessages,
      model,
      temperature,
      maxTokens,
    });

    // Create new assistant message
    const assistantMessage = await this.createMessage({
      conversationId: message.conversationId,
      userId: null, // Assistant message
      role: 'assistant',
      content: completion.content,
      parentMessageId: message.id,
      toolCalls: completion.toolCalls,
    });

    return assistantMessage;
  }

  private async getConversationContext(conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            role: true,
            content: true,
            toolCalls: true,
            createdAt: true,
          },
        },
        memories: {
          where: {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } },
            ],
          },
          select: {
            key: true,
            value: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    return {
      id: conversation.id,
      messages: conversation.messages,
      memories: conversation.memories,
    };
  }

  async searchMessages(query: string, options: {
    tenantId: string;
    userId: string;
    conversationId?: string;
    role?: string;
    limit?: number;
  }) {
    const { tenantId, userId, conversationId, role, limit = 20 } = options;

    const where: any = {
      conversation: {
        tenantId,
        userId,
      },
      content: { contains: query, mode: 'insensitive' },
      ...(conversationId && { conversationId }),
      ...(role && { role }),
    };

    const messages = await this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        conversation: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    return messages.map(msg => ({
      id: msg.id,
      conversationId: msg.conversationId,
      conversationTitle: msg.conversation.title,
      role: msg.role,
      content: msg.content,
      createdAt: msg.createdAt.toISOString(),
    }));
  }

  async getMessageStats(options: {
    tenantId: string;
    userId?: string;
    conversationId?: string;\n    period?: '7d' | '30d' | '90d';
  }) {\n    const { tenantId, userId, conversationId, period = '30d' } = options;
\n    const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    const where = {
      conversation: {
        tenantId,
        ...(userId && { userId }),
      },
      ...(conversationId && { conversationId }),
      createdAt: { gte: startDate },
    };

    const [stats, roleBreakdown] = await Promise.all([
      this.prisma.message.aggregate({
        where,
        _count: true,
        _sum: { tokenCount: true },
        _avg: { tokenCount: true },
      }),
      this.prisma.message.groupBy({
        by: ['role'],
        where,
        _count: true,
        _sum: { tokenCount: true },
      }),
    ]);

    return {
      totalMessages: stats._count,
      totalTokens: stats._sum.tokenCount || 0,
      averageTokensPerMessage: Math.round(stats._avg.tokenCount || 0),
      breakdown: roleBreakdown.map(item => ({
        role: item.role,
        count: item._count,
        tokens: item._sum.tokenCount || 0,
      })),
    };
  }
}