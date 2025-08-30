'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Progress,
} from '@penny/ui';
import {
  Wrench,
  Activity,
  TrendingUp,
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  Shield,
  ExternalLink
} from 'lucide-react';

interface ToolStatsData {
  total_tools: number;
  active_tools: number;
  inactive_tools: number;
  deprecated_tools: number;
  total_usage: number;
  usage_trend: number;
  avg_response_time: number;
  success_rate: number;
  top_categories: Array<{
    name: string;
    count: number;
    percentage: number;
  }>;
  top_tools: Array<{
    name: string;
    usage_count: number;
    category: string;
  }>;
  recent_activity: {
    tools_added_today: number;
    tools_updated_today: number;
    usage_today: number;
  };
}

export function ToolStats() {
  const [stats, setStats] = useState<ToolStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock data for now - replace with actual API call
    const mockStats: ToolStatsData = {
      total_tools: 47,
      active_tools: 42,
      inactive_tools: 3,
      deprecated_tools: 2,
      total_usage: 15240,
      usage_trend: 12.5,
      avg_response_time: 245,
      success_rate: 98.7,
      top_categories: [
        { name: 'Analytics', count: 12, percentage: 25.5 },
        { name: 'Integration', count: 10, percentage: 21.3 },
        { name: 'Communication', count: 8, percentage: 17.0 },
        { name: 'Code Execution', count: 7, percentage: 14.9 },
        { name: 'Visualization', count: 6, percentage: 12.8 },
        { name: 'Security', count: 4, percentage: 8.5 }
      ],
      top_tools: [
        { name: 'get_company_kpis', usage_count: 1547, category: 'Analytics' },
        { name: 'execute_python_code', usage_count: 1203, category: 'Code Execution' },
        { name: 'load_dashboard', usage_count: 892, category: 'Visualization' },
        { name: 'create_jira_ticket', usage_count: 445, category: 'Integration' },
        { name: 'send_slack_message', usage_count: 334, category: 'Communication' }
      ],
      recent_activity: {
        tools_added_today: 2,
        tools_updated_today: 5,
        usage_today: 127
      }
    };

    setTimeout(() => {
      setStats(mockStats);
      setLoading(false);
    }, 800);
  }, []);

  const formatNumber = (num: number): string => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`;
    }
    return num.toString();
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) {
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    } else if (trend < 0) {
      return <TrendingUp className="h-4 w-4 text-red-600 rotate-180" />;
    }
    return <Activity className="h-4 w-4 text-gray-600" />;
  };

  const getTrendColor = (trend: number): string => {
    if (trend > 0) return 'text-green-600';
    if (trend < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Primary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Tools */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tools</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_tools}</div>
            <p className="text-xs text-muted-foreground">
              {stats.active_tools} active, {stats.inactive_tools} inactive
            </p>
          </CardContent>
        </Card>

        {/* Total Usage */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Usage</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.total_usage)}</div>
            <div className="flex items-center text-xs">
              {getTrendIcon(stats.usage_trend)}
              <span className={`ml-1 ${getTrendColor(stats.usage_trend)}`}>
                {stats.usage_trend > 0 ? '+' : ''}{stats.usage_trend}% from last month
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Average Response Time */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avg_response_time}ms</div>
            <p className="text-xs text-muted-foreground">
              Across all tool executions
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
            <div className="text-2xl font-bold">{stats.success_rate}%</div>
            <Progress value={stats.success_rate} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Tool Categories */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Tool Categories</CardTitle>
            <CardDescription>Distribution by category</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.top_categories.map((category, index) => (
              <div key={category.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {category.name}
                    </Badge>
                    <span className="text-sm font-medium">{category.count}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {category.percentage}%
                  </span>
                </div>
                <Progress value={category.percentage} className="h-1" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Top Tools */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Most Used Tools</CardTitle>
            <CardDescription>By usage count this month</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.top_tools.map((tool, index) => (
              <div key={tool.name} className="flex items-center justify-between">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{tool.name}</div>
                  <div className="text-xs text-muted-foreground">{tool.category}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {formatNumber(tool.usage_count)}
                  </Badge>
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">
                      {index + 1}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Today's Activity</CardTitle>
            <CardDescription>Recent tool registry activity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-blue-600" />
                <span className="text-sm">Tools Added</span>
              </div>
              <Badge variant="secondary">{stats.recent_activity.tools_added_today}</Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-orange-600" />
                <span className="text-sm">Tools Updated</span>
              </div>
              <Badge variant="secondary">{stats.recent_activity.tools_updated_today}</Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-green-600" />
                <span className="text-sm">Tool Executions</span>
              </div>
              <Badge variant="secondary">{stats.recent_activity.usage_today}</Badge>
            </div>

            {/* Status Indicators */}
            <div className="pt-2 mt-4 border-t">
              <div className="flex items-center justify-between text-sm">
                <span>System Status</span>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-green-600 font-medium">Healthy</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}