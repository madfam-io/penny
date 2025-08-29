#!/usr/bin/env node

import dotenv from 'dotenv';
import { WebSocketApp } from './app';
import { logger } from './utils/logger';
import { ServerConfig, RedisConfig } from './types';

// Load environment variables
dotenv.config();

// Configuration with environment variable fallbacks
const createServerConfig = (): ServerConfig => {
  const redisConfig: RedisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'penny:ws:',
    lazyConnect: true,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3
  };

  return {
    port: parseInt(process.env.WS_PORT || process.env.PORT || '3003'),
    host: process.env.WS_HOST || '0.0.0.0',
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
      credentials: true
    },
    redis: redisConfig,
    jwt: {
      secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
      audience: process.env.JWT_AUDIENCE || 'penny-users',
      issuer: process.env.JWT_ISSUER || 'penny-auth'
    },
    rateLimit: {
      global: {
        points: parseInt(process.env.RATE_LIMIT_GLOBAL_POINTS || '1000'),
        duration: parseInt(process.env.RATE_LIMIT_GLOBAL_DURATION || '60000'), // 1 minute
        blockDuration: parseInt(process.env.RATE_LIMIT_GLOBAL_BLOCK || '60000') // 1 minute
      },
      perSocket: {
        points: parseInt(process.env.RATE_LIMIT_SOCKET_POINTS || '100'),
        duration: parseInt(process.env.RATE_LIMIT_SOCKET_DURATION || '60000'), // 1 minute
        blockDuration: parseInt(process.env.RATE_LIMIT_SOCKET_BLOCK || '60000') // 1 minute
      },
      perRoom: {
        points: parseInt(process.env.RATE_LIMIT_ROOM_POINTS || '500'),
        duration: parseInt(process.env.RATE_LIMIT_ROOM_DURATION || '60000'), // 1 minute
        blockDuration: parseInt(process.env.RATE_LIMIT_ROOM_BLOCK || '60000') // 1 minute
      }
    },
    heartbeat: {
      interval: parseInt(process.env.HEARTBEAT_INTERVAL || '25000'), // 25 seconds
      timeout: parseInt(process.env.HEARTBEAT_TIMEOUT || '60000') // 60 seconds
    }
  };
};

// Global error handlers
process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled rejection');
  process.exit(1);
});

// Graceful shutdown
let app: WebSocketApp | null = null;

const gracefulShutdown = async (signal: string) => {
  logger.info({ signal }, 'Received shutdown signal');

  if (app) {
    try {
      await app.stop();
      logger.info('Server shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error({ error }, 'Error during shutdown');
      process.exit(1);
    }
  } else {
    logger.info('No server instance to shutdown');
    process.exit(0);
  }
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start the server
const startServer = async () => {
  try {
    // Validate required environment variables
    const requiredEnvVars = ['JWT_SECRET'];
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    if (missingEnvVars.length > 0) {
      logger.error({ missingEnvVars }, 'Missing required environment variables');
      process.exit(1);
    }

    // Create server configuration
    const config = createServerConfig();
    
    // Log startup configuration (without sensitive data)
    logger.info({
      port: config.port,
      host: config.host,
      redisHost: config.redis.host,
      redisPort: config.redis.port,
      corsOrigins: config.cors.origin,
      environment: process.env.NODE_ENV || 'development'
    }, 'Starting WebSocket server...');

    // Create and start the app
    app = new WebSocketApp(config);
    await app.start();

    logger.info('WebSocket server is ready to accept connections');

  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
};

// Start the application
if (require.main === module) {
  startServer().catch((error) => {
    logger.error({ error }, 'Server startup failed');
    process.exit(1);
  });
}

export { WebSocketApp, createServerConfig };