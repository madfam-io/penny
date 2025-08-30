import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

interface ApiKeyContext {
  id: string;
  tenantId: string;
  userId: string;
  name: string;
  scopes: string[];
  lastUsedAt?: string;
  expiresAt?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    apiKey?: ApiKeyContext;
  }
}

export async function apiKeyAuthPlugin(fastify: FastifyInstance) {
  const prisma = new PrismaClient();

  fastify.decorate('apiKeyAuth', async function(request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'API key required',
      });
    }

    // Support both "Bearer" and "ApiKey" prefixes
    const match = authHeader.match(/^(?:Bearer|ApiKey)\s+(.+)$/i);
    if (!match) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Invalid authorization header format',
      });
    }

    const apiKey = match[1];
    
    try {
      const keyContext = await validateApiKey(apiKey);
      
      if (!keyContext) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Invalid API key',
        });
      }

      // Check if key is expired
      if (keyContext.expiresAt && new Date(keyContext.expiresAt) < new Date()) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'API key has expired',
        });
      }

      // Update last used timestamp (async, don't await)
      updateLastUsed(keyContext.id).catch(error => {
        request.log.warn(error, 'Failed to update API key last used timestamp');
      });

      request.apiKey = keyContext;

      // Set user context from API key for compatibility
      request.user = {
        id: keyContext.userId,
        tenantId: keyContext.tenantId,\n        email: '', // Not available from API key
        name: keyContext.name,
        roles: ['api'], // API keys get basic API role
        permissions: keyContext.scopes,
      };

    } catch (error) {
      request.log.error(error, 'API key validation failed');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Authentication service unavailable',
      });
    }
  });

  // Scope-based authorization
  fastify.decorate('requireScope', function(requiredScope: string) {
    return async function(request: FastifyRequest, reply: FastifyReply) {
      if (!request.apiKey) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'API key authentication required',
        });
      }
\n      if (!request.apiKey.scopes.includes(requiredScope) && !request.apiKey.scopes.includes('*')) {
        return reply.code(403).send({
          error: 'Forbidden',
          message: `Scope required: ${requiredScope}`,
        });
      }
    };
  });

  // Multiple scopes authorization (requires all)
  fastify.decorate('requireScopes', function(requiredScopes: string[]) {
    return async function(request: FastifyRequest, reply: FastifyReply) {
      if (!request.apiKey) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'API key authentication required',
        });
      }

      const hasAllScopes = requiredScopes.every(scope =>
       request.apiKey!.scopes.includes(scope) || request.apiKey!.scopes.includes('*')
      );

      if (!hasAllScopes) {
        return reply.code(403).send({
          error: 'Forbidden',
          message: `Scopes required: ${requiredScopes.join(', ')}`,
        });
      }
    };
  });

  // Any scope authorization (requires at least one)
  fastify.decorate('requireAnyScope', function(requiredScopes: string[]) {
    return async function(request: FastifyRequest, reply: FastifyReply) {
      if (!request.apiKey) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'API key authentication required',
        });
      }

      const hasAnyScope = requiredScopes.some(scope =>
       request.apiKey!.scopes.includes(scope) || request.apiKey!.scopes.includes('*')
      );

      if (!hasAnyScope) {
        return reply.code(403).send({
          error: 'Forbidden',
          message: `One of these scopes required: ${requiredScopes.join(', ')}`,
        });
      }
    };
  });

  // API key management endpoints
  fastify.post('/api-keys', {
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          scopes: { 
            type: 'array', 
            items: { type: 'string' },
            default: ['read'],
          },
          expiresAt: { type: 'string', format: 'date-time' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            key: { type: 'string' },
            scopes: { type: 'array', items: { type: 'string' } },
            expiresAt: { type: 'string' },
            createdAt: { type: 'string' },
          },
        },
      },
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation],
  }, async (request, reply) => {
    const { name, scopes = ['read'], expiresAt } = request.body as any;
    const { tenantId, id: userId } = request.user;

    try {
      const result = await createApiKey({
        tenantId,
        userId,
        name,
        scopes,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      });

      return reply.code(201).send(result);
    } catch (error) {
      request.log.error(error, 'Failed to create API key');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create API key',
      });
    }
  });
\n  fastify.get('/api-keys', {
    schema: {
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              scopes: { type: 'array', items: { type: 'string' } },
              lastUsedAt: { type: 'string' },
              expiresAt: { type: 'string' },
              createdAt: { type: 'string' },
            },
          },
        },
      },
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation],
  }, async (request) => {
    const { tenantId, id: userId } = request.user;

    const apiKeys = await prisma.apiKey.findMany({
      where: {
        tenantId,
        userId,
      },
      select: {
        id: true,
        name: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return apiKeys.map(key => ({
      id: key.id,
      name: key.name,
      scopes: key.scopes as string[],
      lastUsedAt: key.lastUsedAt?.toISOString(),
      expiresAt: key.expiresAt?.toISOString(),
      createdAt: key.createdAt.toISOString(),
    }));
  });
\n  fastify.delete('/api-keys/:id', {
    preHandler: [fastify.authenticate, fastify.tenantIsolation],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { tenantId, id: userId } = request.user;

    try {
      const deleted = await prisma.apiKey.deleteMany({
        where: {
          id,
          tenantId,
          userId,
        },
      });

      if (deleted.count === 0) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'API key not found',
        });
      }

      return reply.code(204).send();
    } catch (error) {
      request.log.error(error, 'Failed to delete API key');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to delete API key',
      });
    }
  });

  // Helper functions
  async function validateApiKey(key: string): Promise<ApiKeyContext | null> {
    // Hash the key to find it in database
    const keyHash = hashApiKey(key);

    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        user: {
          select: {
            id: true,
            tenantId: true,
            name: true,
            isActive: true,
          },
        },
        tenant: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!apiKey || !apiKey.user.isActive) {
      return null;
    }

    return {
      id: apiKey.id,
      tenantId: apiKey.tenantId,
      userId: apiKey.userId,
      name: apiKey.name,
      scopes: apiKey.scopes as string[],
      lastUsedAt: apiKey.lastUsedAt?.toISOString(),
      expiresAt: apiKey.expiresAt?.toISOString(),
    };
  }

  async function createApiKey(data: {
    tenantId: string;
    userId: string;
    name: string;
    scopes: string[];
    expiresAt?: Date;
  }) {
    // Generate a secure random API key
    const key = generateApiKey();
    const keyHash = hashApiKey(key);

    const apiKey = await prisma.apiKey.create({
      data: {
        tenantId: data.tenantId,
        userId: data.userId,
        name: data.name,
        keyHash,
        scopes: data.scopes,
        expiresAt: data.expiresAt,
      },
    });

    return {
      id: apiKey.id,
      name: apiKey.name,
      key, // Only returned once during creation
      scopes: apiKey.scopes as string[],
      expiresAt: apiKey.expiresAt?.toISOString(),
      createdAt: apiKey.createdAt.toISOString(),
    };
  }

  async function updateLastUsed(apiKeyId: string) {
    await prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { lastUsedAt: new Date() },
    });
  }

  function generateApiKey(): string {
    // Generate a secure random key
    const randomBytes = require('crypto').randomBytes(32);
    return `pk_${randomBytes.toString('base64url')}`;
  }

  function hashApiKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  // Available scopes
  const AVAILABLE_SCOPES = [
    'read', // Read access to resources
    'write', // Write access to resources
    'delete', // Delete access to resources
    'admin', // Admin operations
    'conversations:read',
    'conversations:write',
    'conversations:delete',
    'messages:read',
    'messages:write',
    'artifacts:read',
    'artifacts:write',
    'artifacts:delete',
    'tools:execute',
    'webhooks:manage',
    'usage:read',\n    '*', // All permissions
  ];

  // Get available scopes endpoint\n  fastify.get('/api-keys/scopes', {
    schema: {
      response: {
        200: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  }, async () => {
    return AVAILABLE_SCOPES;
  });

  // Cleanup on close
  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
}

declare module 'fastify' {
  interface FastifyInstance {
    apiKeyAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireScope: (scope: string) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireScopes: (scopes: string[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAnyScope: (scopes: string[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}