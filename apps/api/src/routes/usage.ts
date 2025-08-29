import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { UsageService } from '../services/UsageService';
import { PaginationSchema, ErrorResponseSchema, MetadataSchema } from '../schemas/common';

// Request/Response Schemas
const UsageQuerySchema = z.object({
  resourceType: z.enum(['messages', 'tokens', 'tools', 'storage', 'api_calls']).optional(),
  resourceId: z.string().optional(),
  userId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  period: z.enum(['1h', '6h', '1d', '7d', '30d', '90d']).default('30d'),
  granularity: z.enum(['hour', 'day', 'week', 'month']).default('day'),
  limit: z.number().int().positive().max(1000).default(100),
  offset: z.number().int().min(0).default(0),
});

const UsageResponseSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  userId: z.string().nullable(),
  resourceType: z.string(),
  resourceId: z.string().nullable(),
  quantity: z.number(),
  unit: z.string(),
  cost: z.number().nullable(),
  metadata: z.record(z.unknown()),
  billingPeriod: z.string().nullable(),
  timestamp: z.string(),
});

const UsageSummarySchema = z.object({
  resourceType: z.string(),
  totalQuantity: z.number(),
  totalCost: z.number(),
  unit: z.string(),
  count: z.number(),
  averagePerDay: z.number(),
  trend: z.object({
    direction: z.enum(['up', 'down', 'stable']),
    percentage: z.number(),
  }),
});

const UsageMetricsSchema = z.object({
  period: z.string(),
  granularity: z.string(),
  summary: z.array(UsageSummarySchema),
  timeline: z.array(z.object({
    timestamp: z.string(),
    metrics: z.record(z.number()),
  })),
  breakdown: z.object({
    byResourceType: z.record(z.number()),
    byUser: z.record(z.object({
      name: z.string(),
      value: z.number(),
    })),
    byDay: z.record(z.number()),
  }),
  costs: z.object({
    total: z.number(),
    byResourceType: z.record(z.number()),
    currency: z.string(),
  }),
  limits: z.record(z.object({
    current: z.number(),
    limit: z.number(),
    percentage: z.number(),
    resetDate: z.string().optional(),
  })),
});

const RecordUsageSchema = z.object({
  resourceType: z.enum(['messages', 'tokens', 'tools', 'storage', 'api_calls']),
  resourceId: z.string().optional(),
  quantity: z.number().positive(),
  unit: z.string().default('count'),
  cost: z.number().optional(),
  metadata: MetadataSchema,
});

const BulkUsageSchema = z.object({
  records: z.array(RecordUsageSchema).min(1).max(1000),
});

export async function usageRoutes(fastify: FastifyInstance) {
  const usageService = new UsageService();

  // Get usage records
  fastify.get('/usage', {
    schema: {
      querystring: UsageQuerySchema,
      response: {
        200: z.object({
          data: z.array(UsageResponseSchema),
          pagination: PaginationSchema,
        }),
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Usage'],
      summary: 'Get usage records',
      description: 'Get paginated list of usage records for tenant',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation, fastify.requireTenantAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user;
    const query = UsageQuerySchema.parse(request.query);
    
    try {
      const result = await usageService.getUsageRecords({
        tenantId,
        ...query,
      });
      
      return reply.send(result);
    } catch (error) {
      request.log.error(error, 'Failed to fetch usage records');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch usage records',
      });
    }
  });

  // Get usage metrics/analytics
  fastify.get('/usage/metrics', {
    schema: {
      querystring: z.object({
        period: z.enum(['1h', '6h', '1d', '7d', '30d', '90d']).default('30d'),
        granularity: z.enum(['hour', 'day', 'week', 'month']).default('day'),
        resourceTypes: z.array(z.string()).optional(),
        includeBreakdown: z.boolean().default(true),
        includeTrends: z.boolean().default(true),
        includeForecasting: z.boolean().default(false),
      }),
      response: {
        200: UsageMetricsSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Usage'],
      summary: 'Get usage metrics',
      description: 'Get aggregated usage metrics and analytics for tenant',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation, fastify.requireTenantAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user;
    const query = z.object({
      period: z.enum(['1h', '6h', '1d', '7d', '30d', '90d']).default('30d'),
      granularity: z.enum(['hour', 'day', 'week', 'month']).default('day'),
      resourceTypes: z.array(z.string()).optional(),
      includeBreakdown: z.boolean().default(true),
      includeTrends: z.boolean().default(true),
      includeForecasting: z.boolean().default(false),
    }).parse(request.query);
    
    try {
      const metrics = await usageService.getUsageMetrics(tenantId, query);
      return reply.send(metrics);
    } catch (error) {
      request.log.error(error, 'Failed to fetch usage metrics');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch usage metrics',
      });
    }
  });

  // Get current usage vs limits
  fastify.get('/usage/limits', {
    schema: {
      response: {
        200: z.object({
          limits: z.record(z.number()),
          current: z.record(z.number()),
          usage: z.array(z.object({
            resourceType: z.string(),
            current: z.number(),
            limit: z.number(),
            unit: z.string(),
            percentage: z.number(),
            status: z.enum(['ok', 'warning', 'exceeded']),
            resetDate: z.string().optional(),
          })),
          subscription: z.object({
            planName: z.string(),
            billingCycle: z.string(),
            currentPeriodStart: z.string(),
            currentPeriodEnd: z.string(),
          }),
          alerts: z.array(z.object({
            resourceType: z.string(),
            type: z.enum(['approaching_limit', 'limit_exceeded', 'usage_spike']),
            message: z.string(),
            threshold: z.number(),
            current: z.number(),
            severity: z.enum(['info', 'warning', 'critical']),
          })),
        }),
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Usage'],
      summary: 'Get usage vs limits',
      description: 'Get current usage against subscription limits',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user;
    
    try {
      const usage = await usageService.getCurrentUsage(tenantId);
      return reply.send(usage);
    } catch (error) {
      request.log.error(error, 'Failed to fetch current usage');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch current usage',
      });
    }
  });

  // Record usage (internal API)
  fastify.post('/usage/record', {
    schema: {
      body: RecordUsageSchema,
      response: {
        201: UsageResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        429: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Usage'],
      summary: 'Record usage',
      description: 'Record a single usage event (internal API)',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation, fastify.rateLimiting],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId, userId } = request.user;
    const body = RecordUsageSchema.parse(request.body);
    
    try {
      const usage = await usageService.recordUsage({
        tenantId,
        userId,
        ...body,
      });
      
      return reply.code(201).send(usage);
    } catch (error) {
      if (error.code === 'LIMIT_EXCEEDED') {
        return reply.code(429).send({
          error: 'Too Many Requests',
          message: error.message || 'Usage limit exceeded',
        });
      }
      
      request.log.error(error, 'Failed to record usage');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to record usage',
      });
    }
  });

  // Bulk record usage (internal API)
  fastify.post('/usage/record/bulk', {
    schema: {
      body: BulkUsageSchema,
      response: {
        200: z.object({
          successful: z.array(UsageResponseSchema),
          failed: z.array(z.object({
            record: RecordUsageSchema,
            error: z.string(),
          })),
          total: z.number(),
          successCount: z.number(),
          failureCount: z.number(),
        }),
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Usage'],
      summary: 'Bulk record usage',
      description: 'Record multiple usage events in batch (internal API)',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation, fastify.rateLimiting],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId, userId } = request.user;
    const { records } = BulkUsageSchema.parse(request.body);
    
    try {
      const result = await usageService.bulkRecordUsage(tenantId, {
        userId,
        records,
      });
      
      return reply.send(result);
    } catch (error) {
      request.log.error(error, 'Failed to bulk record usage');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to bulk record usage',
      });
    }
  });

  // Get user usage (for current user)
  fastify.get('/usage/me', {
    schema: {
      querystring: z.object({
        period: z.enum(['1d', '7d', '30d', '90d']).default('30d'),
        resourceTypes: z.array(z.string()).optional(),
      }),
      response: {
        200: z.object({
          summary: z.array(UsageSummarySchema),
          breakdown: z.object({
            byResourceType: z.record(z.number()),
            byDay: z.record(z.number()),
          }),
          totalCost: z.number(),
          currency: z.string(),
        }),
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Usage'],
      summary: 'Get my usage',
      description: 'Get usage statistics for current user',
    },
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId, userId } = request.user;
    const { period, resourceTypes } = z.object({
      period: z.enum(['1d', '7d', '30d', '90d']).default('30d'),
      resourceTypes: z.array(z.string()).optional(),
    }).parse(request.query);
    
    try {
      const usage = await usageService.getUserUsage(userId, {
        tenantId,
        period,
        resourceTypes,
      });
      
      return reply.send(usage);
    } catch (error) {
      request.log.error(error, 'Failed to fetch user usage');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch user usage',
      });
    }
  });

  // Get usage reports
  fastify.get('/usage/reports', {
    schema: {
      querystring: z.object({
        reportType: z.enum(['daily', 'weekly', 'monthly', 'custom']).default('monthly'),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
        includeUsers: z.boolean().default(false),
        includeProjects: z.boolean().default(false),
        format: z.enum(['json', 'csv']).default('json'),
      }),
      response: {
        200: z.union([
          z.object({
            report: z.object({
              period: z.string(),
              generated: z.string(),
              summary: z.array(UsageSummarySchema),
              details: z.array(z.object({
                date: z.string(),
                metrics: z.record(z.number()),
                users: z.array(z.object({
                  id: z.string(),
                  name: z.string(),
                  usage: z.record(z.number()),
                })).optional(),
              })),
              costs: z.object({
                total: z.number(),
                breakdown: z.record(z.number()),
                currency: z.string(),
              }),
            }),
          }),
          z.string(), // CSV format
        ]),
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Usage'],
      summary: 'Generate usage report',
      description: 'Generate detailed usage report for tenant',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation, fastify.requireTenantAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user;
    const query = z.object({
      reportType: z.enum(['daily', 'weekly', 'monthly', 'custom']).default('monthly'),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
      includeUsers: z.boolean().default(false),
      includeProjects: z.boolean().default(false),
      format: z.enum(['json', 'csv']).default('json'),
    }).parse(request.query);
    
    try {
      const report = await usageService.generateReport(tenantId, query);
      
      if (query.format === 'csv') {
        reply.type('text/csv');
        reply.header('Content-Disposition', 'attachment; filename="usage-report.csv"');
      }
      
      return reply.send(report);
    } catch (error) {
      request.log.error(error, 'Failed to generate usage report');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to generate usage report',
      });
    }
  });

  // Get usage predictions/forecasting
  fastify.get('/usage/forecast', {
    schema: {
      querystring: z.object({
        resourceType: z.enum(['messages', 'tokens', 'tools', 'storage', 'api_calls']),
        period: z.enum(['7d', '30d', '90d']).default('30d'),
        forecastDays: z.number().int().min(1).max(365).default(30),
      }),
      response: {
        200: z.object({
          resourceType: z.string(),
          currentUsage: z.number(),
          forecastPeriod: z.string(),
          predictions: z.array(z.object({
            date: z.string(),
            predicted: z.number(),
            confidence: z.number(),
            lower_bound: z.number(),
            upper_bound: z.number(),
          })),
          summary: z.object({
            totalPredicted: z.number(),
            averageDaily: z.number(),
            trend: z.enum(['increasing', 'decreasing', 'stable']),
            confidence: z.number(),
            limitExceededDate: z.string().optional(),
          }),
          recommendations: z.array(z.string()),
        }),
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Usage'],
      summary: 'Get usage forecast',
      description: 'Get AI-powered usage predictions for resource type',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation, fastify.requireTenantAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user;
    const query = z.object({
      resourceType: z.enum(['messages', 'tokens', 'tools', 'storage', 'api_calls']),
      period: z.enum(['7d', '30d', '90d']).default('30d'),
      forecastDays: z.number().int().min(1).max(365).default(30),
    }).parse(request.query);
    
    try {
      const forecast = await usageService.getForecast(tenantId, query);
      return reply.send(forecast);
    } catch (error) {
      if (error.code === 'INSUFFICIENT_DATA') {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Insufficient historical data for forecasting',
        });
      }
      
      request.log.error(error, 'Failed to generate usage forecast');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to generate usage forecast',
      });
    }
  });

  // Get usage alerts configuration
  fastify.get('/usage/alerts', {
    schema: {
      response: {
        200: z.array(z.object({
          id: z.string(),
          resourceType: z.string(),
          type: z.enum(['threshold', 'spike', 'trend']),
          threshold: z.number(),
          isEnabled: z.boolean(),
          notificationChannels: z.array(z.string()),
          conditions: z.record(z.unknown()),
          createdAt: z.string(),
          updatedAt: z.string(),
        })),
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Usage'],
      summary: 'Get usage alerts',
      description: 'Get usage alert configurations for tenant',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation, fastify.requireTenantAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user;
    
    try {
      const alerts = await usageService.getUsageAlerts(tenantId);
      return reply.send(alerts);
    } catch (error) {
      request.log.error(error, 'Failed to fetch usage alerts');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch usage alerts',
      });
    }
  });

  // Create usage alert
  fastify.post('/usage/alerts', {
    schema: {
      body: z.object({
        resourceType: z.enum(['messages', 'tokens', 'tools', 'storage', 'api_calls']),
        type: z.enum(['threshold', 'spike', 'trend']),
        threshold: z.number().positive(),
        notificationChannels: z.array(z.enum(['email', 'webhook', 'slack'])).default(['email']),
        conditions: z.record(z.unknown()).optional(),
      }),
      response: {
        201: z.object({
          id: z.string(),
          resourceType: z.string(),
          type: z.string(),
          threshold: z.number(),
          isEnabled: z.boolean(),
          notificationChannels: z.array(z.string()),
          conditions: z.record(z.unknown()),
          createdAt: z.string(),
          updatedAt: z.string(),
        }),
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Usage'],
      summary: 'Create usage alert',
      description: 'Create a new usage alert for tenant',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation, fastify.requireTenantAdmin, fastify.rateLimiting],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user;
    const body = z.object({
      resourceType: z.enum(['messages', 'tokens', 'tools', 'storage', 'api_calls']),
      type: z.enum(['threshold', 'spike', 'trend']),
      threshold: z.number().positive(),
      notificationChannels: z.array(z.enum(['email', 'webhook', 'slack'])).default(['email']),
      conditions: z.record(z.unknown()).optional(),
    }).parse(request.body);
    
    try {
      const alert = await usageService.createUsageAlert(tenantId, body);
      return reply.code(201).send(alert);
    } catch (error) {
      request.log.error(error, 'Failed to create usage alert');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create usage alert',
      });
    }
  });
}