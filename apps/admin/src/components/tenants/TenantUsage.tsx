'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@penny/ui';
import { Progress } from '@penny/ui';
import { BarChart3, HardDrive, Zap, MessageSquare, Activity, TrendingUp } from 'lucide-react';

interface TenantUsageProps {
  tenantId: string;
  usage: {
    storageUsed: number;
    storageLimit: number;
    apiCalls: number;
    apiLimit: number;
    messagesThisMonth: number;
  };
}

export function TenantUsage({ tenantId, usage }: TenantUsageProps) {
  const storagePercentage = (usage.storageUsed / usage.storageLimit) * 100;
  const apiPercentage = (usage.apiCalls / usage.apiLimit) * 100;

  const usageHistory = [
    { month: 'Jan', storage: 1.2, api: 8500, messages: 850 },
    { month: 'Feb', storage: 1.4, api: 9200, messages: 920 },
    { month: 'Mar', storage: 1.6, api: 10100, messages: 1010 },
    { month: 'Apr', storage: 1.8, api: 11000, messages: 1100 },
    { month: 'May', storage: 2.0, api: 11800, messages: 1180 },
    { month: 'Jun', storage: 2.2, api: 12200, messages: 1220 },
    { month: 'Jul', storage: 2.3, api: 12350, messages: 1235 },
    { month: 'Aug', storage: 2.4, api: 12450, messages: 1250 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Storage Usage</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <div className="text-2xl font-bold">{usage.storageUsed}GB</div>
                <span className="text-sm text-muted-foreground">of {usage.storageLimit}GB</span>
              </div>
              <Progress value={storagePercentage} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {storagePercentage.toFixed(1)}% used
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Calls</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <div className="text-2xl font-bold">{usage.apiCalls.toLocaleString()}</div>
                <span className="text-sm text-muted-foreground">of {usage.apiLimit.toLocaleString()}</span>
              </div>
              <Progress value={apiPercentage} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {apiPercentage.toFixed(1)}% used this month
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-2xl font-bold">{usage.messagesThisMonth.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600">+15%</span> from last month
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Usage Trends
          </CardTitle>
          <CardDescription>Monthly usage statistics over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Storage Growth</span>
                <span className="text-sm text-muted-foreground">+20% this month</span>
              </div>
              <div className="flex gap-1 h-20">
                {usageHistory.map((month, index) => (
                  <div key={month.month} className="flex-1 flex flex-col justify-end">
                    <div
                      className="bg-blue-500 rounded-t"
                      style={{ height: `${(month.storage / 3) * 100}%` }}
                    />
                    <span className="text-xs text-center mt-1">{month.month}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">API Calls</span>
                <span className="text-sm text-muted-foreground">+5% this month</span>
              </div>
              <div className="flex gap-1 h-20">
                {usageHistory.map((month, index) => (
                  <div key={month.month} className="flex-1 flex flex-col justify-end">
                    <div
                      className="bg-green-500 rounded-t"
                      style={{ height: `${(month.api / 15000) * 100}%` }}
                    />
                    <span className="text-xs text-center mt-1">{month.month}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Messages Sent</span>
                <span className="text-sm text-muted-foreground">+12% this month</span>
              </div>
              <div className="flex gap-1 h-20">
                {usageHistory.map((month, index) => (
                  <div key={month.month} className="flex-1 flex flex-col justify-end">
                    <div
                      className="bg-purple-500 rounded-t"
                      style={{ height: `${(month.messages / 1500) * 100}%` }}
                    />
                    <span className="text-xs text-center mt-1">{month.month}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Peak Usage Times
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Monday - Friday</span>
                <span className="text-sm font-medium">9 AM - 5 PM</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Highest Traffic Day</span>
                <span className="text-sm font-medium">Wednesday</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Lowest Traffic Day</span>
                <span className="text-sm font-medium">Sunday</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Usage Predictions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Storage (next month)</span>
                <span className="text-sm font-medium">~2.8 GB</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">API Calls (next month)</span>
                <span className="text-sm font-medium">~13,500</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Limit reached in</span>
                <span className="text-sm font-medium text-green-600">No risk</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}