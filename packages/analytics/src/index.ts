import { AnalyticsService } from './analytics';
import { EventTrackingService } from './events';
import { SegmentationService } from './segmentation';
import { ReportingService } from './reports';
import { InsightsService } from './insights';
import { ExportService } from './exports';

export * from './analytics';
export * from './events';
export * from './segmentation';
export * from './reports';
export * from './insights';
export * from './exports';
export * from './types';

/**
 * Complete analytics platform for PENNY
 */
export class PennyAnalytics {
  private analytics: AnalyticsService;
  private events: EventTrackingService;
  private segmentation: SegmentationService;
  private reporting: ReportingService;
  private insights: InsightsService;
  private exports: ExportService;

  constructor(config?: {
    redisUrl?: string;
    databaseUrl?: string;
    retentionDays?: number;
    enableRealTimeTracking?: boolean;
    enableAIInsights?: boolean;
    exportFormats?: string[];
  }) {
    const {
      redisUrl = process.env.REDIS_URL || 'redis://localhost:6379',
      databaseUrl = process.env.DATABASE_URL,
      retentionDays = 365,
      enableRealTimeTracking = true,
      enableAIInsights = true,
      exportFormats = ['json', 'csv', 'excel']
    } = config || {};

    // Initialize services
    this.events = new EventTrackingService({
      redisUrl,
      retentionDays,
      enableRealTimeTracking
    });

    this.segmentation = new SegmentationService({
      redisUrl,
      databaseUrl
    });

    this.reporting = new ReportingService({
      databaseUrl,
      events: this.events,
      segmentation: this.segmentation
    });

    this.insights = new InsightsService({
      enabled: enableAIInsights,
      events: this.events,
      reporting: this.reporting
    });

    this.exports = new ExportService({
      formats: exportFormats,
      reporting: this.reporting
    });

    this.analytics = new AnalyticsService({
      events: this.events,
      segmentation: this.segmentation,
      reporting: this.reporting,
      insights: this.insights,
      exports: this.exports
    });
  }

  /**
   * Start all analytics services
   */
  async start(): Promise<void> {
    await this.events.start();
    await this.segmentation.start();
    await this.reporting.start();
    await this.insights.start();
    await this.exports.start();
    await this.analytics.start();
  }

  /**
   * Stop all analytics services
   */
  async stop(): Promise<void> {
    await this.analytics.stop();
    await this.exports.stop();
    await this.insights.stop();
    await this.reporting.stop();
    await this.segmentation.stop();
    await this.events.stop();
  }

  /**
   * Get analytics service instance
   */
  getAnalytics(): AnalyticsService {
    return this.analytics;
  }

  /**
   * Get event tracking service instance
   */
  getEvents(): EventTrackingService {
    return this.events;
  }

  /**
   * Get segmentation service instance
   */
  getSegmentation(): SegmentationService {
    return this.segmentation;
  }

  /**
   * Get reporting service instance
   */
  getReporting(): ReportingService {
    return this.reporting;
  }

  /**
   * Get insights service instance
   */
  getInsights(): InsightsService {
    return this.insights;
  }

  /**
   * Get export service instance
   */
  getExports(): ExportService {
    return this.exports;
  }

  /**
   * Track event (convenience method)
   */
  async track(eventName: string, properties?: Record<string, any>, context?: {
    userId?: string;
    tenantId?: string;
    sessionId?: string;
  }): Promise<void> {
    return this.events.track(eventName, properties, context);
  }

  /**
   * Get real-time analytics dashboard data
   */
  async getDashboardData(tenantId?: string): Promise<{
    realTimeMetrics: any;
    userActivity: any;
    conversationMetrics: any;
    revenueMetrics: any;
    systemHealth: any;
  }> {
    return this.analytics.getDashboardData(tenantId);
  }

  /**
   * Generate comprehensive analytics report
   */
  async generateReport(type: string, options?: {
    tenantId?: string;
    dateRange?: { start: Date; end: Date };
    format?: 'json' | 'csv' | 'excel';
  }): Promise<any> {
    return this.reporting.generateReport(type, options);
  }
}

// Export default instance
export const pennyAnalytics = new PennyAnalytics();