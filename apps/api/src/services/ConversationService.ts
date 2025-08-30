import { PrismaClient } from '@prisma/client';\nimport { AIService } from './AIService';

interface GetConversationsOptions {
  tenantId: string;
  userId: string;
  workspaceId?: string;
  isArchived?: boolean;
  search?: string;
  limit: number;
  offset: number;
  sortBy: 'createdAt' | 'updatedAt' | 'title';
  sortOrder: 'asc' | 'desc';
}

interface GetConversationOptions {
  tenantId: string;
  userId: string;
  includeMessages?: boolean;
  includeArtifacts?: boolean;
}

interface CreateConversationData {
  tenantId: string;
  userId: string;
  workspaceId?: string;
  title?: string;
  metadata?: Record<string, unknown>;
}

interface UpdateConversationData {
  tenantId: string;
  userId: string;
  title?: string;
  metadata?: Record<string, unknown>;
  isArchived?: boolean;
}

export class ConversationService {
  private prisma: PrismaClient;
  private aiService: AIService;

  constructor() {
    this.prisma = new PrismaClient();
    this.aiService = new AIService();
  }

  async getConversations(options: GetConversationsOptions) {
    const {
      tenantId,
      userId,
      workspaceId,
      isArchived,
      search,
      limit,
      offset,
      sortBy,
      sortOrder,
    } = options;

    const where = {
      tenantId,
      userId,
      ...(workspaceId && { workspaceId }),
      ...(typeof isArchived === 'boolean' && { isArchived }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { summary: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        take: limit,
        skip: offset,
        include: {
          _count: {
            select: { messages: true },
          },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              content: true,
              role: true,
              createdAt: true,
            },
          },
        },
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return {
      data: conversations.map(conv => ({
        id: conv.id,
        tenantId: conv.tenantId,
        workspaceId: conv.workspaceId,
        userId: conv.userId,
        title: conv.title,
        summary: conv.summary,
        metadata: conv.metadata as Record<string, unknown>,
        isArchived: conv.isArchived,
        archivedAt: conv.archivedAt?.toISOString() || null,
        createdAt: conv.createdAt.toISOString(),
        updatedAt: conv.updatedAt.toISOString(),
        messageCount: conv._count.messages,
        lastMessage: conv.messages[0] ? {
          id: conv.messages[0].id,
          content: conv.messages[0].content,
          role: conv.messages[0].role,
          createdAt: conv.messages[0].createdAt.toISOString(),
        } : undefined,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  }

  async getConversation(id: string, options: GetConversationOptions) {
    const { tenantId, userId, includeMessages, includeArtifacts } = options;

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id,
        tenantId,
        userId,
      },
      include: {
        _count: {
          select: { messages: true },
        },
        ...(includeMessages && {
          messages: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              role: true,
              content: true,
              metadata: true,
              tokenCount: true,
              createdAt: true,
            },
          },
        }),
        ...(includeArtifacts && {
          artifacts: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              type: true,
              name: true,
              createdAt: true,
            },
          },
        }),
      },
    });

    if (!conversation) {
      return null;
    }

    return {
      id: conversation.id,
      tenantId: conversation.tenantId,
      workspaceId: conversation.workspaceId,
      userId: conversation.userId,
      title: conversation.title,
      summary: conversation.summary,
      metadata: conversation.metadata as Record<string, unknown>,
      isArchived: conversation.isArchived,
      archivedAt: conversation.archivedAt?.toISOString() || null,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      messageCount: conversation._count.messages,
      ...(includeMessages && {
        messages: conversation.messages?.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          metadata: msg.metadata as Record<string, unknown>,
          tokenCount: msg.tokenCount,
          createdAt: msg.createdAt.toISOString(),
        })),
      }),
      ...(includeArtifacts && {
        artifacts: conversation.artifacts?.map(artifact => ({
          id: artifact.id,
          type: artifact.type,
          name: artifact.name,
          createdAt: artifact.createdAt.toISOString(),
        })),
      }),
    };
  }

  async createConversation(data: CreateConversationData) {
    const { tenantId, userId, workspaceId, title, metadata = {} } = data;

    // Get default workspace if none specified
    let finalWorkspaceId = workspaceId;
    if (!finalWorkspaceId) {
      const defaultWorkspace = await this.prisma.workspace.findFirst({
        where: {
          tenantId,
          isDefault: true,
        },
      });
      
      if (!defaultWorkspace) {
        throw new Error('No default workspace found');
      }
      
      finalWorkspaceId = defaultWorkspace.id;
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        tenantId,
        workspaceId: finalWorkspaceId,
        userId,
        title: title || 'New Conversation',
        metadata,
      },
    });

    return {
      id: conversation.id,
      tenantId: conversation.tenantId,
      workspaceId: conversation.workspaceId,
      userId: conversation.userId,
      title: conversation.title,
      summary: conversation.summary,
      metadata: conversation.metadata as Record<string, unknown>,
      isArchived: conversation.isArchived,
      archivedAt: conversation.archivedAt?.toISOString() || null,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    };
  }

  async updateConversation(id: string, data: UpdateConversationData) {
    const { tenantId, userId, title, metadata, isArchived } = data;

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id,
        tenantId,
        userId,
      },
    });

    if (!conversation) {
      return null;
    }

    const updated = await this.prisma.conversation.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(metadata !== undefined && { metadata }),
        ...(isArchived !== undefined && { 
          isArchived,
          ...(isArchived && { archivedAt: new Date() }),
          ...(!isArchived && { archivedAt: null }),
        }),
      },
    });

    return {
      id: updated.id,
      tenantId: updated.tenantId,
      workspaceId: updated.workspaceId,
      userId: updated.userId,
      title: updated.title,
      summary: updated.summary,
      metadata: updated.metadata as Record<string, unknown>,
      isArchived: updated.isArchived,
      archivedAt: updated.archivedAt?.toISOString() || null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deleteConversation(id: string, options: { tenantId: string; userId: string }) {
    const { tenantId, userId } = options;

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id,
        tenantId,
        userId,
      },
    });

    if (!conversation) {
      return false;
    }

    // Soft delete by archiving
    await this.prisma.conversation.update({
      where: { id },
      data: {
        isArchived: true,
        archivedAt: new Date(),
      },
    });

    return true;
  }

  async generateSummary(id: string, options: { tenantId: string; userId: string }) {
    const { tenantId, userId } = options;

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id,
        tenantId,
        userId,
      },
      include: {
        messages: {
          where: { role: { in: ['user', 'assistant'] } },
          orderBy: { createdAt: 'asc' },
          take: 20, // Only use recent messages for summary
        },
      },
    });

    if (!conversation || conversation.messages.length === 0) {
      return null;
    }

    // Generate summary using AI service
    const messagesText = conversation.messages
      .map(msg => `${msg.role}: ${msg.content}`)\n      .join('
');

    const summary = await this.aiService.generateSummary(messagesText);

    // Update conversation with generated summary
    await this.prisma.conversation.update({
      where: { id },
      data: { summary },
    });

    return summary;
  }

  async searchConversations(query: string, options: {
    tenantId: string;
    userId: string;
    limit?: number;
  }) {
    const { tenantId, userId, limit = 20 } = options;

    // Search in conversation titles, summaries, and message content
    const conversations = await this.prisma.conversation.findMany({
      where: {
        tenantId,
        userId,
        isArchived: false,
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { summary: { contains: query, mode: 'insensitive' } },
          {
            messages: {
              some: {
                content: { contains: query, mode: 'insensitive' },
              },
            },
          },
        ],
      },
      include: {
        messages: {
          where: {
            content: { contains: query, mode: 'insensitive' },
          },
          take: 3,
          select: {
            id: true,
            content: true,
            role: true,
            createdAt: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    return conversations.map(conv => ({
      id: conv.id,
      title: conv.title,
      summary: conv.summary,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
      matchingMessages: conv.messages.map(msg => ({
        id: msg.id,
        content: msg.content,
        role: msg.role,
        createdAt: msg.createdAt.toISOString(),
      })),
    }));
  }

  async getConversationContext(id: string, options: {
    tenantId: string;
    userId: string;
    maxMessages?: number;
  }) {
    const { tenantId, userId, maxMessages = 50 } = options;

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id,
        tenantId,
        userId,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: maxMessages,
          select: {
            id: true,
            role: true,
            content: true,
            tokenCount: true,
            createdAt: true,
            toolCalls: true,
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
            metadata: true,
          },
        },
      },
    });

    if (!conversation) {
      return null;
    }

    // Reverse messages to get chronological order
    const messages = conversation.messages.reverse();

    // Calculate total tokens
    const totalTokens = messages.reduce((sum, msg) => sum + msg.tokenCount, 0);

    return {
      id: conversation.id,
      title: conversation.title,
      summary: conversation.summary,
      messages: messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        tokenCount: msg.tokenCount,
        toolCalls: msg.toolCalls as any,
        createdAt: msg.createdAt.toISOString(),
      })),
      memories: conversation.memories.map(memory => ({
        key: memory.key,
        value: memory.value,
        metadata: memory.metadata as Record<string, unknown>,
      })),
      stats: {
        messageCount: messages.length,
        totalTokens,
      },
    };
  }

  async storeMemory(conversationId: string, data: {
    key: string;
    value: string;
    metadata?: Record<string, unknown>;
    expiresAt?: Date;
  }) {
    const { key, value, metadata = {}, expiresAt } = data;

    await this.prisma.memory.upsert({
      where: {
        conversationId_key: {
          conversationId,
          key,
        },
      },
      update: {
        value,
        metadata,
        expiresAt,
      },
      create: {
        conversationId,
        key,
        value,
        metadata,
        expiresAt,
      },
    });
  }

  async getMemory(conversationId: string, key: string) {
    const memory = await this.prisma.memory.findUnique({
      where: {
        conversationId_key: {
          conversationId,
          key,
        },
      },
    });

    if (!memory || (memory.expiresAt && memory.expiresAt <= new Date())) {
      return null;
    }

    return {
      key: memory.key,
      value: memory.value,
      metadata: memory.metadata as Record<string, unknown>,
      createdAt: memory.createdAt.toISOString(),
      updatedAt: memory.updatedAt.toISOString(),
      expiresAt: memory.expiresAt?.toISOString() || null,
    };
  }

  async deleteMemory(conversationId: string, key: string) {
    await this.prisma.memory.delete({
      where: {
        conversationId_key: {
          conversationId,
          key,
        },
      },
    });
  }

  async cleanupExpiredMemories() {
    const deleted = await this.prisma.memory.deleteMany({
      where: {
        expiresAt: {
          lte: new Date(),
        },
      },
    });

    return deleted.count;
  }

  async getConversationStats(options: {
    tenantId: string;
    userId?: string;\n    period?: '7d' | '30d' | '90d';
  }) {\n    const { tenantId, userId, period = '30d' } = options;
\n    const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    const where = {
      tenantId,
      ...(userId && { userId }),
      createdAt: { gte: startDate },
    };

    const [totalConversations, archivedConversations, messageStats] = await Promise.all([
      this.prisma.conversation.count({ where }),
      this.prisma.conversation.count({
        where: { ...where, isArchived: true },
      }),
      this.prisma.message.aggregate({
        where: {
          conversation: where,
        },
        _count: true,
        _sum: { tokenCount: true },
      }),
    ]);

    return {
      totalConversations,
      activeConversations: totalConversations - archivedConversations,
      archivedConversations,
      totalMessages: messageStats._count,
      totalTokens: messageStats._sum.tokenCount || 0,
      averageMessagesPerConversation: totalConversations > 0 
        ? Math.round(messageStats._count / totalConversations) 
        : 0,
    };
  }
}