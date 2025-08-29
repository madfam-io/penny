import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { AuthenticatedSocket, SocketEvent, RateLimitConfig } from '../types';

interface RateLimitState {
  points: number;
  totalHits: number;
  msBeforeNext: number;
  lastUpdated: Date;
}

interface RateLimitRule {
  name: string;
  config: RateLimitConfig;
  keyGenerator: (socket: AuthenticatedSocket, eventName?: string) => string;
  eventFilter?: (eventName: string) => boolean;
}

export function rateLimitingMiddleware(
  redis: Redis, 
  rateLimitConfigs: {
    global: RateLimitConfig;
    perSocket: RateLimitConfig;
    perRoom: RateLimitConfig;
  }
) {
  const rateLimitRules: RateLimitRule[] = [
    // Global rate limiting (per IP)
    {
      name: 'global',
      config: rateLimitConfigs.global,
      keyGenerator: (socket) => `rate_limit:global:${socket.handshake.address}`,
      eventFilter: () => true
    },
    
    // Per socket/user rate limiting
    {
      name: 'per_socket',
      config: rateLimitConfigs.perSocket,
      keyGenerator: (socket) => `rate_limit:socket:${socket.user?.id || socket.id}`,
      eventFilter: () => true
    },
    
    // Message-specific rate limiting
    {
      name: 'messages',
      config: { 
        points: 30, 
        duration: 60000, // 1 minute
        blockDuration: 60000 
      },
      keyGenerator: (socket) => `rate_limit:messages:${socket.user?.id}`,
      eventFilter: (eventName) => [
        'send_message', 
        'stream_completion'
      ].includes(eventName)
    },
    
    // Typing indicators rate limiting (more permissive)
    {
      name: 'typing',
      config: { 
        points: 120, 
        duration: 60000,
        blockDuration: 10000 // Shorter block for typing
      },
      keyGenerator: (socket) => `rate_limit:typing:${socket.user?.id}`,
      eventFilter: (eventName) => [
        'typing_start', 
        'typing_stop', 
        'typing_status'
      ].includes(eventName)
    },
    
    // Reaction rate limiting
    {
      name: 'reactions',
      config: { 
        points: 60, 
        duration: 60000,
        blockDuration: 30000
      },
      keyGenerator: (socket) => `rate_limit:reactions:${socket.user?.id}`,
      eventFilter: (eventName) => [
        'message_reaction',
        'bulk_message_reactions'
      ].includes(eventName)
    },
    
    // Admin operations rate limiting (more restrictive)
    {
      name: 'admin',
      config: { 
        points: 10, 
        duration: 60000,
        blockDuration: 300000 // 5 minutes
      },
      keyGenerator: (socket) => `rate_limit:admin:${socket.user?.id}`,
      eventFilter: (eventName) => [
        'send_bulk_notification',
        'send_system_notification',
        'clear_message_reactions',
        'moderate_reactions'
      ].includes(eventName)
    }
  ];

  return (socket: AuthenticatedSocket, next: (err?: any) => void) => {
    // Apply initial rate limiting check
    checkInitialRateLimit(socket, redis, rateLimitRules)
      .then((allowed) => {
        if (!allowed) {
          return next(new Error('Rate limit exceeded'));
        }

        // Set up event interceptors
        setupEventRateLimiting(socket, redis, rateLimitRules);
        
        next();
      })
      .catch((error) => {
        logger.error({
          socketId: socket.id,
          error: error.message
        }, 'Rate limiting middleware error');
        
        next(error);
      });
  };
}

async function checkInitialRateLimit(
  socket: AuthenticatedSocket, 
  redis: Redis, 
  rules: RateLimitRule[]
): Promise<boolean> {
  try {
    for (const rule of rules) {
      const key = rule.keyGenerator(socket);
      const allowed = await checkRateLimit(redis, key, rule.config);
      
      if (!allowed.allowed) {
        logger.warn({
          socketId: socket.id,
          userId: socket.user?.id,
          clientIP: socket.handshake.address,
          ruleName: rule.name,
          rateLimitState: allowed.state
        }, 'Initial rate limit exceeded');

        return false;
      }
    }
    
    return true;
  } catch (error) {
    logger.error({ error: error.message }, 'Error checking initial rate limit');
    return true; // Allow on error to prevent service disruption
  }
}

function setupEventRateLimiting(
  socket: AuthenticatedSocket, 
  redis: Redis, 
  rules: RateLimitRule[]
) {
  const originalEmit = socket.emit.bind(socket);
  const rateLimitState: Map<string, RateLimitState> = new Map();

  // Store rate limit info on socket
  socket.rateLimitInfo = {
    points: 0,
    totalHits: 0,
    msBeforeNext: 0
  };

  // Intercept all events for rate limiting
  const eventNames = [
    'send_message',
    'stream_completion', 
    'typing_start',
    'typing_stop',
    'typing_status',
    'message_reaction',
    'bulk_message_reactions',
    'send_bulk_notification',
    'send_system_notification',
    'join_conversation',
    'leave_conversation',
    'join_collaboration',
    'leave_collaboration',
    'cursor_update',
    'selection_update',
    'collaborative_edit'
  ];

  eventNames.forEach(eventName => {
    const originalListeners = socket.listeners(eventName);
    socket.removeAllListeners(eventName);

    socket.on(eventName, async (data: any, callback?: Function) => {
      try {
        // Check applicable rate limit rules
        const applicableRules = rules.filter(rule => 
          !rule.eventFilter || rule.eventFilter(eventName)
        );

        let rateLimited = false;
        let blockingRule: RateLimitRule | null = null;
        let rateLimitResult: { allowed: boolean; state: RateLimitState } | null = null;

        for (const rule of applicableRules) {
          const key = rule.keyGenerator(socket, eventName);
          const result = await checkRateLimit(redis, key, rule.config);
          
          if (!result.allowed) {
            rateLimited = true;
            blockingRule = rule;
            rateLimitResult = result;
            break;
          }

          // Update socket rate limit info with most restrictive state
          if (socket.rateLimitInfo) {
            socket.rateLimitInfo.points = Math.min(
              socket.rateLimitInfo.points || Infinity, 
              result.state.points
            );
            socket.rateLimitInfo.totalHits = Math.max(
              socket.rateLimitInfo.totalHits, 
              result.state.totalHits
            );
            socket.rateLimitInfo.msBeforeNext = Math.max(
              socket.rateLimitInfo.msBeforeNext, 
              result.state.msBeforeNext
            );
          }
        }

        if (rateLimited && blockingRule && rateLimitResult) {
          logger.warn({
            socketId: socket.id,
            userId: socket.user?.id,
            eventName,
            ruleName: blockingRule.name,
            rateLimitState: rateLimitResult.state,
            clientIP: socket.handshake.address
          }, 'Event rate limited');

          // Emit rate limit event
          socket.emit(SocketEvent.RATE_LIMITED, {
            eventName,
            rule: blockingRule.name,
            retryAfter: rateLimitResult.state.msBeforeNext,
            limit: blockingRule.config.points,
            remaining: rateLimitResult.state.points,
            timestamp: new Date().toISOString()
          });

          // Call callback with error if provided
          if (callback && typeof callback === 'function') {
            callback({ 
              error: 'Rate limit exceeded', 
              retryAfter: rateLimitResult.state.msBeforeNext 
            });
          }

          return;
        }

        // Event is allowed, execute original handlers
        originalListeners.forEach(listener => {
          if (typeof listener === 'function') {
            listener(data, callback);
          }
        });

      } catch (error) {
        logger.error({
          socketId: socket.id,
          eventName,
          error: error.message
        }, 'Rate limiting error');

        // Allow event on error
        originalListeners.forEach(listener => {
          if (typeof listener === 'function') {
            listener(data, callback);
          }
        });
      }
    });
  });

  // Set up periodic rate limit info updates
  const updateInterval = setInterval(async () => {
    try {
      await updateSocketRateLimitInfo(socket, redis, rules);
    } catch (error) {
      logger.error({
        socketId: socket.id,
        error: error.message
      }, 'Error updating rate limit info');
    }
  }, 5000); // Every 5 seconds

  // Clean up on disconnect
  socket.on('disconnect', () => {
    clearInterval(updateInterval);
  });
}

async function checkRateLimit(
  redis: Redis, 
  key: string, 
  config: RateLimitConfig
): Promise<{ allowed: boolean; state: RateLimitState }> {
  try {
    const now = Date.now();
    const windowStart = now - config.duration;

    // Use Redis transaction for atomic operations
    const pipeline = redis.multi();
    
    // Remove expired entries
    pipeline.zremrangebyscore(key, '-inf', windowStart);
    
    // Count current requests
    pipeline.zcard(key);
    
    // Add current request
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    
    // Set expiration
    pipeline.expire(key, Math.ceil(config.duration / 1000));

    const results = await pipeline.exec();
    
    if (!results) {
      throw new Error('Redis transaction failed');
    }

    const currentCount = (results[1][1] as number) || 0;
    const allowed = currentCount < config.points;

    // Calculate state
    const state: RateLimitState = {
      points: Math.max(0, config.points - currentCount - 1),
      totalHits: currentCount + 1,
      msBeforeNext: allowed ? 0 : config.blockDuration || config.duration,
      lastUpdated: new Date()
    };

    return { allowed, state };

  } catch (error) {
    logger.error({ 
      key, 
      config, 
      error: error.message 
    }, 'Rate limit check error');
    
    // Allow on error
    return {
      allowed: true,
      state: {
        points: config.points,
        totalHits: 0,
        msBeforeNext: 0,
        lastUpdated: new Date()
      }
    };
  }
}

async function updateSocketRateLimitInfo(
  socket: AuthenticatedSocket, 
  redis: Redis, 
  rules: RateLimitRule[]
) {
  if (!socket.rateLimitInfo) return;

  let minPoints = Infinity;
  let maxTotalHits = 0;
  let maxMsBeforeNext = 0;

  for (const rule of rules) {
    try {
      const key = rule.keyGenerator(socket);
      const result = await getRateLimitState(redis, key, rule.config);
      
      minPoints = Math.min(minPoints, result.points);
      maxTotalHits = Math.max(maxTotalHits, result.totalHits);
      maxMsBeforeNext = Math.max(maxMsBeforeNext, result.msBeforeNext);
    } catch (error) {
      // Continue with other rules on error
    }
  }

  socket.rateLimitInfo = {
    points: minPoints === Infinity ? 0 : minPoints,
    totalHits: maxTotalHits,
    msBeforeNext: maxMsBeforeNext
  };
}

async function getRateLimitState(
  redis: Redis, 
  key: string, 
  config: RateLimitConfig
): Promise<RateLimitState> {
  try {
    const now = Date.now();
    const windowStart = now - config.duration;
    
    // Get current count
    const count = await redis.zcount(key, windowStart, '+inf');
    
    return {
      points: Math.max(0, config.points - count),
      totalHits: count,
      msBeforeNext: count >= config.points ? (config.blockDuration || config.duration) : 0,
      lastUpdated: new Date()
    };
  } catch (error) {
    return {
      points: config.points,
      totalHits: 0,
      msBeforeNext: 0,
      lastUpdated: new Date()
    };
  }
}

// Utility functions for external use
export async function isRateLimited(
  redis: Redis, 
  key: string, 
  config: RateLimitConfig
): Promise<boolean> {
  const result = await checkRateLimit(redis, key, config);
  return !result.allowed;
}

export async function getRemainingPoints(
  redis: Redis, 
  key: string, 
  config: RateLimitConfig
): Promise<number> {
  const state = await getRateLimitState(redis, key, config);
  return state.points;
}

export async function resetRateLimit(redis: Redis, key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (error) {
    logger.error({ key, error: error.message }, 'Failed to reset rate limit');
  }
}

// Create custom rate limit rule
export function createRateLimitRule(
  name: string,
  config: RateLimitConfig,
  keyGenerator: (socket: AuthenticatedSocket, eventName?: string) => string,
  eventFilter?: (eventName: string) => boolean
): RateLimitRule {
  return {
    name,
    config,
    keyGenerator,
    eventFilter
  };
}

// Rate limit by conversation
export function conversationRateLimit(config: RateLimitConfig): RateLimitRule {
  return {
    name: 'conversation',
    config,
    keyGenerator: (socket, eventName) => {
      // This would need to be enhanced to extract conversation ID from event data
      return `rate_limit:conversation:${socket.user?.id}:${eventName}`;
    },
    eventFilter: (eventName) => [
      'send_message',
      'stream_completion',
      'typing_start',
      'typing_stop'
    ].includes(eventName)
  };
}

// Rate limit by tenant
export function tenantRateLimit(config: RateLimitConfig): RateLimitRule {
  return {
    name: 'tenant',
    config,
    keyGenerator: (socket) => `rate_limit:tenant:${socket.user?.tenantId}`,
    eventFilter: () => true
  };
}

// Burst rate limiting (allows bursts but limits sustained usage)
export function burstRateLimit(
  burstConfig: RateLimitConfig, 
  sustainedConfig: RateLimitConfig
): RateLimitRule[] {
  return [
    {
      name: 'burst',
      config: burstConfig,
      keyGenerator: (socket) => `rate_limit:burst:${socket.user?.id}`,
      eventFilter: () => true
    },
    {
      name: 'sustained',
      config: sustainedConfig,
      keyGenerator: (socket) => `rate_limit:sustained:${socket.user?.id}`,
      eventFilter: () => true
    }
  ];
}