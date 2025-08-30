'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,\n} from '@penny/ui';
import { UsageChart } from '@/components/analytics/usage-chart';
import { ModelUsage } from '@/components/analytics/model-usage';
import { CostBreakdown } from '@/components/analytics/cost-breakdown';
import { TopTenants } from '@/components/analytics/top-tenants';

export default function AnalyticsPage() {
  return (
    <div className="space-y-8">
      <div>\n        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Platform usage analytics and insights</p>
      </div>
\n      <Tabs defaultValue="usage" className="space-y-4">
        <TabsList>\n          <TabsTrigger value="usage">Usage</TabsTrigger>\n          <TabsTrigger value="costs">Costs</TabsTrigger>\n          <TabsTrigger value="models">AI Models</TabsTrigger>\n          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>
\n        <TabsContent value="usage" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>API Usage</CardTitle>
                <CardDescription>API requests over the last 30 days</CardDescription>
              </CardHeader>
              <CardContent>
                <UsageChart />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Tenants</CardTitle>
                <CardDescription>Most active tenants by API usage</CardDescription>
              </CardHeader>
              <CardContent>
                <TopTenants />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
\n        <TabsContent value="costs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cost Breakdown</CardTitle>
              <CardDescription>Infrastructure and service costs by category</CardDescription>
            </CardHeader>
            <CardContent>
              <CostBreakdown />
            </CardContent>
          </Card>
        </TabsContent>
\n        <TabsContent value="models" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Model Usage</CardTitle>
              <CardDescription>AI model usage distribution and trends</CardDescription>
            </CardHeader>
            <CardContent>
              <ModelUsage />
            </CardContent>
          </Card>
        </TabsContent>
\n        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Response Time</CardTitle>
                <CardDescription>Average API response time</CardDescription>
              </CardHeader>
              <CardContent>\n                <div className="text-3xl font-bold">124ms</div>
                <p className="text-sm text-muted-foreground">-12% from last week</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Error Rate</CardTitle>
                <CardDescription>Percentage of failed requests</CardDescription>
              </CardHeader>
              <CardContent>\n                <div className="text-3xl font-bold">0.3%</div>
                <p className="text-sm text-muted-foreground">-0.1% from last week</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Uptime</CardTitle>
                <CardDescription>System availability</CardDescription>
              </CardHeader>
              <CardContent>\n                <div className="text-3xl font-bold">99.98%</div>
                <p className="text-sm text-muted-foreground">Last 30 days</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
