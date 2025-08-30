import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { WebhookService } from '../services/WebhookService';
import { PaginationSchema, ErrorResponseSchema, MetadataSchema } from '../schemas/common';

// Request/Response Schemas
const CreateWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  secret: z.string().min(16).optional(),
  maxRetries: z.number().int().min(0).max(10).default(3),
  retryInterval: z.number().int().min(100).max(60000).default(1000),
  metadata: MetadataSchema,
});

const UpdateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.string()).min(1).optional(),
  secret: z.string().min(16).optional(),
  isActive: z.boolean().optional(),
  maxRetries: z.number().int().min(0).max(10).optional(),
  retryInterval: z.number().int().min(100).max(60000).optional(),
  metadata: MetadataSchema.optional(),
});

const WebhookQuerySchema = z.object({
  isActive: z.boolean().optional(),
  event: z.string().optional(),
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().min(0).default(0),
  sortBy: z.enum(['createdAt', 'updatedAt', 'lastTriggeredAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

const WebhookResponseSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  url: z.string(),
  events: z.array(z.string()),
  isActive: z.boolean(),
  maxRetries: z.number(),
  retryInterval: z.number(),
  lastTriggeredAt: z.string().nullable(),
  metadata: z.record(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
  stats: z.object({
    totalDeliveries: z.number(),
    successfulDeliveries: z.number(),
    failedDeliveries: z.number(),
    averageResponseTime: z.number(),
    lastDeliveryStatus: z.string().nullable(),
  }).optional(),
});

const WebhookDeliveryQuerySchema = z.object({
  webhookId: z.string().optional(),
  event: z.string().optional(),
  status: z.enum(['pending', 'delivered', 'failed']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

const WebhookDeliveryResponseSchema = z.object({
  id: z.string(),
  webhookId: z.string(),
  event: z.string(),
  status: z.string(),
  httpStatus: z.number().nullable(),
  response: z.string().nullable(),
  error: z.string().nullable(),
  attempt: z.number(),
  nextRetryAt: z.string().nullable(),
  deliveredAt: z.string().nullable(),
  createdAt: z.string(),
  webhook: z.object({
    id: z.string(),
    url: z.string(),
  }).optional(),
  payload: z.record(z.unknown()).optional(),
  headers: z.record(z.string()).optional(),
});

const TestWebhookSchema = z.object({
  event: z.string().default('ping'),
  payload: z.record(z.unknown()).optional(),
});

const AvailableEventsSchema = z.array(z.object({
  name: z.string(),
  description: z.string(),
  category: z.string(),
  schema: z.record(z.unknown()).optional(),
  examples: z.array(z.record(z.unknown())).optional(),
}));

export async function webhookRoutes(fastify: FastifyInstance) {
  const webhookService = new WebhookService();

  // Get available webhook events\n  fastify.get('/webhooks/events', {
    schema: {
      response: {
        200: AvailableEventsSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Webhooks'],
      summary: 'Get available events',
      description: 'Get list of all available webhook events',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const events = await webhookService.getAvailableEvents();
      return reply.send(events);
    } catch (error) {
      request.log.error(error, 'Failed to fetch available events');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch available events',
      });
    }
  });

  // Get webhooks for tenant\n  fastify.get('/webhooks', {
    schema: {
      querystring: WebhookQuerySchema,
      response: {
        200: z.object({
          data: z.array(WebhookResponseSchema),
          pagination: PaginationSchema,
        }),
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Webhooks'],
      summary: 'List webhooks',
      description: 'Get paginated list of webhooks for tenant',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation, fastify.requireTenantAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user;
    const query = WebhookQuerySchema.parse(request.query);
    
    try {
      const result = await webhookService.getWebhooks({
        tenantId,
        ...query,
      });
      
      return reply.send(result);
    } catch (error) {
      request.log.error(error, 'Failed to fetch webhooks');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch webhooks',
      });
    }
  });

  // Get single webhook\n  fastify.get('/webhooks/:id', {
    schema: {
      params: z.object({
        id: z.string(),
      }),
      response: {
        200: WebhookResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Webhooks'],
      summary: 'Get webhook',
      description: 'Get specific webhook with optional statistics',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation, fastify.requireTenantAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user;
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const includeStats = request.query?.include?.includes('stats');
    
    try {
      const webhook = await webhookService.getWebhook(id, {
        tenantId,
        includeStats,
      });
      
      if (!webhook) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Webhook not found',
        });
      }
      
      return reply.send(webhook);
    } catch (error) {
      request.log.error(error, 'Failed to fetch webhook');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch webhook',
      });
    }
  });

  // Create webhook\n  fastify.post('/webhooks', {
    schema: {
      body: CreateWebhookSchema,
      response: {
        201: WebhookResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Webhooks'],
      summary: 'Create webhook',
      description: 'Create a new webhook endpoint',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation, fastify.requireTenantAdmin, fastify.rateLimiting],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user;
    const body = CreateWebhookSchema.parse(request.body);
    
    try {
      const webhook = await webhookService.createWebhook({
        tenantId,
        ...body,
      });
      
      return reply.code(201).send(webhook);
    } catch (error) {
      if (error.code === 'INVALID_EVENTS') {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'One or more events are invalid',
        });
      }
      
      if (error.code === 'URL_UNREACHABLE') {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Webhook URL is not reachable',
        });
      }
      
      request.log.error(error, 'Failed to create webhook');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create webhook',
      });
    }
  });

  // Update webhook\n  fastify.put('/webhooks/:id', {
    schema: {
      params: z.object({
        id: z.string(),
      }),
      body: UpdateWebhookSchema,
      response: {
        200: WebhookResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Webhooks'],
      summary: 'Update webhook',
      description: 'Update an existing webhook',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation, fastify.requireTenantAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user;
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = UpdateWebhookSchema.parse(request.body);
    
    try {
      const webhook = await webhookService.updateWebhook(id, {
        tenantId,
        ...body,
      });
      
      if (!webhook) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Webhook not found',
        });
      }
      
      return reply.send(webhook);
    } catch (error) {
      if (error.code === 'INVALID_EVENTS') {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'One or more events are invalid',
        });
      }
      
      if (error.code === 'URL_UNREACHABLE') {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Webhook URL is not reachable',
        });
      }
      
      request.log.error(error, 'Failed to update webhook');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update webhook',
      });
    }
  });

  // Delete webhook\n  fastify.delete('/webhooks/:id', {
    schema: {
      params: z.object({
        id: z.string(),
      }),
      response: {
        204: z.null(),
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Webhooks'],
      summary: 'Delete webhook',
      description: 'Delete a webhook endpoint',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation, fastify.requireTenantAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user;
    const { id } = z.object({ id: z.string() }).parse(request.params);
    
    try {
      const deleted = await webhookService.deleteWebhook(id, { tenantId });
      
      if (!deleted) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Webhook not found',
        });
      }
      
      return reply.code(204).send();
    } catch (error) {
      request.log.error(error, 'Failed to delete webhook');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to delete webhook',
      });
    }
  });

  // Test webhook\n  fastify.post('/webhooks/:id/test', {
    schema: {
      params: z.object({
        id: z.string(),
      }),
      body: TestWebhookSchema,
      response: {
        200: z.object({
          success: z.boolean(),
          deliveryId: z.string(),
          httpStatus: z.number().optional(),
          response: z.string().optional(),
          error: z.string().optional(),
        }),
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Webhooks'],
      summary: 'Test webhook',
      description: 'Send a test event to webhook endpoint',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation, fastify.requireTenantAdmin, fastify.rateLimiting],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user;
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const { event, payload } = TestWebhookSchema.parse(request.body);
    
    try {
      const result = await webhookService.testWebhook(id, {
        tenantId,
        event,
        payload,
      });
      
      if (!result) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Webhook not found',
        });
      }
      
      return reply.send(result);
    } catch (error) {
      request.log.error(error, 'Failed to test webhook');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to test webhook',
      });
    }
  });

  // Get webhook deliveries\n  fastify.get('/webhooks/deliveries', {
    schema: {
      querystring: WebhookDeliveryQuerySchema,
      response: {
        200: z.object({
          data: z.array(WebhookDeliveryResponseSchema),
          pagination: PaginationSchema,
        }),
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Webhooks'],
      summary: 'List webhook deliveries',
      description: 'Get paginated list of webhook deliveries',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation, fastify.requireTenantAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user;
    const query = WebhookDeliveryQuerySchema.parse(request.query);
    
    try {
      const result = await webhookService.getDeliveries({
        tenantId,
        ...query,
      });
      
      return reply.send(result);
    } catch (error) {
      request.log.error(error, 'Failed to fetch webhook deliveries');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch webhook deliveries',
      });
    }
  });

  // Get single webhook delivery\n  fastify.get('/webhooks/deliveries/:id', {
    schema: {
      params: z.object({
        id: z.string(),
      }),
      response: {
        200: WebhookDeliveryResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Webhooks'],
      summary: 'Get webhook delivery',
      description: 'Get specific webhook delivery with full details',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation, fastify.requireTenantAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user;
    const { id } = z.object({ id: z.string() }).parse(request.params);
    
    try {
      const delivery = await webhookService.getDelivery(id, {
        tenantId,
        includePayload: true,
        includeHeaders: true,
      });
      
      if (!delivery) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Webhook delivery not found',
        });
      }
      
      return reply.send(delivery);
    } catch (error) {
      request.log.error(error, 'Failed to fetch webhook delivery');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch webhook delivery',
      });
    }
  });

  // Retry webhook delivery\n  fastify.post('/webhooks/deliveries/:id/retry', {
    schema: {
      params: z.object({
        id: z.string(),
      }),
      response: {
        200: z.object({
          success: z.boolean(),
          newDeliveryId: z.string().optional(),
          httpStatus: z.number().optional(),
          error: z.string().optional(),
        }),
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        409: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Webhooks'],
      summary: 'Retry webhook delivery',
      description: 'Manually retry a failed webhook delivery',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation, fastify.requireTenantAdmin, fastify.rateLimiting],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user;
    const { id } = z.object({ id: z.string() }).parse(request.params);
    
    try {
      const result = await webhookService.retryDelivery(id, { tenantId });
      
      if (!result) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Webhook delivery not found',
        });
      }
      
      return reply.send(result);
    } catch (error) {
      if (error.code === 'CANNOT_RETRY') {
        return reply.code(409).send({
          error: 'Conflict',
          message: 'Delivery cannot be retried',
        });
      }
      
      request.log.error(error, 'Failed to retry webhook delivery');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retry webhook delivery',
      });
    }
  });

  // Get webhook statistics\n  fastify.get('/webhooks/:id/stats', {
    schema: {
      params: z.object({
        id: z.string(),
      }),
      querystring: z.object({
        period: z.enum(['24h', '7d', '30d', '90d']).default('30d'),
      }),
      response: {
        200: z.object({
          totalDeliveries: z.number(),
          successfulDeliveries: z.number(),
          failedDeliveries: z.number(),
          successRate: z.number(),
          averageResponseTime: z.number(),
          medianResponseTime: z.number(),
          errorsByType: z.record(z.number()),
          deliveriesByDay: z.array(z.object({
            date: z.string(),
            total: z.number(),
            successful: z.number(),
            failed: z.number(),
          })),
          responseTimePercentiles: z.object({
            p50: z.number(),
            p90: z.number(),
            p95: z.number(),
            p99: z.number(),
          }),
        }),
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Webhooks'],
      summary: 'Get webhook statistics',
      description: 'Get detailed statistics for webhook',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation, fastify.requireTenantAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user;
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const { period } = z.object({
      period: z.enum(['24h', '7d', '30d', '90d']).default('30d'),
    }).parse(request.query);
    
    try {
      const stats = await webhookService.getWebhookStats(id, {
        tenantId,
        period,
      });
      
      if (!stats) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Webhook not found',
        });
      }
      
      return reply.send(stats);
    } catch (error) {
      request.log.error(error, 'Failed to fetch webhook statistics');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch webhook statistics',
      });
    }
  });

  // Validate webhook signature (for external webhook providers)
  fastify.post('/webhooks/validate', {
    schema: {
      body: z.object({
        payload: z.string(),
        signature: z.string(),
        secret: z.string(),
        algorithm: z.enum(['sha256', 'sha1']).default('sha256'),
      }),
      response: {
        200: z.object({
          valid: z.boolean(),
        }),
        400: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Webhooks'],
      summary: 'Validate webhook signature',
      description: 'Validate webhook payload signature',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { payload, signature, secret, algorithm } = z.object({
      payload: z.string(),
      signature: z.string(),
      secret: z.string(),
      algorithm: z.enum(['sha256', 'sha1']).default('sha256'),
    }).parse(request.body);
    
    try {
      const valid = await webhookService.validateSignature({
        payload,
        signature,
        secret,
        algorithm,
      });
      
      return reply.send({ valid });
    } catch (error) {
      request.log.error(error, 'Failed to validate webhook signature');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to validate webhook signature',
      });
    }
  });
}