import type { FastifyPluginAsync } from 'fastify';

const routes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/',
    {
      schema: {
        description: 'Basic health check',
        tags: ['health'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              timestamp: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
      };
    },
  );

  fastify.get(
    '/live',
    {
      schema: {
        description: 'Kubernetes liveness probe',
        tags: ['health'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      return { status: 'live' };
    },
  );

  fastify.get(
    '/ready',
    {
      schema: {
        description: 'Kubernetes readiness probe',
        tags: ['health'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              checks: {
                type: 'object',
                properties: {
                  database: { type: 'boolean' },
                  redis: { type: 'boolean' },
                  storage: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      // TODO: Add actual health checks for dependencies
      const checks = {
        database: true,
        redis: true,
        storage: true,
      };

      const isReady = Object.values(checks).every(Boolean);

      if (!isReady) {
        reply.code(503);
      }

      return {
        status: isReady ? 'ready' : 'not ready',
        checks,
      };
    },
  );

  fastify.get(
    '/metrics',
    {
      schema: {
        description: 'Application metrics',
        tags: ['health'],
        response: {
          200: {
            type: 'object',
            properties: {
              requests: { type: 'number' },
              errors: { type: 'number' },
              activeConnections: { type: 'number' },
              uptime: { type: 'number' },
              memory: {
                type: 'object',
                properties: {
                  rss: { type: 'number' },
                  heapTotal: { type: 'number' },
                  heapUsed: { type: 'number' },
                  external: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const memory = process.memoryUsage();

      return {
        requests: fastify.metrics.requestCount,
        errors: fastify.metrics.errorCount,
        activeConnections: fastify.metrics.activeConnections,
        uptime: process.uptime(),
        memory: {
          rss: memory.rss,
          heapTotal: memory.heapTotal,
          heapUsed: memory.heapUsed,
          external: memory.external,
        },
      };
    },
  );
};

export default routes;
