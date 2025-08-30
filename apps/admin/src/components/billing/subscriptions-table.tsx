'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,\n} from '@penny/ui';
import { MoreHorizontal, CreditCard, FileText, Ban, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface Subscription {
  id: string;
  tenant: string;
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  amount: number;
  interval: 'monthly' | 'yearly';
  currentPeriodEnd: Date;
  users: number;
  maxUsers: number;
}

const subscriptions: Subscription[] = [
  {
    id: '1',
    tenant: 'Acme Corporation',
    plan: 'enterprise',
    status: 'active',
    amount: 2499,
    interval: 'monthly',\n    currentPeriodEnd: new Date('2024-03-15'),
    users: 250,
    maxUsers: 500,
  },
  {
    id: '2',
    tenant: 'TechStart Inc',
    plan: 'pro',
    status: 'active',
    amount: 999,
    interval: 'monthly',\n    currentPeriodEnd: new Date('2024-03-10'),
    users: 45,
    maxUsers: 100,
  },
  {
    id: '3',
    tenant: 'Digital Agency',
    plan: 'starter',
    status: 'past_due',
    amount: 299,
    interval: 'monthly',\n    currentPeriodEnd: new Date('2024-02-20'),
    users: 12,
    maxUsers: 20,
  },
];

const planColors = {
  free: 'secondary',
  starter: 'default',
  pro: 'default',
  enterprise: 'default',
} as const;

const statusColors = {
  active: 'default',
  past_due: 'destructive',
  canceled: 'secondary',
  trialing: 'outline',
} as const;

export function SubscriptionsTable() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tenant</TableHead>
          <TableHead>Plan</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Users</TableHead>
          <TableHead>Next Billing</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {subscriptions.map((subscription) => (
          <TableRow key={subscription.id}>\n            <TableCell className="font-medium">{subscription.tenant}</TableCell>
            <TableCell>
              <Badge variant={planColors[subscription.plan]}>
                {subscription.plan.toUpperCase()}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge variant={statusColors[subscription.status]}>\n                {subscription.status.replace('_', ' ')}
              </Badge>
            </TableCell>
            <TableCell>
              ${subscription.amount}/{subscription.interval === 'monthly' ? 'mo' : 'yr'}
            </TableCell>
            <TableCell>
              {subscription.users}/{subscription.maxUsers}
            </TableCell>
            <TableCell>{format(subscription.currentPeriodEnd, 'MMM d, yyyy')}</TableCell>\n            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>\n                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>\n                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>\n                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>\n                    <FileText className="mr-2 h-4 w-4" />
                    <span>View Details</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>\n                    <CreditCard className="mr-2 h-4 w-4" />
                    <span>Update Payment</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>\n                    <RefreshCw className="mr-2 h-4 w-4" />
                    <span>Change Plan</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />\n                  <DropdownMenuItem className="text-red-600">
                    <Ban className="mr-2 h-4 w-4" />
                    <span>Cancel Subscription</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
