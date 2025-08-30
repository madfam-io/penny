import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';\nimport { PrismaClient } from '@prisma/client';

interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
  subscriptionTier?: string;
  limits?: Record<string, unknown>;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: User;
    sessionId?: string;
  }
}

export async function tenantIsolationPlugin(fastify: FastifyInstance) {
  const prisma = new PrismaClient();

  fastify.decorate('tenantIsolation', async function(request: FastifyRequest, reply: FastifyReply) {
    // This middleware should run after authentication
    if (!request.user) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const { tenantId, id: userId } = request.user;

    try {
      // Verify tenant exists and is active
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          subscriptions: {
            where: { status: 'active' },
            take: 1,
          },
        },
      });

      if (!tenant) {
        return reply.code(403).send({
          error: 'Forbidden',
          message: 'Invalid tenant',
        });
      }

      // Verify user belongs to tenant
      const user = await prisma.user.findFirst({
        where: {
          id: userId,
          tenantId,
          isActive: true,
        },
        include: {
          roles: {
            include: {
              role: {
                select: {
                  name: true,
                  permissions: true,
                },
              },
            },
          },
        },
      });

      if (!user) {
        return reply.code(403).send({
          error: 'Forbidden',
          message: 'User not found in tenant',
        });
      }

      // Extract roles and permissions
      const roles = user.roles.map(ur => ur.role.name);
      const permissions = user.roles.reduce((acc, ur) => {
        const rolePermissions = ur.role.permissions as string[];
        return [...acc, ...rolePermissions];
      }, [] as string[]);

      // Update request.user with additional context
      request.user = {
        ...request.user,
        roles,
        permissions: [...new Set(permissions)], // Remove duplicates
        subscriptionTier: tenant.subscriptions[0]?.planId,
        limits: tenant.limits as Record<string, unknown>,
      };

      // Add tenant-specific headers for downstream services
      request.headers['x-tenant-id'] = tenantId;
      request.headers['x-user-id'] = userId;

    } catch (error) {
      request.log.error(error, 'Tenant isolation check failed');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to verify tenant access',
      });
    }
  });

  // Helper decorators for common permission checks
  fastify.decorate('requireTenantAdmin', async function(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user?.roles?.includes('admin') && !request.user?.roles?.includes('manager')) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: 'Admin or manager role required',
      });
    }
  });

  fastify.decorate('requireAdmin', async function(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user?.roles?.includes('admin')) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: 'Admin role required',
      });
    }
  });

  fastify.decorate('requirePermission', function(permission: string) {
    return async function(request: FastifyRequest, reply: FastifyReply) {
      if (!request.user?.permissions?.includes(permission)) {
        return reply.code(403).send({
          error: 'Forbidden',
          message: `Permission required: ${permission}`,
        });
      }
    };
  });

  fastify.decorate('checkResourceAccess', function(resourceType: string) {
    return async function(request: FastifyRequest, reply: FastifyReply) {
      const { tenantId, userId } = request.user;
      const resourceId = request.params?.id || request.body?.id;

      if (!resourceId) {
        return; // Skip check if no resource ID
      }

      try {
        let hasAccess = false;

        switch (resourceType) {
          case 'conversation':
            hasAccess = !!(await prisma.conversation.findFirst({
              where: { id: resourceId, tenantId, userId },
            }));
            break;

          case 'artifact':
            hasAccess = !!(await prisma.artifact.findFirst({
              where: { id: resourceId, tenantId, userId },
            }));
            break;

          case 'workspace':
            // Check if user has access to workspace through roles
            hasAccess = !!(await prisma.workspace.findFirst({
              where: {
                id: resourceId,
                tenantId,
                userRoles: {
                  some: { userId },
                },
              },
            }));
            break;

          default:
            // For other resources, default to tenant-level check
            hasAccess = true;
        }

        if (!hasAccess) {
          return reply.code(404).send({
            error: 'Not Found',
            message: 'Resource not found or access denied',
          });
        }
      } catch (error) {\n        request.log.error(error, `Resource access check failed for ${resourceType}`);
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to verify resource access',
        });
      }
    };
  });

  // Usage tracking for tenant isolation
  fastify.addHook('onResponse', async (request, reply) => {
    if (request.user?.tenantId) {
      // Record API usage for billing/analytics
      try {
        await prisma.usage.create({
          data: {
            tenantId: request.user.tenantId,
            userId: request.user.id,
            resourceType: 'api_calls',
            resourceId: request.url,
            quantity: 1,
            unit: 'count',
            metadata: {
              method: request.method,
              statusCode: reply.statusCode,
              userAgent: request.headers['user-agent'],
              path: request.url,
            },
          },
        });
      } catch (error) {
        // Don't fail the request if usage tracking fails
        request.log.warn(error, 'Failed to record API usage');
      }
    }
  });

  // Data isolation queries helper
  fastify.decorate('isolatedQuery', function() {
    return {
      // Pre-configured Prisma client with tenant isolation
      findMany: async (model: string, options: any = {}) => {
        const tenantId = (fastify as any).requestContext.get('tenantId');
        if (!tenantId) {
          throw new Error('Tenant context not found');
        }

        return (prisma as any)[model].findMany({
          ...options,
          where: {
            ...options.where,
            tenantId,
          },
        });
      },

      findUnique: async (model: string, options: any = {}) => {
        const tenantId = (fastify as any).requestContext.get('tenantId');
        if (!tenantId) {
          throw new Error('Tenant context not found');
        }

        return (prisma as any)[model].findFirst({
          ...options,
          where: {
            ...options.where,
            tenantId,
          },
        });
      },

      create: async (model: string, options: any = {}) => {
        const tenantId = (fastify as any).requestContext.get('tenantId');
        if (!tenantId) {
          throw new Error('Tenant context not found');
        }

        return (prisma as any)[model].create({
          ...options,
          data: {
            ...options.data,
            tenantId,
          },
        });
      },

      update: async (model: string, options: any = {}) => {
        const tenantId = (fastify as any).requestContext.get('tenantId');
        if (!tenantId) {
          throw new Error('Tenant context not found');
        }

        // Verify the record belongs to the tenant before updating
        const existing = await (prisma as any)[model].findFirst({
          where: {
            ...options.where,
            tenantId,
          },
        });

        if (!existing) {
          throw new Error('Record not found or access denied');
        }

        return (prisma as any)[model].update(options);
      },

      delete: async (model: string, options: any = {}) => {
        const tenantId = (fastify as any).requestContext.get('tenantId');
        if (!tenantId) {
          throw new Error('Tenant context not found');
        }

        // Verify the record belongs to the tenant before deleting
        const existing = await (prisma as any)[model].findFirst({
          where: {
            ...options.where,
            tenantId,
          },
        });

        if (!existing) {
          throw new Error('Record not found or access denied');
        }

        return (prisma as any)[model].delete(options);
      },
    };
  });

  // Tenant-specific feature flag checker
  fastify.decorate('checkFeatureFlag', async function(flagKey: string, request: FastifyRequest): Promise<boolean> {
    const { tenantId, id: userId } = request.user;

    try {
      // Check for tenant-specific override first
      const override = await prisma.featureFlagOverride.findFirst({
        where: {
          featureFlag: { key: flagKey },
          OR: [
            { tenantId, userId: null }, // Tenant-level override
            { tenantId, userId }, // User-specific override
          ],
        },
        orderBy: [
          { userId: 'desc' }, // User-specific overrides take precedence
          { createdAt: 'desc' },
        ],
      });

      if (override) {
        return override.isEnabled;
      }

      // Check global feature flag
      const featureFlag = await prisma.featureFlag.findUnique({
        where: { key: flagKey },
      });

      if (!featureFlag) {
        return false;
      }

      if (!featureFlag.isEnabled) {
        return false;
      }

      // Check rollout percentage
      if (featureFlag.rolloutPercentage < 100) {
        // Use tenant ID for consistent rollout\n        const hash = tenantId.split('').reduce((a, b) => {
          a = ((a << 5) - a) + b.charCodeAt(0);
          return a & a;
        }, 0);
        const percentage = Math.abs(hash) % 100;
        return percentage < featureFlag.rolloutPercentage;
      }

      return true;
    } catch (error) {\n      fastify.log.error(error, `Failed to check feature flag: ${flagKey}`);
      return false;
    }
  });

  // Add cleanup on close
  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
}