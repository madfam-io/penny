import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import { AuthenticationError, AuthorizationError, type Role } from '@penny/shared';

interface JWTPayload {
  sub: string; // userId
  tid: string; // tenantId
  roles: Role[];
  sessionId: string;
  iat: number;
  exp: number;
}
\ndeclare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JWTPayload;
  }
}

const authentication: FastifyPluginAsync = async (fastify) => {
  // Register JWT plugin
  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'change-this-in-production',
    sign: {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
  });

  // Add authentication decorator
  fastify.decorate('authenticate', async function (request: FastifyRequest) {
    try {
      // Check for API key first
      const apiKey = request.headers['x-api-key'];
      if (apiKey) {
        // TODO: Validate API key against database
        // For now, we'll skip API key validation
        return;
      }

      // Check for JWT token
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        throw new AuthenticationError('No authentication token provided');
      }

      const payload = await request.jwtVerify<JWTPayload>();

      // Update request context with user info
      request.context.userId = payload.sub as any;
      request.context.tenantId = payload.tid as any;
      request.context.roles = payload.roles;
      request.context.sessionId = payload.sessionId;
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new AuthenticationError('Invalid authentication token');
    }
  });

  // Add authorization decorator
  fastify.decorate('authorize', function (allowedRoles: Role[]) {
    return async function (request: FastifyRequest) {
      const userRoles = request.context.roles || [];

      const hasPermission = allowedRoles.some((role) => userRoles.includes(role));

      if (!hasPermission) {
        throw new AuthorizationError(\n          `Insufficient permissions. Required roles: ${allowedRoles.join(', ')}`,
        );
      }
    };
  });
};

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<void>;
    authorize: (roles: Role[]) => (request: FastifyRequest) => Promise<void>;
  }
}

export default fp(authentication, {
  name: 'authentication',
  dependencies: ['request-context'],
});
