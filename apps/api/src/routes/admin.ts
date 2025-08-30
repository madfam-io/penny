import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AdminService } from '../services/AdminService';
import { PaginationSchema, ErrorResponseSchema, MetadataSchema } from '../schemas/common';

// Request/Response Schemas
const SystemStatsSchema = z.object({
  overview: z.object({
    totalTenants: z.number(),
    totalUsers: z.number(),
    totalConversations: z.number(),
    totalMessages: z.number(),
    totalArtifacts: z.number(),
    totalToolExecutions: z.number(),
    totalStorageUsed: z.number(),
  }),
  growth: z.object({
    newTenants: z.number(),
    newUsers: z.number(),
    newConversations: z.number(),
    activeUsers: z.number(),
    growthRate: z.number(),
  }),
  usage: z.object({
    totalTokens: z.number(),
    totalApiCalls: z.number(),
    averageResponseTime: z.number(),
    successRate: z.number(),
  }),
  health: z.object({
    uptime: z.number(),
    cpu: z.number(),
    memory: z.number(),
    disk: z.number(),
    errorRate: z.number(),
  }),
});

const TenantStatsSchema = z.object({
  tenantId: z.string(),
  name: z.string(),
  slug: z.string(),
  users: z.number(),
  conversations: z.number(),
  messages: z.number(),
  artifacts: z.number(),
  toolExecutions: z.number(),
  storageUsed: z.number(),
  monthlyActiveUsers: z.number(),
  subscriptionTier: z.string(),
  totalCost: z.number(),
  lastActivity: z.string(),
  createdAt: z.string(),
});

const UserActivitySchema = z.object({
  userId: z.string(),
  tenantId: z.string(),
  name: z.string(),
  email: z.string(),
  lastLoginAt: z.string().nullable(),
  conversationCount: z.number(),
  messageCount: z.number(),
  toolExecutionCount: z.number(),
  totalTokens: z.number(),
  totalCost: z.number(),
  isActive: z.boolean(),
});

const AuditLogQuerySchema = z.object({
  tenantId: z.string().optional(),
  userId: z.string().optional(),
  action: z.string().optional(),
  resource: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.number().int().positive().max(1000).default(100),
  offset: z.number().int().min(0).default(0),
});

const AuditLogResponseSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  userId: z.string().nullable(),
  action: z.string(),
  resource: z.string(),
  resourceId: z.string().nullable(),
  metadata: z.record(z.unknown()),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  timestamp: z.string(),
  tenant: z.object({
    name: z.string(),
    slug: z.string(),
  }).optional(),
  user: z.object({
    name: z.string(),
    email: z.string(),
  }).optional(),
});

const SystemMaintenanceSchema = z.object({
  type: z.enum(['planned', 'emergency']),
  title: z.string(),
  description: z.string(),
  scheduledStart: z.string().datetime(),
  scheduledEnd: z.string().datetime(),
  affectedServices: z.array(z.string()),
  notifyUsers: z.boolean().default(true),
});

const FeatureFlagQuerySchema = z.object({
  key: z.string().optional(),
  isEnabled: z.boolean().optional(),
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

const FeatureFlagResponseSchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isEnabled: z.boolean(),
  conditions: z.record(z.unknown()),
  rolloutPercentage: z.number(),
  metadata: z.record(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
  overrides: z.array(z.object({
    tenantId: z.string().nullable(),
    userId: z.string().nullable(),
    isEnabled: z.boolean(),
  })).optional(),
});

const CreateFeatureFlagSchema = z.object({
  key: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  isEnabled: z.boolean().default(false),
  conditions: z.record(z.unknown()).default({}),
  rolloutPercentage: z.number().int().min(0).max(100).default(0),
  metadata: MetadataSchema,
});

const UpdateFeatureFlagSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  isEnabled: z.boolean().optional(),
  conditions: z.record(z.unknown()).optional(),
  rolloutPercentage: z.number().int().min(0).max(100).optional(),
  metadata: MetadataSchema.optional(),
});

export async function adminRoutes(fastify: FastifyInstance) {
  const adminService = new AdminService();

  // Get system overview/dashboard\n  fastify.get('/admin/dashboard', {
    schema: {
      response: {
        200: SystemStatsSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Admin'],
      summary: 'Get system dashboard',
      description: 'Get system overview statistics and health metrics',
    },
    preHandler: [fastify.authenticate, fastify.requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await adminService.getSystemStats();
      return reply.send(stats);
    } catch (error) {
      request.log.error(error, 'Failed to fetch system stats');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch system stats',
      });
    }
  });

  // Get tenant analytics\n  fastify.get('/admin/tenants/analytics', {
    schema: {
      querystring: z.object({
        sortBy: z.enum(['users', 'messages', 'cost', 'createdAt']).default('users'),
        sortOrder: z.enum(['asc', 'desc']).default('desc'),
        limit: z.number().int().positive().max(100).default(20),
        offset: z.number().int().min(0).default(0),\n        period: z.enum(['7d', '30d', '90d']).default('30d'),
      }),
      response: {
        200: z.object({
          data: z.array(TenantStatsSchema),
          pagination: PaginationSchema,
          totals: z.object({
            totalTenants: z.number(),
            totalUsers: z.number(),
            totalRevenue: z.number(),
            totalUsage: z.record(z.number()),
          }),
        }),
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Admin'],
      summary: 'Get tenant analytics',
      description: 'Get detailed analytics for all tenants',
    },
    preHandler: [fastify.authenticate, fastify.requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = z.object({
      sortBy: z.enum(['users', 'messages', 'cost', 'createdAt']).default('users'),
      sortOrder: z.enum(['asc', 'desc']).default('desc'),
      limit: z.number().int().positive().max(100).default(20),
      offset: z.number().int().min(0).default(0),\n      period: z.enum(['7d', '30d', '90d']).default('30d'),
    }).parse(request.query);
    
    try {
      const result = await adminService.getTenantAnalytics(query);
      return reply.send(result);
    } catch (error) {
      request.log.error(error, 'Failed to fetch tenant analytics');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch tenant analytics',
      });
    }
  });

  // Get user activity analytics\n  fastify.get('/admin/users/activity', {
    schema: {
      querystring: z.object({
        tenantId: z.string().optional(),
        isActive: z.boolean().optional(),\n        period: z.enum(['7d', '30d', '90d']).default('30d'),
        sortBy: z.enum(['lastLoginAt', 'messageCount', 'totalCost']).default('lastLoginAt'),
        sortOrder: z.enum(['asc', 'desc']).default('desc'),
        limit: z.number().int().positive().max(100).default(20),
        offset: z.number().int().min(0).default(0),
      }),
      response: {
        200: z.object({
          data: z.array(UserActivitySchema),
          pagination: PaginationSchema,
          summary: z.object({
            totalUsers: z.number(),
            activeUsers: z.number(),
            inactiveUsers: z.number(),
            averageUsage: z.record(z.number()),
          }),
        }),
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Admin'],
      summary: 'Get user activity',
      description: 'Get detailed user activity analytics',
    },
    preHandler: [fastify.authenticate, fastify.requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = z.object({
      tenantId: z.string().optional(),
      isActive: z.boolean().optional(),\n      period: z.enum(['7d', '30d', '90d']).default('30d'),
      sortBy: z.enum(['lastLoginAt', 'messageCount', 'totalCost']).default('lastLoginAt'),
      sortOrder: z.enum(['asc', 'desc']).default('desc'),
      limit: z.number().int().positive().max(100).default(20),
      offset: z.number().int().min(0).default(0),
    }).parse(request.query);
    
    try {
      const result = await adminService.getUserActivity(query);
      return reply.send(result);
    } catch (error) {
      request.log.error(error, 'Failed to fetch user activity');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch user activity',
      });
    }
  });

  // Get audit logs\n  fastify.get('/admin/audit-logs', {
    schema: {
      querystring: AuditLogQuerySchema,
      response: {
        200: z.object({
          data: z.array(AuditLogResponseSchema),
          pagination: PaginationSchema,
        }),
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Admin'],
      summary: 'Get audit logs',
      description: 'Get paginated audit logs with filtering',
    },
    preHandler: [fastify.authenticate, fastify.requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = AuditLogQuerySchema.parse(request.query);
    
    try {
      const result = await adminService.getAuditLogs(query);
      return reply.send(result);
    } catch (error) {
      request.log.error(error, 'Failed to fetch audit logs');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch audit logs',
      });
    }
  });

  // Get system health\n  fastify.get('/admin/health', {
    schema: {
      response: {
        200: z.object({
          status: z.enum(['healthy', 'degraded', 'unhealthy']),
          timestamp: z.string(),
          uptime: z.number(),
          version: z.string(),
          services: z.record(z.object({
            status: z.enum(['up', 'down', 'degraded']),
            latency: z.number().optional(),
            error: z.string().optional(),
            lastCheck: z.string(),
          })),
          resources: z.object({
            cpu: z.object({
              usage: z.number(),
              cores: z.number(),
            }),
            memory: z.object({
              used: z.number(),
              total: z.number(),
              percentage: z.number(),
            }),
            disk: z.object({
              used: z.number(),
              total: z.number(),
              percentage: z.number(),
            }),
          }),
          database: z.object({
            status: z.enum(['up', 'down']),
            connections: z.object({
              active: z.number(),
              idle: z.number(),
              total: z.number(),
            }),
            queryTime: z.object({
              avg: z.number(),
              p95: z.number(),
              slow_queries: z.number(),
            }),
          }),
          queue: z.object({
            status: z.enum(['up', 'down']),
            waiting: z.number(),
            active: z.number(),
            completed: z.number(),
            failed: z.number(),
          }),
        }),
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Admin'],
      summary: 'Get system health',
      description: 'Get detailed system health information',
    },
    preHandler: [fastify.authenticate, fastify.requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const health = await adminService.getSystemHealth();
      return reply.send(health);
    } catch (error) {
      request.log.error(error, 'Failed to fetch system health');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch system health',
      });
    }
  });

  // Schedule system maintenance\n  fastify.post('/admin/maintenance', {
    schema: {
      body: SystemMaintenanceSchema,
      response: {
        201: z.object({
          id: z.string(),
          type: z.string(),
          title: z.string(),
          description: z.string(),
          scheduledStart: z.string(),
          scheduledEnd: z.string(),
          affectedServices: z.array(z.string()),
          status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']),
          createdAt: z.string(),
        }),
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Admin'],
      summary: 'Schedule maintenance',
      description: 'Schedule system maintenance window',
    },
    preHandler: [fastify.authenticate, fastify.requireAdmin, fastify.rateLimiting],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = SystemMaintenanceSchema.parse(request.body);
    
    try {
      const maintenance = await adminService.scheduleMaintenance(body);
      return reply.code(201).send(maintenance);
    } catch (error) {
      request.log.error(error, 'Failed to schedule maintenance');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to schedule maintenance',
      });
    }
  });

  // Get feature flags\n  fastify.get('/admin/feature-flags', {
    schema: {
      querystring: FeatureFlagQuerySchema,
      response: {
        200: z.object({
          data: z.array(FeatureFlagResponseSchema),
          pagination: PaginationSchema,
        }),
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Admin'],
      summary: 'Get feature flags',
      description: 'Get paginated list of feature flags',
    },
    preHandler: [fastify.authenticate, fastify.requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = FeatureFlagQuerySchema.parse(request.query);
    
    try {
      const result = await adminService.getFeatureFlags(query);
      return reply.send(result);
    } catch (error) {
      request.log.error(error, 'Failed to fetch feature flags');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch feature flags',
      });
    }
  });

  // Create feature flag\n  fastify.post('/admin/feature-flags', {
    schema: {
      body: CreateFeatureFlagSchema,
      response: {
        201: FeatureFlagResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        409: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Admin'],
      summary: 'Create feature flag',
      description: 'Create a new feature flag',
    },
    preHandler: [fastify.authenticate, fastify.requireAdmin, fastify.rateLimiting],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = CreateFeatureFlagSchema.parse(request.body);
    
    try {
      const featureFlag = await adminService.createFeatureFlag(body);
      return reply.code(201).send(featureFlag);
    } catch (error) {
      if (error.code === 'FEATURE_FLAG_EXISTS') {
        return reply.code(409).send({
          error: 'Conflict',
          message: 'Feature flag with this key already exists',
        });
      }
      
      request.log.error(error, 'Failed to create feature flag');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create feature flag',
      });
    }
  });

  // Update feature flag\n  fastify.put('/admin/feature-flags/:id', {
    schema: {
      params: z.object({
        id: z.string(),
      }),
      body: UpdateFeatureFlagSchema,
      response: {
        200: FeatureFlagResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Admin'],
      summary: 'Update feature flag',
      description: 'Update an existing feature flag',
    },
    preHandler: [fastify.authenticate, fastify.requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = UpdateFeatureFlagSchema.parse(request.body);
    
    try {
      const featureFlag = await adminService.updateFeatureFlag(id, body);
      
      if (!featureFlag) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Feature flag not found',
        });
      }
      
      return reply.send(featureFlag);
    } catch (error) {
      request.log.error(error, 'Failed to update feature flag');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update feature flag',
      });
    }
  });

  // Delete feature flag\n  fastify.delete('/admin/feature-flags/:id', {
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
      tags: ['Admin'],
      summary: 'Delete feature flag',
      description: 'Delete a feature flag',
    },
    preHandler: [fastify.authenticate, fastify.requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    
    try {
      const deleted = await adminService.deleteFeatureFlag(id);
      
      if (!deleted) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Feature flag not found',
        });
      }
      
      return reply.code(204).send();
    } catch (error) {
      request.log.error(error, 'Failed to delete feature flag');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to delete feature flag',
      });
    }
  });

  // Create feature flag override\n  fastify.post('/admin/feature-flags/:id/overrides', {
    schema: {
      params: z.object({
        id: z.string(),
      }),
      body: z.object({
        tenantId: z.string().optional(),
        userId: z.string().optional(),
        isEnabled: z.boolean(),
        conditions: z.record(z.unknown()).optional(),
      }),
      response: {
        201: z.object({
          id: z.string(),
          featureFlagId: z.string(),
          tenantId: z.string().nullable(),
          userId: z.string().nullable(),
          isEnabled: z.boolean(),
          conditions: z.record(z.unknown()),
          createdAt: z.string(),
        }),
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Admin'],
      summary: 'Create feature flag override',
      description: 'Create tenant or user-specific feature flag override',
    },
    preHandler: [fastify.authenticate, fastify.requireAdmin, fastify.rateLimiting],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({
      tenantId: z.string().optional(),
      userId: z.string().optional(),
      isEnabled: z.boolean(),
      conditions: z.record(z.unknown()).optional(),
    }).parse(request.body);
    
    try {
      const override = await adminService.createFeatureFlagOverride(id, body);
      return reply.code(201).send(override);
    } catch (error) {
      if (error.code === 'FEATURE_FLAG_NOT_FOUND') {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Feature flag not found',
        });
      }
      
      request.log.error(error, 'Failed to create feature flag override');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create feature flag override',
      });
    }
  });

  // Export data (GDPR compliance)
  fastify.post('/admin/export/:tenantId', {
    schema: {
      params: z.object({
        tenantId: z.string(),
      }),
      body: z.object({
        dataTypes: z.array(z.enum(['users', 'conversations', 'messages', 'artifacts', 'usage'])),
        format: z.enum(['json', 'csv']).default('json'),
        includeDeleted: z.boolean().default(false),
      }),
      response: {
        202: z.object({
          exportId: z.string(),
          status: z.enum(['queued', 'processing', 'completed', 'failed']),
          estimatedCompletion: z.string(),
        }),
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Admin'],
      summary: 'Export tenant data',
      description: 'Export all data for a tenant (GDPR compliance)',
    },
    preHandler: [fastify.authenticate, fastify.requireAdmin, fastify.rateLimiting],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = z.object({ tenantId: z.string() }).parse(request.params);
    const body = z.object({
      dataTypes: z.array(z.enum(['users', 'conversations', 'messages', 'artifacts', 'usage'])),
      format: z.enum(['json', 'csv']).default('json'),
      includeDeleted: z.boolean().default(false),
    }).parse(request.body);
    
    try {
      const exportJob = await adminService.exportTenantData(tenantId, body);
      return reply.code(202).send(exportJob);
    } catch (error) {
      if (error.code === 'TENANT_NOT_FOUND') {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Tenant not found',
        });
      }
      
      request.log.error(error, 'Failed to start data export');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to start data export',
      });
    }
  });

  // Get export status\n  fastify.get('/admin/exports/:exportId', {
    schema: {
      params: z.object({
        exportId: z.string(),
      }),
      response: {
        200: z.object({
          id: z.string(),
          tenantId: z.string(),
          status: z.enum(['queued', 'processing', 'completed', 'failed']),
          progress: z.number(),
          totalRecords: z.number().optional(),
          processedRecords: z.number().optional(),
          downloadUrl: z.string().optional(),
          error: z.string().optional(),
          createdAt: z.string(),
          completedAt: z.string().optional(),
          expiresAt: z.string().optional(),
        }),
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Admin'],
      summary: 'Get export status',
      description: 'Get status of data export job',
    },
    preHandler: [fastify.authenticate, fastify.requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { exportId } = z.object({ exportId: z.string() }).parse(request.params);
    
    try {
      const exportJob = await adminService.getExportStatus(exportId);
      
      if (!exportJob) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Export job not found',
        });
      }
      
      return reply.send(exportJob);
    } catch (error) {
      request.log.error(error, 'Failed to fetch export status');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch export status',
      });
    }
  });

  // System metrics for monitoring\n  fastify.get('/admin/metrics', {
    schema: {
      querystring: z.object({
        period: z.enum(['1h', '6h', '1d', '7d', '30d']).default('1h'),
        metrics: z.array(z.string()).optional(),
      }),
      response: {
        200: z.object({
          timestamp: z.string(),
          period: z.string(),
          metrics: z.record(z.union([z.number(), z.string()])),
          timeseries: z.record(z.array(z.object({
            timestamp: z.string(),
            value: z.number(),
          }))),
        }),
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Admin'],
      summary: 'Get system metrics',
      description: 'Get time-series system metrics for monitoring',
    },
    preHandler: [fastify.authenticate, fastify.requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { period, metrics } = z.object({
      period: z.enum(['1h', '6h', '1d', '7d', '30d']).default('1h'),
      metrics: z.array(z.string()).optional(),
    }).parse(request.query);
    
    try {
      const systemMetrics = await adminService.getSystemMetrics({
        period,
        metrics,
      });
      
      return reply.send(systemMetrics);
    } catch (error) {
      request.log.error(error, 'Failed to fetch system metrics');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch system metrics',
      });
    }
  });
}