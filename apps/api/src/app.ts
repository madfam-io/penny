import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import websocket from '@fastify/websocket';

import { errorHandler } from './plugins/error-handler.js';
import { requestContext } from './plugins/request-context.js';
import { authentication } from './plugins/authentication.js';
import { telemetry } from './plugins/telemetry.js';

import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import toolRoutes from './routes/tools/index.js';
import artifactRoutes from './routes/artifacts.js';
import fileRoutes from './routes/files/index.js';
import wsRoutes from './routes/ws/index.js';

import { logger } from './utils/logger.js';

export async function createServer() {
  const server = Fastify({
    logger,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    genReqId: (req) => req.headers['x-request-id']?.toString() || undefined,
    disableRequestLogging: false,
    maxParamLength: 500,
    trustProxy: true,
  });

  // Core plugins
  await server.register(cors, {
    origin: (origin, cb) => {
      const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'];
      if (!origin || allowedOrigins.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
  });

  await server.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
  });

  await server.register(rateLimit, {
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    cache: 10000,
    allowList: ['127.0.0.1'],
    redis: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).toString() : undefined,
  });

  // WebSocket support
  await server.register(websocket);

  // API documentation
  await server.register(swagger, {
    openapi: {
      info: {
        title: 'PENNY API',
        description: 'Multi-tenant AI-first workbench API',
        version: '0.0.1',
      },
      servers: [
        {
          url: process.env.API_URL || 'http://localhost:3000',
          description: 'API server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
          apiKey: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key',
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  });

  await server.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  // Custom plugins
  await server.register(errorHandler);
  await server.register(requestContext);
  await server.register(telemetry);
  await server.register(authentication);

  // Routes
  await server.register(healthRoutes, { prefix: '/health' });
  await server.register(authRoutes, { prefix: '/api/v1/auth' });
  await server.register(chatRoutes, { prefix: '/api/v1/chat' });
  await server.register(toolRoutes, { prefix: '/api/v1/tools' });
  await server.register(artifactRoutes, { prefix: '/api/v1/artifacts' });
  await server.register(fileRoutes, { prefix: '/api/v1/files' });
  await server.register(wsRoutes); // WebSocket routes don't need a prefix

  // Default 404 handler
  server.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
      },
    });
  });

  return server;
}