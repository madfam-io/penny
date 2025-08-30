import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  MessageSquare, 
  Cpu, 
  Database, 
  Users, 
  Zap,
  AlertTriangle,
  Info
} from 'lucide-react';

interface UsageData {
  usage_type: string;
  current_usage: number;
  limit: number;
  percentage_used: number;
  overage: number;
  limit_exceeded: boolean;
}

interface UsageTrend {
  usage_type: string;
  daily_usage: Array<{ date: string; usage: number; }>;
  trend_direction: 'up' | 'down' | 'stable';
  average_daily_usage: number;
  peak_usage: number;
  total_usage: number;
}

interface UsageMetricsProps {
  period?: 'hour' | 'day' | 'month';
}

export const UsageMetrics: React.FC<UsageMetricsProps> = ({ period = 'month' }) => {
  const [usageData, setUsageData] = useState<UsageData[]>([]);
  const [trends, setTrends] = useState<UsageTrend[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState(period);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsageData();
    fetchTrends();
  }, [selectedPeriod]);

  const fetchUsageData = async () => {
    try {
      const response = await fetch(`/api/billing/usage/summary?period=${selectedPeriod}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      });

      if (!response.ok) throw new Error('Failed to fetch usage data');

      const data = await response.json();
      const usageArray = Object.entries(data.usage_by_type).map(([type, usage]: [string, any]) => ({
        usage_type: type,
        ...usage
      }));
      
      setUsageData(usageArray);
    } catch (err) {
      setError('Failed to load usage data');
    }
  };

  const fetchTrends = async () => {
    try {
      const response = await fetch('/api/billing/usage/trends', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      });

      if (!response.ok) throw new Error('Failed to fetch trends');

      const data = await response.json();
      setTrends(data.trends || []);
    } catch (err) {
      console.error('Failed to load trends:', err);
    } finally {
      setLoading(false);
    }
  };

  const getUsageIcon = (usageType: string) => {
    switch (usageType) {
      case 'messages': return <MessageSquare className="h-5 w-5" />;
      case 'tokens': return <Cpu className="h-5 w-5" />;
      case 'storage': return <Database className="h-5 w-5" />;
      case 'users': return <Users className="h-5 w-5" />;
      case 'api_calls': return <Zap className="h-5 w-5" />;
      default: return <Info className="h-5 w-5" />;
    }
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-600" />;
      default: return <Minus className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatUsageType = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusColor = (usage: UsageData) => {
    if (usage.limit_exceeded) return 'text-red-600 bg-red-50 border-red-200';
    if (usage.percentage_used >= 90) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    if (usage.percentage_used >= 75) return 'text-blue-600 bg-blue-50 border-blue-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  const getProgressColor = (percentage: number, exceeded: boolean) => {
    if (exceeded) return 'bg-red-500';
    if (percentage >= 90) return 'bg-yellow-500';
    if (percentage >= 75) return 'bg-blue-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (\n      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <span className="text-red-800">{error}</span>
      </div>
    );
  }

  return (\n    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Usage Metrics</h2>\n        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          {[
            { id: 'hour', label: 'Last Hour' },
            { id: 'day', label: 'Today' },
            { id: 'month', label: 'This Month' },
          ].map((period) => (
            <button
              key={period.id}
              onClick={() => setSelectedPeriod(period.id as 'hour' | 'day' | 'month')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedPeriod === period.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      {/* Usage Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {usageData.map((usage) => {
          const trend = trends.find(t => t.usage_type === usage.usage_type);
          
          return (
            <Card key={usage.usage_type} className={`border ${getStatusColor(usage)}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <div className="flex items-center space-x-2">
                  {getUsageIcon(usage.usage_type)}
                  <CardTitle className="text-base font-medium">
                    {formatUsageType(usage.usage_type)}
                  </CardTitle>
                </div>
                {trend && getTrendIcon(trend.trend_direction)}
              </CardHeader>
             
             <CardContent className="space-y-4">
                {/* Usage Numbers */}
                <div className="flex justify-between items-end">
                  <div>\n                    <div className="text-2xl font-bold">
                      {usage.usage_type === 'storage' 
                        ? formatBytes(usage.current_usage)
                        : formatNumber(usage.current_usage)
                      }
                    </div>\n                    <div className="text-sm text-gray-600">
                      of {usage.limit === -1 ? 'unlimited' : 
                        usage.usage_type === 'storage' 
                          ? formatBytes(usage.limit)
                          : formatNumber(usage.limit)
                      }
                    </div>
                  </div>\n                  <div className="text-right">
                    <div className="text-sm font-semibold">
                      {Math.min(usage.percentage_used, 100).toFixed(1)}%
                    </div>
                    {usage.limit_exceeded && (\n                      <Badge variant="destructive" className="text-xs">
                        Over limit
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <Progress 
                    value={Math.min(usage.percentage_used, 100)}
                   className="h-3"
                  />
                  {usage.overage > 0 && (\n                    <div className="flex items-center space-x-1 text-sm text-red-600">
                      <AlertTriangle className="h-4 w-4" />
                      <span>
                        {formatNumber(usage.overage)} units over limit
                      </span>
                    </div>
                  )}
                </div>

                {/* Trend Information */}
                {trend && (\n                  <div className="pt-2 border-t text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Daily average:</span>\n                      <span className="font-medium">
                        {formatNumber(trend.average_daily_usage)}
                      </span>
                    </div>\n                    <div className="flex justify-between">
                      <span>Peak usage:</span>\n                      <span className="font-medium">
                        {formatNumber(trend.peak_usage)}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Usage Trends Chart */}
      {trends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Usage Trends (Last 30 Days)</CardTitle>
            <CardDescription>
              Track your usage patterns over time
            </CardDescription>
          </CardHeader>
          <CardContent>\n            <div className="space-y-6">
              {trends.slice(0, 3).map((trend) => (\n                <div key={trend.usage_type} className="space-y-3">
                  <div className="flex items-center justify-between">\n                    <div className="flex items-center space-x-2">
                      {getUsageIcon(trend.usage_type)}
                      <h4 className="font-medium">{formatUsageType(trend.usage_type)}</h4>
                      {getTrendIcon(trend.trend_direction)}
                    </div>\n                    <div className="text-sm text-gray-600">
                      Total: {formatNumber(trend.total_usage)}
                    </div>
                  </div>
                  
                  {/* Simple bar chart representation */}
                  <div className="flex items-end space-x-1 h-20">
                    {trend.daily_usage.slice(-14).map((day, index) => {
                      const maxUsage = Math.max(...trend.daily_usage.map(d => d.usage));
                      const height = maxUsage > 0 ? (day.usage / maxUsage) * 100 : 0;
                      
                      return (
                        <div
                          key={index}
                          className="flex-1 bg-blue-200 rounded-t hover:bg-blue-300 transition-colors cursor-pointer"\n                          style={{ height: `${Math.max(height, 2)}%` }}
                          title={`${new Date(day.date).toLocaleDateString()}: ${formatNumber(day.usage)}`}
                        />
                      );
                    })}
                  </div>
                 
                 <div className="flex justify-between text-xs text-gray-500">
                    <span>{trend.daily_usage.length > 14 ? '14 days ago' : 'Start'}</span>
                    <span>Today</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage Alerts */}
      {usageData.some(u => u.limit_exceeded || u.percentage_used >= 90) && (\n        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>\n            <CardTitle className="flex items-center text-yellow-800">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Usage Alerts
            </CardTitle>
          </CardHeader>\n          <CardContent className="space-y-3">
            {usageData
              .filter(u => u.limit_exceeded || u.percentage_used >= 90)
              .map(usage => (\n                <div key={usage.usage_type} className="flex items-center justify-between p-3 bg-white rounded-lg">
                  <div className="flex items-center space-x-3">
                    {getUsageIcon(usage.usage_type)}
                    <div>\n                      <div className="font-medium text-gray-900">
                        {formatUsageType(usage.usage_type)}
                      </div>\n                      <div className="text-sm text-gray-600">
                        {usage.limit_exceeded
                         ? `Over limit by ${formatNumber(usage.overage)} units`
                          : `${usage.percentage_used.toFixed(1)}% of limit used`
                        }
                      </div>
                    </div>
                  </div>\n                  <Button variant="outline" size="sm">
                    Upgrade Plan
                  </Button>
                </div>
              ))
            }
          </CardContent>
        </Card>
      )}
    </div>
  );
};