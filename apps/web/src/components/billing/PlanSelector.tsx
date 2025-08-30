import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Check, Zap, Crown, Building, Loader2 } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  type: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  features: {
    max_users: number;
    max_conversations: number;
    max_messages_per_month: number;
    max_tokens_per_month: number;
    max_storage_gb: number;
    custom_tools: boolean;
    priority_support: boolean;
    sso: boolean;
    audit_logs: boolean;
    white_labeling: boolean;
    api_access: boolean;
    advanced_analytics: boolean;
  };
  trial_days: number;
  is_active: boolean;
}

interface PlanSelectorProps {
  currentPlan?: string;
  onPlanSelect?: (planId: string, billingInterval: 'month' | 'year') => void;
}

export const PlanSelector: React.FC<PlanSelectorProps> = ({ 
  currentPlan, 
  onPlanSelect 
}) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month');
  const [loading, setLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await fetch('/api/billing/plans', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch plans');
      }

      const data = await response.json();
      setPlans(data.plans || []);
    } catch (err) {
      setError('Failed to load plans');
      console.error('Plans fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanSelect = async (planId: string) => {
    if (onPlanSelect) {
      onPlanSelect(planId, billingInterval);
      return;
    }

    try {
      setProcessingPlan(planId);
     
     const response = await fetch('/api/billing/subscription', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          plan_id: planId,
          billing_interval: billingInterval
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create subscription');
      }

      const data = await response.json();
      
      // Handle setup intent if required
      if (data.setup_intent) {
        // Redirect to Stripe checkout or handle payment
        window.location.href = data.setup_intent.next_action?.redirect_to_url?.url;
      } else {
        // Subscription created successfully
        window.location.reload();
      }
    } catch (err) {
      setError('Failed to subscribe to plan');
      console.error('Subscription error:', err);
    } finally {
      setProcessingPlan(null);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    if (num === -1) return 'Unlimited';
    return num.toLocaleString();
  };

  const getYearlySavings = (monthlyPrice: number, yearlyPrice: number) => {
    const yearlyMonthly = monthlyPrice * 12;
    const savings = yearlyMonthly - yearlyPrice;
    const percentage = Math.round((savings / yearlyMonthly) * 100);
    return { savings, percentage };
  };

  const getPlanIcon = (type: string) => {
    switch (type) {
      case 'free': return <Zap className="h-6 w-6 text-gray-600" />;
      case 'pro': return <Crown className="h-6 w-6 text-blue-600" />;
      case 'enterprise': return <Building className="h-6 w-6 text-purple-600" />;
      default: return <Zap className="h-6 w-6 text-gray-600" />;
    }
  };

  const getPlanColor = (type: string) => {
    switch (type) {
      case 'free': return 'border-gray-200';
      case 'pro': return 'border-blue-200 shadow-lg';
      case 'enterprise': return 'border-purple-200';
      default: return 'border-gray-200';
    }
  };

  const isCurrentPlan = (planName: string) => {
    return currentPlan === planName;
  };

  const isPlanUpgrade = (planType: string) => {
    if (!currentPlan) return true;
    const planOrder = { 'free': 0, 'pro': 1, 'enterprise': 2 };
    const currentOrder = planOrder[currentPlan.toLowerCase() as keyof typeof planOrder] || 0;
    const newOrder = planOrder[planType as keyof typeof planOrder] || 0;
    return newOrder > currentOrder;
  };

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
        <span className="text-red-800">{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Billing Interval Toggle */}
      <div className="flex justify-center">
        <div className="flex items-center bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setBillingInterval('month')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              billingInterval === 'month'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingInterval('year')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              billingInterval === 'year'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Yearly
            <Badge variant="secondary" className="ml-2 text-xs">Save up to 20%</Badge>
          </button>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const price = billingInterval === 'year' ? plan.price_yearly : plan.price_monthly;
          const yearlySavings = getYearlySavings(plan.price_monthly, plan.price_yearly);
          const isProcessing = processingPlan === plan.id;
          const isCurrent = isCurrentPlan(plan.name);
          const isUpgrade = isPlanUpgrade(plan.type);

          return (
            <Card key={plan.id} className={`relative ${getPlanColor(plan.type)} ${plan.type === 'pro' ? 'transform scale-105' : ''}`}>
              {plan.type === 'pro' && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-blue-600 text-white">Most Popular</Badge>
                </div>
              )}
             
             <CardHeader className="text-center">
                <div className="flex justify-center mb-2">
                  {getPlanIcon(plan.type)}
                </div>
<CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
               
               <div className="mt-4">
                  <div className="text-3xl font-bold">
                    {plan.price_monthly === 0 ? 'Free' : formatCurrency(price, plan.currency)}
                  </div>
                  {plan.price_monthly > 0 && (
<div className="text-sm text-gray-600">
                      per {billingInterval}
                      {billingInterval === 'year' && yearlySavings.percentage > 0 && (
<div className="text-green-600 font-medium">
                          Save {yearlySavings.percentage}% (${yearlySavings.savings}/year)
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {plan.trial_days > 0 && !isCurrent && (
<Badge variant="outline" className="mt-2">
                    {plan.trial_days} days free trial
                  </Badge>
                )}
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Features List */}
                <div className="space-y-2">
                  <div className="flex items-center text-sm">
<Check className="h-4 w-4 text-green-600 mr-2" />
                    <span>{formatNumber(plan.features.max_users)} users</span>
                  </div>
<div className="flex items-center text-sm">
                    <Check className="h-4 w-4 text-green-600 mr-2" />
                    <span>{formatNumber(plan.features.max_messages_per_month)} messages/month</span>
                  </div>
<div className="flex items-center text-sm">
                    <Check className="h-4 w-4 text-green-600 mr-2" />
                    <span>{formatNumber(plan.features.max_tokens_per_month)} tokens/month</span>
                  </div>
<div className="flex items-center text-sm">
                    <Check className="h-4 w-4 text-green-600 mr-2" />
                    <span>{plan.features.max_storage_gb} GB storage</span>
                  </div>
                  
                  {plan.features.custom_tools && (
<div className="flex items-center text-sm">
                      <Check className="h-4 w-4 text-green-600 mr-2" />
                      <span>Custom tools</span>
                    </div>
                  )}
                  
                  {plan.features.api_access && (
<div className="flex items-center text-sm">
                      <Check className="h-4 w-4 text-green-600 mr-2" />
                      <span>API access</span>
                    </div>
                  )}
                  
                  {plan.features.priority_support && (
<div className="flex items-center text-sm">
                      <Check className="h-4 w-4 text-green-600 mr-2" />
                      <span>Priority support</span>
                    </div>
                  )}
                  
                  {plan.features.sso && (
<div className="flex items-center text-sm">
                      <Check className="h-4 w-4 text-green-600 mr-2" />
                      <span>Single Sign-On (SSO)</span>
                    </div>
                  )}
                  
                  {plan.features.white_labeling && (
<div className="flex items-center text-sm">
                      <Check className="h-4 w-4 text-green-600 mr-2" />
                      <span>White labeling</span>
                    </div>
                  )}
                  
                  {plan.features.advanced_analytics && (
<div className="flex items-center text-sm">
                      <Check className="h-4 w-4 text-green-600 mr-2" />
                      <span>Advanced analytics</span>
                    </div>
                  )}
                  
                  {plan.features.audit_logs && (
<div className="flex items-center text-sm">
                      <Check className="h-4 w-4 text-green-600 mr-2" />
                      <span>Audit logs</span>
                    </div>
                  )}
                </div>

                {/* Action Button */}
                <div className="pt-4">
                  {isCurrent ? (
<Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : (
                    <Button
                      className={`w-full ${
                        plan.type === 'pro' 
                          ? 'bg-blue-600 hover:bg-blue-700' 
                          : plan.type === 'enterprise'
                          ? 'bg-purple-600 hover:bg-purple-700'
                          : ''
                      }`}
                      onClick={() => handlePlanSelect(plan.id)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <>
<Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          {plan.type === 'free' 
                            ? 'Downgrade to Free' 
                            : isUpgrade 
                            ? 'Upgrade to ' + plan.name
                            : 'Switch to ' + plan.name
                          }
                        </>
                      )}
                    </Button>
                  )}
                  
                  {plan.type === 'enterprise' && (
<Button variant="outline" className="w-full mt-2">
                      Contact Sales
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Feature Comparison Table */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Feature Comparison</CardTitle>
          <CardDescription>Compare features across all plans</CardDescription>
        </CardHeader>
        <CardContent>
<div className="overflow-x-auto">
            <table className="w-full">
              <thead>
<tr className="border-b">
                  <th className="text-left py-3 px-4">Feature</th>
                  {plans.map((plan) => (
<th key={plan.id} className="text-center py-3 px-4">
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
<tr className="border-b">
                  <td className="py-3 px-4 font-medium">Users</td>
                  {plans.map((plan) => (
<td key={plan.id} className="text-center py-3 px-4">
                      {formatNumber(plan.features.max_users)}
                    </td>
                  ))}
                </tr>
<tr className="border-b">
                  <td className="py-3 px-4 font-medium">Messages/month</td>
                  {plans.map((plan) => (
<td key={plan.id} className="text-center py-3 px-4">
                      {formatNumber(plan.features.max_messages_per_month)}
                    </td>
                  ))}
                </tr>
<tr className="border-b">
                  <td className="py-3 px-4 font-medium">Storage</td>
                  {plans.map((plan) => (
<td key={plan.id} className="text-center py-3 px-4">
                      {plan.features.max_storage_gb} GB
                    </td>
                  ))}
                </tr>
<tr className="border-b">
                  <td className="py-3 px-4 font-medium">Custom Tools</td>
                  {plans.map((plan) => (
<td key={plan.id} className="text-center py-3 px-4">
                      {plan.features.custom_tools ? (
<Check className="h-5 w-5 text-green-600 mx-auto" />
                      ) : (
<span className="text-gray-400">—</span>
                      )}
                    </td>
                  ))}
                </tr>
<tr className="border-b">
                  <td className="py-3 px-4 font-medium">API Access</td>
                  {plans.map((plan) => (
<td key={plan.id} className="text-center py-3 px-4">
                      {plan.features.api_access ? (
<Check className="h-5 w-5 text-green-600 mx-auto" />
                      ) : (
<span className="text-gray-400">—</span>
                      )}
                    </td>
                  ))}
                </tr>
<tr className="border-b">
                  <td className="py-3 px-4 font-medium">SSO</td>
                  {plans.map((plan) => (
<td key={plan.id} className="text-center py-3 px-4">
                      {plan.features.sso ? (
<Check className="h-5 w-5 text-green-600 mx-auto" />
                      ) : (
<span className="text-gray-400">—</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
<td className="py-3 px-4 font-medium">White Labeling</td>
                  {plans.map((plan) => (
<td key={plan.id} className="text-center py-3 px-4">
                      {plan.features.white_labeling ? (
<Check className="h-5 w-5 text-green-600 mx-auto" />
                      ) : (
<span className="text-gray-400">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};