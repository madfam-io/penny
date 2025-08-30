import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';\nimport { TenantService } from '../services/TenantService';\nimport { PaginationSchema, ErrorResponseSchema, MetadataSchema } from '../schemas/common';

// Request/Response Schemas
const CreateTenantSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  logo: z.string().url().optional(),
  favicon: z.string().url().optional(),\n  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#3b82f6'),
  customCss: z.string().max(50000).optional(),
  settings: MetadataSchema,
  features: MetadataSchema,
  limits: MetadataSchema,
});

const UpdateTenantSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  logo: z.string().url().optional(),
  favicon: z.string().url().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  customCss: z.string().max(50000).optional(),
  settings: MetadataSchema.optional(),
  features: MetadataSchema.optional(),
  limits: MetadataSchema.optional(),
});

const TenantQuerySchema = z.object({
  search: z.string().optional(),
  isActive: z.boolean().optional(),
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().min(0).default(0),
  sortBy: z.enum(['name', 'slug', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

const TenantResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  logo: z.string().nullable(),
  favicon: z.string().nullable(),
  primaryColor: z.string(),
  customCss: z.string().nullable(),
  settings: z.record(z.unknown()),
  features: z.record(z.unknown()),
  limits: z.record(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
  stats: z.object({
    userCount: z.number(),
    workspaceCount: z.number(),
    conversationCount: z.number(),
    artifactCount: z.number(),
    monthlyUsage: z.record(z.number()),
  }).optional(),
});

const TenantStatsSchema = z.object({
  userCount: z.number(),
  workspaceCount: z.number(),
  conversationCount: z.number(),
  messageCount: z.number(),
  artifactCount: z.number(),
  toolExecutionCount: z.number(),
  storageUsed: z.number(), // in bytes
  monthlyStats: z.array(z.object({
    month: z.string(),
    conversations: z.number(),
    messages: z.number(),
    toolExecutions: z.number(),
    storageUsed: z.number(),
  })),
});

export async function tenantRoutes(fastify: FastifyInstance) {
  const tenantService = new TenantService();

  // Admin only: Get all tenants\n  fastify.get('/admin/tenants', {
    schema: {
      querystring: TenantQuerySchema,
      response: {
        200: z.object({
          data: z.array(TenantResponseSchema),
          pagination: PaginationSchema,
        }),
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Tenants', 'Admin'],
      summary: 'List all tenants',
      description: 'Get paginated list of all tenants (admin only)',
    },
    preHandler: [fastify.authenticate, fastify.requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = TenantQuerySchema.parse(request.query);
    
    try {
      const result = await tenantService.getTenants(query);
      return reply.send(result);
    } catch (error) {
      request.log.error(error, 'Failed to fetch tenants');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch tenants',
      });
    }
  });

  // Get current tenant info\n  fastify.get('/tenant', {
    schema: {
      response: {
        200: TenantResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Tenants'],
      summary: 'Get current tenant',
      description: 'Get current user's tenant information',
    },
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user;
    
    try {
      const tenant = await tenantService.getTenant(tenantId);
      
      if (!tenant) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Tenant not found',
        });
      }
      
      return reply.send(tenant);
    } catch (error) {
      request.log.error(error, 'Failed to fetch tenant');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch tenant',
      });
    }
  });

  // Admin only: Get tenant by ID\n  fastify.get('/admin/tenants/:id', {
    schema: {
      params: z.object({
        id: z.string(),
      }),
      response: {
        200: TenantResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Tenants', 'Admin'],
      summary: 'Get tenant by ID',
      description: 'Get specific tenant information (admin only)',
    },
    preHandler: [fastify.authenticate, fastify.requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    
    try {
      const tenant = await tenantService.getTenant(id, { includeStats: true });
      
      if (!tenant) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Tenant not found',
        });
      }
      
      return reply.send(tenant);
    } catch (error) {
      request.log.error(error, 'Failed to fetch tenant');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch tenant',
      });
    }
  });

  // Admin only: Create tenant\n  fastify.post('/admin/tenants', {
    schema: {
      body: CreateTenantSchema,
      response: {
        201: TenantResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        409: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Tenants', 'Admin'],
      summary: 'Create tenant',
      description: 'Create a new tenant (admin only)',
    },
    preHandler: [fastify.authenticate, fastify.requireAdmin, fastify.rateLimiting],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = CreateTenantSchema.parse(request.body);
    
    try {
      const tenant = await tenantService.createTenant(body);
      return reply.code(201).send(tenant);
    } catch (error) {
      if (error.code === 'TENANT_SLUG_EXISTS') {
        return reply.code(409).send({
          error: 'Conflict',
          message: 'Tenant with this slug already exists',
        });
      }
      
      request.log.error(error, 'Failed to create tenant');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create tenant',
      });
    }
  });

  // Update current tenant\n  fastify.put('/tenant', {
    schema: {
      body: UpdateTenantSchema,
      response: {
        200: TenantResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Tenants'],
      summary: 'Update current tenant',
      description: 'Update current tenant information (admin role required)',
    },
    preHandler: [fastify.authenticate, fastify.requireTenantAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user;
    const body = UpdateTenantSchema.parse(request.body);
    
    try {
      const tenant = await tenantService.updateTenant(tenantId, body);
      
      if (!tenant) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Tenant not found',
        });
      }
      
      return reply.send(tenant);
    } catch (error) {
      request.log.error(error, 'Failed to update tenant');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update tenant',
      });
    }
  });

  // Admin only: Update tenant by ID\n  fastify.put('/admin/tenants/:id', {
    schema: {
      params: z.object({
        id: z.string(),
      }),
      body: UpdateTenantSchema,
      response: {
        200: TenantResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Tenants', 'Admin'],
      summary: 'Update tenant by ID',
      description: 'Update specific tenant (admin only)',
    },
    preHandler: [fastify.authenticate, fastify.requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = UpdateTenantSchema.parse(request.body);
    
    try {
      const tenant = await tenantService.updateTenant(id, body);
      
      if (!tenant) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Tenant not found',
        });
      }
      
      return reply.send(tenant);
    } catch (error) {
      request.log.error(error, 'Failed to update tenant');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update tenant',
      });
    }
  });

  // Admin only: Delete tenant\n  fastify.delete('/admin/tenants/:id', {
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
      tags: ['Tenants', 'Admin'],
      summary: 'Delete tenant',
      description: 'Delete a tenant and all associated data (admin only)',
    },
    preHandler: [fastify.authenticate, fastify.requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    
    try {
      const deleted = await tenantService.deleteTenant(id);
      
      if (!deleted) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Tenant not found',
        });
      }
      
      return reply.code(204).send();
    } catch (error) {
      request.log.error(error, 'Failed to delete tenant');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to delete tenant',
      });
    }
  });

  // Get tenant statistics\n  fastify.get('/tenant/stats', {
    schema: {
      querystring: z.object({\n        period: z.enum(['7d', '30d', '90d', '1y']).default('30d'),
        granularity: z.enum(['day', 'week', 'month']).default('day'),
      }),
      response: {
        200: TenantStatsSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Tenants'],
      summary: 'Get tenant statistics',
      description: 'Get usage statistics for current tenant',
    },
    preHandler: [fastify.authenticate, fastify.requireTenantAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user;
    const { period, granularity } = z.object({\n      period: z.enum(['7d', '30d', '90d', '1y']).default('30d'),
      granularity: z.enum(['day', 'week', 'month']).default('day'),
    }).parse(request.query);
    
    try {
      const stats = await tenantService.getTenantStats(tenantId, {
        period,
        granularity,
      });
      
      return reply.send(stats);
    } catch (error) {
      request.log.error(error, 'Failed to fetch tenant stats');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch tenant statistics',
      });
    }
  });

  // Get tenant usage limits and current usage\n  fastify.get('/tenant/usage', {
    schema: {
      response: {
        200: z.object({
          limits: z.record(z.number()),
          current: z.record(z.number()),
          usage: z.array(z.object({
            metric: z.string(),
            limit: z.number(),
            current: z.number(),
            percentage: z.number(),
            resetDate: z.string().optional(),
          })),
          billing: z.object({
            tier: z.string(),
            cycleStart: z.string(),
            cycleEnd: z.string(),
            nextBillingDate: z.string(),
          }),
        }),
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Tenants'],
      summary: 'Get tenant usage',
      description: 'Get current usage against limits for tenant',
    },
    preHandler: [fastify.authenticate, fastify.requireTenantAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user;
    
    try {
      const usage = await tenantService.getTenantUsage(tenantId);
      return reply.send(usage);
    } catch (error) {
      request.log.error(error, 'Failed to fetch tenant usage');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch tenant usage',
      });
    }
  });

  // Validate tenant slug availability\n  fastify.get('/tenant/slug/:slug/available', {
    schema: {
      params: z.object({
        slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
      }),
      response: {
        200: z.object({
          available: z.boolean(),
          suggestions: z.array(z.string()).optional(),
        }),
        400: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Tenants'],
      summary: 'Check slug availability',
      description: 'Check if a tenant slug is available',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { slug } = z.object({
      slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
    }).parse(request.params);
    
    try {
      const result = await tenantService.checkSlugAvailability(slug);
      return reply.send(result);
    } catch (error) {
      request.log.error(error, 'Failed to check slug availability');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to check slug availability',
      });
    }
  });
}