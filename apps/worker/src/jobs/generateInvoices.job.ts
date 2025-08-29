import { Job, Worker, Queue } from 'bullmq';
import { BillingService } from '@penny/billing';
import { startOfMonth, endOfMonth, addDays, isAfter } from 'date-fns';

export interface InvoiceGenerationJobData {
  tenant_id?: string; // If provided, generate for specific tenant
  subscription_id?: string; // If provided, generate for specific subscription
  invoice_type: 'subscription' | 'overage' | 'usage';
  period_start?: string;
  period_end?: string;
  force_regeneration?: boolean;
}

export class InvoiceGenerationService {
  private billingService: BillingService;
  private queue: Queue<InvoiceGenerationJobData>;
  private worker: Worker<InvoiceGenerationJobData>;

  constructor(
    billingService: BillingService,
    redisConfig: { host: string; port: number; }
  ) {
    this.billingService = billingService;

    // Create queue
    this.queue = new Queue<InvoiceGenerationJobData>('invoice-generation', {
      connection: redisConfig,
      defaultJobOptions: {
        removeOnComplete: 200,
        removeOnFail: 100,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        }
      }
    });

    // Create worker
    this.worker = new Worker<InvoiceGenerationJobData>(
      'invoice-generation',
      this.processInvoiceGeneration.bind(this),
      {
        connection: redisConfig,
        concurrency: 3, // Lower concurrency for invoice generation
        limiter: {
          max: 50,
          duration: 60000, // 50 invoices per minute
        }
      }
    );

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.worker.on('completed', (job) => {
      console.log(`Invoice generation job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Invoice generation job ${job?.id} failed:`, err);
    });

    this.worker.on('error', (err) => {
      console.error('Invoice generation worker error:', err);
    });
  }

  /**
   * Schedule invoice generation job
   */
  async scheduleInvoiceGeneration(data: InvoiceGenerationJobData): Promise<Job<InvoiceGenerationJobData>> {
    return await this.queue.add('generate-invoice', data, {
      jobId: `invoice-gen-${data.subscription_id || data.tenant_id}-${Date.now()}`,
      delay: 0
    });
  }

  /**
   * Schedule monthly invoice generation for all subscriptions
   */
  async scheduleMonthlyInvoiceGeneration(): Promise<void> {
    await this.queue.add('generate-monthly-invoices', {
      invoice_type: 'subscription'
    }, {
      repeat: { cron: '0 0 1 * *' }, // First day of month at midnight
      jobId: 'monthly-invoice-generation'
    });
  }

  /**
   * Process invoice generation job
   */
  private async processInvoiceGeneration(job: Job<InvoiceGenerationJobData>): Promise<void> {
    const { tenant_id, subscription_id, invoice_type, period_start, period_end, force_regeneration } = job.data;

    console.log(`Processing invoice generation job:`, job.data);

    try {
      await job.updateProgress(10);

      switch (invoice_type) {
        case 'subscription':
          await this.generateSubscriptionInvoices(tenant_id, subscription_id, period_start, period_end);
          break;
        case 'overage':
          await this.generateOverageInvoices(tenant_id, subscription_id);
          break;
        case 'usage':
          await this.generateUsageInvoices(tenant_id, subscription_id, period_start, period_end);
          break;
      }

      await job.updateProgress(100);
    } catch (error) {
      console.error('Invoice generation job failed:', error);
      throw error;
    }
  }

  /**
   * Generate subscription invoices
   */
  private async generateSubscriptionInvoices(
    tenantId?: string,
    subscriptionId?: string,
    periodStart?: string,
    periodEnd?: string
  ): Promise<void> {
    if (subscriptionId) {
      // Generate for specific subscription
      await this.generateSubscriptionInvoice(subscriptionId, periodStart, periodEnd);
    } else if (tenantId) {
      // Generate for tenant's subscription
      const subscription = await this.billingService.getTenantSubscription(tenantId);
      if (subscription) {
        await this.generateSubscriptionInvoice(subscription.id, periodStart, periodEnd);
      }
    } else {
      // Generate for all active subscriptions
      await this.generateAllSubscriptionInvoices(periodStart, periodEnd);
    }
  }

  /**
   * Generate invoice for a specific subscription
   */
  private async generateSubscriptionInvoice(
    subscriptionId: string,
    periodStart?: string,
    periodEnd?: string
  ): Promise<void> {
    try {
      const startDate = periodStart ? new Date(periodStart) : startOfMonth(new Date());
      const endDate = periodEnd ? new Date(periodEnd) : endOfMonth(new Date());

      console.log(`Generating subscription invoice for ${subscriptionId}, period: ${startDate} - ${endDate}`);

      const invoice = await this.billingService.generateInvoice(subscriptionId, startDate, endDate);
      
      console.log(`Successfully generated invoice ${invoice.id} for subscription ${subscriptionId}`);

      // Schedule follow-up jobs if needed
      await this.scheduleInvoiceFollowUp(invoice.id);
      
    } catch (error) {
      console.error(`Failed to generate invoice for subscription ${subscriptionId}:`, error);
      throw error;
    }
  }

  /**
   * Generate invoices for all active subscriptions
   */
  private async generateAllSubscriptionInvoices(periodStart?: string, periodEnd?: string): Promise<void> {
    const subscriptions = await this.getAllActiveSubscriptions();
    
    for (const subscription of subscriptions) {
      try {
        await this.generateSubscriptionInvoice(subscription.id, periodStart, periodEnd);
        
        // Add delay between invoices to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Failed to generate invoice for subscription ${subscription.id}:`, error);
        // Continue with other subscriptions
      }
    }
  }

  /**
   * Generate overage invoices for usage beyond limits
   */
  private async generateOverageInvoices(tenantId?: string, subscriptionId?: string): Promise<void> {
    console.log(`Generating overage invoices for tenant: ${tenantId}, subscription: ${subscriptionId}`);
    
    if (subscriptionId) {
      await this.generateOverageInvoice(subscriptionId);
    } else if (tenantId) {
      const subscription = await this.billingService.getTenantSubscription(tenantId);
      if (subscription) {
        await this.generateOverageInvoice(subscription.id);
      }
    } else {
      // Generate overage invoices for all subscriptions with usage overages
      const subscriptions = await this.getSubscriptionsWithOverage();
      
      for (const subscription of subscriptions) {
        try {
          await this.generateOverageInvoice(subscription.id);
        } catch (error) {
          console.error(`Failed to generate overage invoice for subscription ${subscription.id}:`, error);
        }
      }
    }
  }

  /**
   * Generate overage invoice for a specific subscription
   */
  private async generateOverageInvoice(subscriptionId: string): Promise<void> {
    try {
      // This would be implemented with the actual billing service
      console.log(`Generating overage invoice for subscription ${subscriptionId}`);
      
      // Mock implementation - in reality this would:
      // 1. Get usage aggregates for the period
      // 2. Calculate overage charges
      // 3. Generate invoice with overage line items
      // 4. Send notification
      
    } catch (error) {
      console.error(`Failed to generate overage invoice for subscription ${subscriptionId}:`, error);
      throw error;
    }
  }

  /**
   * Generate usage-based invoices
   */
  private async generateUsageInvoices(
    tenantId?: string,
    subscriptionId?: string,
    periodStart?: string,
    periodEnd?: string
  ): Promise<void> {
    console.log(`Generating usage invoices for tenant: ${tenantId}, subscription: ${subscriptionId}`);
    
    // Implementation would be similar to subscription invoices but focused on metered usage
  }

  /**
   * Schedule follow-up actions after invoice generation
   */
  private async scheduleInvoiceFollowUp(invoiceId: string): Promise<void> {
    // Schedule email notification
    // await this.notificationService.scheduleInvoiceNotification(invoiceId);
    
    // Schedule payment reminder if needed
    // await this.schedulePaymentReminder(invoiceId);
    
    console.log(`Scheduled follow-up actions for invoice ${invoiceId}`);
  }

  /**
   * Process failed payment invoices
   */
  async processFailedPaymentInvoices(): Promise<void> {
    console.log('Processing failed payment invoices');
    
    const failedInvoices = await this.getFailedPaymentInvoices();
    
    for (const invoice of failedInvoices) {
      try {
        await this.handleFailedPaymentInvoice(invoice);
      } catch (error) {
        console.error(`Failed to process failed payment invoice ${invoice.id}:`, error);
      }
    }
  }

  /**
   * Handle a specific failed payment invoice
   */
  private async handleFailedPaymentInvoice(invoice: any): Promise<void> {
    console.log(`Handling failed payment invoice ${invoice.id}`);
    
    // Implementation would:
    // 1. Update invoice status
    // 2. Schedule payment retry
    // 3. Send dunning notification
    // 4. Apply late fees if configured
    // 5. Suspend services if appropriate
  }

  /**
   * Generate summary reports
   */
  async generateBillingSummaryReports(period: 'daily' | 'weekly' | 'monthly'): Promise<void> {
    console.log(`Generating billing summary reports for ${period} period`);
    
    // This would generate:
    // - Revenue summaries
    // - Invoice statistics
    // - Payment failure rates
    // - Customer billing health
    // - Overage patterns
  }

  /**
   * Cleanup old invoices
   */
  async cleanupOldInvoices(retentionYears: number = 7): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - retentionYears);
    
    console.log(`Cleaning up invoices older than ${cutoffDate.toISOString()}`);
    
    // Implementation would archive or delete old invoices according to retention policy
  }

  // Helper methods (placeholder implementations)
  private async getAllActiveSubscriptions(): Promise<any[]> {
    // Mock implementation - would query database for active subscriptions
    return [
      { id: 'sub_1', tenant_id: 'tenant_1' },
      { id: 'sub_2', tenant_id: 'tenant_2' },
      { id: 'sub_3', tenant_id: 'tenant_3' }
    ];
  }

  private async getSubscriptionsWithOverage(): Promise<any[]> {
    // Mock implementation - would query for subscriptions with usage overages
    return [
      { id: 'sub_2', tenant_id: 'tenant_2' }
    ];
  }

  private async getFailedPaymentInvoices(): Promise<any[]> {
    // Mock implementation - would query for invoices with failed payments
    return [];
  }

  /**
   * Close worker and queue connections
   */
  async close(): Promise<void> {
    await this.worker.close();
    await this.queue.close();
  }

  /**
   * Get queue status
   */
  async getQueueStatus() {
    const waiting = await this.queue.getWaiting();
    const active = await this.queue.getActive();
    const completed = await this.queue.getCompleted();
    const failed = await this.queue.getFailed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length
    };
  }
}