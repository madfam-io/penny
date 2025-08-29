import { Request, Response } from 'express';

// Core monitoring types
export interface MetricValue {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp?: Date;
}

export interface LogEntry {
  level: 'error' | 'warn' | 'info' | 'debug' | 'trace';
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  service?: string;
  environment?: string;
  traceId?: string;
  spanId?: string;
}

export interface Alert {
  id: string;
  name: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  resolved?: boolean;
  resolvedAt?: Date;
}

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  lastCheck: Date;
  responseTime: number;
  message?: string;
  metadata?: Record<string, any>;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  network: {
    bytesReceived: number;
    bytesSent: number;
  };
}

// Alert channel types
export interface AlertChannel {
  type: 'email' | 'slack' | 'webhook' | 'pagerduty';
  name: string;
  config: Record<string, any>;
  enabled: boolean;
}

export interface EmailAlertConfig {
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  from: string;
  to: string[];
  subject?: string;
  template?: string;
}

export interface SlackAlertConfig {
  webhookUrl: string;
  channel: string;
  username?: string;
  iconEmoji?: string;
}

export interface WebhookAlertConfig {
  url: string;
  method: 'POST' | 'PUT';
  headers?: Record<string, string>;
  authentication?: {
    type: 'bearer' | 'basic';
    token?: string;
    username?: string;
    password?: string;
  };
}

// Dashboard types
export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'status' | 'log';
  title: string;
  config: Record<string, any>;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widgets: DashboardWidget[];
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Trace types
export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  tags?: Record<string, any>;
  logs?: Array<{
    timestamp: Date;
    fields: Record<string, any>;
  }>;
  status?: {
    code: number;
    message?: string;
  };
}

// Performance monitoring types
export interface PerformanceMetrics {
  requestCount: number;
  errorCount: number;
  responseTime: {
    p50: number;
    p95: number;
    p99: number;
    average: number;
  };
  throughput: number;
  errorRate: number;
}

export interface APMTrace {
  traceId: string;
  duration: number;
  spans: TraceSpan[];
  service: string;
  endpoint: string;
  statusCode: number;
  timestamp: Date;
  error?: boolean;
  errorMessage?: string;
}

// Configuration types
export interface MonitoringConfig {
  serviceName: string;
  environment: string;
  tracing: {
    enabled: boolean;
    jaegerEndpoint?: string;
    samplingRate?: number;
  };
  metrics: {
    enabled: boolean;
    prometheusPort?: number;
    prefix?: string;
  };
  logging: {
    enabled: boolean;
    level: string;
    format?: 'json' | 'text';
  };
  alerts: {
    enabled: boolean;
    channels: AlertChannel[];
  };
  health: {
    enabled: boolean;
    checkInterval: number;
    checks: Array<{
      name: string;
      type: 'http' | 'database' | 'redis' | 'custom';
      config: Record<string, any>;
    }>;
  };
}

// Event types for analytics
export interface AnalyticsEvent {
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
  };
}

// Business metrics types
export interface BusinessMetrics {
  activeUsers: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  revenue: {
    mrr: number;
    arr: number;
    churn: number;
    ltv: number;
  };
  usage: {
    apiCalls: number;
    storage: number;
    bandwidth: number;
    compute: number;
  };
  retention: {
    day1: number;
    day7: number;
    day30: number;
  };
}

// Express middleware types
export interface MonitoringMiddleware {
  (req: Request, res: Response, next: Function): void;
}

export interface ErrorTrackingMiddleware {
  (error: Error, req: Request, res: Response, next: Function): void;
}

// Export utility type helpers
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';
export type HealthStatus = 'healthy' | 'unhealthy' | 'degraded';
export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';