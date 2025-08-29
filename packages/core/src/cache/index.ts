import type Redis from 'ioredis';
import { LRUCache } from 'lru-cache';
import type { Conversation, Message, User } from '@penny/database';

export interface CacheConfig {
  redis: Redis;
  memoryMaxSize?: number;
  defaultTTL?: number;
}

export class CacheService {
  private redis: Redis;
  private memoryCache: LRUCache<string, any>;
  private defaultTTL: number;

  constructor(config: CacheConfig) {
    this.redis = config.redis;
    this.defaultTTL = config.defaultTTL || 3600; // 1 hour default

    // Initialize in-memory LRU cache
    this.memoryCache = new LRUCache({
      max: config.memoryMaxSize || 1000,
      ttl: 60000, // 1 minute in-memory TTL
      updateAgeOnGet: true,
      updateAgeOnHas: true,
    });

    // Subscribe to cache invalidation events
    this.setupInvalidationListener();
  }

  // Conversation cache methods
  async getConversation(id: string): Promise<Conversation | null> {
    const cacheKey = `conv:${id}`;

    // L1: Memory cache
    const memCached = this.memoryCache.get(cacheKey);
    if (memCached) {
      return memCached;
    }

    // L2: Redis cache
    const redisCached = await this.redis.get(cacheKey);
    if (redisCached) {
      const conversation = JSON.parse(redisCached);
      this.memoryCache.set(cacheKey, conversation);
      return conversation;
    }

    return null;
  }

  async setConversation(conversation: Conversation, ttl?: number): Promise<void> {
    const cacheKey = `conv:${conversation.id}`;
    const serialized = JSON.stringify(conversation);

    // Set in both caches
    this.memoryCache.set(cacheKey, conversation);
    await this.redis.setex(cacheKey, ttl || this.defaultTTL, serialized);
  }

  async invalidateConversation(conversationId: string): Promise<void> {
    const keys = [
      `conv:${conversationId}`,
      `conv:${conversationId}:messages`,
      `conv:${conversationId}:artifacts`,
    ];

    // Clear from memory cache
    keys.forEach((key) => this.memoryCache.delete(key));

    // Clear from Redis
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }

    // Publish invalidation event for distributed cache
    await this.redis.publish(
      'cache:invalidate',
      JSON.stringify({
        type: 'conversation',
        id: conversationId,
        keys,
      }),
    );
  }

  // Message cache methods
  async getRecentMessages(conversationId: string, limit = 50): Promise<Message[] | null> {
    const cacheKey = `conv:${conversationId}:messages:${limit}`;

    // Check memory cache first
    const memCached = this.memoryCache.get(cacheKey);
    if (memCached) {
      return memCached;
    }

    // Check Redis
    const redisCached = await this.redis.get(cacheKey);
    if (redisCached) {
      const messages = JSON.parse(redisCached);
      this.memoryCache.set(cacheKey, messages);
      return messages;
    }

    return null;
  }

  async setRecentMessages(conversationId: string, messages: Message[], limit = 50): Promise<void> {
    const cacheKey = `conv:${conversationId}:messages:${limit}`;
    const serialized = JSON.stringify(messages);

    this.memoryCache.set(cacheKey, messages);
    await this.redis.setex(cacheKey, 300, serialized); // 5 minute TTL for messages
  }

  // User cache methods
  async getUser(userId: string): Promise<User | null> {
    const cacheKey = `user:${userId}`;

    const memCached = this.memoryCache.get(cacheKey);
    if (memCached) {
      return memCached;
    }

    const redisCached = await this.redis.get(cacheKey);
    if (redisCached) {
      const user = JSON.parse(redisCached);
      this.memoryCache.set(cacheKey, user);
      return user;
    }

    return null;
  }

  async setUser(user: User, ttl?: number): Promise<void> {
    const cacheKey = `user:${user.id}`;
    const serialized = JSON.stringify(user);

    this.memoryCache.set(cacheKey, user);
    await this.redis.setex(cacheKey, ttl || this.defaultTTL, serialized);
  }

  // Session cache methods
  async getSession(token: string): Promise<any | null> {
    const cacheKey = `session:${token}`;

    // Sessions should be in Redis only (not in memory cache)
    const session = await this.redis.get(cacheKey);
    return session ? JSON.parse(session) : null;
  }

  async setSession(token: string, session: any, ttl: number): Promise<void> {
    const cacheKey = `session:${token}`;
    await this.redis.setex(cacheKey, ttl, JSON.stringify(session));
  }

  async invalidateSession(token: string): Promise<void> {
    await this.redis.del(`session:${token}`);
  }

  // Model provider cache
  async getModelProviders(): Promise<any[] | null> {
    const cacheKey = 'models:providers';

    const cached = this.memoryCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const redisCached = await this.redis.get(cacheKey);
    if (redisCached) {
      const providers = JSON.parse(redisCached);
      this.memoryCache.set(cacheKey, providers);
      return providers;
    }

    return null;
  }

  async setModelProviders(providers: any[], ttl = 3600): Promise<void> {
    const cacheKey = 'models:providers';

    this.memoryCache.set(cacheKey, providers);
    await this.redis.setex(cacheKey, ttl, JSON.stringify(providers));
  }

  // API response cache
  async getCachedResponse(key: string): Promise<any | null> {
    const cacheKey = `api:${key}`;

    const cached = this.memoryCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const redisCached = await this.redis.get(cacheKey);
    return redisCached ? JSON.parse(redisCached) : null;
  }

  async setCachedResponse(key: string, data: any, ttl = 300): Promise<void> {
    const cacheKey = `api:${key}`;

    this.memoryCache.set(cacheKey, data);
    await this.redis.setex(cacheKey, ttl, JSON.stringify(data));
  }

  // Query result cache
  async getCachedQuery(queryHash: string): Promise<any | null> {
    const cacheKey = `query:${queryHash}`;

    const cached = await this.redis.get(cacheKey);
    return cached ? JSON.parse(cached) : null;
  }

  async setCachedQuery(queryHash: string, result: any, ttl = 600): Promise<void> {
    const cacheKey = `query:${queryHash}`;
    await this.redis.setex(cacheKey, ttl, JSON.stringify(result));
  }

  // Utility methods
  async warmCache(conversationId: string): Promise<void> {
    // This would be called to pre-populate cache
    // Implementation depends on data access patterns
  }

  async clearCache(pattern?: string): Promise<void> {
    if (!pattern) {
      this.memoryCache.clear();
      return;
    }

    // Clear matching keys from memory cache
    for (const key of this.memoryCache.keys()) {
      if (key.includes(pattern)) {
        this.memoryCache.delete(key);
      }
    }

    // Clear from Redis (be careful with this in production)
    const keys = await this.redis.keys(`*${pattern}*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  // Cache statistics
  getStats() {
    return {
      memory: {
        size: this.memoryCache.size,
        calculatedSize: this.memoryCache.calculatedSize,
      },
      hitRate: {
        // Would need to implement hit/miss tracking
      },
    };
  }

  // Set up distributed cache invalidation
  private setupInvalidationListener(): void {
    const subscriber = this.redis.duplicate();

    subscriber.subscribe('cache:invalidate');

    subscriber.on('message', (channel, message) => {
      try {
        const event = JSON.parse(message);

        // Clear from local memory cache
        if (event.keys && Array.isArray(event.keys)) {
          event.keys.forEach((key: string) => {
            this.memoryCache.delete(key);
          });
        }
      } catch (error) {
        console.error('Cache invalidation error:', error);
      }
    });
  }
}

// Cache key generators
export const cacheKeys = {
  conversation: (id: string) => `conv:${id}`,
  conversationMessages: (id: string, limit: number) => `conv:${id}:messages:${limit}`,
  user: (id: string) => `user:${id}`,
  session: (token: string) => `session:${token}`,
  apiResponse: (endpoint: string, params: string) => `api:${endpoint}:${params}`,
  modelProviders: () => 'models:providers',
  queryResult: (hash: string) => `query:${hash}`,
};
