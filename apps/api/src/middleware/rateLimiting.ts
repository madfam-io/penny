import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Redis } from 'ioredis';

interface RateLimitConfig {
  max: number;
  timeWindow: number; // in seconds
  keyGenerator?: (request: FastifyRequest) => string;
  skipOnError?: boolean;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  onLimitReached?: (request: FastifyRequest, reply: FastifyReply) => void;
}

interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export async function rateLimitingPlugin(fastify: FastifyInstance) {
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

  // Default configurations for different endpoints
  const defaultConfigs = {
    global: { max: 1000, timeWindow: 3600 }, // 1000 requests per hour
    auth: { max: 10, timeWindow: 900 }, // 10 auth attempts per 15 minutes
    api: { max: 100, timeWindow: 3600 }, // 100 API calls per hour per user
    upload: { max: 10, timeWindow: 600 }, // 10 uploads per 10 minutes
    ai: { max: 50, timeWindow: 3600 }, // 50 AI requests per hour
    webhook: { max: 1000, timeWindow: 60 }, // 1000 webhook calls per minute
  };

  fastify.decorate('rateLimiting', function(configName?: keyof typeof defaultConfigs | RateLimitConfig) {
    return async function(request: FastifyRequest, reply: FastifyReply) {
      let config: RateLimitConfig;

      if (typeof configName === 'string') {
        config = defaultConfigs[configName] || defaultConfigs.global;
      } else if (typeof configName === 'object') {
        config = configName;
      } else {
        config = defaultConfigs.global;
      }

      const key = config.keyGenerator 
        ? config.keyGenerator(request)
        : generateDefaultKey(request);

      try {
        const rateLimitInfo = await checkRateLimit(key, config);

        // Add rate limit headers
        reply.header('X-RateLimit-Limit', rateLimitInfo.limit);
        reply.header('X-RateLimit-Remaining', rateLimitInfo.remaining);
        reply.header('X-RateLimit-Reset', rateLimitInfo.resetTime);

        if (rateLimitInfo.remaining < 0) {
          if (rateLimitInfo.retryAfter) {
            reply.header('Retry-After', rateLimitInfo.retryAfter);
          }

          if (config.onLimitReached) {
            config.onLimitReached(request, reply);
          } else {
            return reply.code(429).send({
              error: 'Too Many Requests',
              message: 'Rate limit exceeded',
              retryAfter: rateLimitInfo.retryAfter,
            });
          }
        }

        // Store rate limit info for potential response handling
        request.rateLimitInfo = rateLimitInfo;

      } catch (error) {
        if (!config.skipOnError) {
          request.log.error(error, 'Rate limiting check failed');
          return reply.code(500).send({
            error: 'Internal Server Error',
            message: 'Rate limiting service unavailable',
          });
        }
        // Skip rate limiting on error if configured to do so
      }
    };
  });

  // Tiered rate limiting based on subscription
  fastify.decorate('tieredRateLimiting', function(
    configs: Record<string, RateLimitConfig>
  ) {
    return async function(request: FastifyRequest, reply: FastifyReply) {
      const subscriptionTier = request.user?.subscriptionTier || 'free';
      const config = configs[subscriptionTier] || configs['free'] || defaultConfigs.global;

      return fastify.rateLimiting(config)(request, reply);
    };
  });

  // IP-based rate limiting (for unauthenticated endpoints)
  fastify.decorate('ipRateLimiting', function(config?: RateLimitConfig) {
    const rateLimitConfig = config || defaultConfigs.global;
    rateLimitConfig.keyGenerator = (request: FastifyRequest) => {
      const forwarded = request.headers['x-forwarded-for'];\n      const ip = forwarded ? (forwarded as string).split(',')[0] : request.ip;
      return `ip:${ip}`;
    };

    return fastify.rateLimiting(rateLimitConfig);
  });

  // User-based rate limiting
  fastify.decorate('userRateLimiting', function(config?: RateLimitConfig) {
    const rateLimitConfig = config || defaultConfigs.api;
    rateLimitConfig.keyGenerator = (request: FastifyRequest) => {
      if (!request.user?.id) {
        const forwarded = request.headers['x-forwarded-for'];\n        const ip = forwarded ? (forwarded as string).split(',')[0] : request.ip;\n        return `ip:${ip}`;
      }\n      return `user:${request.user.id}`;
    };

    return fastify.rateLimiting(rateLimitConfig);
  });

  // Tenant-based rate limiting
  fastify.decorate('tenantRateLimiting', function(config?: RateLimitConfig) {
    const rateLimitConfig = config || defaultConfigs.api;
    rateLimitConfig.keyGenerator = (request: FastifyRequest) => {
      if (!request.user?.tenantId) {
        const forwarded = request.headers['x-forwarded-for'];\n        const ip = forwarded ? (forwarded as string).split(',')[0] : request.ip;\n        return `ip:${ip}`;
      }\n      return `tenant:${request.user.tenantId}`;
    };

    return fastify.rateLimiting(rateLimitConfig);
  });

  // Endpoint-specific rate limiting
  fastify.decorate('endpointRateLimiting', function(
    endpoint: string,
    config?: RateLimitConfig
  ) {
    const rateLimitConfig = config || defaultConfigs.api;
    rateLimitConfig.keyGenerator = (request: FastifyRequest) => {
      const userId = request.user?.id || 'anonymous';\n      return `endpoint:${endpoint}:${userId}`;
    };

    return fastify.rateLimiting(rateLimitConfig);
  });

  // Burst rate limiting (allows short bursts with longer cooldown)
  fastify.decorate('burstRateLimiting', function(
    burstConfig: { max: number; timeWindow: number },
    sustainedConfig: { max: number; timeWindow: number }
  ) {
    return async function(request: FastifyRequest, reply: FastifyReply) {
      const key = generateDefaultKey(request);
      
      try {
        // Check burst limit first\n        const burstInfo = await checkRateLimit(`${key}:burst`, burstConfig);
        
        // Check sustained limit\n        const sustainedInfo = await checkRateLimit(`${key}:sustained`, sustainedConfig);

        // Use the more restrictive limit
        const rateLimitInfo = burstInfo.remaining < sustainedInfo.remaining ? burstInfo : sustainedInfo;

        reply.header('X-RateLimit-Limit', rateLimitInfo.limit);
        reply.header('X-RateLimit-Remaining', rateLimitInfo.remaining);
        reply.header('X-RateLimit-Reset', rateLimitInfo.resetTime);

        if (rateLimitInfo.remaining < 0) {
          if (rateLimitInfo.retryAfter) {
            reply.header('Retry-After', rateLimitInfo.retryAfter);
          }

          return reply.code(429).send({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded',
            retryAfter: rateLimitInfo.retryAfter,
          });
        }

        request.rateLimitInfo = rateLimitInfo;

      } catch (error) {
        request.log.error(error, 'Burst rate limiting check failed');
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Rate limiting service unavailable',
        });
      }
    };
  });

  // Adaptive rate limiting based on system load
  fastify.decorate('adaptiveRateLimiting', function(
    baseConfig: RateLimitConfig,
    loadFactorFn?: () => Promise<number>
  ) {
    return async function(request: FastifyRequest, reply: FastifyReply) {
      let adjustedConfig = { ...baseConfig };

      if (loadFactorFn) {
        try {
          const loadFactor = await loadFactorFn();
          // Reduce rate limit if system load is high
          adjustedConfig.max = Math.max(1, Math.floor(baseConfig.max * (2 - loadFactor)));
        } catch (error) {
          // Use base config if load factor check fails
          request.log.warn(error, 'Failed to get system load factor');
        }
      }

      return fastify.rateLimiting(adjustedConfig)(request, reply);
    };
  });

  // Helper function to check rate limit using sliding window
  async function checkRateLimit(
    key: string,
    config: RateLimitConfig
  ): Promise<RateLimitInfo> {
    const now = Math.floor(Date.now() / 1000);
    const window = config.timeWindow;
    const windowStart = now - window;

    const pipeline = redis.pipeline();

    // Remove expired entries
    pipeline.zremrangebyscore(key, 0, windowStart);
    
    // Count current requests in window
    pipeline.zcard(key);
    
    // Add current request\n    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    
    // Set expiry for cleanup
    pipeline.expire(key, window + 60);

    const results = await pipeline.exec();

    if (!results) {
      throw new Error('Redis pipeline failed');
    }

    const currentCount = (results[1][1] as number) + 1; // +1 for current request
    const remaining = Math.max(0, config.max - currentCount);
    const resetTime = now + window;

    return {
      limit: config.max,
      remaining,
      resetTime,
      ...(remaining === 0 && { retryAfter: window }),
    };
  }

  // Generate default key based on user, tenant, or IP
  function generateDefaultKey(request: FastifyRequest): string {
    if (request.user?.id) {\n      return `user:${request.user.id}`;
    }
    
    if (request.user?.tenantId) {\n      return `tenant:${request.user.tenantId}`;
    }

    const forwarded = request.headers['x-forwarded-for'];\n    const ip = forwarded ? (forwarded as string).split(',')[0] : request.ip;\n    return `ip:${ip}`;
  }

  // Rate limit status endpoint\n  fastify.get('/rate-limit/status', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            limits: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  key: { type: 'string' },
                  limit: { type: 'number' },
                  remaining: { type: 'number' },
                  resetTime: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = request.user.id;
    const keys = [\n      `user:${userId}`,\n      `tenant:${request.user.tenantId}`,\n      `endpoint:ai:${userId}`,
    ];

    const limits = await Promise.all(
      keys.map(async (key) => {
        try {
          const info = await checkRateLimit(key, defaultConfigs.api);
          return {\n            key: key.replace(`${userId}`, 'self'),
            ...info,
          };
        } catch (error) {
          return {\n            key: key.replace(`${userId}`, 'self'),
            limit: 0,
            remaining: 0,
            resetTime: 0,
          };
        }
      })
    );

    return { limits };
  });

  // Rate limit reset endpoint (admin only)\n  fastify.post('/rate-limit/reset', {
    schema: {
      body: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          userId: { type: 'string' },
          tenantId: { type: 'string' },
        },
      },
    },
    preHandler: [fastify.authenticate, fastify.requireAdmin],
  }, async (request, reply) => {
    const { key, userId, tenantId } = request.body as any;

    let resetKey: string;
    if (key) {
      resetKey = key;
    } else if (userId) {\n      resetKey = `user:${userId}`;
    } else if (tenantId) {\n      resetKey = `tenant:${tenantId}`;
    } else {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Must specify key, userId, or tenantId',
      });
    }

    try {
      await redis.del(resetKey);\n      return { success: true, message: `Rate limit reset for ${resetKey}` };
    } catch (error) {
      request.log.error(error, 'Failed to reset rate limit');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to reset rate limit',
      });
    }
  });

  // Cleanup on close
  fastify.addHook('onClose', async () => {
    await redis.disconnect();
  });

  // Add rate limit info to request object
  fastify.decorateRequest('rateLimitInfo', null);
}

declare module 'fastify' {
  interface FastifyRequest {
    rateLimitInfo?: RateLimitInfo;
  }

  interface FastifyInstance {
    rateLimiting: (
      configName?: keyof typeof defaultConfigs | RateLimitConfig
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    
    tieredRateLimiting: (
      configs: Record<string, RateLimitConfig>
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    
    ipRateLimiting: (
      config?: RateLimitConfig
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    
    userRateLimiting: (
      config?: RateLimitConfig
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    
    tenantRateLimiting: (
      config?: RateLimitConfig
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    
    endpointRateLimiting: (
      endpoint: string,
      config?: RateLimitConfig
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    
    burstRateLimiting: (
      burstConfig: { max: number; timeWindow: number },
      sustainedConfig: { max: number; timeWindow: number }
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    
    adaptiveRateLimiting: (
      baseConfig: RateLimitConfig,
      loadFactorFn?: () => Promise<number>
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}