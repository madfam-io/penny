import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { SandboxExecutor } from './executor.js';
import { SandboxSecurity } from './security.js';
import { ResourceMonitor } from './utils/resourceMonitor.js';
import executeRoute from './routes/execute.js';
import validateRoute from './routes/validate.js';
import packagesRoute from './routes/packages.js';
import sessionsRoute from './routes/sessions.js';

const PORT = process.env.SANDBOX_PORT ? parseInt(process.env.SANDBOX_PORT) : 3003;
const HOST = process.env.SANDBOX_HOST || '0.0.0.0';

export async function createServer() {
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: process.env.NODE_ENV === 'development' 
        ? { target: 'pino-pretty' } 
        : undefined
    }
  }).withTypeProvider<TypeBoxTypeProvider>();

  // Security middleware
  await server.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],\n        scriptSrc: ["'self'"],\n        styleSrc: ["'self'", "'unsafe-inline'"],\n        imgSrc: ["'self'", "data:", "https:"],\n        connectSrc: ["'self'"],\n        fontSrc: ["'self'"],\n        objectSrc: ["'none'"],\n        mediaSrc: ["'self'"],\n        frameSrc: ["'none'"],
      },
    },
  });

  await server.register(cors, {
    origin: process.env.NODE_ENV === 'production' 
      ? [process.env.FRONTEND_URL || 'https://penny.ai']
      : true,
    credentials: true
  });

  // Rate limiting
  await server.register(rateLimit, {
    max: 100, // requests per minute\n    timeWindow: '1 minute',
    errorResponseBuilder: (request, context) => ({
      code: 'RATE_LIMIT_EXCEEDED',
      error: 'Rate limit exceeded',
      message: `Only ${context.max} requests per ${context.after} allowed.`,
      date: Date.now(),
      expiresIn: context.ttl
    })
  });

  // Initialize core services
  const security = new SandboxSecurity();
  const executor = new SandboxExecutor(security);
  const resourceMonitor = new ResourceMonitor();

  // Add services to server context
  server.decorate('security', security);
  server.decorate('executor', executor);
  server.decorate('resourceMonitor', resourceMonitor);

  // Health check endpoint
  server.get('/health', async () => {
    const health = await resourceMonitor.getSystemHealth();
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),\n      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      system: health
    };
  });

  // Register routes\n  await server.register(executeRoute, { prefix: '/api/v1/execute' });
  await server.register(validateRoute, { prefix: '/api/v1/validate' });
  await server.register(packagesRoute, { prefix: '/api/v1/packages' });
  await server.register(sessionsRoute, { prefix: '/api/v1/sessions' });

  // Error handler
  server.setErrorHandler((error, request, reply) => {
    server.log.error(error);
    
    if (error.validation) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: error.message,
        validationErrors: error.validation
      });
    }

    if (error.statusCode === 429) {
      return reply.status(429).send({
        error: 'Rate Limit Exceeded',
        message: 'Too many requests, please try again later.'
      });
    }

    const statusCode = error.statusCode || 500;
    return reply.status(statusCode).send({
      error: error.name || 'Internal Server Error',
      message: process.env.NODE_ENV === 'production' 
        ? 'An internal error occurred'
        : error.message
    });
  });

  // Graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    server.log.info(`Received ${signal}, shutting down gracefully...`);
    
    try {
      await executor.cleanup();
      await server.close();
      process.exit(0);
    } catch (err) {
      server.log.error('Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  return server;
}

export async function startServer() {
  const server = await createServer();
  
  try {
    await server.listen({ port: PORT, host: HOST });
    server.log.info(`🔒 Sandbox service listening on http://${HOST}:${PORT}`);
  } catch (err) {
    server.log.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch(console.error);
}

// Type augmentation for Fastify decorators
declare module 'fastify' {
  interface FastifyInstance {
    security: SandboxSecurity;
    executor: SandboxExecutor;
    resourceMonitor: ResourceMonitor;
  }
}