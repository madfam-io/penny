import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { SubscriptionService } from '../services/SubscriptionService';
import { PaginationSchema, ErrorResponseSchema, MetadataSchema } from '../schemas/common';

// Request/Response Schemas
const CreateSubscriptionSchema = z.object({
  planId: z.string(),
  billingCycle: z.enum(['monthly', 'yearly']).default('monthly'),
  couponCode: z.string().optional(),
  paymentMethodId: z.string().optional(),
  trialDays: z.number().int().min(0).max(365).optional(),
});

const UpdateSubscriptionSchema = z.object({
  planId: z.string().optional(),
  billingCycle: z.enum(['monthly', 'yearly']).optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
  couponCode: z.string().optional(),
});

const SubscriptionResponseSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  planId: z.string(),
  status: z.string(),
  currentPeriodStart: z.string(),
  currentPeriodEnd: z.string(),
  cancelAtPeriodEnd: z.boolean(),
  canceledAt: z.string().nullable(),
  trialStart: z.string().nullable(),
  trialEnd: z.string().nullable(),
  billingCycle: z.string(),
  pricePerMonth: z.number(),
  currency: z.string(),
  limits: z.record(z.unknown()),
  metadata: z.record(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
  plan: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    features: z.array(z.string()),
    limits: z.record(z.number()),
    pricing: z.object({
      monthly: z.number(),
      yearly: z.number(),
    }),
  }).optional(),
  usage: z.object({
    current: z.record(z.number()),
    limits: z.record(z.number()),
    percentage: z.record(z.number()),
  }).optional(),
});

const InvoiceResponseSchema = z.object({
  id: z.string(),
  subscriptionId: z.string(),
  tenantId: z.string(),
  number: z.string(),
  status: z.string(),
  total: z.number(),
  subtotal: z.number(),
  tax: z.number(),
  currency: z.string(),
  dueDate: z.string(),
  paidAt: z.string().nullable(),
  voidedAt: z.string().nullable(),
  hostedInvoiceUrl: z.string().nullable(),
  invoicePdf: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lineItems: z.array(z.object({
    id: z.string(),
    description: z.string(),
    quantity: z.number(),
    unitPrice: z.number(),
    total: z.number(),
  })).optional(),
});

const PlanResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  features: z.array(z.string()),
  limits: z.record(z.number()),
  pricing: z.object({
    monthly: z.number(),
    yearly: z.number(),
  }),
  isActive: z.boolean(),
  isPopular: z.boolean(),
  metadata: z.record(z.unknown()),
});

const PaymentMethodSchema = z.object({
  id: z.string(),
  type: z.string(),
  last4: z.string(),
  brand: z.string(),
  expiryMonth: z.number(),
  expiryYear: z.number(),
  isDefault: z.boolean(),
  createdAt: z.string(),
});

export async function subscriptionRoutes(fastify: FastifyInstance) {
  const subscriptionService = new SubscriptionService();

  // Get available plans\n  fastify.get('/billing/plans', {
    schema: {
      response: {
        200: z.array(PlanResponseSchema),
        500: ErrorResponseSchema,
      },
      tags: ['Subscriptions'],
      summary: 'Get available plans',
      description: 'Get all available subscription plans',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const plans = await subscriptionService.getAvailablePlans();
      return reply.send(plans);
    } catch (error) {
      request.log.error(error, 'Failed to fetch plans');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch plans',
      });
    }
  });

  // Get current subscription\n  fastify.get('/billing/subscription', {
    schema: {
      response: {
        200: SubscriptionResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Subscriptions'],
      summary: 'Get current subscription',
      description: 'Get current tenant subscription with usage',
    },
    preHandler: [fastify.authenticate, fastify.requireTenantAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user;
    const includeUsage = request.query?.include?.includes('usage');
    
    try {
      const subscription = await subscriptionService.getCurrentSubscription(tenantId, {
        includeUsage,
      });
      
      if (!subscription) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'No active subscription found',
        });
      }
      
      return reply.send(subscription);
    } catch (error) {
      request.log.error(error, 'Failed to fetch subscription');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch subscription',
      });
    }
  });

  // Create subscription\n  fastify.post('/billing/subscription', {
    schema: {
      body: CreateSubscriptionSchema,
      response: {
        201: SubscriptionResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        402: ErrorResponseSchema,
        409: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Subscriptions'],
      summary: 'Create subscription',
      description: 'Create a new subscription for tenant',
    },
    preHandler: [fastify.authenticate, fastify.requireTenantAdmin, fastify.rateLimiting],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user;
    const body = CreateSubscriptionSchema.parse(request.body);
    
    try {
      const subscription = await subscriptionService.createSubscription({
        tenantId,
        ...body,
      });
      
      return reply.code(201).send(subscription);
    } catch (error) {
      if (error.code === 'SUBSCRIPTION_EXISTS') {
        return reply.code(409).send({
          error: 'Conflict',
          message: 'Tenant already has an active subscription',
        });
      }
      
      if (error.code === 'PAYMENT_FAILED') {
        return reply.code(402).send({
          error: 'Payment Required',
          message: error.message || 'Payment failed',
        });
      }
      
      if (error.code === 'INVALID_PLAN') {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Invalid or inactive plan',
        });
      }
      
      request.log.error(error, 'Failed to create subscription');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create subscription',
      });
    }
  });

  // Update subscription\n  fastify.put('/billing/subscription', {
    schema: {
      body: UpdateSubscriptionSchema,
      response: {
        200: SubscriptionResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        402: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Subscriptions'],
      summary: 'Update subscription',
      description: 'Update current subscription (plan change, billing cycle, etc.)',
    },
    preHandler: [fastify.authenticate, fastify.requireTenantAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user;
    const body = UpdateSubscriptionSchema.parse(request.body);
    
    try {
      const subscription = await subscriptionService.updateSubscription(tenantId, body);
      
      if (!subscription) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'No active subscription found',
        });
      }
      
      return reply.send(subscription);
    } catch (error) {
      if (error.code === 'PAYMENT_FAILED') {
        return reply.code(402).send({
          error: 'Payment Required',
          message: error.message || 'Payment failed for plan change',
        });
      }
      
      if (error.code === 'INVALID_PLAN') {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Invalid or inactive plan',
        });
      }
      
      request.log.error(error, 'Failed to update subscription');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update subscription',
      });
    }
  });

  // Cancel subscription\n  fastify.post('/billing/subscription/cancel', {
    schema: {
      body: z.object({
        immediately: z.boolean().default(false),
        reason: z.string().max(500).optional(),
      }),
      response: {
        200: SubscriptionResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Subscriptions'],
      summary: 'Cancel subscription',
      description: 'Cancel current subscription',
    },
    preHandler: [fastify.authenticate, fastify.requireTenantAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user;
    const { immediately, reason } = z.object({
      immediately: z.boolean().default(false),
      reason: z.string().max(500).optional(),
    }).parse(request.body);
    
    try {
      const subscription = await subscriptionService.cancelSubscription(tenantId, {
        immediately,
        reason,
      });
      
      if (!subscription) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'No active subscription found',
        });
      }
      
      return reply.send(subscription);
    } catch (error) {
      request.log.error(error, 'Failed to cancel subscription');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to cancel subscription',
      });
    }
  });

  // Reactivate subscription\n  fastify.post('/billing/subscription/reactivate', {
    schema: {
      response: {
        200: SubscriptionResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Subscriptions'],
      summary: 'Reactivate subscription',
      description: 'Reactivate a canceled subscription',
    },
    preHandler: [fastify.authenticate, fastify.requireTenantAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user;
    
    try {
      const subscription = await subscriptionService.reactivateSubscription(tenantId);
      
      if (!subscription) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'No subscription found to reactivate',
        });
      }
      
      return reply.send(subscription);
    } catch (error) {
      if (error.code === 'CANNOT_REACTIVATE') {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Subscription cannot be reactivated',
        });
      }
      
      request.log.error(error, 'Failed to reactivate subscription');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to reactivate subscription',
      });
    }
  });

  // Get invoices\n  fastify.get('/billing/invoices', {
    schema: {
      querystring: z.object({
        status: z.enum(['draft', 'open', 'paid', 'void', 'uncollectible']).optional(),
        limit: z.number().int().positive().max(100).default(20),
        offset: z.number().int().min(0).default(0),
      }),
      response: {
        200: z.object({
          data: z.array(InvoiceResponseSchema),
          pagination: PaginationSchema,
        }),
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Subscriptions'],
      summary: 'Get invoices',
      description: 'Get tenant invoices with pagination',
    },
    preHandler: [fastify.authenticate, fastify.requireTenantAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user;
    const query = z.object({
      status: z.enum(['draft', 'open', 'paid', 'void', 'uncollectible']).optional(),
      limit: z.number().int().positive().max(100).default(20),
      offset: z.number().int().min(0).default(0),
    }).parse(request.query);
    
    try {
      const result = await subscriptionService.getInvoices(tenantId, query);
      return reply.send(result);
    } catch (error) {
      request.log.error(error, 'Failed to fetch invoices');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch invoices',
      });
    }
  });

  // Get single invoice\n  fastify.get('/billing/invoices/:id', {
    schema: {
      params: z.object({
        id: z.string(),
      }),
      response: {
        200: InvoiceResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Subscriptions'],
      summary: 'Get invoice',
      description: 'Get specific invoice with line items',
    },
    preHandler: [fastify.authenticate, fastify.requireTenantAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user;
    const { id } = z.object({ id: z.string() }).parse(request.params);
    
    try {
      const invoice = await subscriptionService.getInvoice(id, { tenantId });
      
      if (!invoice) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Invoice not found',
        });
      }
      
      return reply.send(invoice);
    } catch (error) {
      request.log.error(error, 'Failed to fetch invoice');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch invoice',
      });
    }
  });

  // Get payment methods\n  fastify.get('/billing/payment-methods', {
    schema: {
      response: {
        200: z.array(PaymentMethodSchema),
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Subscriptions'],
      summary: 'Get payment methods',
      description: 'Get saved payment methods for tenant',
    },
    preHandler: [fastify.authenticate, fastify.requireTenantAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user;
    
    try {
      const paymentMethods = await subscriptionService.getPaymentMethods(tenantId);
      return reply.send(paymentMethods);
    } catch (error) {
      request.log.error(error, 'Failed to fetch payment methods');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch payment methods',
      });
    }
  });

  // Add payment method\n  fastify.post('/billing/payment-methods', {
    schema: {
      body: z.object({
        paymentMethodId: z.string(), // From Stripe
        setAsDefault: z.boolean().default(false),
      }),
      response: {
        201: PaymentMethodSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        402: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Subscriptions'],
      summary: 'Add payment method',
      description: 'Add new payment method to tenant',
    },
    preHandler: [fastify.authenticate, fastify.requireTenantAdmin, fastify.rateLimiting],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user;
    const { paymentMethodId, setAsDefault } = z.object({
      paymentMethodId: z.string(),
      setAsDefault: z.boolean().default(false),
    }).parse(request.body);
    
    try {
      const paymentMethod = await subscriptionService.addPaymentMethod(tenantId, {
        paymentMethodId,
        setAsDefault,
      });
      
      return reply.code(201).send(paymentMethod);
    } catch (error) {
      if (error.code === 'INVALID_PAYMENT_METHOD') {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Invalid payment method',
        });
      }
      
      if (error.code === 'PAYMENT_METHOD_FAILED') {
        return reply.code(402).send({
          error: 'Payment Required',
          message: 'Failed to attach payment method',
        });
      }
      
      request.log.error(error, 'Failed to add payment method');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to add payment method',
      });
    }
  });

  // Delete payment method\n  fastify.delete('/billing/payment-methods/:id', {
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
      tags: ['Subscriptions'],
      summary: 'Delete payment method',
      description: 'Remove payment method from tenant',
    },
    preHandler: [fastify.authenticate, fastify.requireTenantAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user;
    const { id } = z.object({ id: z.string() }).parse(request.params);
    
    try {
      const deleted = await subscriptionService.deletePaymentMethod(tenantId, id);
      
      if (!deleted) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Payment method not found',
        });
      }
      
      return reply.code(204).send();
    } catch (error) {
      request.log.error(error, 'Failed to delete payment method');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to delete payment method',
      });
    }
  });

  // Set default payment method\n  fastify.put('/billing/payment-methods/:id/default', {
    schema: {
      params: z.object({
        id: z.string(),
      }),
      response: {
        200: PaymentMethodSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Subscriptions'],
      summary: 'Set default payment method',
      description: 'Set payment method as default for tenant',
    },
    preHandler: [fastify.authenticate, fastify.requireTenantAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user;
    const { id } = z.object({ id: z.string() }).parse(request.params);
    
    try {
      const paymentMethod = await subscriptionService.setDefaultPaymentMethod(tenantId, id);
      
      if (!paymentMethod) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Payment method not found',
        });
      }
      
      return reply.send(paymentMethod);
    } catch (error) {
      request.log.error(error, 'Failed to set default payment method');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to set default payment method',
      });
    }
  });

  // Get subscription usage\n  fastify.get('/billing/usage', {
    schema: {
      querystring: z.object({
        period: z.enum(['current', 'previous', '7d', '30d']).default('current'),
        granularity: z.enum(['day', 'week', 'month']).default('day'),
      }),
      response: {
        200: z.object({
          current: z.record(z.number()),
          limits: z.record(z.number()),
          usage: z.array(z.object({
            metric: z.string(),
            current: z.number(),
            limit: z.number(),
            percentage: z.number(),
          })),
          history: z.array(z.object({
            date: z.string(),
            metrics: z.record(z.number()),
          })),
          billing: z.object({
            cycleStart: z.string(),
            cycleEnd: z.string(),
            estimatedCost: z.number(),
          }),
        }),
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Subscriptions'],
      summary: 'Get usage metrics',
      description: 'Get detailed usage metrics for billing period',
    },
    preHandler: [fastify.authenticate, fastify.requireTenantAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user;
    const { period, granularity } = z.object({
      period: z.enum(['current', 'previous', '7d', '30d']).default('current'),
      granularity: z.enum(['day', 'week', 'month']).default('day'),
    }).parse(request.query);
    
    try {
      const usage = await subscriptionService.getUsageMetrics(tenantId, {
        period,
        granularity,
      });
      
      return reply.send(usage);
    } catch (error) {
      request.log.error(error, 'Failed to fetch usage metrics');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch usage metrics',
      });
    }
  });
}