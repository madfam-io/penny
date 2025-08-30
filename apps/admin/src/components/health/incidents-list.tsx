'use client';

import { Badge } from '@penny/ui';
import { format, formatDistanceToNow } from 'date-fns';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface Incident {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'major' | 'minor';
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  service: string;
  startedAt: Date;
  resolvedAt?: Date;
}

const incidents: Incident[] = [
  {
    id: '1',
    title: 'Increased WebSocket latency',
    description: 'Some users experiencing delayed real-time updates',
    severity: 'minor',
    status: 'monitoring',
    service: 'WebSocket Service',
    startedAt: new Date(Date.now() - 1000 * 60 * 45),
  },
  {
    id: '2',
    title: 'Database connection spike',
    description: 'Temporary spike in database connections causing slowdowns',
    severity: 'major',
    status: 'resolved',
    service: 'Database Cluster',
    startedAt: new Date(Date.now() - 1000 * 60 * 60 * 3),
    resolvedAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
  },
  {
    id: '3',
    title: 'API rate limiting issues',
    description: 'Rate limiting incorrectly triggered for some tenants',
    severity: 'minor',
    status: 'resolved',
    service: 'API Gateway',
    startedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    resolvedAt: new Date(Date.now() - 1000 * 60 * 60 * 22),
  },
];

const severityColors = {
  critical: 'destructive',
  major: 'default',
  minor: 'secondary',
} as const;

const statusIcons = {
  investigating: AlertTriangle,
  identified: Clock,
  monitoring: Clock,
  resolved: CheckCircle,
};

export function IncidentsList() {
  return (
    <div className="space-y-4">
      {incidents.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          No incidents reported in the last 30 days
        </p>
      ) : (
        incidents.map((incident) => {
          const Icon = statusIcons[incident.status];

          return (
            <div key={incident.id} className="flex items-start gap-4 p-4 rounded-lg border">
              <Icon
                className={`h-5 w-5 mt-1 ${
                  incident.status === 'resolved' ? 'text-green-600' : 'text-yellow-600'
                }`}
              />

              <div className="flex-1 space-y-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium">{incident.title}</h4>
                    <p className="text-sm text-muted-foreground">{incident.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={severityColors[incident.severity]}>{incident.severity}</Badge>
                    <Badge variant="outline">{incident.service}</Badge>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>
                    Started {formatDistanceToNow(incident.startedAt, { addSuffix: true })}
                  </span>
                  {incident.resolvedAt && (
                    <>
                      <span>•</span>
                      <span>
                        Resolved {formatDistanceToNow(incident.resolvedAt, { addSuffix: true })}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
