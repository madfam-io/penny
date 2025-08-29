import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { Message, MessageType, Attachment, ToolCall, StreamChunk } from '../types';

interface CreateMessageOptions {
  conversationId: string;
  userId: string | null;
  content: string;
  role: 'user' | 'assistant' | 'system';
  type?: MessageType;
  parentMessageId?: string;
  metadata?: Record<string, unknown>;
  attachments?: Attachment[];
  toolCalls?: ToolCall[];
}

interface MessageFilter {
  conversationId?: string;
  userId?: string;
  role?: 'user' | 'assistant' | 'system';
  type?: MessageType;
  dateFrom?: Date;
  dateTo?: Date;
  hasAttachments?: boolean;
  hasToolCalls?: boolean;
  parentMessageId?: string;
}

interface PaginationOptions {
  limit?: number;
  offset?: number;
  sortOrder?: 'asc' | 'desc';
  cursor?: string;
}

interface MessageSearchOptions {
  query: string;
  conversationIds?: string[];
  userId?: string;
  limit?: number;
  offset?: number;
}

export class MessageService {
  private redis: Redis;
  private readonly MESSAGE_TTL = 30 * 24 * 60 * 60; // 30 days

  constructor(redis: Redis) {
    this.redis = redis;
  }

  // Core message operations
  async createMessage(options: CreateMessageOptions): Promise<Message> {
    try {
      const messageId = this.generateMessageId();
      const now = new Date();

      const message: Message = {
        id: messageId,
        conversationId: options.conversationId,
        userId: options.userId,
        content: options.content,
        role: options.role,
        type: options.type || MessageType.TEXT,
        parentMessageId: options.parentMessageId,
        metadata: options.metadata || {},
        attachments: options.attachments || [],
        toolCalls: options.toolCalls || [],
        createdAt: now,
        updatedAt: now
      };

      // Store message
      await this.storeMessage(message);

      // Index message for search and retrieval
      await this.indexMessage(message);

      // Update conversation metadata
      await this.updateConversationMetadata(options.conversationId, message);

      logger.debug({
        messageId,
        conversationId: options.conversationId,
        userId: options.userId,
        role: options.role,
        contentLength: options.content.length,
        hasAttachments: (options.attachments?.length || 0) > 0,
        hasToolCalls: (options.toolCalls?.length || 0) > 0
      }, 'Message created');

      return message;

    } catch (error) {
      logger.error({
        conversationId: options.conversationId,
        userId: options.userId,
        error: error.message
      }, 'Failed to create message');
      throw error;
    }
  }

  async getMessage(messageId: string, context?: { tenantId: string; userId: string }): Promise<Message | null> {
    try {
      const messageKey = `message:${messageId}`;
      const data = await this.redis.hgetall(messageKey);

      if (!data.id) {
        return null;
      }

      // Verify access if context provided
      if (context && !await this.verifyMessageAccess(messageId, context)) {
        return null;
      }

      return this.deserializeMessage(data);

    } catch (error) {
      logger.error({
        messageId,
        error: error.message
      }, 'Failed to get message');
      return null;
    }
  }

  async getMessages(
    conversationId: string,
    options: PaginationOptions & { tenantId?: string; userId?: string } = {}
  ): Promise<{ data: Message[]; hasMore: boolean; cursor?: string }> {
    try {
      const { limit = 50, offset = 0, sortOrder = 'desc', tenantId, userId } = options;
      
      // Verify conversation access if context provided
      if (tenantId && userId && !await this.verifyConversationAccess(conversationId, { tenantId, userId })) {
        return { data: [], hasMore: false };
      }

      const messagesKey = `conversation:${conversationId}:messages`;
      
      // Get message IDs from sorted set (sorted by timestamp)
      const messageIds = sortOrder === 'desc' 
        ? await this.redis.zrevrange(messagesKey, offset, offset + limit - 1)
        : await this.redis.zrange(messagesKey, offset, offset + limit - 1);

      // Get message data
      const messages: Message[] = [];
      for (const messageId of messageIds) {
        const message = await this.getMessage(messageId);
        if (message) {
          messages.push(message);
        }
      }

      // Check if there are more messages
      const totalCount = await this.redis.zcard(messagesKey);
      const hasMore = offset + messages.length < totalCount;

      return {
        data: messages,
        hasMore,
        cursor: hasMore ? String(offset + messages.length) : undefined
      };

    } catch (error) {
      logger.error({
        conversationId,
        error: error.message
      }, 'Failed to get messages');
      return { data: [], hasMore: false };
    }
  }

  async updateMessage(
    messageId: string,
    updates: {
      content?: string;
      metadata?: Record<string, unknown>;
      attachments?: Attachment[];
      toolCalls?: ToolCall[];
    },
    context: { tenantId: string; userId: string }
  ): Promise<Message | null> {
    try {
      // Verify access
      if (!await this.verifyMessageAccess(messageId, context)) {
        throw new Error('Access denied to message');
      }

      const message = await this.getMessage(messageId);
      if (!message) {
        return null;
      }

      // Apply updates
      const updatedMessage: Message = {
        ...message,
        ...updates,
        updatedAt: new Date()
      };

      // Store updated message
      await this.storeMessage(updatedMessage);

      // Re-index if content changed
      if (updates.content) {
        await this.indexMessage(updatedMessage);
      }

      logger.debug({
        messageId,
        updates: Object.keys(updates),
        userId: context.userId
      }, 'Message updated');

      return updatedMessage;

    } catch (error) {
      logger.error({
        messageId,
        error: error.message
      }, 'Failed to update message');
      throw error;
    }
  }

  async deleteMessage(
    messageId: string,
    context: { tenantId: string; userId: string }
  ): Promise<boolean> {
    try {
      // Verify access
      if (!await this.verifyMessageAccess(messageId, context)) {
        throw new Error('Access denied to message');
      }

      const message = await this.getMessage(messageId);
      if (!message) {
        return false;
      }

      // Remove from conversation index
      const conversationKey = `conversation:${message.conversationId}:messages`;
      await this.redis.zrem(conversationKey, messageId);

      // Remove from search indexes
      await this.removeFromSearchIndexes(message);

      // Delete message data
      const messageKey = `message:${messageId}`;
      await this.redis.del(messageKey);

      // Update conversation metadata
      await this.updateConversationMetadata(message.conversationId, null, 'delete');

      logger.info({
        messageId,
        conversationId: message.conversationId,
        userId: context.userId
      }, 'Message deleted');

      return true;

    } catch (error) {
      logger.error({
        messageId,
        error: error.message
      }, 'Failed to delete message');
      return false;
    }
  }

  // Search functionality
  async searchMessages(options: MessageSearchOptions): Promise<{
    messages: Message[];
    totalCount: number;
    hasMore: boolean;
  }> {
    try {
      const { query, conversationIds, userId, limit = 50, offset = 0 } = options;
      
      // Build search key
      let searchKey = 'message_search:';
      if (conversationIds && conversationIds.length > 0) {
        searchKey += `conversations:${conversationIds.join(',')}:`;
      }
      if (userId) {
        searchKey += `user:${userId}:`;
      }
      searchKey += `query:${query}`;

      // Use Redis full-text search if available, otherwise fall back to pattern matching
      const messageIds = await this.performSearch(query, conversationIds, userId, limit, offset);
      
      // Get message data
      const messages: Message[] = [];
      for (const messageId of messageIds) {
        const message = await this.getMessage(messageId);
        if (message) {
          messages.push(message);
        }
      }

      return {
        messages,
        totalCount: messageIds.length,
        hasMore: messageIds.length === limit
      };

    } catch (error) {
      logger.error({
        query: options.query,
        error: error.message
      }, 'Failed to search messages');
      return { messages: [], totalCount: 0, hasMore: false };
    }
  }

  // Streaming support
  async *streamCompletion(options: {
    conversationId: string;
    content: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    tenantId: string;
    userId: string;
    toolsEnabled?: string[];
    artifactsEnabled?: boolean;
  }): AsyncGenerator<StreamChunk> {
    // This would integrate with your AI service
    // For now, providing a mock implementation
    
    try {
      // Yield start chunk
      yield { type: 'content', content: '' };

      // Simulate streaming response
      const response = "This is a simulated streaming response from the AI model.";
      const words = response.split(' ');
      
      for (let i = 0; i < words.length; i++) {
        const chunk = i === 0 ? words[i] : ' ' + words[i];
        yield { type: 'content', content: chunk };
        
        // Simulate delay
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Yield completion
      yield { type: 'done' };

    } catch (error) {
      yield { type: 'error', error: error.message };
    }
  }

  // Access control
  async verifyConversationAccess(
    conversationId: string,
    context: { tenantId: string; userId: string }
  ): Promise<boolean> {
    try {
      // Check if conversation exists and user has access
      const conversationKey = `conversation:${conversationId}`;
      const conversationData = await this.redis.hmget(conversationKey, 'tenantId', 'participants', 'isPublic');
      
      if (!conversationData[0]) {
        return false; // Conversation doesn't exist
      }

      // Check tenant isolation
      if (conversationData[0] !== context.tenantId) {
        return false;
      }

      // Check if user is participant
      const participants = conversationData[1] ? JSON.parse(conversationData[1]) : [];
      if (participants.includes(context.userId)) {
        return true;
      }

      // Check if conversation is public
      const isPublic = conversationData[2] === 'true';
      if (isPublic) {
        return true;
      }

      return false;

    } catch (error) {
      logger.error({
        conversationId,
        userId: context.userId,
        error: error.message
      }, 'Failed to verify conversation access');
      return false;
    }
  }

  async verifyMessageAccess(
    messageId: string,
    context: { tenantId: string; userId: string }
  ): Promise<boolean> {
    try {
      const message = await this.getMessage(messageId);
      if (!message) {
        return false;
      }

      // Check conversation access
      return await this.verifyConversationAccess(message.conversationId, context);

    } catch (error) {
      logger.error({
        messageId,
        error: error.message
      }, 'Failed to verify message access');
      return false;
    }
  }

  // Private helper methods
  private async storeMessage(message: Message): Promise<void> {
    const messageKey = `message:${message.id}`;
    const conversationKey = `conversation:${message.conversationId}:messages`;
    
    // Serialize message data
    const messageData = {
      id: message.id,
      conversationId: message.conversationId,
      userId: message.userId || '',
      content: message.content,
      role: message.role,
      type: message.type,
      parentMessageId: message.parentMessageId || '',
      metadata: JSON.stringify(message.metadata),
      attachments: JSON.stringify(message.attachments),
      toolCalls: JSON.stringify(message.toolCalls),
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString()
    };

    // Store message
    await this.redis.hmset(messageKey, messageData);
    
    // Add to conversation timeline (sorted by timestamp)
    await this.redis.zadd(conversationKey, message.createdAt.getTime(), message.id);
    
    // Set TTL
    await this.redis.expire(messageKey, this.MESSAGE_TTL);
    await this.redis.expire(conversationKey, this.MESSAGE_TTL);
  }

  private deserializeMessage(data: Record<string, string>): Message {
    return {
      id: data.id,
      conversationId: data.conversationId,
      userId: data.userId || null,
      content: data.content,
      role: data.role as 'user' | 'assistant' | 'system',
      type: data.type as MessageType,
      parentMessageId: data.parentMessageId || undefined,
      metadata: data.metadata ? JSON.parse(data.metadata) : {},
      attachments: data.attachments ? JSON.parse(data.attachments) : [],
      toolCalls: data.toolCalls ? JSON.parse(data.toolCalls) : [],
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt)
    };
  }

  private async indexMessage(message: Message): Promise<void> {
    try {
      // Index by user
      if (message.userId) {
        const userKey = `user:${message.userId}:messages`;
        await this.redis.zadd(userKey, message.createdAt.getTime(), message.id);
        await this.redis.expire(userKey, this.MESSAGE_TTL);
      }

      // Index by type
      const typeKey = `messages:type:${message.type}`;
      await this.redis.zadd(typeKey, message.createdAt.getTime(), message.id);
      await this.redis.expire(typeKey, this.MESSAGE_TTL);

      // Simple text search indexing (for basic search functionality)
      if (message.content && message.content.trim()) {
        const words = message.content.toLowerCase().split(/\s+/).filter(word => word.length > 2);
        for (const word of words.slice(0, 20)) { // Limit to first 20 words
          const wordKey = `search:word:${word}`;
          await this.redis.zadd(wordKey, message.createdAt.getTime(), message.id);
          await this.redis.expire(wordKey, this.MESSAGE_TTL);
        }
      }

    } catch (error) {
      logger.error({
        messageId: message.id,
        error: error.message
      }, 'Failed to index message');
    }
  }

  private async removeFromSearchIndexes(message: Message): Promise<void> {
    try {
      // Remove from user index
      if (message.userId) {
        const userKey = `user:${message.userId}:messages`;
        await this.redis.zrem(userKey, message.id);
      }

      // Remove from type index
      const typeKey = `messages:type:${message.type}`;
      await this.redis.zrem(typeKey, message.id);

      // Remove from word indexes
      if (message.content) {
        const words = message.content.toLowerCase().split(/\s+/).filter(word => word.length > 2);
        for (const word of words.slice(0, 20)) {
          const wordKey = `search:word:${word}`;
          await this.redis.zrem(wordKey, message.id);
        }
      }

    } catch (error) {
      logger.error({
        messageId: message.id,
        error: error.message
      }, 'Failed to remove message from search indexes');
    }
  }

  private async performSearch(
    query: string, 
    conversationIds?: string[], 
    userId?: string,
    limit = 50,
    offset = 0
  ): Promise<string[]> {
    try {
      const words = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
      if (words.length === 0) {
        return [];
      }

      // Get message IDs for each word
      const wordResults: string[][] = [];
      for (const word of words.slice(0, 5)) { // Limit search words
        const wordKey = `search:word:${word}`;
        const messageIds = await this.redis.zrevrange(wordKey, 0, 1000); // Limit per word
        wordResults.push(messageIds);
      }

      // Find intersection of all word results (messages containing all words)
      let resultIds = wordResults[0] || [];
      for (let i = 1; i < wordResults.length; i++) {
        resultIds = resultIds.filter(id => wordResults[i].includes(id));
      }

      // Filter by conversation if specified
      if (conversationIds && conversationIds.length > 0) {
        const filteredIds: string[] = [];
        for (const messageId of resultIds) {
          const message = await this.getMessage(messageId);
          if (message && conversationIds.includes(message.conversationId)) {
            filteredIds.push(messageId);
          }
        }
        resultIds = filteredIds;
      }

      // Apply pagination
      return resultIds.slice(offset, offset + limit);

    } catch (error) {
      logger.error({
        query,
        error: error.message
      }, 'Search query failed');
      return [];
    }
  }

  private async updateConversationMetadata(
    conversationId: string, 
    message?: Message | null,
    action: 'create' | 'delete' = 'create'
  ): Promise<void> {
    try {
      const conversationKey = `conversation:${conversationId}`;
      
      if (action === 'delete') {
        // Decrement message count
        await this.redis.hincrby(conversationKey, 'messageCount', -1);
      } else if (message) {
        // Update last message info
        const updates = {
          lastMessageAt: message.createdAt.toISOString(),
          lastMessageId: message.id,
          lastMessageUser: message.userId || '',
          messageCount: await this.redis.zcard(`conversation:${conversationId}:messages`)
        };
        
        await this.redis.hmset(conversationKey, updates);
      }

      await this.redis.expire(conversationKey, this.MESSAGE_TTL);

    } catch (error) {
      logger.error({
        conversationId,
        error: error.message
      }, 'Failed to update conversation metadata');
    }
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  // Statistics
  async getMessageStats(conversationId?: string, userId?: string): Promise<{
    totalMessages: number;
    messagesByType: Record<string, number>;
    messagesByRole: Record<string, number>;
    averageMessageLength: number;
    messagesWithAttachments: number;
    messagesWithToolCalls: number;
  }> {
    try {
      let messageKeys: string[];
      
      if (conversationId) {
        const conversationKey = `conversation:${conversationId}:messages`;
        messageKeys = await this.redis.zrange(conversationKey, 0, -1);
      } else if (userId) {
        const userKey = `user:${userId}:messages`;
        messageKeys = await this.redis.zrange(userKey, 0, -1);
      } else {
        messageKeys = await this.redis.keys('message:*');
      }

      const stats = {
        totalMessages: messageKeys.length,
        messagesByType: {} as Record<string, number>,
        messagesByRole: {} as Record<string, number>,
        averageMessageLength: 0,
        messagesWithAttachments: 0,
        messagesWithToolCalls: 0
      };

      let totalLength = 0;

      // Analyze messages in batches
      const batchSize = 100;
      for (let i = 0; i < messageKeys.length; i += batchSize) {
        const batch = messageKeys.slice(i, i + batchSize);
        
        for (const messageId of batch) {
          const message = await this.getMessage(messageId);
          if (message) {
            // Count by type
            stats.messagesByType[message.type] = (stats.messagesByType[message.type] || 0) + 1;
            
            // Count by role
            stats.messagesByRole[message.role] = (stats.messagesByRole[message.role] || 0) + 1;
            
            // Track content length
            totalLength += message.content.length;
            
            // Count attachments
            if (message.attachments.length > 0) {
              stats.messagesWithAttachments++;
            }
            
            // Count tool calls
            if (message.toolCalls.length > 0) {
              stats.messagesWithToolCalls++;
            }
          }
        }
      }

      stats.averageMessageLength = stats.totalMessages > 0 ? totalLength / stats.totalMessages : 0;

      return stats;

    } catch (error) {
      logger.error({
        conversationId,
        userId,
        error: error.message
      }, 'Failed to get message stats');
      return {
        totalMessages: 0,
        messagesByType: {},
        messagesByRole: {},
        averageMessageLength: 0,
        messagesWithAttachments: 0,
        messagesWithToolCalls: 0
      };
    }
  }
}