import { Server as SocketIOServer } from 'socket.io';
import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { 
  AuthenticatedSocket, 
  SocketEvent, 
  MessageReactionData, 
  MessageReactionSchema 
} from '../types';
import { z } from 'zod';

// Extended reaction schemas
const BulkReactionSchema = z.object({
  messageIds: z.array(z.string()),
  reaction: z.string().emoji('Invalid emoji'),
  action: z.enum(['add', 'remove'])
});

const GetReactionsSchema = z.object({
  messageIds: z.array(z.string())
});

const ReactionStatsSchema = z.object({
  conversationId: z.string(),
  timeRange: z.enum(['1h', '24h', '7d', '30d']).default('24h')
});

// Reaction interfaces
interface MessageReactions {
  messageId: string;
  reactions: Map<string, ReactionData>; // emoji -> reaction data
  totalCount: number;
  lastUpdated: Date;
}

interface ReactionData {
  emoji: string;
  count: number;
  users: Map<string, ReactionUser>; // userId -> user info
  firstReactedAt: Date;
  lastReactedAt: Date;
}

interface ReactionUser {
  userId: string;
  userName: string;
  reactedAt: Date;
}

interface ReactionStats {
  totalReactions: number;
  uniqueEmojis: number;
  topEmojis: Array<{ emoji: string; count: number }>;
  mostReactedMessage: string | null;
  activeUsers: number;
}

export class ReactionsHandler {
  private io: SocketIOServer;
  private redis: Redis;
  
  // In-memory reaction cache for fast access
  private reactionCache: Map<string, MessageReactions> = new Map();
  
  // Reaction validation
  private readonly MAX_REACTIONS_PER_MESSAGE = 50;
  private readonly MAX_REACTIONS_PER_USER_PER_MESSAGE = 10;
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  
  // Reaction cleanup timer
  private cleanupTimer: NodeJS.Timeout;

  constructor(io: SocketIOServer, redis: Redis) {
    this.io = io;
    this.redis = redis;
    
    // Setup periodic cache cleanup
    this.cleanupTimer = setInterval(() => {
      this.cleanupCache();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  public setupHandlers(): void {
    this.io.on(SocketEvent.CONNECT, (socket: AuthenticatedSocket) => {
      this.setupSocketHandlers(socket);
    });
  }

  private setupSocketHandlers(socket: AuthenticatedSocket): void {
    if (!socket.user) return;

    // Reaction management
    socket.on(SocketEvent.MESSAGE_REACTION, (data) => 
      this.handleMessageReaction(socket, data)
    );

    socket.on('bulk_message_reactions', (data) => 
      this.handleBulkMessageReactions(socket, data)
    );

    // Reaction queries
    socket.on('get_message_reactions', (data) => 
      this.handleGetMessageReactions(socket, data)
    );

    socket.on('get_reaction_stats', (data) => 
      this.handleGetReactionStats(socket, data)
    );

    socket.on('get_user_reactions', (data) => 
      this.handleGetUserReactions(socket, data)
    );

    // Admin functions
    socket.on('clear_message_reactions', (data) => 
      this.handleClearMessageReactions(socket, data)
    );

    socket.on('moderate_reactions', (data) => 
      this.handleModerateReactions(socket, data)
    );
  }

  private async handleMessageReaction(socket: AuthenticatedSocket, data: unknown): Promise<void> {
    try {
      const reactionData = MessageReactionSchema.parse(data);
      const user = socket.user!;

      // Validate message access (simplified - should check actual permissions)
      const hasAccess = await this.validateMessageAccess(user, reactionData.messageId);
      if (!hasAccess) {
        socket.emit(SocketEvent.ERROR, {
          message: 'Access denied to message',
          messageId: reactionData.messageId,
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Get or create message reactions
      let messageReactions = await this.getMessageReactions(reactionData.messageId);
      if (!messageReactions) {
        messageReactions = {
          messageId: reactionData.messageId,
          reactions: new Map(),
          totalCount: 0,
          lastUpdated: new Date()
        };
      }

      // Validate reaction limits
      if (!await this.validateReactionLimits(messageReactions, user.id, reactionData)) {
        socket.emit(SocketEvent.ERROR, {
          message: 'Reaction limit exceeded',
          messageId: reactionData.messageId,
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Process the reaction
      const result = await this.processReaction(messageReactions, user, reactionData);
      
      if (!result.success) {
        socket.emit(SocketEvent.ERROR, {
          message: result.error || 'Failed to process reaction',
          messageId: reactionData.messageId,
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Update cache and storage
      this.reactionCache.set(reactionData.messageId, messageReactions);
      await this.saveMessageReactions(messageReactions);

      // Get conversation ID for broadcasting
      const conversationId = await this.getMessageConversationId(reactionData.messageId);
      
      if (conversationId) {
        // Broadcast reaction update to conversation participants
        this.io.to(`conversation:${conversationId}`).emit(SocketEvent.MESSAGE_REACTION, {
          messageId: reactionData.messageId,
          userId: user.id,
          userName: user.name,
          reaction: reactionData.reaction,
          action: reactionData.action,
          reactionCount: result.reactionCount,
          totalReactions: messageReactions.totalCount,
          timestamp: new Date().toISOString()
        });
      }

      // Send confirmation to the user
      socket.emit('reaction_updated', {
        messageId: reactionData.messageId,
        reaction: reactionData.reaction,
        action: reactionData.action,
        reactionCount: result.reactionCount,
        userReacted: result.userReacted,
        timestamp: new Date().toISOString()
      });

      logger.debug({
        userId: user.id,
        messageId: reactionData.messageId,
        reaction: reactionData.reaction,
        action: reactionData.action,
        newCount: result.reactionCount
      }, 'Message reaction processed');

    } catch (error) {
      logger.error({
        socketId: socket.id,
        userId: socket.user?.id,
        error: error.message,
        data
      }, 'Error handling message reaction');

      socket.emit(SocketEvent.ERROR, {
        message: 'Failed to process reaction',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  private async handleBulkMessageReactions(socket: AuthenticatedSocket, data: unknown): Promise<void> {
    try {
      const bulkData = BulkReactionSchema.parse(data);
      const user = socket.user!;

      const results: Array<{ messageId: string; success: boolean; error?: string }> = [];

      for (const messageId of bulkData.messageIds) {
        try {
          // Validate message access
          const hasAccess = await this.validateMessageAccess(user, messageId);
          if (!hasAccess) {
            results.push({ messageId, success: false, error: 'Access denied' });
            continue;
          }

          // Process individual reaction
          const reactionData = {
            messageId,
            reaction: bulkData.reaction,
            action: bulkData.action
          };

          const messageReactions = await this.getMessageReactions(messageId) || {
            messageId,
            reactions: new Map(),
            totalCount: 0,
            lastUpdated: new Date()
          };

          const result = await this.processReaction(messageReactions, user, reactionData);
          
          if (result.success) {
            this.reactionCache.set(messageId, messageReactions);
            await this.saveMessageReactions(messageReactions);
            
            // Broadcast to conversation
            const conversationId = await this.getMessageConversationId(messageId);
            if (conversationId) {
              this.io.to(`conversation:${conversationId}`).emit(SocketEvent.MESSAGE_REACTION, {
                messageId,
                userId: user.id,
                userName: user.name,
                reaction: bulkData.reaction,
                action: bulkData.action,
                reactionCount: result.reactionCount,
                totalReactions: messageReactions.totalCount,
                bulk: true,
                timestamp: new Date().toISOString()
              });
            }
          }

          results.push({ messageId, success: result.success, error: result.error });

        } catch (error) {
          results.push({ messageId, success: false, error: error.message });
        }
      }

      socket.emit('bulk_reactions_processed', {
        results,
        successCount: results.filter(r => r.success).length,
        failureCount: results.filter(r => !r.success).length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error({
        socketId: socket.id,
        userId: socket.user?.id,
        error: error.message,
        data
      }, 'Error handling bulk message reactions');

      socket.emit(SocketEvent.ERROR, {
        message: 'Failed to process bulk reactions',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  private async handleGetMessageReactions(socket: AuthenticatedSocket, data: unknown): Promise<void> {
    try {
      const { messageIds } = GetReactionsSchema.parse(data);
      const user = socket.user!;

      const reactionsData: Array<{
        messageId: string;
        reactions: Array<{
          emoji: string;
          count: number;
          users: Array<{ userId: string; userName: string; reactedAt: string }>;
          userReacted: boolean;
        }>;
        totalCount: number;
      }> = [];

      for (const messageId of messageIds) {
        // Validate access
        const hasAccess = await this.validateMessageAccess(user, messageId);
        if (!hasAccess) continue;

        const messageReactions = await this.getMessageReactions(messageId);
        if (!messageReactions) {
          reactionsData.push({
            messageId,
            reactions: [],
            totalCount: 0
          });
          continue;
        }

        const reactions = Array.from(messageReactions.reactions.entries()).map(([emoji, reactionData]) => ({
          emoji,
          count: reactionData.count,
          users: Array.from(reactionData.users.values()).map(u => ({
            userId: u.userId,
            userName: u.userName,
            reactedAt: u.reactedAt.toISOString()
          })),
          userReacted: reactionData.users.has(user.id)
        }));

        reactionsData.push({
          messageId,
          reactions,
          totalCount: messageReactions.totalCount
        });
      }

      socket.emit('message_reactions', {
        reactions: reactionsData,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error({
        socketId: socket.id,
        userId: socket.user?.id,
        error: error.message,
        data
      }, 'Error getting message reactions');

      socket.emit(SocketEvent.ERROR, {
        message: 'Failed to get message reactions',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  private async handleGetReactionStats(socket: AuthenticatedSocket, data: unknown): Promise<void> {
    try {
      const { conversationId, timeRange } = ReactionStatsSchema.parse(data);
      const user = socket.user!;

      // Validate conversation access
      const hasAccess = await this.validateConversationAccess(user, conversationId);
      if (!hasAccess) {
        socket.emit(SocketEvent.ERROR, {
          message: 'Access denied to conversation',
          conversationId,
          timestamp: new Date().toISOString()
        });
        return;
      }

      const stats = await this.getReactionStats(conversationId, timeRange);
      
      socket.emit('reaction_stats', {
        conversationId,
        timeRange,
        stats,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error({
        socketId: socket.id,
        userId: socket.user?.id,
        error: error.message,
        data
      }, 'Error getting reaction stats');

      socket.emit(SocketEvent.ERROR, {
        message: 'Failed to get reaction stats',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  private async handleGetUserReactions(socket: AuthenticatedSocket, data: unknown): Promise<void> {
    try {
      const { 
        userId, 
        conversationId,
        limit = 50,
        offset = 0 
      } = data as { 
        userId?: string; 
        conversationId?: string;
        limit?: number;
        offset?: number;
      };

      const user = socket.user!;
      const targetUserId = userId || user.id;

      // If requesting another user's reactions, validate permissions
      if (targetUserId !== user.id && !user.permissions?.includes('view_user_reactions')) {
        socket.emit(SocketEvent.ERROR, {
          message: 'Insufficient permissions to view user reactions',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const userReactions = await this.getUserReactions(targetUserId, conversationId, limit, offset);
      
      socket.emit('user_reactions', {
        userId: targetUserId,
        conversationId,
        reactions: userReactions,
        hasMore: userReactions.length === limit,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error({
        socketId: socket.id,
        userId: socket.user?.id,
        error: error.message,
        data
      }, 'Error getting user reactions');

      socket.emit(SocketEvent.ERROR, {
        message: 'Failed to get user reactions',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  private async handleClearMessageReactions(socket: AuthenticatedSocket, data: unknown): Promise<void> {
    try {
      const user = socket.user!;
      
      // Check admin permissions
      if (!user.permissions?.includes('admin') && !user.permissions?.includes('moderate_reactions')) {
        socket.emit(SocketEvent.ERROR, {
          message: 'Insufficient permissions to clear reactions',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const { messageId } = data as { messageId: string };
      
      // Clear reactions
      await this.clearMessageReactions(messageId);
      
      // Broadcast the change
      const conversationId = await this.getMessageConversationId(messageId);
      if (conversationId) {
        this.io.to(`conversation:${conversationId}`).emit('reactions_cleared', {
          messageId,
          clearedBy: user.id,
          clearedByName: user.name,
          timestamp: new Date().toISOString()
        });
      }

      socket.emit('reactions_cleared', {
        messageId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error({
        socketId: socket.id,
        userId: socket.user?.id,
        error: error.message,
        data
      }, 'Error clearing message reactions');

      socket.emit(SocketEvent.ERROR, {
        message: 'Failed to clear message reactions',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  private async handleModerateReactions(socket: AuthenticatedSocket, data: unknown): Promise<void> {
    try {
      const user = socket.user!;
      
      // Check moderation permissions
      if (!user.permissions?.includes('admin') && !user.permissions?.includes('moderate_reactions')) {
        socket.emit(SocketEvent.ERROR, {
          message: 'Insufficient permissions to moderate reactions',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const { 
        messageId, 
        emoji, 
        action,
        reason 
      } = data as { 
        messageId: string; 
        emoji?: string;
        action: 'remove_emoji' | 'remove_user_reaction';
        reason: string;
      };

      // Perform moderation action
      await this.moderateReaction(messageId, emoji, action, user.id, reason);
      
      // Broadcast moderation action
      const conversationId = await this.getMessageConversationId(messageId);
      if (conversationId) {
        this.io.to(`conversation:${conversationId}`).emit('reaction_moderated', {
          messageId,
          emoji,
          action,
          moderatedBy: user.id,
          moderatedByName: user.name,
          reason,
          timestamp: new Date().toISOString()
        });
      }

      socket.emit('reaction_moderated', {
        messageId,
        emoji,
        action,
        reason,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error({
        socketId: socket.id,
        userId: socket.user?.id,
        error: error.message,
        data
      }, 'Error moderating reactions');

      socket.emit(SocketEvent.ERROR, {
        message: 'Failed to moderate reaction',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Core reaction processing logic
  private async processReaction(
    messageReactions: MessageReactions, 
    user: any, 
    reactionData: MessageReactionData
  ): Promise<{ success: boolean; reactionCount: number; userReacted: boolean; error?: string }> {
    const { reaction, action } = reactionData;
    
    // Get or create reaction data for this emoji
    let reactionObj = messageReactions.reactions.get(reaction);
    if (!reactionObj) {
      reactionObj = {
        emoji: reaction,
        count: 0,
        users: new Map(),
        firstReactedAt: new Date(),
        lastReactedAt: new Date()
      };
      messageReactions.reactions.set(reaction, reactionObj);
    }

    const userAlreadyReacted = reactionObj.users.has(user.id);

    if (action === 'add') {
      if (userAlreadyReacted) {
        return { success: true, reactionCount: reactionObj.count, userReacted: true };
      }
      
      // Add user reaction
      reactionObj.users.set(user.id, {
        userId: user.id,
        userName: user.name,
        reactedAt: new Date()
      });
      reactionObj.count++;
      reactionObj.lastReactedAt = new Date();
      messageReactions.totalCount++;
      
    } else if (action === 'remove') {
      if (!userAlreadyReacted) {
        return { success: true, reactionCount: reactionObj.count, userReacted: false };
      }
      
      // Remove user reaction
      reactionObj.users.delete(user.id);
      reactionObj.count--;
      messageReactions.totalCount--;
      
      // Remove empty reaction
      if (reactionObj.count === 0) {
        messageReactions.reactions.delete(reaction);
      }
    }

    messageReactions.lastUpdated = new Date();
    
    return {
      success: true,
      reactionCount: reactionObj.count,
      userReacted: action === 'add' && reactionObj.users.has(user.id)
    };
  }

  // Helper methods
  private async getMessageReactions(messageId: string): Promise<MessageReactions | null> {
    // Check cache first
    if (this.reactionCache.has(messageId)) {
      return this.reactionCache.get(messageId)!;
    }

    // Load from Redis
    try {
      const key = `reactions:message:${messageId}`;
      const data = await this.redis.get(key);
      
      if (data) {
        const parsed = JSON.parse(data);
        const messageReactions: MessageReactions = {
          messageId,
          reactions: new Map(),
          totalCount: parsed.totalCount || 0,
          lastUpdated: new Date(parsed.lastUpdated)
        };

        // Rebuild reaction maps
        for (const [emoji, reactionData] of Object.entries(parsed.reactions || {})) {
          const reaction = reactionData as any;
          messageReactions.reactions.set(emoji, {
            emoji,
            count: reaction.count || 0,
            users: new Map(Object.entries(reaction.users || {}).map(([userId, userData]: [string, any]) => [
              userId,
              {
                userId,
                userName: userData.userName,
                reactedAt: new Date(userData.reactedAt)
              }
            ])),
            firstReactedAt: new Date(reaction.firstReactedAt),
            lastReactedAt: new Date(reaction.lastReactedAt)
          });
        }

        this.reactionCache.set(messageId, messageReactions);
        return messageReactions;
      }
    } catch (error) {
      logger.error({ messageId, error: error.message }, 'Failed to load message reactions from Redis');
    }

    return null;
  }

  private async saveMessageReactions(messageReactions: MessageReactions): Promise<void> {
    try {
      const key = `reactions:message:${messageReactions.messageId}`;
      
      // Convert Maps to Objects for JSON serialization
      const serializable = {
        totalCount: messageReactions.totalCount,
        lastUpdated: messageReactions.lastUpdated.toISOString(),
        reactions: Object.fromEntries(
          Array.from(messageReactions.reactions.entries()).map(([emoji, reactionData]) => [
            emoji,
            {
              emoji: reactionData.emoji,
              count: reactionData.count,
              users: Object.fromEntries(
                Array.from(reactionData.users.entries()).map(([userId, userData]) => [
                  userId,
                  {
                    userId: userData.userId,
                    userName: userData.userName,
                    reactedAt: userData.reactedAt.toISOString()
                  }
                ])
              ),
              firstReactedAt: reactionData.firstReactedAt.toISOString(),
              lastReactedAt: reactionData.lastReactedAt.toISOString()
            }
          ])
        )
      };

      await this.redis.setex(key, 24 * 60 * 60, JSON.stringify(serializable)); // 24 hours TTL

    } catch (error) {
      logger.error({ 
        messageId: messageReactions.messageId, 
        error: error.message 
      }, 'Failed to save message reactions to Redis');
    }
  }

  private async validateReactionLimits(
    messageReactions: MessageReactions, 
    userId: string, 
    reactionData: MessageReactionData
  ): Promise<boolean> {
    // Check total reactions per message
    if (messageReactions.totalCount >= this.MAX_REACTIONS_PER_MESSAGE) {
      return false;
    }

    // Check reactions per user per message
    const userReactionCount = Array.from(messageReactions.reactions.values())
      .filter(reaction => reaction.users.has(userId))
      .length;

    if (reactionData.action === 'add' && userReactionCount >= this.MAX_REACTIONS_PER_USER_PER_MESSAGE) {
      return false;
    }

    return true;
  }

  private async validateMessageAccess(user: any, messageId: string): Promise<boolean> {
    // Simplified validation - should check actual message permissions
    // In a real implementation, this would verify the user has access to the message
    return true;
  }

  private async validateConversationAccess(user: any, conversationId: string): Promise<boolean> {
    // Simplified validation - should check actual conversation permissions
    return true;
  }

  private async getMessageConversationId(messageId: string): Promise<string | null> {
    // This should query your message storage to get the conversation ID
    // For now, returning null - implement based on your message storage
    return null;
  }

  private async getReactionStats(conversationId: string, timeRange: string): Promise<ReactionStats> {
    // Implementation would query reactions within the time range
    // This is a simplified version
    return {
      totalReactions: 0,
      uniqueEmojis: 0,
      topEmojis: [],
      mostReactedMessage: null,
      activeUsers: 0
    };
  }

  private async getUserReactions(userId: string, conversationId?: string, limit = 50, offset = 0): Promise<any[]> {
    // Implementation would query user's reaction history
    return [];
  }

  private async clearMessageReactions(messageId: string): Promise<void> {
    const key = `reactions:message:${messageId}`;
    await this.redis.del(key);
    this.reactionCache.delete(messageId);
  }

  private async moderateReaction(
    messageId: string, 
    emoji: string | undefined, 
    action: string, 
    moderatorId: string, 
    reason: string
  ): Promise<void> {
    // Implementation would handle moderation actions
    if (action === 'remove_emoji' && emoji) {
      const messageReactions = await this.getMessageReactions(messageId);
      if (messageReactions) {
        messageReactions.reactions.delete(emoji);
        await this.saveMessageReactions(messageReactions);
      }
    }
  }

  private cleanupCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [messageId, messageReactions] of this.reactionCache.entries()) {
      const age = now - messageReactions.lastUpdated.getTime();
      if (age > this.CACHE_TTL) {
        keysToDelete.push(messageId);
      }
    }

    for (const key of keysToDelete) {
      this.reactionCache.delete(key);
    }

    if (keysToDelete.length > 0) {
      logger.debug({ cleanedMessages: keysToDelete.length }, 'Cleaned up reaction cache');
    }
  }

  // Public methods for external use
  public getReactionMetrics() {
    return {
      cachedMessages: this.reactionCache.size,
      totalCachedReactions: Array.from(this.reactionCache.values())
        .reduce((sum, msg) => sum + msg.totalCount, 0)
    };
  }

  public async getMessageReactionSummary(messageId: string) {
    const reactions = await this.getMessageReactions(messageId);
    if (!reactions) return null;

    return {
      messageId,
      totalCount: reactions.totalCount,
      uniqueEmojis: reactions.reactions.size,
      topEmojis: Array.from(reactions.reactions.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(r => ({ emoji: r.emoji, count: r.count }))
    };
  }

  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }
}