'use client';
\nimport { Card, CardContent, CardHeader, CardTitle, Badge, Progress } from '@penny/ui';
import { LucideIcon } from 'lucide-react';

interface ServiceStatusProps {
  service: {
    name: string;
    status: 'operational' | 'degraded' | 'down';
    latency: number;
    uptime: number;
    icon: LucideIcon;
  };
}

const statusColors = {
  operational: 'default',
  degraded: 'secondary',
  down: 'destructive',
} as const;

const statusText = {
  operational: 'Operational',
  degraded: 'Degraded',
  down: 'Down',
};

export function ServiceStatus({ service }: ServiceStatusProps) {
  const Icon = service.icon;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">\n        <CardTitle className="text-sm font-medium">{service.name}</CardTitle>\n        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>\n        <div className="space-y-3">
          <Badge variant={statusColors[service.status]}>{statusText[service.status]}</Badge>
\n          <div className="space-y-1">\n            <div className="flex items-center justify-between text-sm">\n              <span className="text-muted-foreground">Latency</span>\n              <span className="font-medium">{service.latency}ms</span>
            </div>\n            <Progress value={Math.min(100, (service.latency / 200) * 100)} className="h-2" />
          </div>
\n          <div className="space-y-1">\n            <div className="flex items-center justify-between text-sm">\n              <span className="text-muted-foreground">Uptime</span>\n              <span className="font-medium">{service.uptime}%</span>
            </div>\n            <Progress value={service.uptime} className="h-2" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
