import Stripe from 'stripe';
import Decimal from 'decimal.js';
import {
  BillingServiceOptions,
  Subscription,
  SubscriptionStatus,
  PlanBillingInterval,
  PaymentMethod,
  Invoice,
  InvoiceLineItem,
  Coupon,
  BillingError,
  PaymentError,
  SubscriptionError,
  CreateSubscriptionRequest,
  UpdateSubscriptionRequest,
  CreatePaymentMethodRequest,
  CreateCouponRequest
} from './types';

export class StripeService {
  private stripe: Stripe;
  private options: BillingServiceOptions;

  constructor(options: BillingServiceOptions) {
    this.options = options;
    this.stripe = new Stripe(options.stripe_secret_key, {
      apiVersion: '2023-10-16',
      typescript: true
    });
  }

  // Customer Management
  async createCustomer(tenantId: string, email?: string, name?: string, metadata?: Record<string, string>): Promise<Stripe.Customer> {
    try {
      return await this.stripe.customers.create({
        email,
        name,
        metadata: {
          tenant_id: tenantId,
          ...metadata
        }
      });
    } catch (error) {
      throw new BillingError('Failed to create Stripe customer', 'STRIPE_CUSTOMER_CREATE_FAILED', 500, { error });
    }
  }

  async getCustomer(customerId: string): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.retrieve(customerId);
      if (customer.deleted) {
        throw new BillingError('Customer has been deleted', 'CUSTOMER_DELETED', 404);
      }
      return customer as Stripe.Customer;
    } catch (error) {
      if (error instanceof BillingError) throw error;
      throw new BillingError('Failed to retrieve Stripe customer', 'STRIPE_CUSTOMER_RETRIEVE_FAILED', 500, { error });
    }
  }

  async updateCustomer(customerId: string, updates: Partial<Stripe.CustomerUpdateParams>): Promise<Stripe.Customer> {
    try {
      return await this.stripe.customers.update(customerId, updates);
    } catch (error) {
      throw new BillingError('Failed to update Stripe customer', 'STRIPE_CUSTOMER_UPDATE_FAILED', 500, { error });
    }
  }

  // Subscription Management
  async createSubscription(
    customerId: string,
    request: CreateSubscriptionRequest,
    priceId: string
  ): Promise<Stripe.Subscription> {
    try {
      const subscriptionData: Stripe.SubscriptionCreateParams = {
        customer: customerId,
        items: [{
          price: priceId,
          quantity: 1
        }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          plan_id: request.plan_id,
          billing_interval: request.billing_interval
        }
      };

      // Add trial period if specified
      if (request.trial_days && request.trial_days > 0) {
        subscriptionData.trial_period_days = request.trial_days;
      }

      // Add payment method if provided
      if (request.payment_method_id) {
        subscriptionData.default_payment_method = request.payment_method_id;
      }

      // Add coupon if provided
      if (request.coupon_code) {
        subscriptionData.coupon = request.coupon_code;
      }

      // Enable proration if configured
      if (this.options.enable_proration) {
        subscriptionData.proration_behavior = 'create_prorations';
      }

      return await this.stripe.subscriptions.create(subscriptionData);
    } catch (error) {
      throw new SubscriptionError('Failed to create subscription', { error });
    }
  }

  async updateSubscription(
    subscriptionId: string,
    request: UpdateSubscriptionRequest,
    newPriceId?: string
  ): Promise<Stripe.Subscription> {
    try {
      const updateData: Stripe.SubscriptionUpdateParams = {
        metadata: {}
      };

      // Update price if changing plans
      if (newPriceId) {
        const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
        updateData.items = [{
          id: subscription.items.data[0].id,
          price: newPriceId,
          quantity: request.quantity || 1
        }];
        updateData.metadata!.plan_id = request.plan_id;
      }

      // Handle proration
      if (request.prorate !== undefined) {
        updateData.proration_behavior = request.prorate ? 'create_prorations' : 'none';
      } else if (this.options.enable_proration) {
        updateData.proration_behavior = 'create_prorations';
      }

      // Update quantity if specified
      if (request.quantity && !newPriceId) {
        const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
        updateData.items = [{
          id: subscription.items.data[0].id,
          quantity: request.quantity
        }];
      }

      return await this.stripe.subscriptions.update(subscriptionId, updateData);
    } catch (error) {
      throw new SubscriptionError('Failed to update subscription', { error });
    }
  }

  async cancelSubscription(subscriptionId: string, immediately: boolean = false): Promise<Stripe.Subscription> {
    try {
      if (immediately) {
        return await this.stripe.subscriptions.cancel(subscriptionId);
      } else {
        return await this.stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true
        });
      }
    } catch (error) {
      throw new SubscriptionError('Failed to cancel subscription', { error });
    }
  }

  async reactivateSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      return await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false
      });
    } catch (error) {
      throw new SubscriptionError('Failed to reactivate subscription', { error });
    }
  }

  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      return await this.stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['customer', 'latest_invoice']
      });
    } catch (error) {
      throw new SubscriptionError('Failed to retrieve subscription', { error });
    }
  }

  // Payment Method Management
  async attachPaymentMethod(
    customerId: string,
    request: CreatePaymentMethodRequest
  ): Promise<Stripe.PaymentMethod> {
    try {
      // Attach payment method to customer
      const paymentMethod = await this.stripe.paymentMethods.attach(request.stripe_payment_method_id, {
        customer: customerId
      });

      // Set as default if requested
      if (request.set_as_default) {
        await this.stripe.customers.update(customerId, {
          invoice_settings: {
            default_payment_method: paymentMethod.id
          }
        });
      }

      return paymentMethod;
    } catch (error) {
      throw new PaymentError('Failed to attach payment method', { error });
    }
  }

  async detachPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    try {
      return await this.stripe.paymentMethods.detach(paymentMethodId);
    } catch (error) {
      throw new PaymentError('Failed to detach payment method', { error });
    }
  }

  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<Stripe.Customer> {
    try {
      return await this.stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      });
    } catch (error) {
      throw new PaymentError('Failed to set default payment method', { error });
    }
  }

  async listPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
    try {
      const result = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: 'card'
      });
      return result.data;
    } catch (error) {
      throw new PaymentError('Failed to list payment methods', { error });
    }
  }

  // Invoice Management
  async createInvoice(customerId: string, items: Stripe.InvoiceItemCreateParams[]): Promise<Stripe.Invoice> {
    try {
      // Create invoice items
      for (const item of items) {
        await this.stripe.invoiceItems.create({
          ...item,
          customer: customerId
        });
      }

      // Create and finalize invoice
      const invoice = await this.stripe.invoices.create({
        customer: customerId,
        auto_advance: false // Don't auto-finalize
      });

      return await this.stripe.invoices.finalizeInvoice(invoice.id);
    } catch (error) {
      throw new BillingError('Failed to create invoice', 'INVOICE_CREATE_FAILED', 500, { error });
    }
  }

  async getInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    try {
      return await this.stripe.invoices.retrieve(invoiceId, {
        expand: ['customer', 'subscription', 'payment_intent']
      });
    } catch (error) {
      throw new BillingError('Failed to retrieve invoice', 'INVOICE_RETRIEVE_FAILED', 500, { error });
    }
  }

  async payInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    try {
      return await this.stripe.invoices.pay(invoiceId);
    } catch (error) {
      throw new PaymentError('Failed to pay invoice', { error });
    }
  }

  async voidInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    try {
      return await this.stripe.invoices.voidInvoice(invoiceId);
    } catch (error) {
      throw new BillingError('Failed to void invoice', 'INVOICE_VOID_FAILED', 500, { error });
    }
  }

  async listInvoices(customerId: string, limit: number = 10): Promise<Stripe.Invoice[]> {
    try {
      const result = await this.stripe.invoices.list({
        customer: customerId,
        limit
      });
      return result.data;
    } catch (error) {
      throw new BillingError('Failed to list invoices', 'INVOICE_LIST_FAILED', 500, { error });
    }
  }

  // Coupon Management
  async createCoupon(request: CreateCouponRequest): Promise<Stripe.Coupon> {
    try {
      const couponData: Stripe.CouponCreateParams = {
        name: request.name,
        duration: request.duration,
        metadata: request.metadata
      };

      if (request.percent_off) {
        couponData.percent_off = request.percent_off;
      }

      if (request.amount_off && request.currency) {
        couponData.amount_off = Math.round(request.amount_off * 100); // Convert to cents
        couponData.currency = request.currency;
      }

      if (request.duration_in_months) {
        couponData.duration_in_months = request.duration_in_months;
      }

      if (request.max_redemptions) {
        couponData.max_redemptions = request.max_redemptions;
      }

      if (request.valid_until) {
        couponData.redeem_by = Math.floor(request.valid_until.getTime() / 1000);
      }

      return await this.stripe.coupons.create(couponData);
    } catch (error) {
      throw new BillingError('Failed to create coupon', 'COUPON_CREATE_FAILED', 500, { error });
    }
  }

  async getCoupon(couponId: string): Promise<Stripe.Coupon> {
    try {
      return await this.stripe.coupons.retrieve(couponId);
    } catch (error) {
      throw new BillingError('Failed to retrieve coupon', 'COUPON_RETRIEVE_FAILED', 500, { error });
    }
  }

  async deleteCoupon(couponId: string): Promise<Stripe.DeletedCoupon> {
    try {
      return await this.stripe.coupons.del(couponId);
    } catch (error) {
      throw new BillingError('Failed to delete coupon', 'COUPON_DELETE_FAILED', 500, { error });
    }
  }

  // Price Management
  async createPrice(
    productId: string,
    unitAmount: number,
    currency: string,
    interval?: string,
    intervalCount: number = 1
  ): Promise<Stripe.Price> {
    try {
      const priceData: Stripe.PriceCreateParams = {
        product: productId,
        unit_amount: Math.round(unitAmount * 100), // Convert to cents
        currency: currency.toLowerCase()
      };

      if (interval) {
        priceData.recurring = {
          interval: interval as 'month' | 'year',
          interval_count: intervalCount
        };
      }

      return await this.stripe.prices.create(priceData);
    } catch (error) {
      throw new BillingError('Failed to create price', 'PRICE_CREATE_FAILED', 500, { error });
    }
  }

  // Product Management
  async createProduct(name: string, description?: string, metadata?: Record<string, string>): Promise<Stripe.Product> {
    try {
      return await this.stripe.products.create({
        name,
        description,
        metadata
      });
    } catch (error) {
      throw new BillingError('Failed to create product', 'PRODUCT_CREATE_FAILED', 500, { error });
    }
  }

  // Usage Records (for metered billing)
  async createUsageRecord(
    subscriptionItemId: string,
    quantity: number,
    timestamp?: number,
    action: 'increment' | 'set' = 'increment'
  ): Promise<Stripe.UsageRecord> {
    try {
      return await this.stripe.subscriptionItems.createUsageRecord(subscriptionItemId, {
        quantity,
        timestamp: timestamp || Math.floor(Date.now() / 1000),
        action
      });
    } catch (error) {
      throw new BillingError('Failed to create usage record', 'USAGE_RECORD_CREATE_FAILED', 500, { error });
    }
  }

  // Tax Rates
  async createTaxRate(
    displayName: string,
    percentage: number,
    inclusive: boolean = false,
    jurisdiction?: string
  ): Promise<Stripe.TaxRate> {
    try {
      return await this.stripe.taxRates.create({
        display_name: displayName,
        percentage,
        inclusive,
        jurisdiction
      });
    } catch (error) {
      throw new BillingError('Failed to create tax rate', 'TAX_RATE_CREATE_FAILED', 500, { error });
    }
  }

  // Refunds
  async createRefund(
    paymentIntentId: string,
    amount?: number,
    reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
  ): Promise<Stripe.Refund> {
    try {
      const refundData: Stripe.RefundCreateParams = {
        payment_intent: paymentIntentId
      };

      if (amount) {
        refundData.amount = Math.round(amount * 100); // Convert to cents
      }

      if (reason) {
        refundData.reason = reason;
      }

      return await this.stripe.refunds.create(refundData);
    } catch (error) {
      throw new PaymentError('Failed to create refund', { error });
    }
  }

  // Webhook Utilities
  constructWebhookEvent(payload: string, signature: string): Stripe.Event {
    try {
      return this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.options.webhook_secret
      );
    } catch (error) {
      throw new BillingError('Invalid webhook signature', 'WEBHOOK_SIGNATURE_INVALID', 400, { error });
    }
  }

  // Utility Methods
  convertAmountFromStripe(amount: number): Decimal {
    return new Decimal(amount).div(100);
  }

  convertAmountToStripe(amount: Decimal): number {
    return amount.mul(100).toNumber();
  }

  mapSubscriptionStatus(stripeStatus: string): SubscriptionStatus {
    const statusMap: Record<string, SubscriptionStatus> = {
      'active': SubscriptionStatus.ACTIVE,
      'trialing': SubscriptionStatus.TRIALING,
      'past_due': SubscriptionStatus.PAST_DUE,
      'canceled': SubscriptionStatus.CANCELED,
      'unpaid': SubscriptionStatus.UNPAID,
      'incomplete': SubscriptionStatus.INCOMPLETE,
      'incomplete_expired': SubscriptionStatus.INCOMPLETE_EXPIRED
    };

    return statusMap[stripeStatus] || SubscriptionStatus.INCOMPLETE;
  }

  mapBillingInterval(stripeInterval: string): PlanBillingInterval {
    return stripeInterval === 'year' ? PlanBillingInterval.YEARLY : PlanBillingInterval.MONTHLY;
  }

  // Analytics and Reporting
  async getRevenueMetrics(startDate: Date, endDate: Date): Promise<{
    total_revenue: Decimal;
    subscription_revenue: Decimal;
    one_time_revenue: Decimal;
    refunded_amount: Decimal;
  }> {
    try {
      // Get charges for the period
      const charges = await this.stripe.charges.list({
        created: {
          gte: Math.floor(startDate.getTime() / 1000),
          lte: Math.floor(endDate.getTime() / 1000)
        },
        limit: 100
      });

      let totalRevenue = new Decimal(0);
      let subscriptionRevenue = new Decimal(0);
      let oneTimeRevenue = new Decimal(0);
      let refundedAmount = new Decimal(0);

      for (const charge of charges.data) {
        if (charge.paid && !charge.refunded) {
          const amount = this.convertAmountFromStripe(charge.amount);
          totalRevenue = totalRevenue.plus(amount);

          // Check if it's subscription-related
          if (charge.invoice) {
            subscriptionRevenue = subscriptionRevenue.plus(amount);
          } else {
            oneTimeRevenue = oneTimeRevenue.plus(amount);
          }
        }

        if (charge.amount_refunded > 0) {
          refundedAmount = refundedAmount.plus(this.convertAmountFromStripe(charge.amount_refunded));
        }
      }

      return {
        total_revenue: totalRevenue,
        subscription_revenue: subscriptionRevenue,
        one_time_revenue: oneTimeRevenue,
        refunded_amount: refundedAmount
      };
    } catch (error) {
      throw new BillingError('Failed to get revenue metrics', 'REVENUE_METRICS_FAILED', 500, { error });
    }
  }
}