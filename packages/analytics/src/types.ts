// Analytics event types
export interface AnalyticsEvent {
  id: string;
  eventName: string;
  userId?: string;
  sessionId?: string;
  tenantId?: string;
  timestamp: Date;
  properties?: Record<string, any>;
  metadata?: {
    userAgent?: string;
    ip?: string;
    referrer?: string;
    page?: string;
    device?: {
      type: 'desktop' | 'mobile' | 'tablet';
      os?: string;
      browser?: string;
    };
    location?: {
      country?: string;
      region?: string;
      city?: string;
    };
  };
}

// User segment types
export interface UserSegment {
  id: string;
  name: string;
  description?: string;
  criteria: SegmentCriteria;
  userCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SegmentCriteria {
  conditions: Array<{
    field: string;
    operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in' | 'not_in';
    value: any;
  }>;
  logic: 'and' | 'or';
}

// Funnel analysis
export interface Funnel {
  id: string;
  name: string;
  steps: Array<{
    name: string;
    eventName: string;
    conditions?: Record<string, any>;
  }>;
  tenantId?: string;
  createdAt: Date;
}

export interface FunnelResult {
  funnelId: string;
  totalUsers: number;
  steps: Array<{
    step: number;
    name: string;
    users: number;
    conversionRate: number;
    dropoffRate: number;
  }>;
  overallConversionRate: number;
  dateRange: { start: Date; end: Date };
}

// Cohort analysis
export interface Cohort {
  id: string;
  name: string;
  definition: {
    event: string;
    period: 'daily' | 'weekly' | 'monthly';
    conditions?: Record<string, any>;
  };
  createdAt: Date;
}

export interface CohortAnalysis {
  cohortId: string;
  periods: Array<{
    period: string;
    cohortSize: number;
    retention: Array<{
      period: number;
      users: number;
      percentage: number;
    }>;
  }>;
}

// A/B testing
export interface ABTest {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  variants: Array<{
    id: string;
    name: string;
    traffic: number; // percentage
    config?: Record<string, any>;
  }>;
  metrics: Array<{
    name: string;
    type: 'conversion' | 'revenue' | 'engagement';
    event?: string;
  }>;
  startDate?: Date;
  endDate?: Date;
  tenantId?: string;
  createdAt: Date;
}

export interface ABTestResult {
  testId: string;
  variants: Array<{
    variantId: string;
    name: string;
    users: number;
    conversions: number;
    conversionRate: number;
    revenue?: number;
    significance?: number;
    confidence?: number;
  }>;
  winner?: string;
  isSignificant: boolean;
}

// Revenue analytics
export interface RevenueMetrics {
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annual Recurring Revenue
  churn: {
    rate: number;
    count: number;
  };
  ltv: number; // Lifetime Value
  cac: number; // Customer Acquisition Cost
  payback: number; // Payback period in months
  expansion: {
    rate: number;
    revenue: number;
  };
}

// User behavior analytics
export interface UserBehaviorMetrics {
  activeUsers: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  engagement: {
    averageSessionDuration: number;
    pagesPerSession: number;
    bounceRate: number;
    returnUserRate: number;
  };
  retention: {
    day1: number;
    day7: number;
    day30: number;
  };
  topFeatures: Array<{
    feature: string;
    users: number;
    usage: number;
  }>;
}

// Report types
export interface Report {
  id: string;
  name: string;
  type: 'user_analytics' | 'revenue_analytics' | 'engagement' | 'funnel' | 'cohort' | 'ab_test' | 'custom';
  config: Record<string, any>;
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    recipients: string[];
  };
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportData {
  reportId: string;
  generatedAt: Date;
  dateRange: { start: Date; end: Date };
  data: any;
  summary: {
    keyMetrics: Record<string, number>;
    insights: string[];
    trends: Array<{
      metric: string;
      trend: 'up' | 'down' | 'stable';
      change: number;
    }>;
  };
}

// AI insights
export interface AIInsight {
  id: string;
  type: 'trend' | 'anomaly' | 'prediction' | 'recommendation';
  title: string;
  description: string;
  confidence: number;
  impact: 'high' | 'medium' | 'low';
  category: 'user_behavior' | 'revenue' | 'performance' | 'marketing';
  data: any;
  actionable: boolean;
  actions?: Array<{
    title: string;
    description: string;
    priority: number;
  }>;
  generatedAt: Date;
  tenantId?: string;
}

// Export types
export interface ExportJob {
  id: string;
  type: 'analytics' | 'events' | 'users' | 'revenue';
  format: 'json' | 'csv' | 'excel' | 'pdf';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  config: {
    tenantId?: string;
    dateRange?: { start: Date; end: Date };
    filters?: Record<string, any>;
    includeRawData?: boolean;
  };
  result?: {
    url: string;
    size: number;
    rowCount?: number;
  };
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

// Time series data
export interface TimeSeriesData {
  timestamp: Date;
  value: number;
  metadata?: Record<string, any>;
}

export interface TimeSeriesQuery {
  metric: string;
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max';
  interval: 'minute' | 'hour' | 'day' | 'week' | 'month';
  dateRange: { start: Date; end: Date };
  filters?: Record<string, any>;
  groupBy?: string[];
}

// Configuration types
export interface AnalyticsConfig {
  events: {
    retentionDays: number;
    enableRealTime: boolean;
    batchSize: number;
    flushInterval: number;
  };
  segmentation: {
    maxSegments: number;
    refreshInterval: number;
  };
  reporting: {
    defaultTimeZone: string;
    maxConcurrentReports: number;
    cacheTimeout: number;
  };
  insights: {
    enabled: boolean;
    refreshInterval: number;
    confidenceThreshold: number;
  };
  exports: {
    maxFileSize: number;
    retentionDays: number;
    allowedFormats: string[];
  };
}

// Dashboard widget types
export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'funnel' | 'cohort' | 'map';
  title: string;
  config: {
    metric?: string;
    chartType?: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
    timeRange?: string;
    filters?: Record<string, any>;
    groupBy?: string[];
    customQuery?: string;
  };
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  refreshInterval?: number;
}

// Real-time analytics
export interface RealTimeMetrics {
  activeUsers: number;
  eventsPerSecond: number;
  topEvents: Array<{
    eventName: string;
    count: number;
  }>;
  topPages: Array<{
    page: string;
    users: number;
  }>;
  conversionRate: number;
  errorRate: number;
  responseTime: number;
}

// Data quality
export interface DataQualityReport {
  totalEvents: number;
  validEvents: number;
  invalidEvents: number;
  duplicateEvents: number;
  qualityScore: number;
  issues: Array<{
    type: 'missing_field' | 'invalid_format' | 'duplicate' | 'anomaly';
    count: number;
    examples: any[];
  }>;
  generatedAt: Date;
}

// Utility types
export type DateRange = {
  start: Date;
  end: Date;
};

export type TimeGranularity = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';

export type MetricType = 'count' | 'sum' | 'average' | 'unique' | 'ratio';

export type ComparisonPeriod = 'previous_period' | 'previous_year' | 'custom';

export type TrendDirection = 'up' | 'down' | 'stable';

export type AlertCondition = {
  metric: string;
  operator: 'greater_than' | 'less_than' | 'equals' | 'not_equals' | 'percentage_change';
  value: number;
  timeWindow: string;
};

export type AlertRule = {
  id: string;
  name: string;
  description?: string;
  condition: AlertCondition;
  enabled: boolean;
  notifications: Array<{
    type: 'email' | 'slack' | 'webhook';
    config: Record<string, any>;
  }>;
  createdAt: Date;
};