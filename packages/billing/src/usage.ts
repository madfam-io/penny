import Decimal from 'decimal.js';
import { addMinutes, startOfHour, endOfHour, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import {
  UsageType,
  UsageRecord,
  UsageAggregate,
  UsageLimit,
  Plan,
  Subscription,
  RecordUsageRequest,
  BillingError,
  UsageLimitError,
  BillingNotification
} from './types';
import { PlanService } from './plans';

export interface UsageTrackingOptions {
  aggregation_interval_minutes: number;
  enable_soft_limits: boolean;
  enable_hard_limits: boolean;
  enable_notifications: boolean;
  grace_period_percentage: number; // Additional usage allowed beyond hard limit
}

export interface UsageStorage {
  recordUsage(record: Omit<UsageRecord, 'id' | 'created_at'>): Promise<UsageRecord>;
  getUsageRecords(tenantId: string, usageType: UsageType, startDate: Date, endDate: Date): Promise<UsageRecord[]>;
  getUsageAggregate(tenantId: string, usageType: UsageType, startDate: Date, endDate: Date): Promise<UsageAggregate>;
  getUsageAggregates(tenantId: string, startDate: Date, endDate: Date): Promise<UsageAggregate[]>;
}

export interface UsageNotificationService {
  sendNotification(notification: BillingNotification): Promise<void>;
}

export class UsageService {
  private options: UsageTrackingOptions;
  private storage: UsageStorage;
  private planService: PlanService;
  private notificationService?: UsageNotificationService;

  constructor(
    storage: UsageStorage,
    planService: PlanService,
    options: UsageTrackingOptions,
    notificationService?: UsageNotificationService
  ) {
    this.storage = storage;
    this.planService = planService;
    this.options = options;
    this.notificationService = notificationService;
  }

  /**
   * Record usage for a tenant
   */
  async recordUsage(
    tenantId: string,
    subscriptionId: string,
    request: RecordUsageRequest
  ): Promise<{ 
    record: UsageRecord; 
    limit_exceeded: boolean; 
    current_usage: number; 
    limit: number; 
  }> {
    const timestamp = request.timestamp || new Date();

    // Determine aggregation period
    const periodStart = this.getAggregationPeriodStart(timestamp);
    const periodEnd = this.getAggregationPeriodEnd(periodStart);

    // Create usage record
    const record = await this.storage.recordUsage({
      tenant_id: tenantId,
      subscription_id: subscriptionId,
      usage_type: request.usage_type,
      quantity: request.quantity,
      period_start: periodStart,
      period_end: periodEnd,
      metadata: request.metadata
    });

    // Check limits and get current usage
    const { limit_exceeded, current_usage, limit } = await this.checkUsageLimits(
      tenantId,
      request.usage_type,
      periodStart,
      periodEnd
    );

    // Send notifications if limits are exceeded
    if (limit_exceeded && this.options.enable_notifications && this.notificationService) {
      await this.sendLimitNotification(tenantId, request.usage_type, current_usage, limit);
    }

    return {
      record,
      limit_exceeded,
      current_usage,
      limit
    };
  }

  /**
   * Get current usage for a tenant and usage type
   */
  async getCurrentUsage(tenantId: string, usageType: UsageType, period?: 'hour' | 'day' | 'month'): Promise<{
    current_usage: number;
    limit: number;
    percentage_used: number;
    period_start: Date;
    period_end: Date;
  }> {
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
      default:
        periodStart = startOfMonth(now);
        periodEnd = endOfMonth(now);
        break;
    }

    const aggregate = await this.storage.getUsageAggregate(tenantId, usageType, periodStart, periodEnd);
    const limit = aggregate.limit || 0;
    const currentUsage = aggregate.total_quantity || 0;
    const percentageUsed = limit > 0 ? (currentUsage / limit) * 100 : 0;

    return {
      current_usage: currentUsage,
      limit,
      percentage_used: Math.min(percentageUsed, 100),
      period_start: periodStart,
      period_end: periodEnd
    };
  }

  /**
   * Get usage summary for a tenant
   */
  async getUsageSummary(tenantId: string, periodStart?: Date, periodEnd?: Date): Promise<{
    period_start: Date;
    period_end: Date;
    usage_by_type: Record<UsageType, {
      current_usage: number;
      limit: number;
      percentage_used: number;
      overage: number;
      limit_exceeded: boolean;
    }>;
    total_overage_cost: Decimal;
  }> {
    const now = new Date();
    const start = periodStart || startOfMonth(now);
    const end = periodEnd || endOfMonth(now);

    const aggregates = await this.storage.getUsageAggregates(tenantId, start, end);
    const usageByType: Record<string, any> = {};
    let totalOverageCost = new Decimal(0);

    for (const aggregate of aggregates) {
      const currentUsage = aggregate.total_quantity;
      const limit = aggregate.limit;
      const overage = Math.max(0, currentUsage - limit);
      const percentageUsed = limit > 0 ? Math.min((currentUsage / limit) * 100, 100) : 0;
      const limitExceeded = currentUsage > limit;

      // Calculate overage cost
      const overageCost = await this.calculateOverageCost(tenantId, aggregate.usage_type, overage);
      totalOverageCost = totalOverageCost.plus(overageCost);

      usageByType[aggregate.usage_type] = {
        current_usage: currentUsage,
        limit,
        percentage_used: percentageUsed,
        overage,
        limit_exceeded: limitExceeded
      };
    }

    return {
      period_start: start,
      period_end: end,
      usage_by_type: usageByType as any,
      total_overage_cost: totalOverageCost
    };
  }

  /**
   * Calculate overage cost for usage above limits
   */
  async calculateOverageCost(tenantId: string, usageType: UsageType, overageQuantity: number): Promise<Decimal> {
    if (overageQuantity <= 0) {
      return new Decimal(0);
    }

    // This would typically get the tenant's current plan from the database
    // For now, we'll assume we can get it from the plan service
    const plan = await this.getTenantPlan(tenantId);
    if (!plan) {
      return new Decimal(0);
    }

    const usageLimit = plan.usage_limits.find(limit => limit.type === usageType);
    if (!usageLimit || !usageLimit.overage_rate) {
      return new Decimal(0);
    }

    return usageLimit.overage_rate.mul(overageQuantity);
  }

  /**
   * Check if usage limits are exceeded
   */
  async checkUsageLimits(
    tenantId: string,
    usageType: UsageType,
    periodStart: Date,
    periodEnd: Date
  ): Promise<{ limit_exceeded: boolean; current_usage: number; limit: number; }> {
    const aggregate = await this.storage.getUsageAggregate(tenantId, usageType, periodStart, periodEnd);
    const currentUsage = aggregate.total_quantity;
    const limit = aggregate.limit;

    const limitExceeded = this.options.enable_hard_limits && currentUsage > limit;

    return {
      limit_exceeded: limitExceeded,
      current_usage: currentUsage,
      limit
    };
  }

  /**
   * Validate if usage is allowed (check hard limits)
   */
  async validateUsage(
    tenantId: string,
    usageType: UsageType,
    requestedQuantity: number
  ): Promise<{ allowed: boolean; reason?: string; current_usage: number; limit: number; }> {
    if (!this.options.enable_hard_limits) {
      return { allowed: true, current_usage: 0, limit: -1 };
    }

    const now = new Date();
    const periodStart = startOfMonth(now);
    const periodEnd = endOfMonth(now);

    const aggregate = await this.storage.getUsageAggregate(tenantId, usageType, periodStart, periodEnd);
    const currentUsage = aggregate.total_quantity;
    const limit = aggregate.limit;

    if (limit === -1) {
      return { allowed: true, current_usage: currentUsage, limit };
    }

    const projectedUsage = currentUsage + requestedQuantity;
    const graceLimit = limit * (1 + this.options.grace_period_percentage / 100);

    if (projectedUsage <= graceLimit) {
      return { allowed: true, current_usage: currentUsage, limit };
    }

    return {
      allowed: false,
      reason: `Usage would exceed limit. Current: ${currentUsage}, Limit: ${limit}, Requested: ${requestedQuantity}`,
      current_usage: currentUsage,
      limit
    };
  }

  /**
   * Get usage trends for analytics
   */
  async getUsageTrends(
    tenantId: string,
    usageType: UsageType,
    days: number = 30
  ): Promise<{
    daily_usage: Array<{ date: Date; usage: number; }>;
    trend_direction: 'up' | 'down' | 'stable';
    average_daily_usage: number;
    peak_usage: number;
    total_usage: number;
  }> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));

    const records = await this.storage.getUsageRecords(tenantId, usageType, startDate, endDate);

    // Group by day
    const dailyUsage = new Map<string, number>();
    let totalUsage = 0;

    for (const record of records) {
      const dateKey = startOfDay(record.period_start).toISOString().split('T')[0];
      dailyUsage.set(dateKey, (dailyUsage.get(dateKey) || 0) + record.quantity);
      totalUsage += record.quantity;
    }

    const dailyUsageArray = Array.from(dailyUsage.entries()).map(([date, usage]) => ({
      date: new Date(date),
      usage
    })).sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculate trend
    const averageDailyUsage = totalUsage / days;
    const peakUsage = Math.max(...dailyUsageArray.map(d => d.usage), 0);

    // Simple trend calculation (compare first half vs second half)
    const midPoint = Math.floor(dailyUsageArray.length / 2);
    const firstHalfAverage = dailyUsageArray.slice(0, midPoint).reduce((sum, d) => sum + d.usage, 0) / midPoint;
    const secondHalfAverage = dailyUsageArray.slice(midPoint).reduce((sum, d) => sum + d.usage, 0) / (dailyUsageArray.length - midPoint);

    let trendDirection: 'up' | 'down' | 'stable' = 'stable';
    const trendThreshold = 0.1; // 10% change threshold

    if (secondHalfAverage > firstHalfAverage * (1 + trendThreshold)) {
      trendDirection = 'up';
    } else if (secondHalfAverage < firstHalfAverage * (1 - trendThreshold)) {
      trendDirection = 'down';
    }

    return {
      daily_usage: dailyUsageArray,
      trend_direction: trendDirection,
      average_daily_usage: averageDailyUsage,
      peak_usage: peakUsage,
      total_usage: totalUsage
    };
  }

  /**
   * Reset usage for testing or admin purposes
   */
  async resetUsage(tenantId: string, usageType?: UsageType): Promise<void> {
    // This would typically delete or archive usage records
    // Implementation depends on the storage backend
    throw new BillingError('Usage reset not implemented', 'USAGE_RESET_NOT_IMPLEMENTED', 501);
  }

  /**
   * Bulk record usage (for batch operations)
   */
  async bulkRecordUsage(
    records: Array<{
      tenant_id: string;
      subscription_id: string;
      usage_type: UsageType;
      quantity: number;
      timestamp?: Date;
      metadata?: Record<string, any>;
    }>
  ): Promise<{ 
    successful: UsageRecord[]; 
    failed: Array<{ record: any; error: string; }>; 
  }> {
    const successful: UsageRecord[] = [];
    const failed: Array<{ record: any; error: string; }> = [];

    for (const recordData of records) {
      try {
        const result = await this.recordUsage(
          recordData.tenant_id,
          recordData.subscription_id,
          {
            usage_type: recordData.usage_type,
            quantity: recordData.quantity,
            timestamp: recordData.timestamp,
            metadata: recordData.metadata
          }
        );
        successful.push(result.record);
      } catch (error) {
        failed.push({
          record: recordData,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return { successful, failed };
  }

  // Private helper methods

  private getAggregationPeriodStart(timestamp: Date): Date {
    const intervalMinutes = this.options.aggregation_interval_minutes;
    const roundedMinutes = Math.floor(timestamp.getMinutes() / intervalMinutes) * intervalMinutes;
    
    const periodStart = new Date(timestamp);
    periodStart.setMinutes(roundedMinutes);
    periodStart.setSeconds(0);
    periodStart.setMilliseconds(0);
    
    return periodStart;
  }

  private getAggregationPeriodEnd(periodStart: Date): Date {
    return addMinutes(periodStart, this.options.aggregation_interval_minutes);
  }

  private async sendLimitNotification(
    tenantId: string,
    usageType: UsageType,
    currentUsage: number,
    limit: number
  ): Promise<void> {
    if (!this.notificationService) return;

    const percentageUsed = (currentUsage / limit) * 100;
    let notificationType: string;
    let urgency: string;

    if (percentageUsed >= 100) {
      notificationType = 'usage_limit_exceeded';
      urgency = 'high';
    } else if (percentageUsed >= 90) {
      notificationType = 'usage_limit_warning';
      urgency = 'medium';
    } else {
      return; // Don't send notification for lower usage
    }

    const notification: BillingNotification = {
      type: 'email',
      recipient: `tenant_${tenantId}@notifications.penny.com`, // This would be dynamic
      subject: `Usage Limit ${percentageUsed >= 100 ? 'Exceeded' : 'Warning'} - ${usageType}`,
      template: notificationType,
      data: {
        tenant_id: tenantId,
        usage_type: usageType,
        current_usage: currentUsage,
        limit: limit,
        percentage_used: Math.round(percentageUsed),
        urgency
      }
    };

    await this.notificationService.sendNotification(notification);
  }

  private async getTenantPlan(tenantId: string): Promise<Plan | null> {
    // This would typically fetch the tenant's current plan from the database
    // For now, return null as we don't have database integration here
    // In real implementation, this would query the subscription and get the associated plan
    return null;
  }
}

// Utility functions for usage calculations
export class UsageCalculator {
  /**
   * Calculate token usage from text
   */
  static estimateTokens(text: string, model: string = 'gpt-4'): number {
    // Simple estimation - in reality, you'd use the actual tokenizer
    const avgCharsPerToken = model.includes('gpt-4') ? 4 : 3;
    return Math.ceil(text.length / avgCharsPerToken);
  }

  /**
   * Calculate storage usage from file size
   */
  static calculateStorageUsage(fileSizeBytes: number): number {
    return fileSizeBytes;
  }

  /**
   * Calculate API call complexity score
   */
  static calculateAPIComplexity(endpoint: string, payload?: any): number {
    const complexityScores: Record<string, number> = {
      'chat': 1,
      'tools': 2,
      'artifacts': 3,
      'admin': 2,
      'analytics': 2
    };

    const baseScore = complexityScores[endpoint] || 1;
    
    // Add complexity based on payload size
    if (payload) {
      const payloadSize = JSON.stringify(payload).length;
      const sizeMultiplier = Math.min(payloadSize / 1000, 3); // Max 3x multiplier
      return Math.ceil(baseScore * (1 + sizeMultiplier));
    }

    return baseScore;
  }

  /**
   * Calculate artifact processing complexity
   */
  static calculateArtifactComplexity(artifactType: string, sizeKB: number): number {
    const typeMultipliers: Record<string, number> = {
      'image': 2,
      'video': 5,
      'audio': 3,
      'document': 1,
      'code': 1,
      'data': 2
    };

    const baseComplexity = typeMultipliers[artifactType] || 1;
    const sizeMultiplier = Math.max(1, sizeKB / 100); // 1 point per 100KB

    return Math.ceil(baseComplexity * sizeMultiplier);
  }
}