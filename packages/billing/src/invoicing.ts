import Decimal from 'decimal.js';
import { startOfMonth, endOfMonth, addDays, format } from 'date-fns';
import {
  Invoice,
  InvoiceLineItem,
  Subscription,
  UsageAggregate,
  UsageType,
  Plan,
  BillingError,
  BillingNotification
} from './types';
import { StripeService } from './stripe';
import { UsageService } from './usage';
import { PlanService } from './plans';

export interface InvoiceStorage {
  saveInvoice(invoice: Omit<Invoice, 'id' | 'created_at' | 'updated_at'>): Promise<Invoice>;
  saveInvoiceLineItem(lineItem: Omit<InvoiceLineItem, 'id'>): Promise<InvoiceLineItem>;
  getInvoice(invoiceId: string): Promise<Invoice | null>;
  getInvoicesByTenant(tenantId: string, limit?: number, offset?: number): Promise<Invoice[]>;
  getInvoicesBySubscription(subscriptionId: string, limit?: number, offset?: number): Promise<Invoice[]>;
  updateInvoiceStatus(invoiceId: string, status: string, paidAt?: Date): Promise<void>;
  getLineItemsByInvoice(invoiceId: string): Promise<InvoiceLineItem[]>;
}

export interface InvoiceNotificationService {
  sendNotification(notification: BillingNotification): Promise<void>;
}

export interface InvoiceGenerationOptions {
  include_usage_details: boolean;
  include_tax: boolean;
  auto_finalize: boolean;
  send_notification: boolean;
  grace_period_days: number;
  pdf_generation: boolean;
}

export interface TaxCalculationService {
  calculateTax(amount: Decimal, tenantLocation: string): Promise<{ tax_amount: Decimal; tax_rate: number; tax_description: string; }>;
}

export class InvoicingService {
  private stripeService: StripeService;
  private usageService: UsageService;
  private planService: PlanService;
  private storage: InvoiceStorage;
  private notificationService?: InvoiceNotificationService;
  private taxService?: TaxCalculationService;
  private options: InvoiceGenerationOptions;

  constructor(
    stripeService: StripeService,
    usageService: UsageService,
    planService: PlanService,
    storage: InvoiceStorage,
    options: InvoiceGenerationOptions,
    notificationService?: InvoiceNotificationService,
    taxService?: TaxCalculationService
  ) {
    this.stripeService = stripeService;
    this.usageService = usageService;
    this.planService = planService;
    this.storage = storage;
    this.options = options;
    this.notificationService = notificationService;
    this.taxService = taxService;
  }

  /**
   * Generate invoice for a subscription period
   */
  async generateInvoice(
    subscription: Subscription,
    periodStart: Date,
    periodEnd: Date,
    includeUsage: boolean = true
  ): Promise<Invoice> {
    try {
      // Get plan details
      const plan = this.planService.getPlan(subscription.plan_id);
      if (!plan) {
        throw new BillingError('Plan not found for subscription', 'PLAN_NOT_FOUND', 404);
      }

      // Calculate base subscription cost
      let subtotal = new Decimal(subscription.price);
      const lineItems: Omit<InvoiceLineItem, 'id' | 'invoice_id'>[] = [];

      // Add subscription line item
      lineItems.push({
        description: `${plan.name} Plan - ${format(periodStart, 'MMM yyyy')}`,
        quantity: subscription.quantity,
        unit_amount: subscription.price.div(subscription.quantity),
        amount: subscription.price,
        period_start: periodStart,
        period_end: periodEnd
      });

      // Calculate usage-based charges if enabled
      if (includeUsage && this.options.include_usage_details) {
        const usageCharges = await this.calculateUsageCharges(
          subscription.tenant_id,
          plan,
          periodStart,
          periodEnd
        );

        for (const charge of usageCharges) {
          lineItems.push(charge);
          subtotal = subtotal.plus(charge.amount);
        }
      }

      // Calculate tax if enabled
      let tax = new Decimal(0);
      if (this.options.include_tax && this.taxService) {
        const taxResult = await this.taxService.calculateTax(subtotal, subscription.tenant_id);
        tax = taxResult.tax_amount;

        if (tax.greaterThan(0)) {
          lineItems.push({
            description: taxResult.tax_description,
            quantity: 1,
            unit_amount: tax,
            amount: tax
          });
        }
      }

      // Calculate total
      const total = subtotal.plus(tax);

      // Generate invoice number
      const invoiceNumber = await this.generateInvoiceNumber(subscription.tenant_id);

      // Calculate due date
      const dueDate = addDays(periodEnd, this.options.grace_period_days);

      // Create invoice in Stripe if auto-finalize is enabled
      let stripeInvoiceId = '';
      let pdfUrl = '';
      let hostedUrl = '';

      if (this.options.auto_finalize) {
        const stripeLineItems = lineItems.map(item => ({
          price_data: {
            currency: subscription.currency,
            product_data: {
              name: item.description
            },
            unit_amount: this.stripeService.convertAmountToStripe(item.unit_amount)
          },
          quantity: item.quantity
        }));

        const stripeInvoice = await this.stripeService.createInvoice(
          subscription.tenant_id, // This should be the Stripe customer ID
          stripeLineItems
        );

        stripeInvoiceId = stripeInvoice.id;
        pdfUrl = stripeInvoice.invoice_pdf || '';
        hostedUrl = stripeInvoice.hosted_invoice_url || '';
      }

      // Save invoice to our database
      const invoice = await this.storage.saveInvoice({
        tenant_id: subscription.tenant_id,
        subscription_id: subscription.id,
        stripe_invoice_id: stripeInvoiceId,
        number: invoiceNumber,
        status: this.options.auto_finalize ? 'open' : 'draft',
        currency: subscription.currency,
        subtotal,
        tax,
        discount: new Decimal(0), // TODO: Handle discounts
        total,
        amount_paid: new Decimal(0),
        amount_due: total,
        period_start: periodStart,
        period_end: periodEnd,
        due_date: dueDate,
        pdf_url: pdfUrl,
        hosted_url: hostedUrl,
        metadata: {
          plan_id: subscription.plan_id,
          billing_interval: subscription.billing_interval,
          auto_generated: true
        }
      });

      // Save line items
      for (const lineItem of lineItems) {
        await this.storage.saveInvoiceLineItem({
          ...lineItem,
          invoice_id: invoice.id
        });
      }

      // Send notification if enabled
      if (this.options.send_notification && this.notificationService) {
        await this.sendInvoiceNotification(invoice, 'invoice_created');
      }

      return invoice;
    } catch (error) {
      throw new BillingError(
        'Failed to generate invoice',
        'INVOICE_GENERATION_FAILED',
        500,
        { error, subscription_id: subscription.id }
      );
    }
  }

  /**
   * Generate invoice for usage overages
   */
  async generateUsageInvoice(
    subscription: Subscription,
    usageAggregates: UsageAggregate[]
  ): Promise<Invoice | null> {
    const plan = this.planService.getPlan(subscription.plan_id);
    if (!plan) {
      throw new BillingError('Plan not found for subscription', 'PLAN_NOT_FOUND', 404);
    }

    let hasOverages = false;
    let subtotal = new Decimal(0);
    const lineItems: Omit<InvoiceLineItem, 'id' | 'invoice_id'>[] = [];

    for (const aggregate of usageAggregates) {
      const overageQuantity = Math.max(0, aggregate.overage_quantity);
      if (overageQuantity > 0) {
        const usageLimit = plan.usage_limits.find(limit => limit.type === aggregate.usage_type);
        if (usageLimit && usageLimit.overage_rate) {
          hasOverages = true;
          const overageAmount = usageLimit.overage_rate.mul(overageQuantity);

          lineItems.push({
            description: `${aggregate.usage_type.toUpperCase()} Overage - ${overageQuantity} units`,
            quantity: overageQuantity,
            unit_amount: usageLimit.overage_rate,
            amount: overageAmount,
            usage_type: aggregate.usage_type,
            period_start: aggregate.period_start,
            period_end: aggregate.period_end
          });

          subtotal = subtotal.plus(overageAmount);
        }
      }
    }

    // Don't create invoice if no overages
    if (!hasOverages) {
      return null;
    }

    // Calculate tax
    let tax = new Decimal(0);
    if (this.options.include_tax && this.taxService) {
      const taxResult = await this.taxService.calculateTax(subtotal, subscription.tenant_id);
      tax = taxResult.tax_amount;

      if (tax.greaterThan(0)) {
        lineItems.push({
          description: taxResult.tax_description,
          quantity: 1,
          unit_amount: tax,
          amount: tax
        });
      }
    }

    const total = subtotal.plus(tax);
    const invoiceNumber = await this.generateInvoiceNumber(subscription.tenant_id);
    const dueDate = addDays(new Date(), this.options.grace_period_days);

    // Save invoice
    const invoice = await this.storage.saveInvoice({
      tenant_id: subscription.tenant_id,
      subscription_id: subscription.id,
      stripe_invoice_id: '',
      number: invoiceNumber,
      status: 'draft',
      currency: subscription.currency,
      subtotal,
      tax,
      discount: new Decimal(0),
      total,
      amount_paid: new Decimal(0),
      amount_due: total,
      period_start: usageAggregates[0]?.period_start || new Date(),
      period_end: usageAggregates[0]?.period_end || new Date(),
      due_date: dueDate,
      metadata: {
        plan_id: subscription.plan_id,
        invoice_type: 'usage_overage',
        auto_generated: true
      }
    });

    // Save line items
    for (const lineItem of lineItems) {
      await this.storage.saveInvoiceLineItem({
        ...lineItem,
        invoice_id: invoice.id
      });
    }

    return invoice;
  }

  /**
   * Finalize draft invoice
   */
  async finalizeInvoice(invoiceId: string): Promise<Invoice> {
    const invoice = await this.storage.getInvoice(invoiceId);
    if (!invoice) {
      throw new BillingError('Invoice not found', 'INVOICE_NOT_FOUND', 404);
    }

    if (invoice.status !== 'draft') {
      throw new BillingError('Only draft invoices can be finalized', 'INVALID_INVOICE_STATUS', 400);
    }

    // Create in Stripe if not already created
    if (!invoice.stripe_invoice_id) {
      const lineItems = await this.storage.getLineItemsByInvoice(invoiceId);
      const stripeLineItems = lineItems.map(item => ({
        price_data: {
          currency: invoice.currency,
          product_data: {
            name: item.description
          },
          unit_amount: this.stripeService.convertAmountToStripe(item.unit_amount)
        },
        quantity: item.quantity
      }));

      const stripeInvoice = await this.stripeService.createInvoice(
        invoice.tenant_id,
        stripeLineItems
      );

      // Update invoice with Stripe data
      await this.storage.updateInvoiceStatus(invoiceId, 'open');
      
      // Update the local invoice object
      invoice.status = 'open';
      invoice.stripe_invoice_id = stripeInvoice.id;
      invoice.pdf_url = stripeInvoice.invoice_pdf || '';
      invoice.hosted_url = stripeInvoice.hosted_invoice_url || '';
    }

    // Send notification
    if (this.notificationService) {
      await this.sendInvoiceNotification(invoice, 'invoice_finalized');
    }

    return invoice;
  }

  /**
   * Mark invoice as paid
   */
  async markInvoicePaid(invoiceId: string, paidAt?: Date): Promise<Invoice> {
    const invoice = await this.storage.getInvoice(invoiceId);
    if (!invoice) {
      throw new BillingError('Invoice not found', 'INVOICE_NOT_FOUND', 404);
    }

    const paymentDate = paidAt || new Date();
    await this.storage.updateInvoiceStatus(invoiceId, 'paid', paymentDate);

    // Update local invoice object
    invoice.status = 'paid';
    invoice.paid_at = paymentDate;
    invoice.amount_paid = invoice.total;
    invoice.amount_due = new Decimal(0);

    // Send notification
    if (this.notificationService) {
      await this.sendInvoiceNotification(invoice, 'invoice_paid');
    }

    return invoice;
  }

  /**
   * Void an invoice
   */
  async voidInvoice(invoiceId: string, reason?: string): Promise<Invoice> {
    const invoice = await this.storage.getInvoice(invoiceId);
    if (!invoice) {
      throw new BillingError('Invoice not found', 'INVOICE_NOT_FOUND', 404);
    }

    if (invoice.status === 'paid') {
      throw new BillingError('Cannot void a paid invoice', 'INVALID_INVOICE_STATUS', 400);
    }

    // Void in Stripe if it exists
    if (invoice.stripe_invoice_id) {
      await this.stripeService.voidInvoice(invoice.stripe_invoice_id);
    }

    await this.storage.updateInvoiceStatus(invoiceId, 'void');
    
    invoice.status = 'void';

    // Send notification
    if (this.notificationService) {
      await this.sendInvoiceNotification(invoice, 'invoice_voided');
    }

    return invoice;
  }

  /**
   * Get invoice with line items
   */
  async getInvoiceWithDetails(invoiceId: string): Promise<{
    invoice: Invoice;
    line_items: InvoiceLineItem[];
  }> {
    const invoice = await this.storage.getInvoice(invoiceId);
    if (!invoice) {
      throw new BillingError('Invoice not found', 'INVOICE_NOT_FOUND', 404);
    }

    const lineItems = await this.storage.getLineItemsByInvoice(invoiceId);

    return {
      invoice,
      line_items: lineItems
    };
  }

  /**
   * Get invoices for a tenant
   */
  async getTenantInvoices(
    tenantId: string,
    limit: number = 50,
    offset: number = 0,
    status?: string
  ): Promise<{
    invoices: Invoice[];
    total_count: number;
    has_more: boolean;
  }> {
    let invoices = await this.storage.getInvoicesByTenant(tenantId, limit + 1, offset);

    // Filter by status if provided
    if (status) {
      invoices = invoices.filter(invoice => invoice.status === status);
    }

    const hasMore = invoices.length > limit;
    if (hasMore) {
      invoices = invoices.slice(0, limit);
    }

    return {
      invoices,
      total_count: invoices.length, // This would typically be a separate query
      has_more: hasMore
    };
  }

  /**
   * Calculate upcoming invoice preview
   */
  async previewUpcomingInvoice(subscriptionId: string): Promise<{
    estimated_total: Decimal;
    line_items: Array<{
      description: string;
      amount: Decimal;
      type: 'subscription' | 'usage' | 'tax';
    }>;
    period_start: Date;
    period_end: Date;
  }> {
    // This would calculate what the next invoice would look like
    // based on current usage and subscription details
    
    // Get current period
    const now = new Date();
    const periodStart = startOfMonth(now);
    const periodEnd = endOfMonth(now);

    // Mock implementation - in reality, this would fetch subscription
    // and calculate based on current usage
    const lineItems = [
      {
        description: 'Pro Plan - Current Period',
        amount: new Decimal(29),
        type: 'subscription' as const
      }
    ];

    const estimatedTotal = lineItems.reduce((sum, item) => sum.plus(item.amount), new Decimal(0));

    return {
      estimated_total: estimatedTotal,
      line_items: lineItems,
      period_start: periodStart,
      period_end: periodEnd
    };
  }

  // Private helper methods

  private async calculateUsageCharges(
    tenantId: string,
    plan: Plan,
    periodStart: Date,
    periodEnd: Date
  ): Promise<Omit<InvoiceLineItem, 'id' | 'invoice_id'>[]> {
    const lineItems: Omit<InvoiceLineItem, 'id' | 'invoice_id'>[] = [];

    // Get usage summary for the period
    const usageSummary = await this.usageService.getUsageSummary(tenantId, periodStart, periodEnd);

    for (const [usageType, usage] of Object.entries(usageSummary.usage_by_type)) {
      if (usage.overage > 0) {
        const usageLimit = plan.usage_limits.find(limit => limit.type === usageType as UsageType);
        if (usageLimit && usageLimit.overage_rate) {
          const overageAmount = usageLimit.overage_rate.mul(usage.overage);

          lineItems.push({
            description: `${usageType.toUpperCase()} Overage - ${usage.overage} units`,
            quantity: usage.overage,
            unit_amount: usageLimit.overage_rate,
            amount: overageAmount,
            usage_type: usageType as UsageType,
            period_start: periodStart,
            period_end: periodEnd
          });
        }
      }
    }

    return lineItems;
  }

  private async generateInvoiceNumber(tenantId: string): Promise<string> {
    // Generate a unique invoice number
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const timestamp = now.getTime().toString().slice(-6);
    const tenantPrefix = tenantId.substring(0, 4).toUpperCase();
    
    return `INV-${year}${month}-${tenantPrefix}-${timestamp}`;
  }

  private async sendInvoiceNotification(invoice: Invoice, eventType: string): Promise<void> {
    if (!this.notificationService) return;

    const notificationMap: Record<string, { subject: string; template: string; }> = {
      'invoice_created': {
        subject: `New Invoice - ${invoice.number}`,
        template: 'invoice_created'
      },
      'invoice_finalized': {
        subject: `Invoice Ready - ${invoice.number}`,
        template: 'invoice_finalized'
      },
      'invoice_paid': {
        subject: `Payment Received - ${invoice.number}`,
        template: 'invoice_paid'
      },
      'invoice_voided': {
        subject: `Invoice Cancelled - ${invoice.number}`,
        template: 'invoice_voided'
      },
      'invoice_overdue': {
        subject: `Overdue Invoice - ${invoice.number}`,
        template: 'invoice_overdue'
      }
    };

    const notificationData = notificationMap[eventType];
    if (!notificationData) return;

    const notification: BillingNotification = {
      type: 'email',
      recipient: `tenant_${invoice.tenant_id}@notifications.penny.com`,
      subject: notificationData.subject,
      template: notificationData.template,
      data: {
        invoice_id: invoice.id,
        invoice_number: invoice.number,
        amount: invoice.total.toString(),
        currency: invoice.currency,
        due_date: invoice.due_date.toISOString(),
        hosted_url: invoice.hosted_url,
        pdf_url: invoice.pdf_url
      }
    };

    await this.notificationService.sendNotification(notification);
  }
}