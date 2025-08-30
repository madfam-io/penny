import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  X, 
  Check, 
  Crown, 
  Building, 
  TrendingUp, 
  Loader2,
  Star,
  ArrowRight
} from 'lucide-react';

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan?: string;
}

interface PlanComparison {
  feature: string;
  free: boolean | string | number;
  pro: boolean | string | number;
  enterprise: boolean | string | number;
}

const planComparisons: PlanComparison[] = [
  { feature: 'Users', free: 3, pro: 25, enterprise: 'Unlimited' },
  { feature: 'Messages/month', free: '100', pro: '10,000', enterprise: '100,000' },
  { feature: 'Tokens/month', free: '10K', pro: '1M', enterprise: '10M' },
  { feature: 'Storage', free: '1 GB', pro: '50 GB', enterprise: '500 GB' },
  { feature: 'Custom Tools', free: false, pro: true, enterprise: true },
  { feature: 'API Access', free: false, pro: true, enterprise: true },
  { feature: 'Priority Support', free: false, pro: true, enterprise: true },
  { feature: 'SSO', free: false, pro: false, enterprise: true },
  { feature: 'White Labeling', free: false, pro: false, enterprise: true },
  { feature: 'Advanced Analytics', free: false, pro: true, enterprise: true },
  { feature: 'Audit Logs', free: false, pro: true, enterprise: true },
];

export const UpgradeDialog: React.FC<UpgradeDialogProps> = ({ 
  open, 
  onOpenChange, 
  currentPlan 
}) => {
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'enterprise'>('pro');
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month');
  const [processing, setProcessing] = useState(false);

  const plans = {
    pro: {
      name: 'Pro',
      icon: Crown,
      color: 'blue',
      monthlyPrice: 29,
      yearlyPrice: 290,
      description: 'Perfect for growing teams',
      popular: true,
      features: [
        '25 users included',
        '10,000 messages per month',
        '1M tokens per month',
        '50 GB storage',
        'Custom tools',
        'API access',
        'Priority support',
        'Advanced analytics'
      ]
    },
    enterprise: {
      name: 'Enterprise',
      icon: Building,
      color: 'purple',
      monthlyPrice: 199,
      yearlyPrice: 1990,
      description: 'For large organizations',
      popular: false,
      features: [
        'Unlimited users',
        '100,000 messages per month',
        '10M tokens per month',
        '500 GB storage',
        'All Pro features',
        'SSO integration',
        'White labeling',
        'Dedicated support',
        'Custom contracts'
      ]
    }
  };

  const handleUpgrade = async () => {
    try {
      setProcessing(true);
     
     const response = await fetch('/api/billing/subscription/upgrade', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          plan_id: selectedPlan,
          billing_interval: billingInterval
        })
      });

      if (!response.ok) throw new Error('Failed to upgrade plan');

      const data = await response.json();
      
      // Handle payment if required
      if (data.payment_required && data.payment_url) {
        window.location.href = data.payment_url;
      } else {
        // Upgrade successful
        onOpenChange(false);
        window.location.reload();
      }
    } catch (err) {
      console.error('Upgrade error:', err);
    } finally {
      setProcessing(false);
    }
  };

  const getYearlySavings = (monthlyPrice: number, yearlyPrice: number) => {
    const yearlyMonthly = monthlyPrice * 12;
    const savings = yearlyMonthly - yearlyPrice;
    const percentage = Math.round((savings / yearlyMonthly) * 100);
    return { savings, percentage };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const renderFeatureValue = (value: boolean | string | number) => {
    if (typeof value === 'boolean') {
      return value ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <X className="h-4 w-4 text-gray-400" />
      );
    }
    return <span className="text-sm font-medium">{value}</span>;
  };

  const isCurrentPlanLower = (planType: 'pro' | 'enterprise') => {
    if (!currentPlan) return true;
    const planOrder = { free: 0, pro: 1, enterprise: 2 };
    const currentOrder = planOrder[currentPlan.toLowerCase() as keyof typeof planOrder] || 0;
    const targetOrder = planOrder[planType];
    return targetOrder > currentOrder;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
<h2 className="text-2xl font-bold text-gray-900">Upgrade Your Plan</h2>
            <p className="text-gray-600">Choose the plan that fits your needs</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
<X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 space-y-8">
          {/* Billing Toggle */}
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
                <Badge variant="secondary" className="ml-2 text-xs">Save 20%</Badge>
              </button>
            </div>
          </div>

          {/* Plan Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {Object.entries(plans).map(([planKey, plan]) => {
              const PlanIcon = plan.icon;
              const price = billingInterval === 'year' ? plan.yearlyPrice : plan.monthlyPrice;
              const savings = getYearlySavings(plan.monthlyPrice, plan.yearlyPrice);
              const isSelected = selectedPlan === planKey;
              const canUpgrade = isCurrentPlanLower(planKey as 'pro' | 'enterprise');

              return (
                <Card 
                  key={planKey}
                  className={`relative cursor-pointer transition-all ${
                    isSelected 
                      ? `border-${plan.color}-500 shadow-lg ring-2 ring-${plan.color}-200` 
                      : 'border-gray-200 hover:border-gray-300'
                  } ${plan.popular ? 'transform scale-105' : ''}`}
                  onClick={() => setSelectedPlan(planKey as 'pro' | 'enterprise')}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className={`bg-${plan.color}-600 text-white`}>
                        <Star className="h-3 w-3 mr-1" />
                        Most Popular
                      </Badge>
                    </div>
                  )}

                  <CardHeader className="text-center pb-4">
                    <div className="flex justify-center mb-3">
<div className={`p-3 rounded-full bg-${plan.color}-100`}>
                        <PlanIcon className={`h-8 w-8 text-${plan.color}-600`} />
                      </div>
                    </div>
                   
                   <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <CardDescription className="text-sm">{plan.description}</CardDescription>
                   
                   <div className="mt-4">
                      <div className="text-3xl font-bold">
                        {formatCurrency(price)}
                      </div>
                      <div className="text-sm text-gray-600">
                        per {billingInterval}
                        {billingInterval === 'year' && (
<div className="text-green-600 font-medium">
                            Save ${savings.savings}/year ({savings.percentage}% off)
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
<ul className="space-y-2 text-sm">
                      {plan.features.map((feature, index) => (
<li key={index} className="flex items-center">
                          <Check className={`h-4 w-4 text-${plan.color}-600 mr-2 flex-shrink-0`} />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-6">
                      {canUpgrade ? (
<div className={`w-full p-3 rounded-md border-2 border-dashed transition-colors ${
                          isSelected 
                            ? `border-${plan.color}-500 bg-${plan.color}-50` 
                            : 'border-gray-300'
                        }`}>
<div className="flex items-center justify-center text-sm">
                            {isSelected && (
                              <>
                                <Check className={`h-4 w-4 text-${plan.color}-600 mr-2`} />
                                <span className={`text-${plan.color}-700 font-medium`}>
                                  Selected for upgrade
                                </span>
                              </>
                            )}
                            {!isSelected && (
                              <span className="text-gray-600">
                                Click to select
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
<div className="w-full p-3 rounded-md bg-gray-100 text-center">
                          <span className="text-sm text-gray-600">
                            {currentPlan === planKey ? 'Current Plan' : 'Downgrade not available'}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Feature Comparison Table */}
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>Feature Comparison</CardTitle>
                <CardDescription>Compare features across all plans</CardDescription>
              </CardHeader>
              <CardContent>
<div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
<tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">Feature</th>
<th className="text-center py-3 px-4">
                          <div className="text-gray-600">Free</div>
                        </th>
<th className="text-center py-3 px-4">
                          <div className="text-blue-600 font-semibold">Pro</div>
                          {selectedPlan === 'pro' && (
<Badge variant="secondary" className="mt-1 text-xs">Selected</Badge>
                          )}
                        </th>
<th className="text-center py-3 px-4">
                          <div className="text-purple-600 font-semibold">Enterprise</div>
                          {selectedPlan === 'enterprise' && (
<Badge variant="secondary" className="mt-1 text-xs">Selected</Badge>
                          )}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {planComparisons.map((comparison, index) => (
<tr key={index} className="border-b last:border-b-0">
                          <td className="py-3 px-4 font-medium text-gray-900">
                            {comparison.feature}
                          </td>
<td className="py-3 px-4 text-center">
                            {renderFeatureValue(comparison.free)}
                          </td>
<td className={`py-3 px-4 text-center ${
                            selectedPlan === 'pro' ? 'bg-blue-50' : ''
                          }`}>
                            {renderFeatureValue(comparison.pro)}
                          </td>
                          <td className={`py-3 px-4 text-center ${
                            selectedPlan === 'enterprise' ? 'bg-purple-50' : ''
                          }`}>
                            {renderFeatureValue(comparison.enterprise)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Upgrade Actions */}
          <div className="max-w-md mx-auto">
            <div className="bg-gray-50 rounded-lg p-6 text-center">
<div className="mb-4">
                <h3 className="font-semibold text-gray-900 mb-2">
                  Ready to upgrade to {plans[selectedPlan].name}?
                </h3>
<div className="text-2xl font-bold text-gray-900">
                  {formatCurrency(
                    billingInterval === 'year' 
                      ? plans[selectedPlan].yearlyPrice 
                      : plans[selectedPlan].monthlyPrice
                  )}
                  <span className="text-base font-normal text-gray-600">
                    /{billingInterval}
                  </span>
                </div>
                {billingInterval === 'year' && (
<div className="text-green-600 text-sm font-medium">
                    Save {getYearlySavings(plans[selectedPlan].monthlyPrice, plans[selectedPlan].yearlyPrice).percentage}% with yearly billing
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Button
                  onClick={handleUpgrade}
                  disabled={processing || !isCurrentPlanLower(selectedPlan)}
                  className="w-full"
                  size="lg"
                >
                  {processing ? (
                    <>
<Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
<TrendingUp className="h-4 w-4 mr-2" />
                      Upgrade to {plans[selectedPlan].name}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>

                <div className="text-xs text-gray-600">
                  • 14-day free trial included<br />
                  • Cancel anytime<br />
                  • Prorated billing
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};