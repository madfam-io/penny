'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Alert,
  AlertDescription,
} from '@penny/ui';
import { Activity, Database, Server, Wifi, AlertTriangle, CheckCircle } from 'lucide-react';
import { ServiceStatus } from '@/components/health/service-status';
import { MetricsChart } from '@/components/health/metrics-chart';
import { IncidentsList } from '@/components/health/incidents-list';

const services = [
  {
    name: 'API Gateway',
    status: 'operational',
    latency: 45,
    uptime: 99.99,
    icon: Server,
  },
  {
    name: 'Database Cluster',
    status: 'operational',
    latency: 12,
    uptime: 99.95,
    icon: Database,
  },
  {
    name: 'WebSocket Service',
    status: 'degraded',
    latency: 178,
    uptime: 98.5,
    icon: Wifi,
  },
  {
    name: 'AI Services',
    status: 'operational',
    latency: 850,
    uptime: 99.8,
    icon: Activity,
  },
];

export default function HealthPage() {
  const hasIssues = services.some((s) => s.status !== 'operational');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Health</h1>
        <p className="text-muted-foreground">Monitor system status and performance metrics</p>
      </div>

      {hasIssues ? (
        <Alert className="border-yellow-600 bg-yellow-50 dark:bg-yellow-950/20">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800 dark:text-yellow-200">
            Some services are experiencing degraded performance. Our team is investigating.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-green-600 bg-green-50 dark:bg-green-950/20">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            All systems are operational. No issues detected.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {services.map((service) => (
          <ServiceStatus key={service.name} service={service} />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Response Time</CardTitle>
            <CardDescription>API response times over the last 24 hours</CardDescription>
          </CardHeader>
          <CardContent>
            <MetricsChart metric="latency" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Error Rate</CardTitle>
            <CardDescription>Error rate percentage over the last 24 hours</CardDescription>
          </CardHeader>
          <CardContent>
            <MetricsChart metric="errors" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Incidents</CardTitle>
          <CardDescription>System incidents and their resolution status</CardDescription>
        </CardHeader>
        <CardContent>
          <IncidentsList />
        </CardContent>
      </Card>
    </div>
  );
}
