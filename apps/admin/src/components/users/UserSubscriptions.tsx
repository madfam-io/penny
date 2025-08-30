'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@penny/ui';
import { Badge } from '@penny/ui';
import { Button } from '@penny/ui';
import { Progress } from '@penny/ui';
import { 
  CreditCard, 
  Calendar, 
  DollarSign, 
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap
} from 'lucide-react';
import { format } from 'date-fns';

interface UserSubscriptionsProps {
  userId: string;
}

interface Subscription {
  id: string;
  plan: string;
  status: 'active' | 'inactive' | 'cancelled' | 'past_due';
  amount: number;
  currency: string;
  billingCycle: 'monthly' | 'yearly';
  nextBillingDate: Date;
  usage: {
    apiCalls: { current: number; limit: number };
    storage: { current: number; limit: number };
    messages: { current: number; limit: number };
  };
}

// Mock data
function getUserSubscriptions(userId: string): Subscription[] {
  return [
    {
      id: 'sub-123',
      plan: 'Professional',
      status: 'active',
      amount: 29.99,
      currency: 'USD',
      billingCycle: 'monthly',
      nextBillingDate: new Date('2024-09-15'),
      usage: {
        apiCalls: { current: 1250, limit: 5000 },
        storage: { current: 2.4, limit: 10 },
        messages: { current: 850, limit: 2000 }
      }
    }
  ];
}

export function UserSubscriptions({ userId }: UserSubscriptionsProps) {
  const [subscriptions] = useState<Subscription[]>(getUserSubscriptions(userId));

  const getStatusColor = (status: Subscription['status']) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/20';
      case 'inactive': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900/20';
      case 'past_due': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20';
    }
  };

  const getStatusIcon = (status: Subscription['status']) => {
    switch (status) {
      case 'active': return CheckCircle;
      case 'inactive': return Clock;
      case 'cancelled': return AlertTriangle;
      case 'past_due': return AlertTriangle;
      default: return Clock;
    }
  };

  const formatUsage = (current: number, limit: number, unit: string = '') => {
    const percentage = (current / limit) * 100;
    return { current, limit, percentage, unit };
  };

  if (subscriptions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Subscriptions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Active Subscriptions</h3>
            <p>This user doesn't have any active subscriptions.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {subscriptions.map((subscription) => {
        const StatusIcon = getStatusIcon(subscription.status);
        const apiUsage = formatUsage(
          subscription.usage.apiCalls.current, 
          subscription.usage.apiCalls.limit
        );
        const storageUsage = formatUsage(
          subscription.usage.storage.current, 
          subscription.usage.storage.limit, 
          'GB'
        );
        const messageUsage = formatUsage(
          subscription.usage.messages.current, 
          subscription.usage.messages.limit
        );

        return (
          <div key={subscription.id} className="space-y-6">
            {/* Subscription Overview */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Current Subscription
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <StatusIcon className="h-4 w-4" />
                    <Badge className={getStatusColor(subscription.status)}>
                      {subscription.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h3 className="font-medium text-lg mb-2">{subscription.plan} Plan</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold">
                        ${subscription.amount}
                      </span>
                      <span className="text-muted-foreground">
                        /{subscription.billingCycle === 'monthly' ? 'mo' : 'yr'}
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Next Billing</h4>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{format(subscription.nextBillingDate, 'MMM d, yyyy')}</span>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Subscription ID</h4>
                    <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                      {subscription.id}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Usage Statistics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Usage This Month
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* API Calls */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-blue-600" />
                        <span className="font-medium">API Calls</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {apiUsage.current.toLocaleString()} / {apiUsage.limit.toLocaleString()}
                      </span>
                    </div>
                    <Progress value={apiUsage.percentage} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">
                      {apiUsage.percentage.toFixed(1)}% used
                    </p>
                  </div>

                  {/* Storage */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-green-600" />
                        <span className="font-medium">Storage</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {storageUsage.current} / {storageUsage.limit} GB
                      </span>
                    </div>
                    <Progress value={storageUsage.percentage} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">
                      {storageUsage.percentage.toFixed(1)}% used
                    </p>
                  </div>

                  {/* Messages */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-purple-600" />
                        <span className="font-medium">Messages</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {messageUsage.current.toLocaleString()} / {messageUsage.limit.toLocaleString()}
                      </span>
                    </div>
                    <Progress value={messageUsage.percentage} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">
                      {messageUsage.percentage.toFixed(1)}% used
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Billing History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Recent Billing History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium">August 2024</p>
                      <p className="text-sm text-muted-foreground">Professional Plan</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${subscription.amount}</p>
                      <Badge variant="outline" className="text-xs">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Paid
                      </Badge>
                    </div>
                  </div>
                 
                 <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium">July 2024</p>
                      <p className="text-sm text-muted-foreground">Professional Plan</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${subscription.amount}</p>
                      <Badge variant="outline" className="text-xs">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Paid
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}