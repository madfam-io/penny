import Fastify, { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { Server as SocketIOServer } from 'socket.io';
import Redis from 'ioredis';
import { createAdapter } from 'socket.io-redis';
import { logger } from './utils/logger';
import { ServerConfig, HealthStatus } from './types';
import { authenticationMiddleware } from './middleware/authentication';
import { tenantIsolationMiddleware } from './middleware/tenantIsolation';
import { rateLimitingMiddleware } from './middleware/rateLimiting';
import { errorHandlerMiddleware } from './middleware/errorHandler';
import { ConnectionHandler } from './handlers/connection.handler';
import { ChatHandler } from './handlers/chat.handler';
import { PresenceHandler } from './handlers/presence.handler';
import { CollaborationHandler } from './handlers/collaboration.handler';
import { NotificationHandler } from './handlers/notifications.handler';
import { TypingHandler } from './handlers/typing.handler';
import { ReactionsHandler } from './handlers/reactions.handler';

export class WebSocketApp {
  private fastify: FastifyInstance;
  private io: SocketIOServer;
  private redis: Redis;
  private pubRedis: Redis;
  private subRedis: Redis;
  private config: ServerConfig;
  private startTime: Date;
  
  // Handlers
  private connectionHandler: ConnectionHandler;
  private chatHandler: ChatHandler;
  private presenceHandler: PresenceHandler;
  private collaborationHandler: CollaborationHandler;
  private notificationHandler: NotificationHandler;
  private typingHandler: TypingHandler;
  private reactionsHandler: ReactionsHandler;

  constructor(config: ServerConfig) {
    this.config = config;
    this.startTime = new Date();
    
    // Initialize Fastify
    this.fastify = Fastify({
      logger: logger,
      trustProxy: true,
      maxParamLength: 200,
      bodyLimit: 1024 * 1024 * 10, // 10MB
    });

    // Initialize Redis connections
    this.initializeRedis();
    
    // Initialize Socket.IO
    this.initializeSocketIO();
    
    // Initialize handlers
    this.initializeHandlers();
    
    // Setup middleware and routes
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketMiddleware();
    this.setupSocketHandlers();
  }

  private initializeRedis() {
    // Main Redis connection
    this.redis = new Redis(this.config.redis);
    
    // Pub/Sub Redis connections (separate connections for better performance)
    this.pubRedis = new Redis(this.config.redis);
    this.subRedis = new Redis(this.config.redis);

    // Redis event handlers
    this.redis.on('connect', () => {
      logger.info('Connected to Redis');
    });

    this.redis.on('error', (error) => {
      logger.error({ error }, 'Redis connection error');
    });

    this.redis.on('reconnecting', () => {
      logger.warn('Reconnecting to Redis...');
    });

    // Graceful error handling for pub/sub connections
    this.pubRedis.on('error', (error) => {
      logger.error({ error }, 'Redis pub connection error');
    });

    this.subRedis.on('error', (error) => {
      logger.error({ error }, 'Redis sub connection error');
    });
  }

  private initializeSocketIO() {
    this.io = new SocketIOServer({
      cors: this.config.cors,
      transports: ['websocket', 'polling'],
      allowEIO3: true,
      pingTimeout: this.config.heartbeat.timeout,
      pingInterval: this.config.heartbeat.interval,
      maxHttpBufferSize: 1024 * 1024 * 2, // 2MB
      allowRequest: (req, callback) => {
        // Additional request validation can be added here
        callback(null, true);
      }
    });

    // Setup Redis adapter for horizontal scaling
    const adapter = createAdapter(this.pubRedis, this.subRedis, {
      key: 'penny-ws',
      requestsTimeout: 5000
    });
    
    this.io.adapter(adapter);

    // Socket.IO event logging
    this.io.engine.on('connection_error', (error) => {
      logger.error({ error }, 'Socket.IO connection error');
    });

    // Track socket metrics
    this.io.on('connection', (socket) => {
      logger.debug({ socketId: socket.id }, 'New socket connection');
    });
  }

  private initializeHandlers() {
    this.connectionHandler = new ConnectionHandler(this.io, this.redis);
    this.chatHandler = new ChatHandler(this.io, this.redis);
    this.presenceHandler = new PresenceHandler(this.io, this.redis);
    this.collaborationHandler = new CollaborationHandler(this.io, this.redis);
    this.notificationHandler = new NotificationHandler(this.io, this.redis);
    this.typingHandler = new TypingHandler(this.io, this.redis);
    this.reactionsHandler = new ReactionsHandler(this.io, this.redis);
  }

  private setupMiddleware() {
    // Security middleware
    this.fastify.register(helmet, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "ws:", "wss:"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        }
      }
    });

    // CORS middleware
    this.fastify.register(cors, this.config.cors);

    // Rate limiting for HTTP endpoints
    this.fastify.register(rateLimit, {
      max: this.config.rateLimit.global.points,
      timeWindow: this.config.rateLimit.global.duration,
      redis: this.redis,
      keyGenerator: (request) => {
        return request.ip || 'unknown';
      },
      errorResponseBuilder: (request, context) => ({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded, please try again later',
        expiresIn: Math.round(context.ttl / 1000)
      })
    });

    // Error handler
    this.fastify.setErrorHandler((error, request, reply) => {
      logger.error({ 
        error: error.message,
        stack: error.stack,
        url: request.url,
        method: request.method
      }, 'HTTP request error');

      if (error.statusCode) {
        reply.status(error.statusCode);
      } else {
        reply.status(500);
      }

      reply.send({
        error: error.message || 'Internal Server Error',
        statusCode: reply.statusCode
      });
    });
  }

  private setupRoutes() {
    // Health check endpoint
    this.fastify.get('/health', async (request, reply) => {
      const health = await this.getHealthStatus();
      
      if (health.status === 'healthy') {
        reply.status(200);
      } else if (health.status === 'degraded') {
        reply.status(200);
      } else {
        reply.status(503);
      }

      return health;
    });

    // Metrics endpoint
    this.fastify.get('/metrics', async (request, reply) => {
      const connectedSockets = this.io.sockets.sockets.size;
      const rooms = this.io.sockets.adapter.rooms.size;
      const uptime = Date.now() - this.startTime.getTime();

      return {
        uptime,
        connectedSockets,
        totalRooms: rooms,
        memoryUsage: process.memoryUsage(),
        timestamp: new Date().toISOString()
      };
    });

    // WebSocket info endpoint
    this.fastify.get('/ws/info', async (request, reply) => {
      return {
        version: '1.0.0',
        transport: 'websocket',
        features: [
          'real-time-chat',
          'presence-tracking',
          'typing-indicators',
          'message-reactions',
          'collaboration',
          'notifications',
          'file-upload',
          'message-streaming'
        ],
        limits: {
          maxMessageSize: 50000,
          maxConnections: 10000,
          rateLimits: this.config.rateLimit
        }
      };
    });

    // Socket connection test endpoint
    this.fastify.get('/ws/test', { websocket: true }, (connection, request) => {
      connection.socket.send(JSON.stringify({
        message: 'WebSocket connection test successful',
        timestamp: new Date().toISOString()
      }));
    });
  }

  private setupSocketMiddleware() {
    // Authentication middleware
    this.io.use(authenticationMiddleware(this.config.jwt));
    
    // Tenant isolation middleware
    this.io.use(tenantIsolationMiddleware());
    
    // Rate limiting middleware
    this.io.use(rateLimitingMiddleware(this.redis, this.config.rateLimit));
    
    // Error handling middleware
    this.io.use(errorHandlerMiddleware());
  }

  private setupSocketHandlers() {
    // Connection lifecycle
    this.connectionHandler.setupHandlers();
    
    // Chat functionality
    this.chatHandler.setupHandlers();
    
    // Presence tracking
    this.presenceHandler.setupHandlers();
    
    // Collaboration features
    this.collaborationHandler.setupHandlers();
    
    // Notifications
    this.notificationHandler.setupHandlers();
    
    // Typing indicators
    this.typingHandler.setupHandlers();
    
    // Message reactions
    this.reactionsHandler.setupHandlers();

    // Global error handling
    this.io.on('connection', (socket) => {
      socket.on('error', (error) => {
        logger.error({ 
          socketId: socket.id, 
          error: error.message 
        }, 'Socket error');
      });

      socket.on('disconnect', (reason) => {
        logger.debug({ 
          socketId: socket.id, 
          reason 
        }, 'Socket disconnected');
      });
    });
  }

  private async getHealthStatus(): Promise<HealthStatus> {
    const status: HealthStatus = {
      status: 'healthy',
      timestamp: new Date(),
      services: {
        redis: 'connected',
        database: 'connected'
      },
      metrics: {
        activeConnections: this.io.sockets.sockets.size,
        totalRooms: this.io.sockets.adapter.rooms.size,
        messagesSentPerMinute: 0, // Would need to implement metric tracking
        averageResponseTime: 0 // Would need to implement metric tracking
      }
    };

    try {
      // Check Redis connection
      await this.redis.ping();
      status.services.redis = 'connected';
    } catch (error) {
      logger.error({ error }, 'Redis health check failed');
      status.services.redis = 'error';
      status.status = 'degraded';
    }

    // Additional health checks can be added here
    // For example, database connectivity, external service availability, etc.

    return status;
  }

  public async start(): Promise<void> {
    try {
      // Start the HTTP server
      await this.fastify.listen({
        port: this.config.port,
        host: this.config.host
      });

      // Attach Socket.IO to the HTTP server
      this.io.attach(this.fastify.server);

      logger.info({
        port: this.config.port,
        host: this.config.host
      }, 'WebSocket server started successfully');

    } catch (error) {
      logger.error({ error }, 'Failed to start WebSocket server');
      throw error;
    }
  }

  public async stop(): Promise<void> {
    logger.info('Shutting down WebSocket server...');

    try {
      // Close all socket connections
      this.io.close();

      // Close Redis connections
      await Promise.all([
        this.redis.quit(),
        this.pubRedis.quit(),
        this.subRedis.quit()
      ]);

      // Close HTTP server
      await this.fastify.close();

      logger.info('WebSocket server shutdown complete');
    } catch (error) {
      logger.error({ error }, 'Error during server shutdown');
      throw error;
    }
  }

  // Public getters for external access
  get socketIO(): SocketIOServer {
    return this.io;
  }

  get redisClient(): Redis {
    return this.redis;
  }

  get httpServer(): FastifyInstance {
    return this.fastify;
  }
}