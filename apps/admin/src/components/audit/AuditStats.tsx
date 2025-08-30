'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@penny/ui';
import { Activity, AlertTriangle, CheckCircle, Users } from 'lucide-react';

export function AuditStats() {
  const stats = [
    {
      title: 'Total Events',
      value: '12,345',
      icon: Activity,
      change: '+12%',
      changeType: 'positive' as const,
    },
    {
      title: 'Success Rate',
      value: '99.8%',
      icon: CheckCircle,
      change: '+0.2%',
      changeType: 'positive' as const,
    },
    {
      title: 'Failed Actions',
      value: '23',
      icon: AlertTriangle,
      change: '-5%',
      changeType: 'positive' as const,
    },
    {
      title: 'Active Users',
      value: '1,234',
      icon: Users,
      change: '+8%',
      changeType: 'positive' as const,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {stat.title}
            </CardTitle>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground">
              <span
                className={
                  stat.changeType === 'positive'
                    ? 'text-green-600'
                    : 'text-red-600'
                }
              >
                {stat.change}
              </span>{' '}
              from last month
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}