import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { 
  BillingService, 
  CreateSubscriptionRequest, 
  UpdateSubscriptionRequest,
  CreatePaymentMethodRequest,
  RecordUsageRequest
} from '@penny/billing';

// Request schemas
const CreateSubscriptionSchema = z.object({
  plan_id: z.string(),
  billing_interval: z.enum(['month', 'year']),
  payment_method_id: z.string().optional(),
  coupon_code: z.string().optional(),
  trial_days: z.number().optional()
});

const UpdateSubscriptionSchema = z.object({
  plan_id: z.string().optional(),
  billing_interval: z.enum(['month', 'year']).optional(),
  quantity: z.number().positive().optional(),
  prorate: z.boolean().default(true)
});

const AddPaymentMethodSchema = z.object({
  stripe_payment_method_id: z.string(),
  set_as_default: z.boolean().default(false)
});

const RecordUsageSchema = z.object({
  usage_type: z.enum(['messages', 'tokens', 'storage', 'users', 'api_calls', 'tools', 'artifacts']),
  quantity: z.number().positive(),
  timestamp: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.any()).optional()
});

export default async function billingRoutes(fastify: FastifyInstance) {
  // Middleware to get billing service
  const getBillingService = (): BillingService => {
    // This would be injected via dependency injection in real implementation
    return fastify.billingService as BillingService;
  };

  // Get current subscription
  fastify.get('/subscription', {
    preHandler: fastify.authenticate,
    schema: {
      description: 'Get current subscription for authenticated user',
      tags: ['billing'],
      response: {
        200: {
          type: 'object',
          properties: {
            subscription: { type: 'object' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = request.user.tenant_id;
      const subscription = await getBillingService().getTenantSubscription(tenantId);
      
      return { subscription };
    } catch (error) {
      request.log.error('Failed to get subscription:', error);
      reply.code(500).send({ error: 'Failed to get subscription' });
    }
  });

  // Create subscription
  fastify.post('/subscription', {
    preHandler: fastify.authenticate,
    schema: {
      description: 'Create new subscription',
      tags: ['billing'],
      body: CreateSubscriptionSchema,
      response: {
        201: {
          type: 'object',
          properties: {
            subscription: { type: 'object' },
            setup_intent: { type: 'object' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: CreateSubscriptionRequest }>, reply: FastifyReply) => {
    try {
      const tenantId = request.user.tenant_id;
      const result = await getBillingService().createSubscription(tenantId, request.body);
      
      reply.code(201).send(result);
    } catch (error) {
      request.log.error('Failed to create subscription:', error);
      reply.code(500).send({ error: 'Failed to create subscription' });
    }
  });

  // Update subscription
  fastify.put('/subscription/:subscriptionId', {
    preHandler: fastify.authenticate,
    schema: {
      description: 'Update existing subscription',
      tags: ['billing'],
      params: {
        type: 'object',
        properties: {
          subscriptionId: { type: 'string' }
        },
        required: ['subscriptionId']
      },
      body: UpdateSubscriptionSchema
    }
  }, async (request: FastifyRequest<{ 
    Params: { subscriptionId: string };
    Body: UpdateSubscriptionRequest;
  }>, reply: FastifyReply) => {
    try {
      const { subscriptionId } = request.params;
      const subscription = await getBillingService().updateSubscription(subscriptionId, request.body);
      
      return { subscription };
    } catch (error) {
      request.log.error('Failed to update subscription:', error);
      reply.code(500).send({ error: 'Failed to update subscription' });
    }
  });

  // Cancel subscription
  fastify.post('/subscription/:subscriptionId/cancel', {
    preHandler: fastify.authenticate,
    schema: {
      description: 'Cancel subscription',
      tags: ['billing'],
      params: {
        type: 'object',
        properties: {
          subscriptionId: { type: 'string' }
        },
        required: ['subscriptionId']
      },
      body: {
        type: 'object',
        properties: {
          immediately: { type: 'boolean', default: false }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { subscriptionId: string };
    Body: { immediately?: boolean };
  }>, reply: FastifyReply) => {
    try {
      const { subscriptionId } = request.params;
      const { immediately = false } = request.body;
      
      const subscription = await getBillingService().cancelSubscription(subscriptionId, immediately);
      
      return { subscription };
    } catch (error) {
      request.log.error('Failed to cancel subscription:', error);
      reply.code(500).send({ error: 'Failed to cancel subscription' });
    }
  });

  // Get available plans
  fastify.get('/plans', {
    preHandler: fastify.authenticate,
    schema: {
      description: 'Get available subscription plans',
      tags: ['billing'],
      response: {
        200: {
          type: 'object',
          properties: {
            plans: { type: 'array' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const plans = getBillingService().getPlans();
      return { plans };
    } catch (error) {
      request.log.error('Failed to get plans:', error);
      reply.code(500).send({ error: 'Failed to get plans' });
    }
  });

  // Payment Methods
  fastify.get('/payment-methods', {
    preHandler: fastify.authenticate,
    schema: {
      description: 'Get payment methods for user',
      tags: ['billing'],
      response: {
        200: {
          type: 'object',
          properties: {
            payment_methods: { type: 'array' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = request.user.tenant_id;
      const paymentMethods = await getBillingService().getPaymentMethods(tenantId);
      
      return { payment_methods: paymentMethods };
    } catch (error) {
      request.log.error('Failed to get payment methods:', error);
      reply.code(500).send({ error: 'Failed to get payment methods' });
    }
  });

  fastify.post('/payment-methods', {
    preHandler: fastify.authenticate,
    schema: {
      description: 'Add new payment method',
      tags: ['billing'],
      body: AddPaymentMethodSchema,
      response: {
        201: {
          type: 'object',
          properties: {
            payment_method: { type: 'object' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: CreatePaymentMethodRequest }>, reply: FastifyReply) => {
    try {
      const tenantId = request.user.tenant_id;
      const paymentMethod = await getBillingService().addPaymentMethod(tenantId, request.body);
      
      reply.code(201).send({ payment_method: paymentMethod });
    } catch (error) {
      request.log.error('Failed to add payment method:', error);
      reply.code(500).send({ error: 'Failed to add payment method' });
    }
  });

  fastify.delete('/payment-methods/:paymentMethodId', {
    preHandler: fastify.authenticate,
    schema: {
      description: 'Remove payment method',
      tags: ['billing'],
      params: {
        type: 'object',
        properties: {
          paymentMethodId: { type: 'string' }
        },
        required: ['paymentMethodId']
      }
    }
  }, async (request: FastifyRequest<{ Params: { paymentMethodId: string } }>, reply: FastifyReply) => {
    try {
      const { paymentMethodId } = request.params;
      await getBillingService().removePaymentMethod(paymentMethodId);
      
      reply.code(204).send();
    } catch (error) {
      request.log.error('Failed to remove payment method:', error);
      reply.code(500).send({ error: 'Failed to remove payment method' });
    }
  });

  // Usage Tracking
  fastify.post('/usage', {
    preHandler: fastify.authenticate,
    schema: {
      description: 'Record usage for current tenant',
      tags: ['billing'],
      body: RecordUsageSchema,
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            usage_record: { type: 'object' },
            limit_exceeded: { type: 'boolean' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: RecordUsageRequest }>, reply: FastifyReply) => {
    try {
      const tenantId = request.user.tenant_id;
      const result = await getBillingService().recordUsage(tenantId, request.body);
      
      reply.code(201).send(result);
    } catch (error) {
      request.log.error('Failed to record usage:', error);
      reply.code(500).send({ error: 'Failed to record usage' });
    }
  });

  fastify.get('/usage/summary', {
    preHandler: fastify.authenticate,
    schema: {
      description: 'Get usage summary for current tenant',
      tags: ['billing'],
      querystring: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['hour', 'day', 'month'] }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Querystring: { period?: 'hour' | 'day' | 'month' } 
  }>, reply: FastifyReply) => {
    try {
      const tenantId = request.user.tenant_id;
      const { period = 'month' } = request.query;
      
      const usage = await getBillingService().getCurrentUsage(tenantId, undefined, period);
      
      return { usage };
    } catch (error) {
      request.log.error('Failed to get usage summary:', error);
      reply.code(500).send({ error: 'Failed to get usage summary' });
    }
  });

  // Validate usage before allowing operation
  fastify.post('/usage/validate', {
    preHandler: fastify.authenticate,
    schema: {
      description: 'Validate if usage is allowed',
      tags: ['billing'],
      body: {
        type: 'object',
        properties: {
          usage_type: { type: 'string' },
          quantity: { type: 'number' }
        },
        required: ['usage_type', 'quantity']
      }
    }
  }, async (request: FastifyRequest<{ 
    Body: { usage_type: string; quantity: number } 
  }>, reply: FastifyReply) => {
    try {
      const tenantId = request.user.tenant_id;
      const { usage_type, quantity } = request.body;
      
      const validation = await getBillingService().validateUsage(tenantId, usage_type as any, quantity);
      
      return { validation };
    } catch (error) {
      request.log.error('Failed to validate usage:', error);
      reply.code(500).send({ error: 'Failed to validate usage' });
    }
  });

  // Invoices
  fastify.get('/invoices', {
    preHandler: fastify.authenticate,
    schema: {
      description: 'Get invoices for current tenant',
      tags: ['billing'],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          limit: { type: 'number', default: 50 },
          offset: { type: 'number', default: 0 }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Querystring: { status?: string; limit?: number; offset?: number } 
  }>, reply: FastifyReply) => {
    try {
      const tenantId = request.user.tenant_id;
      const { status, limit = 50, offset = 0 } = request.query;
      
      const result = await getBillingService().getTenantInvoices(tenantId, limit, offset, status);
      
      return result;
    } catch (error) {
      request.log.error('Failed to get invoices:', error);
      reply.code(500).send({ error: 'Failed to get invoices' });
    }
  });

  fastify.get('/invoices/:invoiceId', {
    preHandler: fastify.authenticate,
    schema: {
      description: 'Get specific invoice details',
      tags: ['billing'],
      params: {
        type: 'object',
        properties: {
          invoiceId: { type: 'string' }
        },
        required: ['invoiceId']
      }
    }
  }, async (request: FastifyRequest<{ Params: { invoiceId: string } }>, reply: FastifyReply) => {
    try {
      const { invoiceId } = request.params;
      const result = await getBillingService().getInvoice(invoiceId);
      
      return result;
    } catch (error) {
      request.log.error('Failed to get invoice:', error);
      reply.code(500).send({ error: 'Failed to get invoice' });
    }
  });

  // Generate upcoming invoice preview
  fastify.get('/invoices/preview/upcoming', {
    preHandler: fastify.authenticate,
    schema: {
      description: 'Preview upcoming invoice',
      tags: ['billing']
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = request.user.tenant_id;
      const subscription = await getBillingService().getTenantSubscription(tenantId);
      
      if (!subscription) {
        return reply.code(404).send({ error: 'No subscription found' });
      }
      
      const preview = await getBillingService().generateInvoice(subscription.id);
      
      return { preview };
    } catch (error) {
      request.log.error('Failed to generate invoice preview:', error);
      reply.code(500).send({ error: 'Failed to generate invoice preview' });
    }
  });

  // Feature access check
  fastify.get('/features/:feature/access', {
    preHandler: fastify.authenticate,
    schema: {
      description: 'Check if tenant can access a feature',
      tags: ['billing'],
      params: {
        type: 'object',
        properties: {
          feature: { type: 'string' }
        },
        required: ['feature']
      }
    }
  }, async (request: FastifyRequest<{ Params: { feature: string } }>, reply: FastifyReply) => {
    try {
      const tenantId = request.user.tenant_id;
      const { feature } = request.params;
      
      const hasAccess = await getBillingService().canUseFeature(tenantId, feature);
      
      return { has_access: hasAccess };
    } catch (error) {
      request.log.error('Failed to check feature access:', error);
      reply.code(500).send({ error: 'Failed to check feature access' });
    }
  });

  // Setup payment intent for subscription
  fastify.post('/setup-intent', {
    preHandler: fastify.authenticate,
    schema: {
      description: 'Create setup intent for payment method',
      tags: ['billing']
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // This would integrate with Stripe to create a setup intent
      // For now, return mock data
      return {
        client_secret: 'seti_mock_client_secret',
        url: 'https://checkout.stripe.com/setup/mock'
      };
    } catch (error) {
      request.log.error('Failed to create setup intent:', error);
      reply.code(500).send({ error: 'Failed to create setup intent' });
    }
  });
}