import { prisma, Prisma } from '@penny/database';
import { generateId } from '@penny/shared';
import Redis from 'ioredis';

export interface CreateConversationParams {
  userId: string;
  tenantId: string;
  title?: string;
  workspaceId?: string;
  metadata?: Record<string, any>;
}

export interface CreateMessageParams {
  conversationId: string;
  userId: string;
  tenantId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  artifacts?: any[];
  metadata?: Record<string, any>;
}

export interface UpdateMessageParams {
  content?: string;
  artifacts?: any[];
  metadata?: Record<string, any>;
}

export class ConversationService {
  private redis: Redis;

  constructor(redisUrl?: string) {
    this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
  }

  async createConversation(params: CreateConversationParams) {
    const { userId, tenantId, title, workspaceId, metadata } = params;

    const conversation = await prisma.conversation.create({
      data: {
        id: generateId('conv'),
        userId,
        tenantId,
        workspaceId,
        title: title || 'New Conversation',
        metadata: metadata || {},
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    // Cache conversation metadata
    await this.cacheConversation(conversation);

    // Emit event for real-time updates
    await this.redis.publish(
      `tenant:${tenantId}:conversations`,
      JSON.stringify({
        type: 'conversation.created',
        data: conversation,
      }),
    );

    return conversation;
  }

  async getConversation(conversationId: string, userId: string, tenantId: string) {
    // Try cache first
    const cached = await this.getCachedConversation(conversationId);
    if (cached) return cached;

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        tenantId,
        OR: [{ userId }, { sharedWith: { some: { userId } } }],
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        messages: {
          take: 50,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    if (conversation) {
      await this.cacheConversation(conversation);
    }

    return conversation;
  }

  async listConversations(
    userId: string,
    tenantId: string,
    options?: {
      workspaceId?: string;
      limit?: number;
      offset?: number;
      search?: string;
    },
  ) {
    const { workspaceId, limit = 20, offset = 0, search } = options || {};

    const where: Prisma.ConversationWhereInput = {
      tenantId,
      OR: [{ userId }, { sharedWith: { some: { userId } } }],
    };

    if (workspaceId) {
      where.workspaceId = workspaceId;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { messages: { some: { content: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { updatedAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: { messages: true },
          },
        },
      }),
      prisma.conversation.count({ where }),
    ]);

    return { conversations, total };
  }

  async addMessage(params: CreateMessageParams) {
    const { conversationId, userId, tenantId, role, content, artifacts, metadata } = params;

    const message = await prisma.message.create({
      data: {
        id: generateId('msg'),
        conversationId,
        userId: role === 'user' ? userId : undefined,
        role,
        content,
        artifacts: artifacts || [],
        metadata: metadata || {},
      },
      include: {
        user:
          role === 'user'
            ? {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatar: true,
                },
              }
            : undefined,
      },
    });

    // Update conversation's last activity
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        updatedAt: new Date(),
        lastMessageAt: new Date(),
      },
    });

    // Cache message
    await this.cacheMessage(conversationId, message);

    // Emit event for real-time updates
    await this.redis.publish(
      `conversation:${conversationId}`,
      JSON.stringify({
        type: 'message.created',
        data: message,
      }),
    );

    return message;
  }

  async updateMessage(messageId: string, params: UpdateMessageParams) {
    const message = await prisma.message.update({
      where: { id: messageId },
      data: {
        content: params.content,
        artifacts: params.artifacts,
        metadata: params.metadata,
        updatedAt: new Date(),
      },
    });

    // Invalidate cache
    await this.invalidateMessageCache(message.conversationId);

    // Emit event for real-time updates
    await this.redis.publish(
      `conversation:${message.conversationId}`,
      JSON.stringify({
        type: 'message.updated',
        data: message,
      }),
    );

    return message;
  }

  async getMessages(
    conversationId: string,
    options?: {
      limit?: number;
      before?: string;
      after?: string;
    },
  ) {
    const { limit = 50, before, after } = options || {};

    // Try cache first for recent messages
    if (!before && !after) {
      const cached = await this.getCachedMessages(conversationId);
      if (cached && cached.length > 0) {
        return cached;
      }
    }

    const where: Prisma.MessageWhereInput = {
      conversationId,
    };

    if (before) {
      where.createdAt = { lt: new Date(before) };
    }

    if (after) {
      where.createdAt = { gt: new Date(after) };
    }

    const messages = await prisma.message.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    // Cache if fetching recent messages
    if (!before && !after) {
      await this.cacheMessages(conversationId, messages);
    }

    return messages.reverse(); // Return in chronological order
  }

  async deleteConversation(conversationId: string, userId: string, tenantId: string) {
    // Verify ownership
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId,
        tenantId,
      },
    });

    if (!conversation) {
      throw new Error('Conversation not found or access denied');
    }

    // Soft delete
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        deletedAt: new Date(),
      },
    });

    // Clear cache
    await this.clearConversationCache(conversationId);

    // Emit event
    await this.redis.publish(
      `tenant:${tenantId}:conversations`,
      JSON.stringify({
        type: 'conversation.deleted',
        data: { id: conversationId },
      }),
    );
  }

  async shareConversation(conversationId: string, shareWithUserId: string, ownerId: string) {
    await prisma.conversationShare.create({
      data: {
        conversationId,
        userId: shareWithUserId,
        sharedBy: ownerId,
        permissions: ['view', 'comment'],
      },
    });

    // Emit event
    const conversation = await this.getConversation(conversationId, ownerId, '');
    await this.redis.publish(\n      `user:${shareWithUserId}`,
      JSON.stringify({
        type: 'conversation.shared',
        data: conversation,
      }),
    );
  }

  async generateTitle(conversationId: string) {
    // Get first few messages to generate title
    const messages = await prisma.message.findMany({
      where: { conversationId },
      take: 3,
      orderBy: { createdAt: 'asc' },
    });

    if (messages.length === 0) return 'New Conversation';

    // Extract key terms from first user message
    const firstUserMessage = messages.find((m) => m.role === 'user');
    if (!firstUserMessage) return 'New Conversation';

    // Simple title generation - in production, use AI
    const words = firstUserMessage.content.split(' ').slice(0, 5);
    const title =\n      words.join(' ') + (words.length < firstUserMessage.content.split(' ').length ? '...' : '');

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { title },
    });

    return title;
  }

  // Cache management methods
  private async cacheConversation(conversation: any) {
    const key = `conversation:${conversation.id}`;
    await this.redis.setex(key, 3600, JSON.stringify(conversation));
  }

  private async getCachedConversation(conversationId: string) {
    const key = `conversation:${conversationId}`;
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  private async cacheMessage(conversationId: string, message: any) {
    const key = `conversation:${conversationId}:messages`;
    await this.redis.lpush(key, JSON.stringify(message));
    await this.redis.ltrim(key, 0, 49); // Keep last 50 messages
    await this.redis.expire(key, 3600);
  }

  private async cacheMessages(conversationId: string, messages: any[]) {
    if (messages.length === 0) return;

    const key = `conversation:${conversationId}:messages`;
    const pipeline = this.redis.pipeline();

    pipeline.del(key);
    messages.forEach((msg) => {
      pipeline.rpush(key, JSON.stringify(msg));
    });
    pipeline.expire(key, 3600);

    await pipeline.exec();
  }

  private async getCachedMessages(conversationId: string) {
    const key = `conversation:${conversationId}:messages`;
    const cached = await this.redis.lrange(key, 0, -1);
    return cached.map((c) => JSON.parse(c));
  }

  private async invalidateMessageCache(conversationId: string) {
    const key = `conversation:${conversationId}:messages`;
    await this.redis.del(key);
  }

  private async clearConversationCache(conversationId: string) {
    const keys = [`conversation:${conversationId}`, `conversation:${conversationId}:messages`];
    await this.redis.del(...keys);
  }

  async disconnect() {
    await this.redis.disconnect();
  }
}
