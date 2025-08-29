import { Server as SocketIOServer } from 'socket.io';
import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { 
  AuthenticatedSocket, 
  SocketEvent, 
  TypingData, 
  TypingSchema,
  TypingIndicator
} from '../types';
import { z } from 'zod';

// Extended typing schemas
const TypingStatusSchema = z.object({
  conversationId: z.string(),
  isTyping: z.boolean(),
  content: z.string().optional(), // Partial content for more advanced indicators
  metadata: z.record(z.unknown()).optional()
});

const GetTypingUsersSchema = z.object({
  conversationId: z.string()
});

export class TypingHandler {
  private io: SocketIOServer;
  private redis: Redis;
  
  // Typing state tracking
  private typingIndicators: Map<string, Map<string, TypingIndicator>> = new Map(); // conversationId -> userId -> indicator
  private typingTimeouts: Map<string, NodeJS.Timeout> = new Map(); // userId:conversationId -> timeout
  
  // Configuration
  private readonly TYPING_TIMEOUT = 5000; // 5 seconds of inactivity before auto-stop
  private readonly TYPING_BROADCAST_THROTTLE = 1000; // 1 second minimum between broadcasts per user
  private lastBroadcast: Map<string, number> = new Map(); // userId:conversationId -> timestamp

  constructor(io: SocketIOServer, redis: Redis) {
    this.io = io;
    this.redis = redis;
    
    // Setup periodic cleanup of stale typing indicators
    setInterval(() => {
      this.cleanupStaleIndicators();
    }, 10000); // Every 10 seconds
  }

  public setupHandlers(): void {
    this.io.on(SocketEvent.CONNECT, (socket: AuthenticatedSocket) => {
      this.setupSocketHandlers(socket);
    });
  }

  private setupSocketHandlers(socket: AuthenticatedSocket): void {
    if (!socket.user) return;

    // Typing indicators
    socket.on(SocketEvent.TYPING_START, (data) => 
      this.handleTypingStart(socket, data)
    );

    socket.on(SocketEvent.TYPING_STOP, (data) => 
      this.handleTypingStop(socket, data)
    );

    // Advanced typing with content preview
    socket.on('typing_status', (data) => 
      this.handleTypingStatus(socket, data)
    );

    // Get current typing users in conversation
    socket.on('get_typing_users', (data) => 
      this.handleGetTypingUsers(socket, data)
    );

    // Activity that should stop typing
    socket.on(SocketEvent.SEND_MESSAGE, (data) => 
      this.handleMessageSent(socket, data)
    );

    socket.on(SocketEvent.STREAM_COMPLETION, (data) => 
      this.handleMessageSent(socket, data)
    );

    // Connection events
    socket.on(SocketEvent.JOIN_CONVERSATION, (data) => 
      this.handleJoinConversation(socket, data)
    );

    socket.on(SocketEvent.LEAVE_CONVERSATION, (data) => 
      this.handleLeaveConversation(socket, data)
    );

    socket.on(SocketEvent.DISCONNECT, () => 
      this.handleDisconnect(socket)
    );
  }

  private async handleTypingStart(socket: AuthenticatedSocket, data: unknown): Promise<void> {
    try {
      const typingData = TypingSchema.parse({ ...data, isTyping: true });
      const user = socket.user!;

      await this.startTyping(socket, typingData.conversationId, user);

    } catch (error) {
      logger.error({
        socketId: socket.id,
        userId: socket.user?.id,
        error: error.message,
        data
      }, 'Error handling typing start');

      socket.emit(SocketEvent.ERROR, {
        message: 'Failed to start typing indicator',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  private async handleTypingStop(socket: AuthenticatedSocket, data: unknown): Promise<void> {
    try {
      const typingData = TypingSchema.parse({ ...data, isTyping: false });
      const user = socket.user!;

      await this.stopTyping(socket, typingData.conversationId, user);

    } catch (error) {
      logger.error({
        socketId: socket.id,
        userId: socket.user?.id,
        error: error.message,
        data
      }, 'Error handling typing stop');

      socket.emit(SocketEvent.ERROR, {
        message: 'Failed to stop typing indicator',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  private async handleTypingStatus(socket: AuthenticatedSocket, data: unknown): Promise<void> {
    try {
      const statusData = TypingStatusSchema.parse(data);
      const user = socket.user!;

      if (statusData.isTyping) {
        await this.startTyping(socket, statusData.conversationId, user, {
          content: statusData.content,
          metadata: statusData.metadata
        });
      } else {
        await this.stopTyping(socket, statusData.conversationId, user);
      }

    } catch (error) {
      logger.error({
        socketId: socket.id,
        userId: socket.user?.id,
        error: error.message,
        data
      }, 'Error handling typing status');

      socket.emit(SocketEvent.ERROR, {
        message: 'Failed to update typing status',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  private async handleGetTypingUsers(socket: AuthenticatedSocket, data: unknown): Promise<void> {
    try {
      const { conversationId } = GetTypingUsersSchema.parse(data);
      
      const typingUsers = this.getTypingUsers(conversationId);
      
      socket.emit('typing_users', {
        conversationId,
        typingUsers: typingUsers.map(indicator => ({
          userId: indicator.userId,
          userName: indicator.userName,
          startedAt: indicator.startedAt.toISOString()
        })),
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error({
        socketId: socket.id,
        userId: socket.user?.id,
        error: error.message,
        data
      }, 'Error getting typing users');

      socket.emit(SocketEvent.ERROR, {
        message: 'Failed to get typing users',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  private async handleMessageSent(socket: AuthenticatedSocket, data: any): Promise<void> {
    const user = socket.user;
    if (!user || !data?.conversationId) return;

    // Stop typing when user sends a message
    await this.stopTyping(socket, data.conversationId, user);
  }

  private async handleJoinConversation(socket: AuthenticatedSocket, data: any): Promise<void> {
    const user = socket.user;
    if (!user || !data?.conversationId) return;

    // Send current typing users in the conversation to the joining user
    const typingUsers = this.getTypingUsers(data.conversationId);
    
    if (typingUsers.length > 0) {
      socket.emit('typing_users', {
        conversationId: data.conversationId,
        typingUsers: typingUsers.map(indicator => ({
          userId: indicator.userId,
          userName: indicator.userName,
          startedAt: indicator.startedAt.toISOString()
        })),
        timestamp: new Date().toISOString()
      });
    }
  }

  private async handleLeaveConversation(socket: AuthenticatedSocket, data: any): Promise<void> {
    const user = socket.user;
    if (!user || !data?.conversationId) return;

    // Stop typing when user leaves conversation
    await this.stopTyping(socket, data.conversationId, user);
  }

  private handleDisconnect(socket: AuthenticatedSocket): void {
    const user = socket.user;
    if (!user) return;

    // Stop typing in all conversations for this user
    for (const [conversationId, userIndicators] of this.typingIndicators.entries()) {
      if (userIndicators.has(user.id)) {
        this.stopTypingInternal(conversationId, user.id, user.name, 'disconnect');
      }
    }
  }

  private async startTyping(
    socket: AuthenticatedSocket, 
    conversationId: string, 
    user: any, 
    options?: { content?: string; metadata?: any }
  ): Promise<void> {
    const timeoutKey = `${user.id}:${conversationId}`;
    const throttleKey = `${user.id}:${conversationId}`;
    const now = Date.now();

    // Check throttling - don't broadcast too frequently
    const lastBroadcastTime = this.lastBroadcast.get(throttleKey) || 0;
    if (now - lastBroadcastTime < this.TYPING_BROADCAST_THROTTLE) {
      // Still update the timeout, but don't broadcast
      this.resetTypingTimeout(timeoutKey, conversationId, user.id, user.name);
      return;
    }

    // Get or create conversation typing map
    if (!this.typingIndicators.has(conversationId)) {
      this.typingIndicators.set(conversationId, new Map());
    }

    const conversationTyping = this.typingIndicators.get(conversationId)!;
    
    // Create or update typing indicator
    const indicator: TypingIndicator = {
      userId: user.id,
      userName: user.name,
      conversationId,
      startedAt: new Date(),
      timeout: setTimeout(() => {
        this.stopTypingInternal(conversationId, user.id, user.name, 'timeout');
      }, this.TYPING_TIMEOUT)
    };

    // Clear existing timeout if any
    const existingIndicator = conversationTyping.get(user.id);
    if (existingIndicator) {
      clearTimeout(existingIndicator.timeout);
    }

    conversationTyping.set(user.id, indicator);

    // Update last broadcast time
    this.lastBroadcast.set(throttleKey, now);

    // Broadcast typing start to other users in conversation
    socket.to(`conversation:${conversationId}`).emit(SocketEvent.TYPING_START, {
      conversationId,
      userId: user.id,
      userName: user.name,
      content: options?.content, // Preview of what they're typing
      metadata: options?.metadata,
      timestamp: new Date().toISOString()
    });

    // Store typing state in Redis for persistence across server restarts
    await this.storeTypingState(conversationId, user.id, {
      userName: user.name,
      startedAt: indicator.startedAt,
      content: options?.content
    });

    logger.debug({
      userId: user.id,
      conversationId,
      hasContent: !!options?.content
    }, 'User started typing');
  }

  private async stopTyping(socket: AuthenticatedSocket, conversationId: string, user: any): Promise<void> {
    await this.stopTypingInternal(conversationId, user.id, user.name, 'manual');
  }

  private async stopTypingInternal(
    conversationId: string, 
    userId: string, 
    userName: string,
    reason: 'manual' | 'timeout' | 'disconnect' | 'message_sent'
  ): Promise<void> {
    const conversationTyping = this.typingIndicators.get(conversationId);
    if (!conversationTyping?.has(userId)) {
      return; // User wasn't typing
    }

    // Clear timeout
    const indicator = conversationTyping.get(userId)!;
    clearTimeout(indicator.timeout);

    // Remove from tracking
    conversationTyping.delete(userId);
    if (conversationTyping.size === 0) {
      this.typingIndicators.delete(conversationId);
    }

    // Clear throttling
    const throttleKey = `${userId}:${conversationId}`;
    this.lastBroadcast.delete(throttleKey);

    // Broadcast typing stop
    this.io.to(`conversation:${conversationId}`).emit(SocketEvent.TYPING_STOP, {
      conversationId,
      userId,
      userName,
      reason,
      timestamp: new Date().toISOString()
    });

    // Remove from Redis
    await this.clearTypingState(conversationId, userId);

    logger.debug({
      userId,
      conversationId,
      reason
    }, 'User stopped typing');
  }

  private resetTypingTimeout(timeoutKey: string, conversationId: string, userId: string, userName: string): void {
    const conversationTyping = this.typingIndicators.get(conversationId);
    const indicator = conversationTyping?.get(userId);
    
    if (indicator) {
      clearTimeout(indicator.timeout);
      indicator.timeout = setTimeout(() => {
        this.stopTypingInternal(conversationId, userId, userName, 'timeout');
      }, this.TYPING_TIMEOUT);
    }
  }

  private async storeTypingState(conversationId: string, userId: string, state: any): Promise<void> {
    try {
      const key = `typing:${conversationId}:${userId}`;
      await this.redis.setex(key, Math.ceil(this.TYPING_TIMEOUT / 1000), JSON.stringify(state));
    } catch (error) {
      logger.error({ 
        conversationId, 
        userId, 
        error: error.message 
      }, 'Failed to store typing state in Redis');
    }
  }

  private async clearTypingState(conversationId: string, userId: string): Promise<void> {
    try {
      const key = `typing:${conversationId}:${userId}`;
      await this.redis.del(key);
    } catch (error) {
      logger.error({ 
        conversationId, 
        userId, 
        error: error.message 
      }, 'Failed to clear typing state from Redis');
    }
  }

  private cleanupStaleIndicators(): void {
    const now = Date.now();
    const staleThreshold = this.TYPING_TIMEOUT * 2; // Double the timeout for safety

    for (const [conversationId, userIndicators] of this.typingIndicators.entries()) {
      const staleUserIds: string[] = [];
      
      for (const [userId, indicator] of userIndicators.entries()) {
        const timeSinceStart = now - indicator.startedAt.getTime();
        if (timeSinceStart > staleThreshold) {
          staleUserIds.push(userId);
        }
      }

      // Clean up stale indicators
      for (const userId of staleUserIds) {
        const indicator = userIndicators.get(userId)!;
        clearTimeout(indicator.timeout);
        userIndicators.delete(userId);
        
        // Broadcast stop
        this.io.to(`conversation:${conversationId}`).emit(SocketEvent.TYPING_STOP, {
          conversationId,
          userId,
          userName: indicator.userName,
          reason: 'cleanup',
          timestamp: new Date().toISOString()
        });

        // Clear from Redis
        this.clearTypingState(conversationId, userId).catch(() => {});
      }

      // Clean up empty conversation maps
      if (userIndicators.size === 0) {
        this.typingIndicators.delete(conversationId);
      }
    }
  }

  // Public methods for external use
  public getTypingUsers(conversationId: string): TypingIndicator[] {
    const conversationTyping = this.typingIndicators.get(conversationId);
    return conversationTyping ? Array.from(conversationTyping.values()) : [];
  }

  public isUserTyping(conversationId: string, userId: string): boolean {
    return this.typingIndicators.get(conversationId)?.has(userId) || false;
  }

  public getTypingUsersCount(conversationId: string): number {
    return this.typingIndicators.get(conversationId)?.size || 0;
  }

  public async forceStopTyping(conversationId: string, userId: string, userName: string): Promise<void> {
    await this.stopTypingInternal(conversationId, userId, userName, 'manual');
  }

  public getTypingMetrics() {
    const totalTypingUsers = Array.from(this.typingIndicators.values())
      .reduce((sum, userMap) => sum + userMap.size, 0);

    return {
      activeConversations: this.typingIndicators.size,
      totalTypingUsers,
      averageTypingUsersPerConversation: this.typingIndicators.size > 0 ? 
        totalTypingUsers / this.typingIndicators.size : 0,
      throttledBroadcasts: this.lastBroadcast.size
    };
  }
}