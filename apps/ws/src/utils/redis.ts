import Redis from 'ioredis';
import { logger } from './logger';
import { PubSubMessage } from '../types';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  lazyConnect?: boolean;
  retryDelayOnFailover?: number;
  maxRetriesPerRequest?: number;
}

export class RedisPubSub {
  private publisher: Redis;
  private subscriber: Redis;
  private messageHandlers: Map<string, Set<(message: PubSubMessage) => void>> = new Map();
  private isConnected = false;

  constructor(config: RedisConfig) {
    // Create separate connections for pub/sub to avoid blocking
    this.publisher = new Redis({
      ...config,
      lazyConnect: true,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3
    });

    this.subscriber = new Redis({
      ...config,
      lazyConnect: true,
      enableReadyCheck: true,
      maxRetriesPerRequest: null // Don't retry for subscriber
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Publisher events
    this.publisher.on('connect', () => {
      logger.info('Redis publisher connected');
    });

    this.publisher.on('error', (error) => {
      logger.error({ error: error.message }, 'Redis publisher error');
    });

    this.publisher.on('close', () => {
      logger.warn('Redis publisher connection closed');
      this.isConnected = false;
    });

    // Subscriber events
    this.subscriber.on('connect', () => {
      logger.info('Redis subscriber connected');
      this.isConnected = true;
    });

    this.subscriber.on('error', (error) => {
      logger.error({ error: error.message }, 'Redis subscriber error');
    });

    this.subscriber.on('close', () => {
      logger.warn('Redis subscriber connection closed');
      this.isConnected = false;
    });

    // Message handling
    this.subscriber.on('message', (channel, message) => {
      this.handleMessage(channel, message);
    });

    this.subscriber.on('pmessage', (pattern, channel, message) => {
      this.handleMessage(channel, message, pattern);
    });
  }

  async connect(): Promise<void> {
    try {
      await Promise.all([
        this.publisher.connect(),
        this.subscriber.connect()
      ]);
      
      logger.info('Redis pub/sub connections established');
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to connect Redis pub/sub');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await Promise.all([
        this.publisher.quit(),
        this.subscriber.quit()
      ]);
      
      this.isConnected = false;
      logger.info('Redis pub/sub connections closed');
    } catch (error) {
      logger.error({ error: error.message }, 'Error disconnecting Redis pub/sub');
    }
  }

  // Publishing methods
  async publish(channel: string, message: PubSubMessage): Promise<void> {
    if (!this.isConnected) {
      logger.warn({ channel }, 'Attempted to publish while disconnected');
      return;
    }

    try {
      const serialized = JSON.stringify({
        ...message,
        timestamp: message.timestamp || new Date()
      });

      await this.publisher.publish(channel, serialized);
      
      logger.debug({ 
        channel, 
        messageType: message.type, 
        targetId: message.targetId 
      }, 'Message published');

    } catch (error) {
      logger.error({ 
        channel, 
        messageType: message.type, 
        error: error.message 
      }, 'Failed to publish message');
      throw error;
    }
  }

  async publishToRoom(roomId: string, event: string, data: any, senderId?: string): Promise<void> {
    const message: PubSubMessage = {
      type: 'room_event',
      event,
      data,
      targetId: roomId,
      senderId,
      timestamp: new Date()
    };

    await this.publish(`room:${roomId}`, message);
  }

  async publishToUser(userId: string, event: string, data: any, senderId?: string): Promise<void> {
    const message: PubSubMessage = {
      type: 'user_event',
      event,
      data,
      targetId: userId,
      senderId,
      timestamp: new Date()
    };

    await this.publish(`user:${userId}`, message);
  }

  async publishBroadcast(event: string, data: any, senderId?: string): Promise<void> {
    const message: PubSubMessage = {
      type: 'broadcast',
      event,
      data,
      senderId,
      timestamp: new Date()
    };

    await this.publish('broadcast', message);
  }

  // Subscription methods
  async subscribe(channel: string, handler: (message: PubSubMessage) => void): Promise<void> {
    try {
      // Add handler
      if (!this.messageHandlers.has(channel)) {
        this.messageHandlers.set(channel, new Set());
      }
      this.messageHandlers.get(channel)!.add(handler);

      // Subscribe to channel
      await this.subscriber.subscribe(channel);
      
      logger.debug({ channel }, 'Subscribed to channel');

    } catch (error) {
      logger.error({ channel, error: error.message }, 'Failed to subscribe to channel');
      throw error;
    }
  }

  async unsubscribe(channel: string, handler?: (message: PubSubMessage) => void): Promise<void> {
    try {
      const handlers = this.messageHandlers.get(channel);
      
      if (handler && handlers) {
        handlers.delete(handler);
        
        // If no more handlers, unsubscribe from channel
        if (handlers.size === 0) {
          this.messageHandlers.delete(channel);
          await this.subscriber.unsubscribe(channel);
        }
      } else {
        // Unsubscribe completely
        this.messageHandlers.delete(channel);
        await this.subscriber.unsubscribe(channel);
      }
      
      logger.debug({ channel }, 'Unsubscribed from channel');

    } catch (error) {
      logger.error({ channel, error: error.message }, 'Failed to unsubscribe from channel');
    }
  }

  async subscribeToRoom(roomId: string, handler: (message: PubSubMessage) => void): Promise<void> {
    await this.subscribe(`room:${roomId}`, handler);
  }

  async subscribeToUser(userId: string, handler: (message: PubSubMessage) => void): Promise<void> {
    await this.subscribe(`user:${userId}`, handler);
  }

  async subscribeToBroadcast(handler: (message: PubSubMessage) => void): Promise<void> {
    await this.subscribe('broadcast', handler);
  }

  async subscribeToPattern(pattern: string, handler: (message: PubSubMessage) => void): Promise<void> {
    try {
      // Add handler
      if (!this.messageHandlers.has(pattern)) {
        this.messageHandlers.set(pattern, new Set());
      }
      this.messageHandlers.get(pattern)!.add(handler);

      // Subscribe to pattern
      await this.subscriber.psubscribe(pattern);
      
      logger.debug({ pattern }, 'Subscribed to pattern');

    } catch (error) {
      logger.error({ pattern, error: error.message }, 'Failed to subscribe to pattern');
      throw error;
    }
  }

  // Message handling
  private handleMessage(channel: string, message: string, pattern?: string): void {
    try {
      const parsedMessage: PubSubMessage = JSON.parse(message);
      
      // Handle direct channel subscriptions
      const channelHandlers = this.messageHandlers.get(channel);
      if (channelHandlers) {
        channelHandlers.forEach(handler => {
          try {
            handler(parsedMessage);
          } catch (error) {
            logger.error({ 
              channel, 
              messageType: parsedMessage.type,
              error: error.message 
            }, 'Error in message handler');
          }
        });
      }

      // Handle pattern subscriptions
      if (pattern) {
        const patternHandlers = this.messageHandlers.get(pattern);
        if (patternHandlers) {
          patternHandlers.forEach(handler => {
            try {
              handler(parsedMessage);
            } catch (error) {
              logger.error({ 
                pattern, 
                channel,
                messageType: parsedMessage.type,
                error: error.message 
              }, 'Error in pattern message handler');
            }
          });
        }
      }

      logger.debug({ 
        channel, 
        pattern,
        messageType: parsedMessage.type,
        targetId: parsedMessage.targetId 
      }, 'Message handled');

    } catch (error) {
      logger.error({ 
        channel, 
        pattern,
        rawMessage: message.substring(0, 100),
        error: error.message 
      }, 'Failed to parse message');
    }
  }

  // Utility methods
  getConnectedChannels(): string[] {
    return Array.from(this.messageHandlers.keys());
  }

  getChannelHandlerCount(channel: string): number {
    return this.messageHandlers.get(channel)?.size || 0;
  }

  isChannelSubscribed(channel: string): boolean {
    return this.messageHandlers.has(channel);
  }

  getStatus(): {
    connected: boolean;
    subscribedChannels: number;
    totalHandlers: number;
  } {
    const totalHandlers = Array.from(this.messageHandlers.values())
      .reduce((sum, handlers) => sum + handlers.size, 0);

    return {
      connected: this.isConnected,
      subscribedChannels: this.messageHandlers.size,
      totalHandlers
    };
  }
}

// Utility functions for Redis operations
export class RedisUtils {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  // Lock utilities for distributed locking
  async acquireLock(
    key: string, 
    ttlMs: number = 30000, 
    retries: number = 3
  ): Promise<string | null> {
    const lockValue = `lock_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    
    for (let i = 0; i < retries; i++) {
      try {
        const result = await this.redis.set(key, lockValue, 'PX', ttlMs, 'NX');
        
        if (result === 'OK') {
          logger.debug({ key, lockValue, ttlMs }, 'Lock acquired');
          return lockValue;
        }
        
        // Wait before retry
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
        }
      } catch (error) {
        logger.error({ key, attempt: i + 1, error: error.message }, 'Lock acquisition error');
      }
    }
    
    logger.warn({ key, retries }, 'Failed to acquire lock after retries');
    return null;
  }

  async releaseLock(key: string, lockValue: string): Promise<boolean> {
    try {
      // Use Lua script to ensure atomic release
      const luaScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      
      const result = await this.redis.eval(luaScript, 1, key, lockValue);
      
      if (result === 1) {
        logger.debug({ key, lockValue }, 'Lock released');
        return true;
      }
      
      logger.warn({ key, lockValue }, 'Lock release failed - value mismatch or expired');
      return false;

    } catch (error) {
      logger.error({ key, lockValue, error: error.message }, 'Error releasing lock');
      return false;
    }
  }

  // Batch operations
  async batchGet(keys: string[]): Promise<(string | null)[]> {
    if (keys.length === 0) return [];
    
    try {
      return await this.redis.mget(...keys);
    } catch (error) {
      logger.error({ keyCount: keys.length, error: error.message }, 'Batch get failed');
      return new Array(keys.length).fill(null);
    }
  }

  async batchSet(keyValues: Record<string, string>, ttlSeconds?: number): Promise<boolean> {
    const keys = Object.keys(keyValues);
    if (keys.length === 0) return true;

    try {
      const pipeline = this.redis.pipeline();
      
      for (const [key, value] of Object.entries(keyValues)) {
        if (ttlSeconds) {
          pipeline.setex(key, ttlSeconds, value);
        } else {
          pipeline.set(key, value);
        }
      }
      
      await pipeline.exec();
      logger.debug({ keyCount: keys.length }, 'Batch set completed');
      return true;

    } catch (error) {
      logger.error({ keyCount: keys.length, error: error.message }, 'Batch set failed');
      return false;
    }
  }

  // Cleanup utilities
  async cleanupByPattern(pattern: string, batchSize = 1000): Promise<number> {
    let cursor = '0';
    let deletedCount = 0;

    try {
      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          batchSize
        );
        
        cursor = nextCursor;
        
        if (keys.length > 0) {
          const deleted = await this.redis.del(...keys);
          deletedCount += deleted;
        }
        
      } while (cursor !== '0');

      logger.info({ pattern, deletedCount }, 'Cleanup completed');
      return deletedCount;

    } catch (error) {
      logger.error({ pattern, error: error.message }, 'Cleanup failed');
      return deletedCount;
    }
  }

  // Health check utilities
  async healthCheck(): Promise<{
    connected: boolean;
    latency: number;
    memoryUsage?: any;
    info?: any;
  }> {
    const startTime = Date.now();
    
    try {
      await this.redis.ping();
      const latency = Date.now() - startTime;
      
      const [memoryInfo, serverInfo] = await Promise.all([
        this.redis.memory('usage'),
        this.redis.info('server')
      ]);

      return {
        connected: true,
        latency,
        memoryUsage: memoryInfo,
        info: serverInfo
      };

    } catch (error) {
      logger.error({ error: error.message }, 'Redis health check failed');
      
      return {
        connected: false,
        latency: Date.now() - startTime
      };
    }
  }

  // Metrics utilities
  async getKeyCount(pattern?: string): Promise<number> {
    try {
      if (pattern) {
        let cursor = '0';
        let count = 0;

        do {
          const [nextCursor, keys] = await this.redis.scan(
            cursor,
            'MATCH',
            pattern,
            'COUNT',
            1000
          );
          
          cursor = nextCursor;
          count += keys.length;
          
        } while (cursor !== '0');

        return count;
      } else {
        const info = await this.redis.info('keyspace');
        const dbInfo = info.split('\n').find(line => line.startsWith('db0:'));
        
        if (dbInfo) {
          const match = dbInfo.match(/keys=(\d+)/);
          return match ? parseInt(match[1]) : 0;
        }
        
        return 0;
      }
    } catch (error) {
      logger.error({ pattern, error: error.message }, 'Failed to get key count');
      return 0;
    }
  }

  async getMemoryUsage(): Promise<{
    used: number;
    peak: number;
    total: number;
    available: number;
  }> {
    try {
      const info = await this.redis.info('memory');
      const lines = info.split('\n');
      
      const getValue = (key: string) => {
        const line = lines.find(l => l.startsWith(key + ':'));
        return line ? parseInt(line.split(':')[1]) : 0;
      };

      return {
        used: getValue('used_memory'),
        peak: getValue('used_memory_peak'),
        total: getValue('total_system_memory'),
        available: getValue('available_memory')
      };

    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get memory usage');
      return { used: 0, peak: 0, total: 0, available: 0 };
    }
  }
}

// Factory function to create Redis instances
export function createRedisInstance(config: RedisConfig): Redis {
  const redis = new Redis({
    ...config,
    enableReadyCheck: true,
    lazyConnect: true,
    retryDelayOnFailover: config.retryDelayOnFailover || 100,
    maxRetriesPerRequest: config.maxRetriesPerRequest || 3
  });

  redis.on('error', (error) => {
    logger.error({ error: error.message }, 'Redis connection error');
  });

  redis.on('connect', () => {
    logger.info({ 
      host: config.host, 
      port: config.port, 
      db: config.db 
    }, 'Redis connected');
  });

  redis.on('close', () => {
    logger.warn('Redis connection closed');
  });

  return redis;
}

// Export utilities
export { Redis };