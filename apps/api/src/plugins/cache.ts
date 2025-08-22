import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import Redis from 'ioredis';
import { CacheService } from '@penny/core';
import crypto from 'crypto';

declare module 'fastify' {
  interface FastifyInstance {
    cache: CacheService;
  }
  
  interface FastifyRequest {
    cacheKey?: string;
  }
}

interface CachePluginOptions {
  redis?: Redis;
  redisUrl?: string;
}

const cachePlugin: FastifyPluginAsync<CachePluginOptions> = async (fastify, options) => {
  // Initialize Redis if not provided
  const redis = options.redis || new Redis(options.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
  
  // Initialize cache service
  const cache = new CacheService({
    redis,
    memoryMaxSize: 1000,
    defaultTTL: 3600,
  });
  
  // Decorate fastify instance
  fastify.decorate('cache', cache);
  
  // Add cache hooks
  fastify.addHook('onRequest', async (request, reply) => {
    // Generate cache key for GET requests
    if (request.method === 'GET') {
      const url = request.url;
      const cacheKey = crypto
        .createHash('sha256')
        .update(`${request.routerPath}:${JSON.stringify(request.query)}`)
        .digest('hex');
      
      request.cacheKey = cacheKey;
    }
  });
  
  // Response caching decorator
  fastify.decorate('withCache', function(handler: any, options: { ttl?: number } = {}) {
    return async function(request: any, reply: any) {
      // Only cache GET requests
      if (request.method !== 'GET' || !request.cacheKey) {
        return handler.call(this, request, reply);
      }
      
      // Check cache
      const cached = await cache.getCachedResponse(request.cacheKey);
      if (cached) {
        reply.header('X-Cache', 'HIT');
        return cached;
      }
      
      // Execute handler
      const result = await handler.call(this, request, reply);
      
      // Cache successful responses
      if (reply.statusCode >= 200 && reply.statusCode < 300) {
        await cache.setCachedResponse(request.cacheKey, result, options.ttl || 300);
        reply.header('X-Cache', 'MISS');
      }
      
      return result;
    };
  });
  
  // Cache invalidation helper
  fastify.decorate('invalidateCache', async function(pattern: string) {
    await cache.clearCache(pattern);
  });
  
  // Cleanup on close
  fastify.addHook('onClose', async () => {
    await redis.quit();
  });
};

export default fp(cachePlugin, {
  name: 'cache',
  dependencies: [],
});