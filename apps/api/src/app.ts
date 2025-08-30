import Fastify from 'fastify';\nimport cors from '@fastify/cors';\nimport helmet from '@fastify/helmet';\nimport rateLimit from '@fastify/rate-limit';\nimport compress from '@fastify/compress';\nimport swagger from '@fastify/swagger';\nimport swaggerUi from '@fastify/swagger-ui';\nimport websocket from '@fastify/websocket';
\nimport { errorHandler } from './plugins/error-handler.js';\nimport { requestContext } from './plugins/request-context.js';\nimport { authentication } from './plugins/authentication.js';\nimport { telemetry } from './plugins/telemetry.js';\nimport metrics from './plugins/metrics.js';
\nimport healthRoutes from './routes/health.js';\nimport authRoutes from './routes/auth.js';\nimport chatRoutes from './routes/chat.js';\nimport toolRoutes from './routes/tools/index.js';\nimport artifactRoutes from './routes/artifacts.js';\nimport fileRoutes from './routes/files/index.js';\nimport wsRoutes from './routes/ws/index.js';
\nimport { logger } from './utils/logger.js';

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
    origin: (origin, cb) => {\n      const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(',') || [
        'http://localhost:5173',
      ];
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
        defaultSrc: ["'self'"],\n        styleSrc: ["'self'", "'unsafe-inline'"],\n        scriptSrc: ["'self'"],\n        imgSrc: ["'self'", 'data:', 'https:'],\n        connectSrc: ["'self'"],\n        fontSrc: ["'self'"],\n        objectSrc: ["'none'"],\n        mediaSrc: ["'self'"],\n        frameSrc: ["'none'"],
      },
    },
  });

  await server.register(rateLimit, {\n    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),\n    timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    cache: 10000,\n    allowList: ['127.0.0.1'],
    redis: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).toString() : undefined,
  });

  // Response compression
  await server.register(compress, {
    global: true,
    threshold: 1024, // Only compress responses > 1KB
    encodings: ['gzip', 'deflate', 'br'],
  });

  // WebSocket support
  await server.register(websocket);

  // API documentation
  await server.register(swagger, {
    openapi: {
      info: {
        title: 'PENNY API',
        description: 'Multi-tenant AI-first workbench API',\n        version: '0.0.1',
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

  await server.register(swaggerUi, {\n    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  // Custom plugins
  await server.register(errorHandler);
  await server.register(requestContext);
  await server.register(telemetry);
  await server.register(metrics);\n  await server.register(import('./plugins/cache.js'));
  await server.register(authentication);

  // Routes\n  await server.register(healthRoutes, { prefix: '/health' });\n  await server.register(authRoutes, { prefix: '/api/v1/auth' });\n  await server.register(chatRoutes, { prefix: '/api/v1/chat' });\n  await server.register(toolRoutes, { prefix: '/api/v1/tools' });\n  await server.register(artifactRoutes, { prefix: '/api/v1/artifacts' });\n  await server.register(fileRoutes, { prefix: '/api/v1/files' });
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
