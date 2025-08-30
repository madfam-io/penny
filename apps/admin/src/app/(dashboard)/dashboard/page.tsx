'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@penny/ui';
import { Activity, CreditCard, Users, Building2 } from 'lucide-react';
import { Overview } from '@/components/dashboard/overview';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { SystemHealth } from '@/components/dashboard/system-health';

const stats = [
  {
    title: 'Total Tenants',\n    value: '24',\n    description: '+2 from last month',
    icon: Building2,
  },
  {
    title: 'Active Users',\n    value: '1,429',\n    description: '+18% from last month',
    icon: Users,
  },
  {
    title: 'API Requests',\n    value: '12.4M',\n    description: '+12% from last month',
    icon: Activity,
  },
  {
    title: 'Revenue',\n    value: '$54,231',\n    description: '+19% from last month',
    icon: CreditCard,
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>\n        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your PENNY platform performance</p>
      </div>
\n      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>\n            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>\n              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>\n              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
\n      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
            <CardDescription>Platform usage over the last 30 days</CardDescription>
          </CardHeader>\n          <CardContent className="pl-2">
            <Overview />
          </CardContent>
        </Card>\n        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>System Health</CardTitle>
            <CardDescription>Current system status and performance</CardDescription>
          </CardHeader>
          <CardContent>
            <SystemHealth />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest events and actions across the platform</CardDescription>
        </CardHeader>
        <CardContent>
          <RecentActivity />
        </CardContent>
      </Card>
    </div>
  );
}
