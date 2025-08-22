import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

const telemetry: FastifyPluginAsync = async (fastify) => {
  // Add request timing
  fastify.addHook('onRequest', async (request) => {
    request.startTime = Date.now();
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const duration = Date.now() - (request.startTime || Date.now());
    
    // Log request metrics
    request.log.info({
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      duration,
      tenantId: request.context?.tenantId,
      userId: request.context?.userId,
    }, 'Request completed');

    // TODO: Send metrics to OpenTelemetry
    // This would integrate with the @penny/telemetry package
  });

  // Add health metrics collection
  fastify.decorate('metrics', {
    requestCount: 0,
    errorCount: 0,
    activeConnections: 0,
  });

  fastify.addHook('onRequest', async () => {
    fastify.metrics.requestCount++;
    fastify.metrics.activeConnections++;
  });

  fastify.addHook('onResponse', async (request, reply) => {
    fastify.metrics.activeConnections--;
    if (reply.statusCode >= 500) {
      fastify.metrics.errorCount++;
    }
  });
};

declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number;
  }
  
  interface FastifyInstance {
    metrics: {
      requestCount: number;
      errorCount: number;
      activeConnections: number;
    };
  }
}

export default fp(telemetry, {
  name: 'telemetry',
});