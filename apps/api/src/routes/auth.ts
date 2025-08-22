import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ValidationError, AuthenticationError, type Role } from '@penny/shared';
import { CryptoService } from '@penny/security';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(255),
  tenantName: z.string().min(1).max(255),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  tenantId: z.string().uuid().optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

const routes: FastifyPluginAsync = async (fastify) => {
  const cryptoService = new CryptoService(
    Buffer.from(process.env.MASTER_ENCRYPTION_KEY || 'change-this-32-byte-key-in-prod!')
  );

  fastify.post('/signup', {
    schema: {
      description: 'Create new tenant and admin user',
      tags: ['auth'],
      body: {
        type: 'object',
        properties: {
          email: { type: 'string' },
          password: { type: 'string' },
          name: { type: 'string' },
          tenantName: { type: 'string' },
        },
        required: ['email', 'password', 'name', 'tenantName'],
      },
    },
  }, async (request, reply) => {
    const body = signupSchema.parse(request.body);

    // TODO: Implement actual signup logic with database
    // For now, return mock response
    const mockUserId = 'usr_' + Date.now();
    const mockTenantId = 'tnt_' + Date.now();

    const token = fastify.jwt.sign({
      sub: mockUserId,
      tid: mockTenantId,
      roles: [Role.ADMIN],
      sessionId: 'ses_' + Date.now(),
    });

    return {
      user: {
        id: mockUserId,
        email: body.email,
        name: body.name,
        roles: [Role.ADMIN],
      },
      tenant: {
        id: mockTenantId,
        name: body.tenantName,
      },
      token,
      refreshToken: cryptoService.generateToken(),
    };
  });

  fastify.post('/login', {
    schema: {
      description: 'Login with email and password',
      tags: ['auth'],
      body: {
        type: 'object',
        properties: {
          email: { type: 'string' },
          password: { type: 'string' },
          tenantId: { type: 'string' },
        },
        required: ['email', 'password'],
      },
    },
  }, async (request, reply) => {
    const body = loginSchema.parse(request.body);

    // TODO: Implement actual login logic with database
    // For now, return mock response
    const mockUserId = 'usr_' + Date.now();
    const mockTenantId = body.tenantId || 'tnt_' + Date.now();

    const token = fastify.jwt.sign({
      sub: mockUserId,
      tid: mockTenantId,
      roles: [Role.CREATOR],
      sessionId: 'ses_' + Date.now(),
    });

    return {
      user: {
        id: mockUserId,
        email: body.email,
        name: 'Mock User',
        roles: [Role.CREATOR],
      },
      token,
      refreshToken: cryptoService.generateToken(),
    };
  });

  fastify.post('/refresh', {
    schema: {
      description: 'Refresh access token',
      tags: ['auth'],
      body: {
        type: 'object',
        properties: {
          refreshToken: { type: 'string' },
        },
        required: ['refreshToken'],
      },
    },
  }, async (request, reply) => {
    const body = refreshSchema.parse(request.body);

    // TODO: Implement actual refresh logic
    // For now, return mock response
    const token = fastify.jwt.sign({
      sub: 'usr_mock',
      tid: 'tnt_mock',
      roles: [Role.CREATOR],
      sessionId: 'ses_' + Date.now(),
    });

    return {
      token,
      refreshToken: cryptoService.generateToken(),
    };
  });

  fastify.post('/logout', {
    schema: {
      description: 'Logout and invalidate session',
      tags: ['auth'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    // TODO: Implement session invalidation
    return { success: true };
  });

  fastify.get('/me', {
    schema: {
      description: 'Get current user info',
      tags: ['auth'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    // TODO: Fetch actual user data from database
    return {
      user: {
        id: request.context.userId,
        email: 'user@example.com',
        name: 'Current User',
        roles: request.context.roles,
      },
      tenant: {
        id: request.context.tenantId,
        name: 'Current Tenant',
      },
    };
  });
};

export default routes;