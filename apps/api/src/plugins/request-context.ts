import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import type { TenantId, UserId, Role } from '@penny/shared';

declare module 'fastify' {
  interface FastifyRequest {
    context: {
      tenantId?: TenantId;
      userId?: UserId;
      roles?: Role[];
      workspaceId?: string;
      apiKeyId?: string;
      sessionId?: string;
      ipAddress: string;
      userAgent?: string;
    };
  }
}

const requestContext: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('context', null);

  fastify.addHook('onRequest', async (request) => {
    // Initialize context with basic info
    request.context = {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    };

    // Extract tenant from subdomain or header
    const host = request.headers.host;
    if (host) {
      const subdomain = host.split('.')[0];
      if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
        // This would be validated against the database in production
        request.context.tenantId = subdomain as TenantId;
      }
    }

    // Override with explicit tenant header if present
    const tenantHeader = request.headers['x-tenant-id'];
    if (tenantHeader) {
      request.context.tenantId = tenantHeader as TenantId;
    }
  });
};

export default fp(requestContext, {
  name: 'request-context',
});
