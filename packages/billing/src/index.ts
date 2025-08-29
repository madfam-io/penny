import Decimal from 'decimal.js';
import {
  BillingServiceOptions,
  Subscription,
  Plan,
  Invoice,
  PaymentMethod,
  UsageRecord,
  Coupon,
  CreateSubscriptionRequest,
  UpdateSubscriptionRequest,
  CreatePaymentMethodRequest,
  CreateCouponRequest,
  RecordUsageRequest,
  BillingError,
  SubscriptionError,
  PaymentError,
  UsageLimitError,
  RevenueMetrics,
  SubscriptionMetrics,
  UsageMetrics,
  BillingNotification
} from './types';

import { StripeService } from './stripe';
import { PlanService } from './plans';
import { UsageService, UsageTrackingOptions } from './usage';
import { InvoicingService, InvoiceGenerationOptions } from './invoicing';
import { WebhookService, WebhookHandlerOptions } from './webhooks';

// Storage interfaces that need to be implemented by the consumer
export interface BillingStorage {
  // Subscriptions
  createSubscription(subscription: Omit<Subscription, 'id' | 'created_at' | 'updated_at'>): Promise<Subscription>;
  getSubscription(subscriptionId: string): Promise<Subscription | null>;
  getSubscriptionByTenant(tenantId: string): Promise<Subscription | null>;
  updateSubscription(subscriptionId: string, updates: Partial<Subscription>): Promise<Subscription>;
  listSubscriptions(filters?: any, limit?: number, offset?: number): Promise<Subscription[]>;

  // Plans
  createPlan(plan: Omit<Plan, 'id' | 'created_at' | 'updated_at'>): Promise<Plan>;
  getPlan(planId: string): Promise<Plan | null>;
  listPlans(activeOnly?: boolean): Promise<Plan[]>;
  updatePlan(planId: string, updates: Partial<Plan>): Promise<Plan>;

  // Payment Methods
  savePaymentMethod(paymentMethod: Omit<PaymentMethod, 'id' | 'created_at' | 'updated_at'>): Promise<PaymentMethod>;
  getPaymentMethods(tenantId: string): Promise<PaymentMethod[]>;
  deletePaymentMethod(paymentMethodId: string): Promise<void>;
  setDefaultPaymentMethod(tenantId: string, paymentMethodId: string): Promise<void>;

  // Usage (implement the interfaces from usage.ts)
  recordUsage(record: Omit<UsageRecord, 'id' | 'created_at'>): Promise<UsageRecord>;
  getUsageRecords(tenantId: string, usageType: any, startDate: Date, endDate: Date): Promise<UsageRecord[]>;
  getUsageAggregate(tenantId: string, usageType: any, startDate: Date, endDate: Date): Promise<any>;
  getUsageAggregates(tenantId: string, startDate: Date, endDate: Date): Promise<any[]>;

  // Invoices (implement the interfaces from invoicing.ts)
  saveInvoice(invoice: Omit<Invoice, 'id' | 'created_at' | 'updated_at'>): Promise<Invoice>;
  saveInvoiceLineItem(lineItem: any): Promise<any>;
  getInvoice(invoiceId: string): Promise<Invoice | null>;
  getInvoicesByTenant(tenantId: string, limit?: number, offset?: number): Promise<Invoice[]>;
  getInvoicesBySubscription(subscriptionId: string, limit?: number, offset?: number): Promise<Invoice[]>;
  updateInvoiceStatus(invoiceId: string, status: string, paidAt?: Date): Promise<void>;
  getLineItemsByInvoice(invoiceId: string): Promise<any[]>;

  // Webhooks (implement the interfaces from webhooks.ts)
  saveEvent(event: any): Promise<any>;
  getEvent(eventId: string): Promise<any | null>;
  markEventProcessed(eventId: string): Promise<void>;
  getUnprocessedEvents(limit?: number): Promise<any[]>;

  // Coupons
  saveCoupon(coupon: Omit<Coupon, 'id' | 'created_at' | 'updated_at'>): Promise<Coupon>;
  getCoupon(couponId: string): Promise<Coupon | null>;
  listCoupons(activeOnly?: boolean): Promise<Coupon[]>;
  updateCoupon(couponId: string, updates: Partial<Coupon>): Promise<Coupon>;
}

export interface NotificationService {
  sendNotification(notification: BillingNotification): Promise<void>;
}

export interface BillingServiceConfig {
  stripe: BillingServiceOptions;
  usage: UsageTrackingOptions;
  invoicing: InvoiceGenerationOptions;
  webhooks: WebhookHandlerOptions;
}

/**
 * Main billing service that orchestrates all billing functionality
 */
export class BillingService {
  private stripeService: StripeService;
  private planService: PlanService;
  private usageService: UsageService;
  private invoicingService: InvoicingService;
  private webhookService: WebhookService;
  private storage: BillingStorage;
  private notificationService?: NotificationService;

  constructor(
    config: BillingServiceConfig,
    storage: BillingStorage,
    notificationService?: NotificationService,
    customPlans?: Plan[]
  ) {
    this.storage = storage;
    this.notificationService = notificationService;

    // Initialize core services
    this.stripeService = new StripeService(config.stripe);
    this.planService = new PlanService(customPlans);
    
    // Initialize usage service
    this.usageService = new UsageService(
      {
        recordUsage: storage.recordUsage.bind(storage),
        getUsageRecords: storage.getUsageRecords.bind(storage),
        getUsageAggregate: storage.getUsageAggregate.bind(storage),
        getUsageAggregates: storage.getUsageAggregates.bind(storage)
      },
      this.planService,
      config.usage,
      notificationService
    );

    // Initialize invoicing service
    this.invoicingService = new InvoicingService(
      this.stripeService,
      this.usageService,
      this.planService,
      {
        saveInvoice: storage.saveInvoice.bind(storage),
        saveInvoiceLineItem: storage.saveInvoiceLineItem.bind(storage),
        getInvoice: storage.getInvoice.bind(storage),
        getInvoicesByTenant: storage.getInvoicesByTenant.bind(storage),
        getInvoicesBySubscription: storage.getInvoicesBySubscription.bind(storage),
        updateInvoiceStatus: storage.updateInvoiceStatus.bind(storage),
        getLineItemsByInvoice: storage.getLineItemsByInvoice.bind(storage)
      },
      config.invoicing,
      notificationService
    );

    // Initialize webhook service
    this.webhookService = new WebhookService(
      this.stripeService,
      {
        saveEvent: storage.saveEvent.bind(storage),
        getEvent: storage.getEvent.bind(storage),
        markEventProcessed: storage.markEventProcessed.bind(storage),
        getUnprocessedEvents: storage.getUnprocessedEvents.bind(storage)
      },
      {
        updateSubscription: storage.updateSubscription.bind(storage),
        getSubscriptionByStripeId: async (stripeId: string) => {
          // This would need a proper implementation in the storage layer
          return null;
        }
      },
      config.webhooks,
      notificationService
    );
  }

  // Plan Management
  /**
   * Get all available plans
   */
  getPlans(): Plan[] {
    return this.planService.getPlans();
  }

  /**
   * Get specific plan
   */
  getPlan(planId: string): Plan | null {
    return this.planService.getPlan(planId);
  }

  // Subscription Management
  /**
   * Create a new subscription
   */
  async createSubscription(
    tenantId: string,
    request: CreateSubscriptionRequest
  ): Promise<{ subscription: Subscription; setup_intent?: any; }> {
    try {
      const plan = this.planService.getPlan(request.plan_id);
      if (!plan) {
        throw new SubscriptionError('Plan not found');
      }

      // Get or create Stripe customer
      const customer = await this.stripeService.createCustomer(tenantId);

      // Determine price ID based on billing interval
      const priceId = request.billing_interval === 'year' 
        ? plan.stripe_price_id_yearly 
        : plan.stripe_price_id_monthly;

      // Create subscription in Stripe
      const stripeSubscription = await this.stripeService.createSubscription(
        customer.id,
        request,
        priceId
      );

      // Save subscription in our database
      const subscription = await this.storage.createSubscription({
        tenant_id: tenantId,
        plan_id: request.plan_id,
        stripe_subscription_id: stripeSubscription.id,
        status: this.stripeService.mapSubscriptionStatus(stripeSubscription.status),
        current_period_start: new Date(stripeSubscription.current_period_start * 1000),
        current_period_end: new Date(stripeSubscription.current_period_end * 1000),
        trial_start: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : undefined,
        trial_end: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : undefined,
        quantity: 1,
        billing_interval: request.billing_interval,
        price: request.billing_interval === 'year' ? plan.price_yearly : plan.price_monthly,
        currency: plan.currency,
        next_billing_date: new Date(stripeSubscription.current_period_end * 1000),
        metadata: stripeSubscription.metadata
      });

      return {
        subscription,
        setup_intent: (stripeSubscription.latest_invoice as any)?.payment_intent
      };
    } catch (error) {
      if (error instanceof BillingError) throw error;
      throw new SubscriptionError('Failed to create subscription', { error });
    }
  }

  /**
   * Update an existing subscription
   */
  async updateSubscription(
    subscriptionId: string,
    request: UpdateSubscriptionRequest
  ): Promise<Subscription> {
    try {
      const subscription = await this.storage.getSubscription(subscriptionId);
      if (!subscription) {
        throw new SubscriptionError('Subscription not found');
      }

      let newPriceId: string | undefined;

      // If changing plans, get the new price ID
      if (request.plan_id && request.plan_id !== subscription.plan_id) {
        const newPlan = this.planService.getPlan(request.plan_id);
        if (!newPlan) {
          throw new SubscriptionError('New plan not found');
        }

        const billingInterval = request.billing_interval || subscription.billing_interval;
        newPriceId = billingInterval === 'year' 
          ? newPlan.stripe_price_id_yearly 
          : newPlan.stripe_price_id_monthly;
      }

      // Update subscription in Stripe
      const stripeSubscription = await this.stripeService.updateSubscription(
        subscription.stripe_subscription_id,
        request,
        newPriceId
      );

      // Update subscription in our database
      const updates: Partial<Subscription> = {
        status: this.stripeService.mapSubscriptionStatus(stripeSubscription.status),
        current_period_start: new Date(stripeSubscription.current_period_start * 1000),
        current_period_end: new Date(stripeSubscription.current_period_end * 1000),
        next_billing_date: new Date(stripeSubscription.current_period_end * 1000),
        updated_at: new Date()
      };

      if (request.plan_id) updates.plan_id = request.plan_id;
      if (request.quantity) updates.quantity = request.quantity;
      if (request.billing_interval) updates.billing_interval = request.billing_interval;

      return await this.storage.updateSubscription(subscriptionId, updates);
    } catch (error) {
      if (error instanceof BillingError) throw error;
      throw new SubscriptionError('Failed to update subscription', { error });
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    immediately: boolean = false
  ): Promise<Subscription> {
    try {
      const subscription = await this.storage.getSubscription(subscriptionId);
      if (!subscription) {
        throw new SubscriptionError('Subscription not found');
      }

      await this.stripeService.cancelSubscription(subscription.stripe_subscription_id, immediately);

      const updates: Partial<Subscription> = {
        canceled_at: new Date(),
        updated_at: new Date()
      };

      if (immediately) {
        updates.status = 'canceled';
        updates.ended_at = new Date();
      }

      return await this.storage.updateSubscription(subscriptionId, updates);
    } catch (error) {
      if (error instanceof BillingError) throw error;
      throw new SubscriptionError('Failed to cancel subscription', { error });
    }
  }

  /**
   * Get subscription for tenant
   */
  async getTenantSubscription(tenantId: string): Promise<Subscription | null> {
    return await this.storage.getSubscriptionByTenant(tenantId);
  }

  // Payment Method Management
  /**
   * Add payment method for tenant
   */
  async addPaymentMethod(
    tenantId: string,
    request: CreatePaymentMethodRequest
  ): Promise<PaymentMethod> {
    try {
      // Get or create Stripe customer
      const customer = await this.stripeService.createCustomer(tenantId);

      // Attach payment method
      const stripePaymentMethod = await this.stripeService.attachPaymentMethod(customer.id, request);

      // Save payment method in our database
      return await this.storage.savePaymentMethod({
        tenant_id: tenantId,
        stripe_payment_method_id: stripePaymentMethod.id,
        type: stripePaymentMethod.type,
        brand: stripePaymentMethod.card?.brand,
        last4: stripePaymentMethod.card?.last4,
        exp_month: stripePaymentMethod.card?.exp_month,
        exp_year: stripePaymentMethod.card?.exp_year,
        is_default: request.set_as_default
      });
    } catch (error) {
      if (error instanceof BillingError) throw error;
      throw new PaymentError('Failed to add payment method', { error });
    }
  }

  /**
   * Get payment methods for tenant
   */
  async getPaymentMethods(tenantId: string): Promise<PaymentMethod[]> {
    return await this.storage.getPaymentMethods(tenantId);
  }

  /**
   * Remove payment method
   */
  async removePaymentMethod(paymentMethodId: string): Promise<void> {
    try {
      await this.stripeService.detachPaymentMethod(paymentMethodId);
      await this.storage.deletePaymentMethod(paymentMethodId);
    } catch (error) {
      throw new PaymentError('Failed to remove payment method', { error });
    }
  }

  // Usage Tracking
  /**
   * Record usage for tenant
   */
  async recordUsage(
    tenantId: string,
    request: RecordUsageRequest
  ): Promise<{ success: boolean; usage_record: UsageRecord; limit_exceeded: boolean; }> {
    const subscription = await this.storage.getSubscriptionByTenant(tenantId);
    if (!subscription) {
      throw new UsageLimitError('No active subscription found for tenant');
    }

    const result = await this.usageService.recordUsage(tenantId, subscription.id, request);
    
    return {
      success: true,
      usage_record: result.record,
      limit_exceeded: result.limit_exceeded
    };
  }

  /**
   * Get current usage for tenant
   */
  async getCurrentUsage(tenantId: string, usageType?: any, period?: 'hour' | 'day' | 'month') {
    if (usageType) {
      return await this.usageService.getCurrentUsage(tenantId, usageType, period);
    }
    
    return await this.usageService.getUsageSummary(tenantId);
  }

  /**
   * Validate if usage is allowed
   */
  async validateUsage(tenantId: string, usageType: any, quantity: number) {
    return await this.usageService.validateUsage(tenantId, usageType, quantity);
  }

  // Invoice Management
  /**
   * Generate invoice for subscription
   */
  async generateInvoice(subscriptionId: string, periodStart?: Date, periodEnd?: Date): Promise<Invoice> {
    const subscription = await this.storage.getSubscription(subscriptionId);
    if (!subscription) {
      throw new BillingError('Subscription not found', 'SUBSCRIPTION_NOT_FOUND', 404);
    }

    const start = periodStart || subscription.current_period_start;
    const end = periodEnd || subscription.current_period_end;

    return await this.invoicingService.generateInvoice(subscription, start, end);
  }

  /**
   * Get invoices for tenant
   */
  async getTenantInvoices(tenantId: string, limit?: number, offset?: number) {
    return await this.invoicingService.getTenantInvoices(tenantId, limit, offset);
  }

  /**
   * Get invoice details
   */
  async getInvoice(invoiceId: string) {
    return await this.invoicingService.getInvoiceWithDetails(invoiceId);
  }

  // Webhook Processing
  /**
   * Process Stripe webhook
   */
  async processWebhook(payload: string, signature: string) {
    return await this.webhookService.processWebhook(payload, signature);
  }

  // Analytics and Reporting
  /**
   * Get revenue metrics
   */
  async getRevenueMetrics(startDate: Date, endDate: Date): Promise<RevenueMetrics> {
    const stripeMetrics = await this.stripeService.getRevenueMetrics(startDate, endDate);
    
    return {
      total_revenue: stripeMetrics.total_revenue,
      monthly_recurring_revenue: stripeMetrics.subscription_revenue, // Simplified
      annual_recurring_revenue: stripeMetrics.subscription_revenue.mul(12),
      average_revenue_per_user: stripeMetrics.total_revenue, // Would need user count
      churn_rate: 0, // Would need to calculate from subscription data
      growth_rate: 0, // Would need historical data
      period_start: startDate,
      period_end: endDate
    };
  }

  /**
   * Get subscription metrics
   */
  async getSubscriptionMetrics(startDate: Date, endDate: Date): Promise<SubscriptionMetrics> {
    const subscriptions = await this.storage.listSubscriptions({
      created_after: startDate,
      created_before: endDate
    });

    return {
      total_subscriptions: subscriptions.length,
      active_subscriptions: subscriptions.filter(s => s.status === 'active').length,
      trialing_subscriptions: subscriptions.filter(s => s.status === 'trialing').length,
      canceled_subscriptions: subscriptions.filter(s => s.status === 'canceled').length,
      new_subscriptions: subscriptions.length, // Simplified
      churned_subscriptions: 0, // Would need to calculate
      upgrade_count: 0, // Would need to track plan changes
      downgrade_count: 0, // Would need to track plan changes
      period_start: startDate,
      period_end: endDate
    };
  }

  // Utility Methods
  /**
   * Check if tenant has active subscription
   */
  async hasActiveSubscription(tenantId: string): Promise<boolean> {
    const subscription = await this.storage.getSubscriptionByTenant(tenantId);
    return subscription?.status === 'active' || subscription?.status === 'trialing';
  }

  /**
   * Get tenant's current plan
   */
  async getTenantPlan(tenantId: string): Promise<Plan | null> {
    const subscription = await this.storage.getSubscriptionByTenant(tenantId);
    if (!subscription) return null;
    
    return this.planService.getPlan(subscription.plan_id);
  }

  /**
   * Check if tenant can use feature
   */
  async canUseFeature(tenantId: string, feature: string): Promise<boolean> {
    const plan = await this.getTenantPlan(tenantId);
    if (!plan) return false;
    
    return this.planService.hasFeature(plan.id, feature as any);
  }
}

// Export all types and services
export * from './types';
export { StripeService } from './stripe';
export { PlanService, DEFAULT_PLANS } from './plans';
export { UsageService, UsageCalculator } from './usage';
export { InvoicingService } from './invoicing';
export { WebhookService } from './webhooks';

// Export default configuration
export const DEFAULT_BILLING_CONFIG: BillingServiceConfig = {
  stripe: {
    stripe_secret_key: process.env.STRIPE_SECRET_KEY || '',
    webhook_secret: process.env.STRIPE_WEBHOOK_SECRET || '',
    default_currency: 'usd',
    trial_period_days: 14,
    grace_period_days: 3,
    usage_aggregation_interval: 60, // 1 hour
    enable_proration: true,
    tax_calculation: false
  },
  usage: {
    aggregation_interval_minutes: 60,
    enable_soft_limits: true,
    enable_hard_limits: true,
    enable_notifications: true,
    grace_period_percentage: 10
  },
  invoicing: {
    include_usage_details: true,
    include_tax: false,
    auto_finalize: true,
    send_notification: true,
    grace_period_days: 7,
    pdf_generation: true
  },
  webhooks: {
    idempotency_check: true,
    retry_failed_events: true,
    max_retry_attempts: 3,
    notification_enabled: true,
    webhook_timeout_ms: 30000
  }
};