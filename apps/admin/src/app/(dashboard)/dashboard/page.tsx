'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@penny/ui';
import { Activity, CreditCard, Users, Building2 } from 'lucide-react';
import { PageErrorBoundary, SectionErrorBoundary, ComponentErrorBoundary } from '@/components/error-boundaries';
import { Overview } from '@/components/dashboard/overview';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { SystemHealth } from '@/components/dashboard/system-health';

const stats = [
  {
    title: 'Total Tenants',
    value: '24',
    description: '+2 from last month',
    icon: Building2,
  },
  {
    title: 'Active Users',
    value: '1,429',
    description: '+18% from last month',
    icon: Users,
  },
  {
    title: 'API Requests',
    value: '12.4M',
    description: '+12% from last month',
    icon: Activity,
  },
  {
    title: 'Revenue',
    value: '$54,231',
    description: '+19% from last month',
    icon: CreditCard,
  },
];

function DashboardPageContent() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your PENNY platform performance</p>
      </div>

      <SectionErrorBoundary 
        title="Dashboard Stats" 
        description="Failed to load dashboard statistics"
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <ComponentErrorBoundary key={stat.title} componentName={`${stat.title} Card`} silent>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                  <stat.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground">{stat.description}</p>
                </CardContent>
              </Card>
            </ComponentErrorBoundary>
          ))}
        </div>
      </SectionErrorBoundary>

      <SectionErrorBoundary 
        title="Charts & Analytics" 
        description="Failed to load dashboard charts"
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Overview</CardTitle>
              <CardDescription>Platform usage over the last 30 days</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              <ComponentErrorBoundary componentName="Overview Chart">
                <Overview />
              </ComponentErrorBoundary>
            </CardContent>
          </Card>
          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>System Health</CardTitle>
              <CardDescription>Current system status and performance</CardDescription>
            </CardHeader>
            <CardContent>
              <ComponentErrorBoundary componentName="System Health">
                <SystemHealth />
              </ComponentErrorBoundary>
            </CardContent>
          </Card>
        </div>
      </SectionErrorBoundary>

      <SectionErrorBoundary 
        title="Recent Activity" 
        description="Failed to load recent activity feed"
      >
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest events and actions across the platform</CardDescription>
          </CardHeader>
          <CardContent>
            <ComponentErrorBoundary componentName="Activity Feed">
              <RecentActivity />
            </ComponentErrorBoundary>
          </CardContent>
        </Card>
      </SectionErrorBoundary>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <PageErrorBoundary pageName="Dashboard">
      <DashboardPageContent />
    </PageErrorBoundary>
  );
}
