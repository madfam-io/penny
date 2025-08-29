import Stripe from 'stripe';
import {
  BillingEvent,
  BillingEventType,
  SubscriptionStatus,
  BillingError,
  BillingNotification
} from './types';
import { StripeService } from './stripe';

export interface WebhookStorage {
  saveEvent(event: Omit<BillingEvent, 'id' | 'created_at' | 'processed_at'>): Promise<BillingEvent>;
  getEvent(eventId: string): Promise<BillingEvent | null>;
  markEventProcessed(eventId: string): Promise<void>;
  getUnprocessedEvents(limit?: number): Promise<BillingEvent[]>;
}

export interface SubscriptionStorage {
  updateSubscription(subscriptionId: string, updates: any): Promise<void>;
  getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<any | null>;
}

export interface WebhookNotificationService {
  sendNotification(notification: BillingNotification): Promise<void>;
}

export interface WebhookHandlerOptions {
  idempotency_check: boolean;
  retry_failed_events: boolean;
  max_retry_attempts: number;
  notification_enabled: boolean;
  webhook_timeout_ms: number;
}

export class WebhookService {
  private stripeService: StripeService;
  private webhookStorage: WebhookStorage;
  private subscriptionStorage: SubscriptionStorage;
  private notificationService?: WebhookNotificationService;
  private options: WebhookHandlerOptions;

  constructor(
    stripeService: StripeService,
    webhookStorage: WebhookStorage,
    subscriptionStorage: SubscriptionStorage,
    options: WebhookHandlerOptions,
    notificationService?: WebhookNotificationService
  ) {
    this.stripeService = stripeService;
    this.webhookStorage = webhookStorage;
    this.subscriptionStorage = subscriptionStorage;
    this.options = options;
    this.notificationService = notificationService;
  }

  /**
   * Process Stripe webhook event
   */
  async processWebhook(payload: string, signature: string): Promise<{
    success: boolean;
    event_id?: string;
    error?: string;
  }> {
    try {
      // Verify webhook signature
      const event = this.stripeService.constructWebhookEvent(payload, signature);

      // Check for duplicate events if idempotency is enabled
      if (this.options.idempotency_check) {
        const existingEvent = await this.webhookStorage.getEvent(event.id);
        if (existingEvent && existingEvent.processed) {
          return { success: true, event_id: event.id };
        }
      }

      // Save event to storage
      const billingEvent = await this.saveWebhookEvent(event);

      // Process the event based on type
      await this.handleWebhookEvent(event, billingEvent);

      // Mark event as processed
      await this.webhookStorage.markEventProcessed(billingEvent.id);

      return { success: true, event_id: event.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown webhook processing error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Handle specific webhook event types
   */
  private async handleWebhookEvent(stripeEvent: Stripe.Event, billingEvent: BillingEvent): Promise<void> {
    switch (stripeEvent.type) {
      // Subscription events
      case 'customer.subscription.created':
        await this.handleSubscriptionCreated(stripeEvent.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(stripeEvent.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(stripeEvent.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.trial_will_end':
        await this.handleTrialWillEnd(stripeEvent.data.object as Stripe.Subscription);
        break;

      // Invoice events
      case 'invoice.created':
        await this.handleInvoiceCreated(stripeEvent.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSucceeded(stripeEvent.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(stripeEvent.data.object as Stripe.Invoice);
        break;

      case 'invoice.finalized':
        await this.handleInvoiceFinalized(stripeEvent.data.object as Stripe.Invoice);
        break;

      // Payment method events
      case 'payment_method.attached':
        await this.handlePaymentMethodAttached(stripeEvent.data.object as Stripe.PaymentMethod);
        break;

      case 'payment_method.detached':
        await this.handlePaymentMethodDetached(stripeEvent.data.object as Stripe.PaymentMethod);
        break;

      // Customer events
      case 'customer.created':
        await this.handleCustomerCreated(stripeEvent.data.object as Stripe.Customer);
        break;

      case 'customer.updated':
        await this.handleCustomerUpdated(stripeEvent.data.object as Stripe.Customer);
        break;

      case 'customer.deleted':
        await this.handleCustomerDeleted(stripeEvent.data.object as Stripe.Customer);
        break;

      // Charge events
      case 'charge.succeeded':
        await this.handleChargeSucceeded(stripeEvent.data.object as Stripe.Charge);
        break;

      case 'charge.failed':
        await this.handleChargeFailed(stripeEvent.data.object as Stripe.Charge);
        break;

      case 'charge.dispute.created':
        await this.handleChargeDisputeCreated(stripeEvent.data.object as Stripe.Dispute);
        break;

      // Coupon events
      case 'coupon.created':
        await this.handleCouponCreated(stripeEvent.data.object as Stripe.Coupon);
        break;

      case 'coupon.deleted':
        await this.handleCouponDeleted(stripeEvent.data.object as Stripe.Coupon);
        break;

      default:
        console.log(`Unhandled webhook event type: ${stripeEvent.type}`);
    }
  }

  // Subscription event handlers
  private async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    const tenantId = this.extractTenantId(subscription.customer as string);
    
    await this.subscriptionStorage.updateSubscription(subscription.id, {
      stripe_subscription_id: subscription.id,
      status: this.stripeService.mapSubscriptionStatus(subscription.status),
      current_period_start: new Date(subscription.current_period_start * 1000),
      current_period_end: new Date(subscription.current_period_end * 1000),
      trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
      trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      updated_at: new Date()
    });

    if (this.options.notification_enabled && this.notificationService) {
      await this.notificationService.sendNotification({
        type: 'email',
        recipient: `tenant_${tenantId}@notifications.penny.com`,
        subject: 'Subscription Created Successfully',
        template: 'subscription_created',
        data: {
          tenant_id: tenantId,
          subscription_id: subscription.id,
          status: subscription.status,
          trial_end: subscription.trial_end
        }
      });
    }
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const tenantId = this.extractTenantId(subscription.customer as string);
    
    await this.subscriptionStorage.updateSubscription(subscription.id, {
      status: this.stripeService.mapSubscriptionStatus(subscription.status),
      current_period_start: new Date(subscription.current_period_start * 1000),
      current_period_end: new Date(subscription.current_period_end * 1000),
      canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
      ended_at: subscription.ended_at ? new Date(subscription.ended_at * 1000) : null,
      updated_at: new Date()
    });

    if (this.options.notification_enabled && this.notificationService) {
      await this.notificationService.sendNotification({
        type: 'email',
        recipient: `tenant_${tenantId}@notifications.penny.com`,
        subject: 'Subscription Updated',
        template: 'subscription_updated',
        data: {
          tenant_id: tenantId,
          subscription_id: subscription.id,
          status: subscription.status,
          changes: this.getSubscriptionChanges(subscription)
        }
      });
    }
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const tenantId = this.extractTenantId(subscription.customer as string);
    
    await this.subscriptionStorage.updateSubscription(subscription.id, {
      status: SubscriptionStatus.CANCELED,
      canceled_at: new Date(subscription.canceled_at! * 1000),
      ended_at: subscription.ended_at ? new Date(subscription.ended_at * 1000) : new Date(),
      updated_at: new Date()
    });

    if (this.options.notification_enabled && this.notificationService) {
      await this.notificationService.sendNotification({
        type: 'email',
        recipient: `tenant_${tenantId}@notifications.penny.com`,
        subject: 'Subscription Cancelled',
        template: 'subscription_cancelled',
        data: {
          tenant_id: tenantId,
          subscription_id: subscription.id,
          canceled_at: subscription.canceled_at,
          ended_at: subscription.ended_at
        }
      });
    }
  }

  private async handleTrialWillEnd(subscription: Stripe.Subscription): Promise<void> {
    const tenantId = this.extractTenantId(subscription.customer as string);
    
    if (this.options.notification_enabled && this.notificationService) {
      const trialEndDate = subscription.trial_end ? new Date(subscription.trial_end * 1000) : new Date();
      const daysUntilEnd = Math.ceil((trialEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      await this.notificationService.sendNotification({
        type: 'email',
        recipient: `tenant_${tenantId}@notifications.penny.com`,
        subject: `Your trial ends in ${daysUntilEnd} days`,
        template: 'trial_will_end',
        data: {
          tenant_id: tenantId,
          subscription_id: subscription.id,
          trial_end_date: trialEndDate.toISOString(),
          days_until_end: daysUntilEnd
        }
      });
    }
  }

  // Invoice event handlers
  private async handleInvoiceCreated(invoice: Stripe.Invoice): Promise<void> {
    const tenantId = this.extractTenantId(invoice.customer as string);
    
    // Invoice creation is usually handled by our invoicing service
    // This webhook can be used for external integrations or notifications
    
    if (this.options.notification_enabled && this.notificationService) {
      await this.notificationService.sendNotification({
        type: 'webhook',
        recipient: 'internal',
        subject: 'Invoice Created in Stripe',
        template: 'invoice_created_stripe',
        data: {
          tenant_id: tenantId,
          invoice_id: invoice.id,
          amount: invoice.total,
          currency: invoice.currency,
          due_date: invoice.due_date
        }
      });
    }
  }

  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    const tenantId = this.extractTenantId(invoice.customer as string);
    
    // Update our local invoice record if it exists
    // This would require integration with the invoicing service

    if (this.options.notification_enabled && this.notificationService) {
      await this.notificationService.sendNotification({
        type: 'email',
        recipient: `tenant_${tenantId}@notifications.penny.com`,
        subject: 'Payment Received - Thank You!',
        template: 'invoice_payment_succeeded',
        data: {
          tenant_id: tenantId,
          invoice_id: invoice.id,
          amount_paid: invoice.amount_paid,
          currency: invoice.currency,
          paid_at: new Date().toISOString()
        }
      });
    }
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const tenantId = this.extractTenantId(invoice.customer as string);
    
    if (this.options.notification_enabled && this.notificationService) {
      await this.notificationService.sendNotification({
        type: 'email',
        recipient: `tenant_${tenantId}@notifications.penny.com`,
        subject: 'Payment Failed - Action Required',
        template: 'invoice_payment_failed',
        data: {
          tenant_id: tenantId,
          invoice_id: invoice.id,
          amount_due: invoice.amount_due,
          currency: invoice.currency,
          next_payment_attempt: invoice.next_payment_attempt,
          payment_intent_id: invoice.payment_intent
        }
      });
    }

    // Trigger dunning management process
    await this.triggerDunningProcess(tenantId, invoice.id);
  }

  private async handleInvoiceFinalized(invoice: Stripe.Invoice): Promise<void> {
    const tenantId = this.extractTenantId(invoice.customer as string);
    
    if (this.options.notification_enabled && this.notificationService) {
      await this.notificationService.sendNotification({
        type: 'email',
        recipient: `tenant_${tenantId}@notifications.penny.com`,
        subject: `Invoice ${invoice.number} - Ready for Payment`,
        template: 'invoice_finalized',
        data: {
          tenant_id: tenantId,
          invoice_id: invoice.id,
          invoice_number: invoice.number,
          amount_due: invoice.amount_due,
          currency: invoice.currency,
          due_date: invoice.due_date,
          hosted_invoice_url: invoice.hosted_invoice_url
        }
      });
    }
  }

  // Payment method event handlers
  private async handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod): Promise<void> {
    const tenantId = this.extractTenantId(paymentMethod.customer as string);
    
    if (this.options.notification_enabled && this.notificationService) {
      await this.notificationService.sendNotification({
        type: 'email',
        recipient: `tenant_${tenantId}@notifications.penny.com`,
        subject: 'New Payment Method Added',
        template: 'payment_method_attached',
        data: {
          tenant_id: tenantId,
          payment_method_id: paymentMethod.id,
          type: paymentMethod.type,
          card_brand: paymentMethod.card?.brand,
          card_last4: paymentMethod.card?.last4
        }
      });
    }
  }

  private async handlePaymentMethodDetached(paymentMethod: Stripe.PaymentMethod): Promise<void> {
    const tenantId = paymentMethod.customer ? this.extractTenantId(paymentMethod.customer as string) : null;
    
    if (tenantId && this.options.notification_enabled && this.notificationService) {
      await this.notificationService.sendNotification({
        type: 'email',
        recipient: `tenant_${tenantId}@notifications.penny.com`,
        subject: 'Payment Method Removed',
        template: 'payment_method_detached',
        data: {
          tenant_id: tenantId,
          payment_method_id: paymentMethod.id,
          type: paymentMethod.type,
          card_brand: paymentMethod.card?.brand,
          card_last4: paymentMethod.card?.last4
        }
      });
    }
  }

  // Customer event handlers
  private async handleCustomerCreated(customer: Stripe.Customer): Promise<void> {
    // Customer creation is usually handled by our auth service
    console.log(`Customer created in Stripe: ${customer.id}`);
  }

  private async handleCustomerUpdated(customer: Stripe.Customer): Promise<void> {
    // Handle customer updates if needed
    console.log(`Customer updated in Stripe: ${customer.id}`);
  }

  private async handleCustomerDeleted(customer: Stripe.Customer): Promise<void> {
    const tenantId = this.extractTenantId(customer.id);
    
    if (this.options.notification_enabled && this.notificationService) {
      await this.notificationService.sendNotification({
        type: 'webhook',
        recipient: 'internal',
        subject: 'Customer Deleted in Stripe',
        template: 'customer_deleted',
        data: {
          tenant_id: tenantId,
          customer_id: customer.id,
          deleted_at: new Date().toISOString()
        }
      });
    }
  }

  // Charge event handlers
  private async handleChargeSucceeded(charge: Stripe.Charge): Promise<void> {
    const tenantId = this.extractTenantId(charge.customer as string);
    
    // Update analytics or trigger business logic
    console.log(`Charge succeeded: ${charge.id} for tenant: ${tenantId}`);
  }

  private async handleChargeFailed(charge: Stripe.Charge): Promise<void> {
    const tenantId = this.extractTenantId(charge.customer as string);
    
    if (this.options.notification_enabled && this.notificationService) {
      await this.notificationService.sendNotification({
        type: 'email',
        recipient: `tenant_${tenantId}@notifications.penny.com`,
        subject: 'Payment Failed',
        template: 'charge_failed',
        data: {
          tenant_id: tenantId,
          charge_id: charge.id,
          amount: charge.amount,
          currency: charge.currency,
          failure_code: charge.failure_code,
          failure_message: charge.failure_message
        }
      });
    }
  }

  private async handleChargeDisputeCreated(dispute: Stripe.Dispute): Promise<void> {
    const charge = dispute.charge as Stripe.Charge;
    const tenantId = this.extractTenantId(charge.customer as string);
    
    if (this.options.notification_enabled && this.notificationService) {
      await this.notificationService.sendNotification({
        type: 'email',
        recipient: 'admin@penny.com',
        subject: 'Chargeback Alert',
        template: 'charge_dispute_created',
        data: {
          tenant_id: tenantId,
          dispute_id: dispute.id,
          charge_id: charge.id,
          amount: dispute.amount,
          currency: dispute.currency,
          reason: dispute.reason,
          status: dispute.status
        }
      });
    }
  }

  // Coupon event handlers
  private async handleCouponCreated(coupon: Stripe.Coupon): Promise<void> {
    console.log(`Coupon created: ${coupon.id}`);
  }

  private async handleCouponDeleted(coupon: Stripe.Coupon): Promise<void> {
    console.log(`Coupon deleted: ${coupon.id}`);
  }

  // Utility methods
  private async saveWebhookEvent(stripeEvent: Stripe.Event): Promise<BillingEvent> {
    const eventType = this.mapStripeEventType(stripeEvent.type);
    const tenantId = this.extractTenantIdFromEvent(stripeEvent);

    return await this.webhookStorage.saveEvent({
      tenant_id: tenantId,
      type: eventType,
      data: stripeEvent.data,
      stripe_event_id: stripeEvent.id,
      processed: false
    });
  }

  private mapStripeEventType(stripeEventType: string): BillingEventType {
    const eventMap: Record<string, BillingEventType> = {
      'customer.subscription.created': BillingEventType.SUBSCRIPTION_CREATED,
      'customer.subscription.updated': BillingEventType.SUBSCRIPTION_UPDATED,
      'customer.subscription.deleted': BillingEventType.SUBSCRIPTION_CANCELED,
      'customer.subscription.trial_will_end': BillingEventType.SUBSCRIPTION_TRIAL_WILL_END,
      'invoice.created': BillingEventType.INVOICE_CREATED,
      'invoice.payment_succeeded': BillingEventType.INVOICE_PAID,
      'invoice.payment_failed': BillingEventType.INVOICE_FAILED,
      'payment_method.attached': BillingEventType.PAYMENT_METHOD_ATTACHED,
      'payment_method.detached': BillingEventType.PAYMENT_METHOD_DETACHED
    };

    return eventMap[stripeEventType] || BillingEventType.INVOICE_CREATED;
  }

  private extractTenantId(customerId: string): string {
    // Extract tenant ID from customer ID or metadata
    // This depends on how you store the tenant ID in Stripe
    return customerId; // Simplified - in reality, you'd look this up
  }

  private extractTenantIdFromEvent(event: Stripe.Event): string {
    // Extract tenant ID from event data
    const object = event.data.object as any;
    
    if (object.customer) {
      return this.extractTenantId(object.customer);
    }
    
    if (object.metadata?.tenant_id) {
      return object.metadata.tenant_id;
    }

    return 'unknown';
  }

  private getSubscriptionChanges(subscription: Stripe.Subscription): Record<string, any> {
    // Analyze subscription changes - this would compare with previous state
    return {
      status: subscription.status,
      price_changed: false, // This would be determined by comparing with previous data
      quantity_changed: false
    };
  }

  private async triggerDunningProcess(tenantId: string, invoiceId: string): Promise<void> {
    // Implement dunning management logic
    // This could include:
    // - Retry payment attempts
    // - Send reminder emails
    // - Downgrade service
    // - Suspend account after multiple failures
    
    console.log(`Triggering dunning process for tenant: ${tenantId}, invoice: ${invoiceId}`);
  }

  /**
   * Process failed webhook events (for retry mechanism)
   */
  async processFailedEvents(): Promise<{
    processed: number;
    failed: number;
    errors: string[];
  }> {
    if (!this.options.retry_failed_events) {
      return { processed: 0, failed: 0, errors: [] };
    }

    const unprocessedEvents = await this.webhookStorage.getUnprocessedEvents(50);
    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const event of unprocessedEvents) {
      try {
        // Reconstruct the Stripe event and process it
        const stripeEvent = {
          id: event.stripe_event_id || event.id,
          type: this.mapBillingEventTypeToStripe(event.type),
          data: event.data
        } as Stripe.Event;

        await this.handleWebhookEvent(stripeEvent, event);
        await this.webhookStorage.markEventProcessed(event.id);
        processed++;
      } catch (error) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Event ${event.id}: ${errorMessage}`);
      }
    }

    return { processed, failed, errors };
  }

  private mapBillingEventTypeToStripe(billingEventType: BillingEventType): string {
    const reverseMap: Record<BillingEventType, string> = {
      [BillingEventType.SUBSCRIPTION_CREATED]: 'customer.subscription.created',
      [BillingEventType.SUBSCRIPTION_UPDATED]: 'customer.subscription.updated',
      [BillingEventType.SUBSCRIPTION_CANCELED]: 'customer.subscription.deleted',
      [BillingEventType.SUBSCRIPTION_TRIAL_WILL_END]: 'customer.subscription.trial_will_end',
      [BillingEventType.INVOICE_CREATED]: 'invoice.created',
      [BillingEventType.INVOICE_PAID]: 'invoice.payment_succeeded',
      [BillingEventType.INVOICE_FAILED]: 'invoice.payment_failed',
      [BillingEventType.PAYMENT_METHOD_ATTACHED]: 'payment_method.attached',
      [BillingEventType.PAYMENT_METHOD_DETACHED]: 'payment_method.detached',
      [BillingEventType.USAGE_THRESHOLD_EXCEEDED]: 'usage.threshold_exceeded'
    };

    return reverseMap[billingEventType] || 'unknown';
  }
}