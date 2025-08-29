import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { AnalyticsEvent, RealTimeMetrics, DataQualityReport } from './types';

export interface EventTrackingConfig {
  redisUrl?: string;
  retentionDays?: number;
  enableRealTimeTracking?: boolean;
  batchSize?: number;
  flushInterval?: number;
  enableValidation?: boolean;
}

export class EventTrackingService extends EventEmitter {
  private redis: Redis;
  private config: Required<EventTrackingConfig>;
  private eventBuffer: AnalyticsEvent[] = [];
  private flushTimer?: NodeJS.Timeout;
  private realTimeMetrics: RealTimeMetrics = {
    activeUsers: 0,
    eventsPerSecond: 0,
    topEvents: [],
    topPages: [],
    conversionRate: 0,
    errorRate: 0,
    responseTime: 0
  };
  private running = false;

  constructor(config: EventTrackingConfig = {}) {
    super();
    
    this.config = {
      redisUrl: config.redisUrl || 'redis://localhost:6379',
      retentionDays: config.retentionDays || 365,
      enableRealTimeTracking: config.enableRealTimeTracking !== false,
      batchSize: config.batchSize || 100,
      flushInterval: config.flushInterval || 5000,
      enableValidation: config.enableValidation !== false
    };

    this.redis = new Redis(this.config.redisUrl);
    this.setupRedisListeners();
  }

  private setupRedisListeners(): void {
    this.redis.on('error', (error) => {
      this.emit('error', error);
    });

    this.redis.on('connect', () => {
      this.emit('connected');
    });
  }

  async start(): Promise<void> {
    if (this.running) return;
    
    this.running = true;
    
    // Start periodic flush
    this.flushTimer = setInterval(() => {
      this.flushEvents();
    }, this.config.flushInterval);

    // Start real-time metrics update
    if (this.config.enableRealTimeTracking) {
      setInterval(() => {
        this.updateRealTimeMetrics();
      }, 1000);
    }

    this.emit('started');
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    
    this.running = false;
    
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // Flush remaining events
    await this.flushEvents();
    
    await this.redis.quit();
    this.emit('stopped');
  }

  /**
   * Track an analytics event
   */
  async track(
    eventName: string,
    properties: Record<string, any> = {},
    context?: {
      userId?: string;
      sessionId?: string;
      tenantId?: string;
      metadata?: any;
    }
  ): Promise<void> {
    const event: AnalyticsEvent = {
      id: uuidv4(),
      eventName,
      userId: context?.userId,
      sessionId: context?.sessionId,
      tenantId: context?.tenantId,
      timestamp: new Date(),
      properties,
      metadata: context?.metadata
    };

    // Validate event if enabled
    if (this.config.enableValidation) {
      const validationResult = this.validateEvent(event);
      if (!validationResult.isValid) {
        this.emit('validationError', { event, errors: validationResult.errors });
        return;
      }
    }

    // Add to buffer
    this.eventBuffer.push(event);
    
    // Real-time processing
    if (this.config.enableRealTimeTracking) {
      await this.processRealTimeEvent(event);
    }

    // Flush if buffer is full
    if (this.eventBuffer.length >= this.config.batchSize) {
      await this.flushEvents();
    }

    this.emit('eventTracked', event);
  }

  /**
   * Track page view event
   */
  async trackPageView(
    page: string,
    context?: {
      userId?: string;
      sessionId?: string;
      tenantId?: string;
      referrer?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    return this.track('page_view', { page }, {
      ...context,
      metadata: {
        referrer: context?.referrer,
        userAgent: context?.userAgent
      }
    });
  }

  /**
   * Track user action event
   */
  async trackUserAction(
    action: string,
    target?: string,
    properties: Record<string, any> = {},
    context?: {
      userId?: string;
      sessionId?: string;
      tenantId?: string;
    }
  ): Promise<void> {
    return this.track('user_action', {
      action,
      target,
      ...properties
    }, context);
  }

  /**
   * Track conversion event
   */
  async trackConversion(
    conversionType: string,
    value?: number,
    properties: Record<string, any> = {},
    context?: {
      userId?: string;
      sessionId?: string;
      tenantId?: string;
    }
  ): Promise<void> {
    return this.track('conversion', {
      conversionType,
      value,
      ...properties
    }, context);
  }

  /**
   * Track error event
   */
  async trackError(
    errorType: string,
    errorMessage: string,
    properties: Record<string, any> = {},
    context?: {
      userId?: string;
      sessionId?: string;
      tenantId?: string;
    }
  ): Promise<void> {
    return this.track('error', {
      errorType,
      errorMessage,
      ...properties
    }, context);
  }

  private validateEvent(event: AnalyticsEvent): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields
    if (!event.eventName) {
      errors.push('Event name is required');
    }

    if (!event.timestamp) {
      errors.push('Timestamp is required');
    }

    // Event name validation
    if (event.eventName && !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(event.eventName)) {
      errors.push('Event name must start with a letter and contain only letters, numbers, and underscores');
    }

    // Properties validation
    if (event.properties) {
      try {
        JSON.stringify(event.properties);
      } catch (error) {
        errors.push('Properties must be JSON serializable');
      }
    }

    // Timestamp validation
    if (event.timestamp) {
      const now = new Date();
      const eventTime = new Date(event.timestamp);
      const diffHours = Math.abs(now.getTime() - eventTime.getTime()) / (1000 * 60 * 60);
      
      if (diffHours > 24) {
        errors.push('Event timestamp is more than 24 hours old or in the future');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private async flushEvents(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      // Store events in Redis with TTL based on retention days
      const ttl = this.config.retentionDays * 24 * 60 * 60; // seconds
      
      const pipeline = this.redis.pipeline();
      
      for (const event of events) {
        // Store individual events
        const eventKey = `events:${event.tenantId || 'default'}:${event.id}`;
        pipeline.setex(eventKey, ttl, JSON.stringify(event));
        
        // Add to time-series data
        const dayKey = `events:daily:${event.tenantId || 'default'}:${this.formatDate(event.timestamp)}`;
        pipeline.hincrby(dayKey, event.eventName, 1);
        pipeline.expire(dayKey, ttl);
        
        // Add to hourly data for real-time analytics
        const hourKey = `events:hourly:${event.tenantId || 'default'}:${this.formatHour(event.timestamp)}`;
        pipeline.hincrby(hourKey, event.eventName, 1);
        pipeline.expire(hourKey, 7 * 24 * 60 * 60); // Keep hourly data for 7 days
        
        // Track user activity
        if (event.userId) {
          const userKey = `users:active:${event.tenantId || 'default'}`;
          pipeline.sadd(userKey, event.userId);
          pipeline.expire(userKey, 24 * 60 * 60); // Daily active users
        }
      }
      
      await pipeline.exec();
      
      this.emit('eventsFlushed', { count: events.length });
    } catch (error) {
      // Return events to buffer if flush failed
      this.eventBuffer.unshift(...events);
      this.emit('flushError', error);
    }
  }

  private async processRealTimeEvent(event: AnalyticsEvent): Promise<void> {
    try {
      // Update real-time counters
      const realtimeKey = `realtime:${event.tenantId || 'default'}`;
      
      // Increment event counter
      await this.redis.hincrby(realtimeKey, 'total_events', 1);
      await this.redis.hincrby(realtimeKey, `event:${event.eventName}`, 1);
      
      // Track active users
      if (event.userId) {
        await this.redis.sadd(`realtime:users:${event.tenantId || 'default'}`, event.userId);
        await this.redis.expire(`realtime:users:${event.tenantId || 'default'}`, 300); // 5 minutes
      }
      
      // Track page views
      if (event.eventName === 'page_view' && event.properties?.page) {
        await this.redis.hincrby(`realtime:pages:${event.tenantId || 'default'}`, event.properties.page, 1);
        await this.redis.expire(`realtime:pages:${event.tenantId || 'default'}`, 300);
      }
      
      // Set TTL for realtime data
      await this.redis.expire(realtimeKey, 300); // 5 minutes
    } catch (error) {
      this.emit('realtimeError', error);
    }
  }

  private async updateRealTimeMetrics(): Promise<void> {
    try {
      const tenantId = 'default'; // This would be parameterized in real use
      
      // Get active users count
      const activeUsers = await this.redis.scard(`realtime:users:${tenantId}`);
      
      // Calculate events per second
      const currentMinute = Math.floor(Date.now() / 60000);
      const eventsLastMinute = await this.redis.hget(`events:hourly:${tenantId}:${this.formatHour(new Date())}`, 'total') || '0';
      const eventsPerSecond = Math.round(parseInt(eventsLastMinute) / 60);
      
      // Get top events
      const topEvents = await this.getTopEvents(tenantId, 5);
      
      // Get top pages
      const topPages = await this.getTopPages(tenantId, 5);
      
      this.realTimeMetrics = {
        activeUsers,
        eventsPerSecond,
        topEvents,
        topPages,
        conversionRate: await this.calculateRealTimeConversionRate(tenantId),
        errorRate: await this.calculateRealTimeErrorRate(tenantId),
        responseTime: 0 // This would be integrated with your monitoring system
      };
      
      this.emit('realTimeMetricsUpdated', this.realTimeMetrics);
    } catch (error) {
      this.emit('metricsError', error);
    }
  }

  private async getTopEvents(tenantId: string, limit: number): Promise<Array<{ eventName: string; count: number }>> {
    try {
      const realtimeKey = `realtime:${tenantId}`;
      const events = await this.redis.hgetall(realtimeKey);
      
      return Object.entries(events)
        .filter(([key]) => key.startsWith('event:'))
        .map(([key, count]) => ({
          eventName: key.replace('event:', ''),
          count: parseInt(count)
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    } catch (error) {
      return [];
    }
  }

  private async getTopPages(tenantId: string, limit: number): Promise<Array<{ page: string; users: number }>> {
    try {
      const pagesKey = `realtime:pages:${tenantId}`;
      const pages = await this.redis.hgetall(pagesKey);
      
      return Object.entries(pages)
        .map(([page, count]) => ({
          page,
          users: parseInt(count)
        }))
        .sort((a, b) => b.users - a.users)
        .slice(0, limit);
    } catch (error) {
      return [];
    }
  }

  private async calculateRealTimeConversionRate(tenantId: string): Promise<number> {
    try {
      const realtimeKey = `realtime:${tenantId}`;\n      const conversions = parseInt(await this.redis.hget(realtimeKey, 'event:conversion') || '0');\n      const pageViews = parseInt(await this.redis.hget(realtimeKey, 'event:page_view') || '0');\n      \n      return pageViews > 0 ? (conversions / pageViews) * 100 : 0;\n    } catch (error) {\n      return 0;\n    }\n  }\n\n  private async calculateRealTimeErrorRate(tenantId: string): Promise<number> {\n    try {\n      const realtimeKey = `realtime:${tenantId}`;\n      const errors = parseInt(await this.redis.hget(realtimeKey, 'event:error') || '0');\n      const total = parseInt(await this.redis.hget(realtimeKey, 'total_events') || '0');\n      \n      return total > 0 ? (errors / total) * 100 : 0;\n    } catch (error) {\n      return 0;\n    }\n  }\n\n  /**\n   * Get events for a specific time range\n   */\n  async getEvents(options: {\n    tenantId?: string;\n    eventName?: string;\n    userId?: string;\n    sessionId?: string;\n    startDate?: Date;\n    endDate?: Date;\n    limit?: number;\n    offset?: number;\n  } = {}): Promise<{\n    events: AnalyticsEvent[];\n    total: number;\n    hasMore: boolean;\n  }> {\n    const {\n      tenantId = 'default',\n      eventName,\n      userId,\n      sessionId,\n      startDate = new Date(Date.now() - 24 * 60 * 60 * 1000),\n      endDate = new Date(),\n      limit = 100,\n      offset = 0\n    } = options;\n\n    // This is a simplified implementation\n    // In production, you'd want to use a more sophisticated query mechanism\n    const events: AnalyticsEvent[] = [];\n    \n    try {\n      // Get all event keys for the tenant\n      const eventKeys = await this.redis.keys(`events:${tenantId}:*`);\n      \n      // Filter and collect events\n      for (const key of eventKeys) {\n        const eventData = await this.redis.get(key);\n        if (eventData) {\n          const event: AnalyticsEvent = JSON.parse(eventData);\n          \n          // Apply filters\n          if (eventName && event.eventName !== eventName) continue;\n          if (userId && event.userId !== userId) continue;\n          if (sessionId && event.sessionId !== sessionId) continue;\n          if (event.timestamp < startDate || event.timestamp > endDate) continue;\n          \n          events.push(event);\n        }\n      }\n      \n      // Sort by timestamp descending\n      events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());\n      \n      // Apply pagination\n      const paginatedEvents = events.slice(offset, offset + limit);\n      \n      return {\n        events: paginatedEvents,\n        total: events.length,\n        hasMore: offset + limit < events.length\n      };\n    } catch (error) {\n      this.emit('queryError', error);\n      return { events: [], total: 0, hasMore: false };\n    }\n  }\n\n  /**\n   * Get aggregated event data\n   */\n  async getAggregatedData(options: {\n    tenantId?: string;\n    eventName?: string;\n    groupBy: 'hour' | 'day' | 'week' | 'month';\n    startDate?: Date;\n    endDate?: Date;\n  }): Promise<Array<{ timestamp: Date; count: number }>> {\n    const {\n      tenantId = 'default',\n      eventName,\n      groupBy = 'day',\n      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),\n      endDate = new Date()\n    } = options;\n\n    const result: Array<{ timestamp: Date; count: number }> = [];\n    \n    try {\n      // Generate date range based on groupBy\n      const dates = this.generateDateRange(startDate, endDate, groupBy);\n      \n      for (const date of dates) {\n        const key = groupBy === 'hour' \n          ? `events:hourly:${tenantId}:${this.formatHour(date)}`\n          : `events:daily:${tenantId}:${this.formatDate(date)}`;\n        \n        const count = eventName \n          ? parseInt(await this.redis.hget(key, eventName) || '0')\n          : parseInt(await this.redis.hget(key, 'total') || '0');\n        \n        result.push({ timestamp: date, count });\n      }\n      \n      return result;\n    } catch (error) {\n      this.emit('aggregationError', error);\n      return [];\n    }\n  }\n\n  /**\n   * Get real-time metrics\n   */\n  getRealTimeMetrics(): RealTimeMetrics {\n    return this.realTimeMetrics;\n  }\n\n  /**\n   * Generate data quality report\n   */\n  async generateDataQualityReport(tenantId: string = 'default', days: number = 7): Promise<DataQualityReport> {\n    const endDate = new Date();\n    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);\n    \n    const { events } = await this.getEvents({\n      tenantId,\n      startDate,\n      endDate,\n      limit: 10000 // Sample size\n    });\n\n    let validEvents = 0;\n    let invalidEvents = 0;\n    let duplicateEvents = 0;\n    const issues: Array<{ type: string; count: number; examples: any[] }> = [];\n    const eventIds = new Set<string>();\n\n    for (const event of events) {\n      // Check for duplicates\n      if (eventIds.has(event.id)) {\n        duplicateEvents++;\n      } else {\n        eventIds.add(event.id);\n      }\n\n      // Validate event\n      const validation = this.validateEvent(event);\n      if (validation.isValid) {\n        validEvents++;\n      } else {\n        invalidEvents++;\n        for (const error of validation.errors) {\n          let issue = issues.find(i => i.type === error);\n          if (!issue) {\n            issue = { type: error, count: 0, examples: [] };\n            issues.push(issue);\n          }\n          issue.count++;\n          if (issue.examples.length < 3) {\n            issue.examples.push(event);\n          }\n        }\n      }\n    }\n\n    const qualityScore = events.length > 0 ? (validEvents / events.length) * 100 : 100;\n\n    return {\n      totalEvents: events.length,\n      validEvents,\n      invalidEvents,\n      duplicateEvents,\n      qualityScore,\n      issues,\n      generatedAt: new Date()\n    };\n  }\n\n  private formatDate(date: Date): string {\n    return date.toISOString().split('T')[0];\n  }\n\n  private formatHour(date: Date): string {\n    return date.toISOString().substring(0, 13);\n  }\n\n  private generateDateRange(start: Date, end: Date, groupBy: 'hour' | 'day' | 'week' | 'month'): Date[] {\n    const dates: Date[] = [];\n    const current = new Date(start);\n\n    while (current <= end) {\n      dates.push(new Date(current));\n      \n      switch (groupBy) {\n        case 'hour':\n          current.setHours(current.getHours() + 1);\n          break;\n        case 'day':\n          current.setDate(current.getDate() + 1);\n          break;\n        case 'week':\n          current.setDate(current.getDate() + 7);\n          break;\n        case 'month':\n          current.setMonth(current.getMonth() + 1);\n          break;\n      }\n    }\n\n    return dates;\n  }\n}"