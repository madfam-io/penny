import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { PresenceStatus, UserPresence } from '../types';

interface PresenceData {
  status: PresenceStatus;
  lastActive: Date;
  customMessage?: string;
  socketIds: Set<string>;
  conversationIds: Set<string>;
}

interface PresenceUpdate {
  status?: PresenceStatus;
  lastActive?: Date;
  customMessage?: string;
  socketIds?: Set<string>;
}

interface PresenceMetrics {
  onlineUsers: number;
  awayUsers: number;
  busyUsers: number;
  offlineUsers: number;
  totalUsers: number;
  averageSessionDuration: number;
}

export class PresenceService {
  private redis: Redis;
  private readonly PRESENCE_TTL = 60 * 60; // 1 hour
  private readonly PRESENCE_KEY_PREFIX = 'presence:';
  private readonly PRESENCE_INDEX_KEY = 'presence_index';

  // Local cache for frequently accessed presence data
  private presenceCache: Map<string, PresenceData> = new Map();
  private readonly CACHE_TTL = 30 * 1000; // 30 seconds
  private cacheTimestamps: Map<string, number> = new Map();

  constructor(redis: Redis) {
    this.redis = redis;
    
    // Setup cache cleanup
    setInterval(() => {
      this.cleanupCache();
    }, 60000); // Every minute
  }

  // Core presence operations
  async updatePresence(userId: string, update: PresenceUpdate): Promise<void> {
    try {
      const key = `${this.PRESENCE_KEY_PREFIX}${userId}`;
      
      // Get current presence data
      let currentPresence = await this.getPresence(userId);
      if (!currentPresence) {
        currentPresence = {
          status: PresenceStatus.OFFLINE,
          lastActive: new Date(),
          socketIds: new Set(),
          conversationIds: new Set()
        };
      }

      // Apply updates
      const updatedPresence: PresenceData = {
        ...currentPresence,
        ...update,
        lastActive: update.lastActive || new Date()
      };

      // Store in Redis
      const serializedData = {
        status: updatedPresence.status,
        lastActive: updatedPresence.lastActive.toISOString(),
        customMessage: updatedPresence.customMessage || '',
        socketIds: JSON.stringify(Array.from(updatedPresence.socketIds)),
        conversationIds: JSON.stringify(Array.from(updatedPresence.conversationIds))
      };

      await this.redis.hmset(key, serializedData);
      await this.redis.expire(key, this.PRESENCE_TTL);

      // Update presence index
      await this.updatePresenceIndex(userId, updatedPresence.status);

      // Update cache
      this.presenceCache.set(userId, updatedPresence);
      this.cacheTimestamps.set(userId, Date.now());

      // Store presence history for analytics
      await this.recordPresenceHistory(userId, updatedPresence);

      logger.debug({
        userId,
        status: updatedPresence.status,
        socketCount: updatedPresence.socketIds.size,
        conversationCount: updatedPresence.conversationIds.size
      }, 'Presence updated');

    } catch (error) {
      logger.error({
        userId,
        update,
        error: error.message
      }, 'Failed to update presence');
      throw error;
    }
  }

  async getPresence(userId: string): Promise<PresenceData | null> {
    try {
      // Check cache first
      const cached = this.getCachedPresence(userId);
      if (cached) {
        return cached;
      }

      // Fetch from Redis
      const key = `${this.PRESENCE_KEY_PREFIX}${userId}`;
      const data = await this.redis.hmget(
        key,
        'status',
        'lastActive',
        'customMessage',
        'socketIds',
        'conversationIds'
      );

      if (!data[0]) {
        return null;
      }

      const presence: PresenceData = {
        status: data[0] as PresenceStatus,
        lastActive: new Date(data[1] || Date.now()),
        customMessage: data[2] || undefined,
        socketIds: new Set(data[3] ? JSON.parse(data[3]) : []),
        conversationIds: new Set(data[4] ? JSON.parse(data[4]) : [])
      };

      // Cache the result
      this.presenceCache.set(userId, presence);
      this.cacheTimestamps.set(userId, Date.now());

      return presence;

    } catch (error) {
      logger.error({
        userId,
        error: error.message
      }, 'Failed to get presence');
      return null;
    }
  }

  async getBulkPresence(userIds: string[]): Promise<Map<string, PresenceData>> {
    const presenceMap = new Map<string, PresenceData>();

    if (userIds.length === 0) {
      return presenceMap;
    }

    try {
      // Check cache first
      const uncachedUserIds: string[] = [];
      for (const userId of userIds) {
        const cached = this.getCachedPresence(userId);
        if (cached) {
          presenceMap.set(userId, cached);
        } else {
          uncachedUserIds.push(userId);
        }
      }

      // Fetch uncached users from Redis in parallel
      if (uncachedUserIds.length > 0) {
        const pipeline = this.redis.pipeline();
        
        for (const userId of uncachedUserIds) {
          const key = `${this.PRESENCE_KEY_PREFIX}${userId}`;
          pipeline.hmget(key, 'status', 'lastActive', 'customMessage', 'socketIds', 'conversationIds');
        }

        const results = await pipeline.exec();
        
        if (results) {
          for (let i = 0; i < uncachedUserIds.length; i++) {
            const userId = uncachedUserIds[i];
            const data = results[i][1] as string[];
            
            if (data[0]) {
              const presence: PresenceData = {
                status: data[0] as PresenceStatus,
                lastActive: new Date(data[1] || Date.now()),
                customMessage: data[2] || undefined,
                socketIds: new Set(data[3] ? JSON.parse(data[3]) : []),
                conversationIds: new Set(data[4] ? JSON.parse(data[4]) : [])
              };

              presenceMap.set(userId, presence);
              
              // Cache the result
              this.presenceCache.set(userId, presence);
              this.cacheTimestamps.set(userId, Date.now());
            }
          }
        }
      }

      return presenceMap;

    } catch (error) {
      logger.error({
        userCount: userIds.length,
        error: error.message
      }, 'Failed to get bulk presence');
      return presenceMap;
    }
  }

  async getUsersByStatus(status: PresenceStatus, limit = 100): Promise<string[]> {
    try {
      const indexKey = `${this.PRESENCE_INDEX_KEY}:${status}`;
      return await this.redis.smembers(indexKey);
    } catch (error) {
      logger.error({
        status,
        error: error.message
      }, 'Failed to get users by status');
      return [];
    }
  }

  async getOnlineUsers(limit = 100): Promise<string[]> {
    return await this.getUsersByStatus(PresenceStatus.ONLINE, limit);
  }

  async isUserOnline(userId: string): Promise<boolean> {
    try {
      const presence = await this.getPresence(userId);
      return presence?.status === PresenceStatus.ONLINE && presence.socketIds.size > 0;
    } catch (error) {
      logger.error({
        userId,
        error: error.message
      }, 'Failed to check if user is online');
      return false;
    }
  }

  async updateLastActive(userId: string, lastActive: Date = new Date()): Promise<void> {
    try {
      const key = `${this.PRESENCE_KEY_PREFIX}${userId}`;
      
      // Update only the lastActive timestamp
      await this.redis.hset(key, 'lastActive', lastActive.toISOString());
      await this.redis.expire(key, this.PRESENCE_TTL);

      // Update cache if present
      const cached = this.presenceCache.get(userId);
      if (cached) {
        cached.lastActive = lastActive;
      }

    } catch (error) {
      logger.error({
        userId,
        error: error.message
      }, 'Failed to update last active');
    }
  }

  async addSocketToUser(userId: string, socketId: string): Promise<void> {
    try {
      const presence = await this.getPresence(userId) || {
        status: PresenceStatus.ONLINE,
        lastActive: new Date(),
        socketIds: new Set(),
        conversationIds: new Set()
      };

      presence.socketIds.add(socketId);
      presence.status = PresenceStatus.ONLINE;
      presence.lastActive = new Date();

      await this.updatePresence(userId, presence);

    } catch (error) {
      logger.error({
        userId,
        socketId,
        error: error.message
      }, 'Failed to add socket to user');
    }
  }

  async removeSocketFromUser(userId: string, socketId: string): Promise<void> {
    try {
      const presence = await this.getPresence(userId);
      if (!presence) return;

      presence.socketIds.delete(socketId);

      // If no more sockets, consider user offline
      if (presence.socketIds.size === 0) {
        presence.status = PresenceStatus.OFFLINE;
      }

      presence.lastActive = new Date();
      await this.updatePresence(userId, presence);

    } catch (error) {
      logger.error({
        userId,
        socketId,
        error: error.message
      }, 'Failed to remove socket from user');
    }
  }

  async addUserToConversation(userId: string, conversationId: string): Promise<void> {
    try {
      const presence = await this.getPresence(userId);
      if (!presence) return;

      presence.conversationIds.add(conversationId);
      presence.lastActive = new Date();

      await this.updatePresence(userId, presence);

    } catch (error) {
      logger.error({
        userId,
        conversationId,
        error: error.message
      }, 'Failed to add user to conversation');
    }
  }

  async removeUserFromConversation(userId: string, conversationId: string): Promise<void> {
    try {
      const presence = await this.getPresence(userId);
      if (!presence) return;

      presence.conversationIds.delete(conversationId);
      presence.lastActive = new Date();

      await this.updatePresence(userId, presence);

    } catch (error) {
      logger.error({
        userId,
        conversationId,
        error: error.message
      }, 'Failed to remove user from conversation');
    }
  }

  async getConversationParticipants(conversationId: string): Promise<string[]> {
    try {
      // Get all online users and filter by conversation
      const onlineUsers = await this.getOnlineUsers(1000);
      const participants: string[] = [];

      const presenceData = await this.getBulkPresence(onlineUsers);
      
      for (const [userId, presence] of presenceData.entries()) {
        if (presence.conversationIds.has(conversationId)) {
          participants.push(userId);
        }
      }

      return participants;

    } catch (error) {
      logger.error({
        conversationId,
        error: error.message
      }, 'Failed to get conversation participants');
      return [];
    }
  }

  // Analytics and monitoring
  async getPresenceMetrics(): Promise<PresenceMetrics> {
    try {
      const [onlineUsers, awayUsers, busyUsers, offlineUsers] = await Promise.all([
        this.getUsersByStatus(PresenceStatus.ONLINE),
        this.getUsersByStatus(PresenceStatus.AWAY),
        this.getUsersByStatus(PresenceStatus.BUSY),
        this.getUsersByStatus(PresenceStatus.OFFLINE)
      ]);

      const totalUsers = onlineUsers.length + awayUsers.length + busyUsers.length + offlineUsers.length;

      // Calculate average session duration (simplified)
      let totalSessionTime = 0;
      let sessionCount = 0;

      const activeUsers = [...onlineUsers, ...awayUsers, ...busyUsers];
      const presenceData = await this.getBulkPresence(activeUsers.slice(0, 100)); // Sample

      for (const [userId, presence] of presenceData.entries()) {
        if (presence.socketIds.size > 0) {
          // Estimate session time based on last active
          const sessionTime = Date.now() - presence.lastActive.getTime();
          if (sessionTime < 24 * 60 * 60 * 1000) { // Less than 24 hours
            totalSessionTime += sessionTime;
            sessionCount++;
          }
        }
      }

      const averageSessionDuration = sessionCount > 0 ? totalSessionTime / sessionCount : 0;

      return {
        onlineUsers: onlineUsers.length,
        awayUsers: awayUsers.length,
        busyUsers: busyUsers.length,
        offlineUsers: offlineUsers.length,
        totalUsers,
        averageSessionDuration
      };

    } catch (error) {
      logger.error({
        error: error.message
      }, 'Failed to get presence metrics');
      return {
        onlineUsers: 0,
        awayUsers: 0,
        busyUsers: 0,
        offlineUsers: 0,
        totalUsers: 0,
        averageSessionDuration: 0
      };
    }
  }

  async getAllPresences(): Promise<Map<string, PresenceData>> {
    try {
      // Get all presence keys
      const keys = await this.redis.keys(`${this.PRESENCE_KEY_PREFIX}*`);
      const userIds = keys.map(key => key.replace(this.PRESENCE_KEY_PREFIX, ''));
      
      return await this.getBulkPresence(userIds);

    } catch (error) {
      logger.error({
        error: error.message
      }, 'Failed to get all presences');
      return new Map();
    }
  }

  async cleanupStalePresence(maxAgeMs = 24 * 60 * 60 * 1000): Promise<number> {
    try {
      const keys = await this.redis.keys(`${this.PRESENCE_KEY_PREFIX}*`);
      let cleanedCount = 0;

      for (const key of keys) {
        const lastActiveStr = await this.redis.hget(key, 'lastActive');
        
        if (lastActiveStr) {
          const lastActive = new Date(lastActiveStr);
          const age = Date.now() - lastActive.getTime();
          
          if (age > maxAgeMs) {
            const userId = key.replace(this.PRESENCE_KEY_PREFIX, '');
            
            // Remove from indexes
            await this.removeFromAllIndexes(userId);
            
            // Delete presence data
            await this.redis.del(key);
            
            // Remove from cache
            this.presenceCache.delete(userId);
            this.cacheTimestamps.delete(userId);
            
            cleanedCount++;
          }
        }
      }

      logger.info({ cleanedCount }, 'Cleaned up stale presence data');
      return cleanedCount;

    } catch (error) {
      logger.error({
        error: error.message
      }, 'Failed to cleanup stale presence');
      return 0;
    }
  }

  // Private helper methods
  private getCachedPresence(userId: string): PresenceData | null {
    const cached = this.presenceCache.get(userId);
    const timestamp = this.cacheTimestamps.get(userId);
    
    if (cached && timestamp && Date.now() - timestamp < this.CACHE_TTL) {
      return cached;
    }
    
    // Cache expired
    this.presenceCache.delete(userId);
    this.cacheTimestamps.delete(userId);
    return null;
  }

  private async updatePresenceIndex(userId: string, status: PresenceStatus): Promise<void> {
    try {
      // Remove from all status indexes
      const statuses = [PresenceStatus.ONLINE, PresenceStatus.AWAY, PresenceStatus.BUSY, PresenceStatus.OFFLINE];
      
      for (const s of statuses) {
        if (s !== status) {
          const indexKey = `${this.PRESENCE_INDEX_KEY}:${s}`;
          await this.redis.srem(indexKey, userId);
        }
      }

      // Add to current status index
      const currentIndexKey = `${this.PRESENCE_INDEX_KEY}:${status}`;
      await this.redis.sadd(currentIndexKey, userId);
      await this.redis.expire(currentIndexKey, this.PRESENCE_TTL);

    } catch (error) {
      logger.error({
        userId,
        status,
        error: error.message
      }, 'Failed to update presence index');
    }
  }

  private async removeFromAllIndexes(userId: string): Promise<void> {
    const statuses = [PresenceStatus.ONLINE, PresenceStatus.AWAY, PresenceStatus.BUSY, PresenceStatus.OFFLINE];
    
    for (const status of statuses) {
      const indexKey = `${this.PRESENCE_INDEX_KEY}:${status}`;
      await this.redis.srem(indexKey, userId);
    }
  }

  private async recordPresenceHistory(userId: string, presence: PresenceData): Promise<void> {
    try {
      // Store presence changes for analytics (with limited history)
      const historyKey = `presence_history:${userId}`;
      const historyEntry = {
        status: presence.status,
        timestamp: presence.lastActive.toISOString(),
        customMessage: presence.customMessage || ''
      };

      await this.redis.lpush(historyKey, JSON.stringify(historyEntry));
      await this.redis.ltrim(historyKey, 0, 99); // Keep last 100 entries
      await this.redis.expire(historyKey, 7 * 24 * 60 * 60); // 7 days

    } catch (error) {
      // Don't throw - history is optional
      logger.debug({
        userId,
        error: error.message
      }, 'Failed to record presence history');
    }
  }

  private cleanupCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [userId, timestamp] of this.cacheTimestamps.entries()) {
      if (now - timestamp > this.CACHE_TTL) {
        keysToDelete.push(userId);
      }
    }

    for (const userId of keysToDelete) {
      this.presenceCache.delete(userId);
      this.cacheTimestamps.delete(userId);
    }

    if (keysToDelete.length > 0) {
      logger.debug({
        cleanedEntries: keysToDelete.length,
        remainingEntries: this.presenceCache.size
      }, 'Cleaned up presence cache');
    }
  }

  // Public utility methods
  public getCacheStats() {
    return {
      cachedUsers: this.presenceCache.size,
      cacheHitRate: this.presenceCache.size > 0 ? 
        Array.from(this.cacheTimestamps.values()).filter(t => Date.now() - t < this.CACHE_TTL).length / this.presenceCache.size : 0
    };
  }

  public async forceRefreshCache(userId?: string): Promise<void> {
    if (userId) {
      this.presenceCache.delete(userId);
      this.cacheTimestamps.delete(userId);
    } else {
      this.presenceCache.clear();
      this.cacheTimestamps.clear();
    }
  }
}