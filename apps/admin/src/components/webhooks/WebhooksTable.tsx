'use client';

import { useState } from 'react';
import { Button } from '@penny/ui';
import { Badge } from '@penny/ui';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@penny/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@penny/ui';
import {
  MoreHorizontal,
  Eye,
  Edit,
  Copy,
  Trash2,
  PlayCircle,
  PauseCircle,
  AlertTriangle,
  CheckCircle,
  Clock,
} from 'lucide-react';
import Link from 'next/link';

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  status: 'active' | 'inactive' | 'error';
  lastDelivery: Date | null;
  successRate: number;
  createdAt: Date;
  description?: string;
}

// Mock data - replace with actual API call
const mockWebhooks: Webhook[] = [
  {
    id: 'wh_001',
    name: 'User Registration Notifications',
    url: 'https://api.acme.com/webhooks/user-events',
    events: ['user.created', 'user.updated'],
    status: 'active',
    lastDelivery: new Date('2024-08-30T14:30:00Z'),
    successRate: 98.5,
    createdAt: new Date('2024-08-01T09:00:00Z'),
    description: 'Notifies external systems when users register or update profiles'
  },
  {
    id: 'wh_002',
    name: 'Payment Processing',
    url: 'https://billing.acme.com/webhook-handler',
    events: ['payment.succeeded', 'payment.failed', 'subscription.cancelled'],
    status: 'active',
    lastDelivery: new Date('2024-08-30T12:15:00Z'),
    successRate: 100,
    createdAt: new Date('2024-07-15T11:30:00Z'),
    description: 'Handles payment and subscription lifecycle events'
  },
  {
    id: 'wh_003',
    name: 'Audit Log Sync',
    url: 'https://logs.security.acme.com/ingest',
    events: ['audit.log.created'],
    status: 'error',
    lastDelivery: new Date('2024-08-29T18:45:00Z'),
    successRate: 75.2,
    createdAt: new Date('2024-08-10T16:20:00Z'),
    description: 'Synchronizes audit logs with external security platform'
  },
  {
    id: 'wh_004',
    name: 'Slack Notifications',
    url: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX',
    events: ['system.alert', 'user.login.failed'],
    status: 'inactive',
    lastDelivery: new Date('2024-08-25T08:20:00Z'),
    successRate: 92.8,
    createdAt: new Date('2024-06-20T14:10:00Z'),
    description: 'Sends system alerts and security notifications to Slack'
  },
];

export function WebhooksTable() {
  const [webhooks] = useState<Webhook[]>(mockWebhooks);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'inactive':
        return <PauseCircle className="h-4 w-4 text-gray-600" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatLastDelivery = (date: Date | null) => {
    if (!date) return 'Never';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const handleToggleStatus = (id: string, currentStatus: string) => {
    console.log(`Toggling webhook ${id} from ${currentStatus}`);
    // Implement status toggle logic
  };

  const handleDelete = (id: string) => {
    console.log(`Deleting webhook ${id}`);
    // Implement delete logic
  };

  const handleTest = (id: string) => {
    console.log(`Testing webhook ${id}`);
    // Implement test webhook logic
  };

  if (webhooks.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-muted-foreground">
          <PlayCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">No webhooks configured</h3>
          <p>Create your first webhook to start receiving event notifications</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name & URL</TableHead>
              <TableHead>Events</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Delivery</TableHead>
              <TableHead>Success Rate</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {webhooks.map((webhook) => (
              <TableRow key={webhook.id}>
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-medium">{webhook.name}</div>
                    <div className="text-sm text-muted-foreground font-mono">
                      {webhook.url}
                    </div>
                    {webhook.description && (
                      <div className="text-sm text-muted-foreground">
                        {webhook.description}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {webhook.events.slice(0, 2).map((event) => (
                      <Badge key={event} variant="outline" className="text-xs">
                        {event}
                      </Badge>
                    ))}
                    {webhook.events.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{webhook.events.length - 2} more
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(webhook.status)}
                    <Badge className={getStatusColor(webhook.status)}>
                      {webhook.status}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {formatLastDelivery(webhook.lastDelivery)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-full bg-gray-200 rounded-full h-2 max-w-[60px]">
                      <div
                        className={`h-2 rounded-full ${
                          webhook.successRate >= 95
                            ? 'bg-green-600'
                            : webhook.successRate >= 85
                            ? 'bg-yellow-600'
                            : 'bg-red-600'
                        }`}
                        style={{ width: `${webhook.successRate}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">
                      {webhook.successRate}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem asChild>
                        <Link
                          href={`/webhooks/${webhook.id}`}
                          className="flex items-center gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          View Details
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link
                          href={`/webhooks/${webhook.id}/edit`}
                          className="flex items-center gap-2"
                        >
                          <Edit className="h-4 w-4" />
                          Edit Webhook
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleTest(webhook.id)}
                        className="flex items-center gap-2"
                      >
                        <PlayCircle className="h-4 w-4" />
                        Test Webhook
                      </DropdownMenuItem>
                      <DropdownMenuItem className="flex items-center gap-2">
                        <Copy className="h-4 w-4" />
                        Copy URL
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleToggleStatus(webhook.id, webhook.status)}
                        className="flex items-center gap-2"
                      >
                        {webhook.status === 'active' ? (
                          <>
                            <PauseCircle className="h-4 w-4" />
                            Disable
                          </>
                        ) : (
                          <>
                            <PlayCircle className="h-4 w-4" />
                            Enable
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDelete(webhook.id)}
                        className="flex items-center gap-2 text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}