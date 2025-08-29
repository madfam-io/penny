import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { AlertCircle, CreditCard, DollarSign, Calendar, TrendingUp, Settings } from 'lucide-react';
import { UsageMetrics } from './UsageMetrics';
import { InvoiceHistory } from './InvoiceHistory';
import { PaymentMethods } from './PaymentMethods';
import { PlanSelector } from './PlanSelector';
import { UpgradeDialog } from './UpgradeDialog';

interface Subscription {
  id: string;
  plan_name: string;
  status: string;
  billing_interval: 'month' | 'year';
  current_period_end: string;
  trial_end?: string;
  price: number;
  currency: string;
  cancel_at_period_end?: boolean;
}

interface UsageSummary {
  period_start: string;
  period_end: string;
  usage_by_type: Record<string, {
    current_usage: number;
    limit: number;
    percentage_used: number;
    overage: number;
    limit_exceeded: boolean;
  }>;
  total_overage_cost: number;
}

export const BillingDashboard: React.FC = () => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'usage' | 'invoices' | 'payment-methods' | 'plan'>('overview');
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      
      // Fetch subscription data
      const subscriptionResponse = await fetch('/api/billing/subscription', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      });
      
      if (subscriptionResponse.ok) {
        const subscriptionData = await subscriptionResponse.json();
        setSubscription(subscriptionData);
      }

      // Fetch usage data
      const usageResponse = await fetch('/api/billing/usage/summary', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      });
      
      if (usageResponse.ok) {
        const usageData = await usageResponse.json();
        setUsage(usageData);
      }

    } catch (err) {
      setError('Failed to load billing information');
      console.error('Billing data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    try {
      const response = await fetch(`/api/billing/subscription/${subscription?.id}/cancel`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        fetchBillingData(); // Refresh data
      } else {
        setError('Failed to cancel subscription');
      }
    } catch (err) {
      setError('Failed to cancel subscription');
    }
  };

  const handleReactivateSubscription = async () => {
    try {
      const response = await fetch(`/api/billing/subscription/${subscription?.id}/reactivate`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        fetchBillingData(); // Refresh data
      } else {
        setError('Failed to reactivate subscription');
      }
    } catch (err) {
      setError('Failed to reactivate subscription');
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'trialing': return 'bg-blue-100 text-blue-800';
      case 'past_due': return 'bg-yellow-100 text-yellow-800';
      case 'canceled': return 'bg-red-100 text-red-800';
      case 'incomplete': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const isTrialing = subscription?.status === 'trialing';
  const isPastDue = subscription?.status === 'past_due';
  const isCanceled = subscription?.status === 'canceled';
  const willCancel = subscription?.cancel_at_period_end;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
          <span className="text-red-800">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Billing & Usage</h1>
          <p className="text-gray-600 mt-1">Manage your subscription, usage, and billing preferences</p>
        </div>
        <div className="flex space-x-3">
          <Button
            variant="outline"
            onClick={() => setActiveTab('plan')}
            className="flex items-center"
          >
            <Settings className="h-4 w-4 mr-2" />
            Manage Plan
          </Button>
          {subscription?.plan_name !== 'Enterprise' && (
            <Button onClick={() => setShowUpgradeDialog(true)}>
              <TrendingUp className="h-4 w-4 mr-2" />
              Upgrade Plan
            </Button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {isTrialing && subscription?.trial_end && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-blue-600 mr-2 mt-0.5" />
            <div>
              <h3 className="text-blue-800 font-medium">Trial Period Active</h3>
              <p className="text-blue-700 text-sm mt-1">
                Your trial ends on {formatDate(subscription.trial_end)}. Add a payment method to continue service.
              </p>
            </div>
          </div>
        </div>
      )}

      {isPastDue && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-yellow-600 mr-2 mt-0.5" />
            <div>
              <h3 className="text-yellow-800 font-medium">Payment Past Due</h3>
              <p className="text-yellow-700 text-sm mt-1">
                Your payment is overdue. Please update your payment method to continue service.
              </p>
            </div>
          </div>
        </div>
      )}

      {willCancel && !isCanceled && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-red-600 mr-2 mt-0.5" />
              <div>
                <h3 className="text-red-800 font-medium">Subscription Canceling</h3>
                <p className="text-red-700 text-sm mt-1">
                  Your subscription will end on {formatDate(subscription.current_period_end)}.
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleReactivateSubscription}>
              Reactivate
            </Button>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          { id: 'overview', label: 'Overview', icon: DollarSign },
          { id: 'usage', label: 'Usage', icon: TrendingUp },
          { id: 'invoices', label: 'Invoices', icon: Calendar },
          { id: 'payment-methods', label: 'Payment Methods', icon: CreditCard },
          { id: 'plan', label: 'Plan', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="h-4 w-4 mr-2" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Current Plan */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Current Subscription
                <Badge className={getStatusColor(subscription?.status || '')}>
                  {subscription?.status?.replace('_', ' ') || 'No subscription'}
                </Badge>
              </CardTitle>
              <CardDescription>
                Your current plan and billing information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {subscription ? (
                <>
                  <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h3 className="font-semibold text-lg">{subscription.plan_name}</h3>
                      <p className="text-gray-600">
                        Billed {subscription.billing_interval}ly
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        {formatCurrency(subscription.price, subscription.currency)}
                      </div>
                      <div className="text-sm text-gray-600">
                        /{subscription.billing_interval}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Next billing date</label>
                      <p className="text-gray-900">{formatDate(subscription.current_period_end)}</p>
                    </div>
                    {subscription.trial_end && (
                      <div>
                        <label className="text-sm font-medium text-gray-700">Trial ends</label>
                        <p className="text-gray-900">{formatDate(subscription.trial_end)}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex space-x-3 pt-4 border-t">
                    {!isCanceled && !willCancel && (
                      <Button variant="outline" onClick={handleCancelSubscription}>
                        Cancel Subscription
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => setActiveTab('plan')}>
                      Change Plan
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">No active subscription</p>
                  <Button onClick={() => setActiveTab('plan')}>
                    Choose a Plan
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Usage Overview */}
          {usage && (
            <Card>
              <CardHeader>
                <CardTitle>Usage Overview</CardTitle>
                <CardDescription>Current month usage</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(usage.usage_by_type).slice(0, 3).map(([type, data]) => (
                    <div key={type} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium capitalize">{type.replace('_', ' ')}</span>
                        <span className="text-gray-600">
                          {data.current_usage.toLocaleString()} / {data.limit === -1 ? '∞' : data.limit.toLocaleString()}
                        </span>
                      </div>
                      <Progress 
                        value={Math.min(data.percentage_used, 100)} 
                        className="h-2"
                      />
                      {data.limit_exceeded && (
                        <p className="text-xs text-red-600">
                          Limit exceeded by {data.overage.toLocaleString()} units
                        </p>
                      )}
                    </div>
                  ))}
                  
                  {usage.total_overage_cost > 0 && (
                    <div className="pt-4 border-t">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Overage charges</span>
                        <span className="text-red-600 font-semibold">
                          {formatCurrency(usage.total_overage_cost)}
                        </span>
                      </div>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('usage')}
                    className="w-full"
                  >
                    View Detailed Usage
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'usage' && <UsageMetrics />}
      {activeTab === 'invoices' && <InvoiceHistory />}
      {activeTab === 'payment-methods' && <PaymentMethods />}
      {activeTab === 'plan' && <PlanSelector currentPlan={subscription?.plan_name} />}

      {/* Upgrade Dialog */}
      <UpgradeDialog
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        currentPlan={subscription?.plan_name}
      />
    </div>
  );
};