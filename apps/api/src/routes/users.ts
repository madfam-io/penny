import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { UserService } from '../services/UserService';
import { PaginationSchema, ErrorResponseSchema, MetadataSchema } from '../schemas/common';

// Request/Response Schemas
const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
  passwordHash: z.string().optional(),
  avatar: z.string().url().optional(),
  locale: z.string().default('en'),
  timezone: z.string().default('UTC'),
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  preferences: MetadataSchema,
  roles: z.array(z.string()).optional(),
  workspaceId: z.string().optional(),
});

const UpdateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).max(255).optional(),
  avatar: z.string().url().optional(),
  locale: z.string().optional(),
  timezone: z.string().optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  preferences: MetadataSchema.optional(),
  isActive: z.boolean().optional(),
});

const InviteUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
  roles: z.array(z.string()).default(['viewer']),
  workspaceId: z.string().optional(),
  message: z.string().max(500).optional(),
  expiresIn: z.number().int().positive().default(7 * 24 * 60 * 60), // 7 days in seconds
});

const BulkInviteSchema = z.object({
  invitations: z.array(InviteUserSchema).min(1).max(50),
  workspaceId: z.string().optional(),
  defaultRoles: z.array(z.string()).default(['viewer']),
});

const UserQuerySchema = z.object({
  search: z.string().optional(),
  role: z.string().optional(),
  workspaceId: z.string().optional(),
  isActive: z.boolean().optional(),
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().min(0).default(0),
  sortBy: z.enum(['name', 'email', 'createdAt', 'lastLoginAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

const UserResponseSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  email: z.string(),
  emailVerified: z.string().nullable(),
  name: z.string(),
  avatar: z.string().nullable(),
  locale: z.string(),
  timezone: z.string(),
  theme: z.string(),
  preferences: z.record(z.unknown()),
  lastLoginAt: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  roles: z.array(z.object({
    id: z.string(),
    name: z.string(),
    workspaceId: z.string().nullable(),
  })).optional(),
  stats: z.object({
    conversationCount: z.number(),
    messageCount: z.number(),
    artifactCount: z.number(),
    toolExecutionCount: z.number(),
  }).optional(),
});

const UserProfileSchema = UserResponseSchema.extend({
  sessions: z.array(z.object({
    id: z.string(),
    deviceId: z.string().nullable(),
    ipAddress: z.string().nullable(),
    userAgent: z.string().nullable(),
    lastActive: z.string(),
    isCurrent: z.boolean(),
  })).optional(),
  apiKeys: z.array(z.object({
    id: z.string(),
    name: z.string(),
    lastUsedAt: z.string().nullable(),
    expiresAt: z.string().nullable(),
    scopes: z.array(z.string()),
  })).optional(),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",\n  path: ["confirmPassword"],
});

export async function userRoutes(fastify: FastifyInstance) {
  const userService = new UserService();

  // Get all users in tenant\n  fastify.get('/users', {
    schema: {
      querystring: UserQuerySchema,
      response: {
        200: z.object({
          data: z.array(UserResponseSchema),
          pagination: PaginationSchema,
        }),
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Users'],
      summary: 'List users',
      description: 'Get paginated list of users in tenant',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation, fastify.requireTenantAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user;
    const query = UserQuerySchema.parse(request.query);
    
    try {
      const result = await userService.getUsers({
        tenantId,
        ...query,
      });
      
      return reply.send(result);
    } catch (error) {
      request.log.error(error, 'Failed to fetch users');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch users',
      });
    }
  });

  // Get current user profile\n  fastify.get('/users/me', {
    schema: {
      response: {
        200: UserProfileSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Users'],
      summary: 'Get current user profile',
      description: 'Get detailed profile of current user',
    },
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId, tenantId } = request.user;
    const includeSessions = request.query?.include?.includes('sessions');
    const includeApiKeys = request.query?.include?.includes('apiKeys');
    
    try {
      const user = await userService.getUser(userId, {
        tenantId,
        includeStats: true,
        includeSessions,
        includeApiKeys,
      });
      
      if (!user) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'User not found',
        });
      }
      
      return reply.send(user);
    } catch (error) {
      request.log.error(error, 'Failed to fetch user profile');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch user profile',
      });
    }
  });

  // Get user by ID\n  fastify.get('/users/:id', {
    schema: {
      params: z.object({
        id: z.string(),
      }),
      response: {
        200: UserResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Users'],
      summary: 'Get user by ID',
      description: 'Get specific user information (admin only)',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation, fastify.requireTenantAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user;
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const includeStats = request.query?.include?.includes('stats');
    
    try {
      const user = await userService.getUser(id, {
        tenantId,
        includeStats,
      });
      
      if (!user) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'User not found',
        });
      }
      
      return reply.send(user);
    } catch (error) {
      request.log.error(error, 'Failed to fetch user');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch user',
      });
    }
  });

  // Create user\n  fastify.post('/users', {
    schema: {
      body: CreateUserSchema,
      response: {
        201: UserResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        409: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Users'],
      summary: 'Create user',
      description: 'Create a new user in tenant (admin only)',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation, fastify.requireTenantAdmin, fastify.rateLimiting],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId, userId: creatorId } = request.user;
    const body = CreateUserSchema.parse(request.body);
    
    try {
      const user = await userService.createUser({
        tenantId,
        creatorId,
        ...body,
      });
      
      return reply.code(201).send(user);
    } catch (error) {
      if (error.code === 'USER_EMAIL_EXISTS') {
        return reply.code(409).send({
          error: 'Conflict',
          message: 'User with this email already exists',
        });
      }
      
      request.log.error(error, 'Failed to create user');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create user',
      });
    }
  });

  // Update current user profile\n  fastify.put('/users/me', {
    schema: {
      body: UpdateUserSchema.omit({ isActive: true }),
      response: {
        200: UserProfileSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Users'],
      summary: 'Update current user profile',
      description: 'Update current user's profile information',
    },
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId, tenantId } = request.user;
    const body = UpdateUserSchema.omit({ isActive: true }).parse(request.body);
    
    try {
      const user = await userService.updateUser(userId, {
        tenantId,
        ...body,
      });
      
      if (!user) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'User not found',
        });
      }
      
      return reply.send(user);
    } catch (error) {
      request.log.error(error, 'Failed to update user profile');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update user profile',
      });
    }
  });

  // Update user by ID\n  fastify.put('/users/:id', {
    schema: {
      params: z.object({
        id: z.string(),
      }),
      body: UpdateUserSchema,
      response: {
        200: UserResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Users'],
      summary: 'Update user by ID',
      description: 'Update specific user (admin only)',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation, fastify.requireTenantAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user;
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = UpdateUserSchema.parse(request.body);
    
    try {
      const user = await userService.updateUser(id, {
        tenantId,
        ...body,
      });
      
      if (!user) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'User not found',
        });
      }
      
      return reply.send(user);
    } catch (error) {
      request.log.error(error, 'Failed to update user');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update user',
      });
    }
  });

  // Delete user\n  fastify.delete('/users/:id', {
    schema: {
      params: z.object({
        id: z.string(),
      }),
      response: {
        204: z.null(),
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Users'],
      summary: 'Delete user',
      description: 'Delete a user (admin only)',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation, fastify.requireTenantAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user;
    const { id } = z.object({ id: z.string() }).parse(request.params);
    
    try {
      const deleted = await userService.deleteUser(id, { tenantId });
      
      if (!deleted) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'User not found',
        });
      }
      
      return reply.code(204).send();
    } catch (error) {
      request.log.error(error, 'Failed to delete user');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to delete user',
      });
    }
  });

  // Invite user\n  fastify.post('/users/invite', {
    schema: {
      body: InviteUserSchema,
      response: {
        200: z.object({
          success: z.boolean(),
          invitationId: z.string(),
          expiresAt: z.string(),
        }),
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        409: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Users'],
      summary: 'Invite user',
      description: 'Send invitation to new user (admin only)',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation, fastify.requireTenantAdmin, fastify.rateLimiting],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId, userId: inviterId } = request.user;
    const body = InviteUserSchema.parse(request.body);
    
    try {
      const invitation = await userService.inviteUser({
        tenantId,
        inviterId,
        ...body,
      });
      
      return reply.send(invitation);
    } catch (error) {
      if (error.code === 'USER_ALREADY_EXISTS') {
        return reply.code(409).send({
          error: 'Conflict',
          message: 'User with this email already exists',
        });
      }
      
      request.log.error(error, 'Failed to invite user');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to invite user',
      });
    }
  });

  // Bulk invite users\n  fastify.post('/users/bulk-invite', {
    schema: {
      body: BulkInviteSchema,
      response: {
        200: z.object({
          successful: z.array(z.object({
            email: z.string(),
            invitationId: z.string(),
          })),
          failed: z.array(z.object({
            email: z.string(),
            error: z.string(),
          })),
          total: z.number(),
          successCount: z.number(),
          failureCount: z.number(),
        }),
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Users'],
      summary: 'Bulk invite users',
      description: 'Send invitations to multiple users (admin only)',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation, fastify.requireTenantAdmin, fastify.rateLimiting],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId, userId: inviterId } = request.user;
    const body = BulkInviteSchema.parse(request.body);
    
    try {
      const result = await userService.bulkInviteUsers({
        tenantId,
        inviterId,
        ...body,
      });
      
      return reply.send(result);
    } catch (error) {
      request.log.error(error, 'Failed to bulk invite users');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to bulk invite users',
      });
    }
  });

  // Change password\n  fastify.post('/users/me/change-password', {
    schema: {
      body: ChangePasswordSchema,
      response: {
        200: z.object({
          success: z.boolean(),
        }),
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Users'],
      summary: 'Change password',
      description: 'Change current user's password',
    },
    preHandler: [fastify.authenticate, fastify.rateLimiting],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId, tenantId } = request.user;
    const body = ChangePasswordSchema.parse(request.body);
    
    try {
      await userService.changePassword(userId, {
        tenantId,
        currentPassword: body.currentPassword,
        newPassword: body.newPassword,
      });
      
      return reply.send({ success: true });
    } catch (error) {
      if (error.code === 'INVALID_PASSWORD') {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Current password is incorrect',
        });
      }
      
      request.log.error(error, 'Failed to change password');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to change password',
      });
    }
  });

  // Get user sessions\n  fastify.get('/users/me/sessions', {
    schema: {
      response: {
        200: z.array(z.object({
          id: z.string(),
          deviceId: z.string().nullable(),
          ipAddress: z.string().nullable(),
          userAgent: z.string().nullable(),
          lastActive: z.string(),
          isCurrent: z.boolean(),
          createdAt: z.string(),
        })),
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Users'],
      summary: 'Get user sessions',
      description: 'Get all active sessions for current user',
    },
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId, tenantId } = request.user;
    const currentSessionId = request.sessionId;
    
    try {
      const sessions = await userService.getUserSessions(userId, {
        tenantId,
        currentSessionId,
      });
      
      return reply.send(sessions);
    } catch (error) {
      request.log.error(error, 'Failed to fetch user sessions');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch user sessions',
      });
    }
  });

  // Revoke user session\n  fastify.delete('/users/me/sessions/:sessionId', {
    schema: {
      params: z.object({
        sessionId: z.string(),
      }),
      response: {
        204: z.null(),
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Users'],
      summary: 'Revoke session',
      description: 'Revoke a specific user session',
    },
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId, tenantId } = request.user;
    const { sessionId } = z.object({ sessionId: z.string() }).parse(request.params);
    
    try {
      const revoked = await userService.revokeSession(sessionId, {
        userId,
        tenantId,
      });
      
      if (!revoked) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Session not found',
        });
      }
      
      return reply.code(204).send();
    } catch (error) {
      request.log.error(error, 'Failed to revoke session');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to revoke session',
      });
    }
  });

  // Revoke all other sessions\n  fastify.post('/users/me/sessions/revoke-all', {
    schema: {
      response: {
        200: z.object({
          revokedCount: z.number(),
        }),
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Users'],
      summary: 'Revoke all other sessions',
      description: 'Revoke all user sessions except current one',
    },
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId, tenantId } = request.user;
    const currentSessionId = request.sessionId;
    
    try {
      const revokedCount = await userService.revokeAllSessions(userId, {
        tenantId,
        exceptSessionId: currentSessionId,
      });
      
      return reply.send({ revokedCount });
    } catch (error) {
      request.log.error(error, 'Failed to revoke sessions');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to revoke sessions',
      });
    }
  });
}