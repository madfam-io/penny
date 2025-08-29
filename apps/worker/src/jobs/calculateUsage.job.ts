import { Job, Worker, Queue } from 'bullmq';
import { BillingService, UsageType } from '@penny/billing';
import { startOfHour, endOfHour, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';

export interface UsageCalculationJobData {
  tenant_id?: string; // If provided, calculate for specific tenant, otherwise all tenants
  usage_type?: UsageType; // If provided, calculate for specific usage type
  period: 'hour' | 'day' | 'month';
  force_recalculation?: boolean;
}

export class UsageCalculationService {
  private billingService: BillingService;
  private queue: Queue<UsageCalculationJobData>;
  private worker: Worker<UsageCalculationJobData>;

  constructor(
    billingService: BillingService,
    redisConfig: { host: string; port: number; }
  ) {
    this.billingService = billingService;

    // Create queue
    this.queue = new Queue<UsageCalculationJobData>('usage-calculation', {
      connection: redisConfig,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        }
      }
    });

    // Create worker
    this.worker = new Worker<UsageCalculationJobData>(
      'usage-calculation',
      this.processUsageCalculation.bind(this),
      {
        connection: redisConfig,
        concurrency: 5,
        limiter: {
          max: 100,
          duration: 60000, // 100 jobs per minute
        }
      }
    );

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.worker.on('completed', (job) => {
      console.log(`Usage calculation job ${job.id} completed for tenant ${job.data.tenant_id}`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Usage calculation job ${job?.id} failed:`, err);
    });

    this.worker.on('error', (err) => {
      console.error('Usage calculation worker error:', err);
    });
  }

  /**
   * Schedule usage calculation job
   */
  async scheduleUsageCalculation(data: UsageCalculationJobData): Promise<Job<UsageCalculationJobData>> {
    return await this.queue.add('calculate-usage', data, {
      // Prevent duplicate jobs for the same tenant and period
      jobId: `usage-calc-${data.tenant_id || 'all'}-${data.period}-${Date.now()}`,
      delay: 0
    });
  }

  /**
   * Schedule recurring usage calculations
   */
  async scheduleRecurringUsageCalculations(): Promise<void> {
    // Schedule hourly calculations
    await this.queue.add('calculate-usage', { period: 'hour' }, {
      repeat: { cron: '0 * * * *' }, // Every hour
      jobId: 'hourly-usage-calculation'
    });

    // Schedule daily calculations
    await this.queue.add('calculate-usage', { period: 'day' }, {
      repeat: { cron: '0 1 * * *' }, // Daily at 1 AM
      jobId: 'daily-usage-calculation'
    });

    // Schedule monthly calculations
    await this.queue.add('calculate-usage', { period: 'month' }, {
      repeat: { cron: '0 2 1 * *' }, // Monthly on 1st at 2 AM
      jobId: 'monthly-usage-calculation'
    });
  }

  /**
   * Process usage calculation job
   */
  private async processUsageCalculation(job: Job<UsageCalculationJobData>): Promise<void> {
    const { tenant_id, usage_type, period, force_recalculation = false } = job.data;

    console.log(`Processing usage calculation job for tenant: ${tenant_id || 'all'}, period: ${period}`);

    try {
      // Get period boundaries
      const now = new Date();
      let periodStart: Date;
      let periodEnd: Date;

      switch (period) {
        case 'hour':
          periodStart = startOfHour(now);
          periodEnd = endOfHour(now);
          break;
        case 'day':
          periodStart = startOfDay(now);
          periodEnd = endOfDay(now);
          break;
        case 'month':
          periodStart = startOfMonth(now);
          periodEnd = endOfMonth(now);
          break;
      }

      if (tenant_id) {
        // Calculate for specific tenant
        await this.calculateTenantUsage(tenant_id, usage_type, periodStart, periodEnd);
      } else {
        // Calculate for all tenants
        await this.calculateAllTenantsUsage(usage_type, periodStart, periodEnd);
      }

      await job.updateProgress(100);
    } catch (error) {
      console.error('Usage calculation job failed:', error);
      throw error;
    }
  }

  /**
   * Calculate usage for a specific tenant
   */
  private async calculateTenantUsage(
    tenantId: string,
    usageType: UsageType | undefined,
    periodStart: Date,
    periodEnd: Date
  ): Promise<void> {
    try {
      if (usageType) {
        // Calculate specific usage type
        const usage = await this.billingService.getCurrentUsage(tenantId, usageType);
        console.log(`Calculated ${usageType} usage for tenant ${tenantId}:`, usage);
      } else {
        // Calculate all usage types
        const usage = await this.billingService.getCurrentUsage(tenantId);
        console.log(`Calculated all usage for tenant ${tenantId}:`, usage);
      }

      // Check if tenant is approaching limits
      await this.checkUsageLimits(tenantId, periodStart, periodEnd);
      
    } catch (error) {
      console.error(`Failed to calculate usage for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate usage for all tenants
   */
  private async calculateAllTenantsUsage(
    usageType: UsageType | undefined,
    periodStart: Date,
    periodEnd: Date
  ): Promise<void> {
    // In a real implementation, this would fetch all tenants from the database
    // For now, we'll simulate with a placeholder
    const tenantIds = await this.getAllTenantIds();

    for (const tenantId of tenantIds) {
      try {
        await this.calculateTenantUsage(tenantId, usageType, periodStart, periodEnd);
      } catch (error) {
        console.error(`Failed to calculate usage for tenant ${tenantId}:`, error);
        // Continue with other tenants even if one fails
      }
    }
  }

  /**
   * Check usage limits and trigger notifications if needed
   */
  private async checkUsageLimits(tenantId: string, periodStart: Date, periodEnd: Date): Promise<void> {
    const usageTypes = [
      UsageType.MESSAGES,
      UsageType.TOKENS,
      UsageType.STORAGE,
      UsageType.USERS,
      UsageType.API_CALLS,
      UsageType.TOOLS,
      UsageType.ARTIFACTS
    ];

    for (const usageType of usageTypes) {
      try {
        const usage = await this.billingService.getCurrentUsage(tenantId, usageType);
        
        // Check for limit thresholds
        if (usage.percentage_used >= 90) {
          await this.triggerUsageAlert(tenantId, usageType, usage);
        }
        
        // Check for overage
        if (usage.current_usage > usage.limit && usage.limit !== -1) {
          await this.triggerOverageAlert(tenantId, usageType, usage);
        }
        
      } catch (error) {
        console.error(`Failed to check usage limits for ${usageType} on tenant ${tenantId}:`, error);
      }
    }
  }

  /**
   * Trigger usage alert notification
   */
  private async triggerUsageAlert(tenantId: string, usageType: UsageType, usage: any): Promise<void> {
    console.log(`Usage alert triggered for tenant ${tenantId}, type: ${usageType}`, {
      current_usage: usage.current_usage,
      limit: usage.limit,
      percentage_used: usage.percentage_used
    });

    // In a real implementation, this would:
    // 1. Create a notification job
    // 2. Send email/webhook notification
    // 3. Log the event for analytics
    
    // Schedule notification job (would be implemented)
    // await this.notificationService.scheduleUsageAlert(tenantId, usageType, usage);
  }

  /**
   * Trigger overage alert notification
   */
  private async triggerOverageAlert(tenantId: string, usageType: UsageType, usage: any): Promise<void> {
    console.log(`Overage alert triggered for tenant ${tenantId}, type: ${usageType}`, {
      current_usage: usage.current_usage,
      limit: usage.limit,
      overage: usage.current_usage - usage.limit
    });

    // In a real implementation, this would:
    // 1. Calculate overage charges
    // 2. Create billing event
    // 3. Schedule invoice generation
    // 4. Send overage notification
    
    // Schedule overage billing job (would be implemented)
    // await this.billingService.scheduleOverageBilling(tenantId, usageType, usage);
  }

  /**
   * Get all tenant IDs (placeholder implementation)
   */
  private async getAllTenantIds(): Promise<string[]> {
    // In a real implementation, this would query the database
    // Return mock tenant IDs for now
    return ['tenant_1', 'tenant_2', 'tenant_3'];
  }

  /**
   * Aggregate usage data for analytics
   */
  async aggregateUsageAnalytics(period: 'day' | 'week' | 'month'): Promise<void> {
    console.log(`Aggregating usage analytics for period: ${period}`);
    
    // This would calculate:
    // - Total usage across all tenants
    // - Usage trends
    // - Peak usage times
    // - Plan utilization rates
    // - Overage patterns
    
    // Store aggregated data for reporting
  }

  /**
   * Clean up old usage records
   */
  async cleanupOldUsageRecords(retentionDays: number = 365): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    console.log(`Cleaning up usage records older than ${cutoffDate.toISOString()}`);
    
    // This would delete old detailed usage records while keeping aggregated summaries
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

// Export job processor function for external usage
export async function processUsageCalculationJob(
  job: Job<UsageCalculationJobData>,
  billingService: BillingService
): Promise<void> {
  const service = new UsageCalculationService(billingService, {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
  });
  
  await service.processUsageCalculation(job);
}