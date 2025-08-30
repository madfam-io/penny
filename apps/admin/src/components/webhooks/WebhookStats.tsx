'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@penny/ui';
import { Badge } from '@penny/ui';
import {
  TrendingUp,
  TrendingDown,
  Webhook,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  AlertTriangle,
  Zap,
} from 'lucide-react';

interface WebhookStatsData {
  totalWebhooks: number;
  activeWebhooks: number;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  averageResponseTime: number;
  deliveryTrends: {
    period: string;
    successful: number;
    failed: number;
    change: number;
  };
  topEvents: Array<{
    event: string;
    count: number;
    successRate: number;
  }>;
  recentErrors: Array<{
    webhookId: string;
    webhookName: string;
    error: string;
    timestamp: Date;
  }>;
}

// Mock data - replace with actual API call
const mockStatsData: WebhookStatsData = {
  totalWebhooks: 12,
  activeWebhooks: 9,
  totalDeliveries: 45678,
  successfulDeliveries: 43234,
  failedDeliveries: 2444,
  averageResponseTime: 245,
  deliveryTrends: {
    period: 'Last 7 days',
    successful: 5234,
    failed: 156,
    change: 12.5,
  },
  topEvents: [
    { event: 'user.created', count: 1234, successRate: 98.5 },
    { event: 'payment.succeeded', count: 987, successRate: 99.2 },
    { event: 'subscription.updated', count: 654, successRate: 97.8 },
    { event: 'audit.log.created', count: 543, successRate: 85.6 },
  ],
  recentErrors: [
    {
      webhookId: 'wh_003',
      webhookName: 'Audit Log Sync',
      error: 'Connection timeout after 30s',
      timestamp: new Date('2024-08-30T14:25:00Z'),
    },
    {
      webhookId: 'wh_007',
      webhookName: 'Customer Support',
      error: 'HTTP 500 Internal Server Error',
      timestamp: new Date('2024-08-30T13:45:00Z'),
    },
    {
      webhookId: 'wh_003',
      webhookName: 'Audit Log Sync',
      error: 'SSL certificate verification failed',
      timestamp: new Date('2024-08-30T12:30:00Z'),
    },
  ],
};

export function WebhookStats() {
  const stats = mockStatsData;
  const successRate = (stats.successfulDeliveries / stats.totalDeliveries) * 100;
  const failureRate = (stats.failedDeliveries / stats.totalDeliveries) * 100;

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatResponseTime = (ms: number) => {
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
    return `${ms}ms`;
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Activity className="h-4 w-4 text-gray-600" />;
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Total Webhooks */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Webhooks</CardTitle>
          <Webhook className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalWebhooks}</div>
          <p className="text-xs text-muted-foreground">
            {stats.activeWebhooks} active, {stats.totalWebhooks - stats.activeWebhooks} inactive
          </p>
        </CardContent>
      </Card>

      {/* Success Rate */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          <CheckCircle className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {successRate.toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground">
            {formatNumber(stats.successfulDeliveries)} of {formatNumber(stats.totalDeliveries)} deliveries
          </p>
        </CardContent>
      </Card>

      {/* Failed Deliveries */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Failed Deliveries</CardTitle>
          <XCircle className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            {formatNumber(stats.failedDeliveries)}
          </div>
          <p className="text-xs text-muted-foreground">
            {failureRate.toFixed(1)}% failure rate
          </p>
        </CardContent>
      </Card>

      {/* Average Response Time */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
          <Zap className="h-4 w-4 text-yellow-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatResponseTime(stats.averageResponseTime)}
          </div>
          <p className="text-xs text-muted-foreground">
            Across all webhook endpoints
          </p>
        </CardContent>
      </Card>

      {/* Delivery Trends */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">Delivery Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">{stats.deliveryTrends.period}</p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">
                      {formatNumber(stats.deliveryTrends.successful)} successful
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span className="text-sm">
                      {formatNumber(stats.deliveryTrends.failed)} failed
                    </span>
                  </div>
                </div>
              </div>
              <div className={`flex items-center gap-1 ${getChangeColor(stats.deliveryTrends.change)}`}>
                {getChangeIcon(stats.deliveryTrends.change)}
                <span className="text-sm font-medium">
                  {Math.abs(stats.deliveryTrends.change)}%
                </span>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Success Rate</span>
                <span>
                  {((stats.deliveryTrends.successful / (stats.deliveryTrends.successful + stats.deliveryTrends.failed)) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{
                    width: `${(stats.deliveryTrends.successful / (stats.deliveryTrends.successful + stats.deliveryTrends.failed)) * 100}%`
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Events */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">Top Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.topEvents.map((event, index) => (
              <div key={event.event} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs">
                    #{index + 1}
                  </Badge>
                  <div>
                    <div className="font-mono text-sm">{event.event}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatNumber(event.count)} deliveries
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-medium ${
                    event.successRate >= 95 ? 'text-green-600' :
                    event.successRate >= 85 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {event.successRate}%
                  </div>
                  <div className="text-xs text-muted-foreground">success</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Errors */}
      <Card className="md:col-span-2 lg:col-span-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            Recent Errors
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.recentErrors.map((error, index) => (
              <div key={index} className="flex items-start justify-between p-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{error.webhookName}</span>
                    <Badge variant="outline" className="text-xs">
                      {error.webhookId}
                    </Badge>
                  </div>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {error.error}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground ml-4">
                  {formatRelativeTime(error.timestamp)}
                </div>
              </div>
            ))}
            {stats.recentErrors.length === 0 && (
              <div className="text-center py-4 text-muted-foreground">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No recent errors</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}