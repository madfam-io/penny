'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@penny/ui';
import { MessageCircle, Clock, TrendingUp, Users } from 'lucide-react';

export function ConversationStats() {
  const stats = [
    {
      title: 'Total Conversations',
      value: '1,234',
      icon: MessageCircle,
      change: '+12%',
      changeType: 'positive' as const,
    },
    {
      title: 'Active Conversations',
      value: '89',
      icon: TrendingUp,
      change: '+5%',
      changeType: 'positive' as const,
    },
    {
      title: 'Avg. Response Time',
      value: '2.3m',
      icon: Clock,
      change: '-8%',
      changeType: 'positive' as const,
    },
    {
      title: 'Unique Users',
      value: '456',
      icon: Users,
      change: '+18%',
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