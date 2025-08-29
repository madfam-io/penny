import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  CreditCard, 
  Plus, 
  Trash2, 
  Check,
  AlertCircle,
  Star,
  Calendar
} from 'lucide-react';

interface PaymentMethod {
  id: string;
  stripe_payment_method_id: string;
  type: string;
  brand?: string;
  last4?: string;
  exp_month?: number;
  exp_year?: number;
  is_default: boolean;
  created_at: string;
}

export const PaymentMethods: React.FC = () => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  const fetchPaymentMethods = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/billing/payment-methods', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      });

      if (!response.ok) throw new Error('Failed to fetch payment methods');

      const data = await response.json();
      setPaymentMethods(data.payment_methods || []);
    } catch (err) {
      setError('Failed to load payment methods');
      console.error('Payment methods fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPaymentMethod = async () => {
    try {
      setProcessing('add');
      
      // In a real implementation, this would integrate with Stripe Elements
      // For now, we'll simulate the flow
      const response = await fetch('/api/billing/setup-intent', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to create setup intent');

      const data = await response.json();
      
      // Redirect to Stripe-hosted page or use Stripe Elements
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError('Failed to add payment method');
    } finally {
      setProcessing(null);
    }
  };

  const handleSetDefault = async (paymentMethodId: string) => {
    try {
      setProcessing(paymentMethodId);
      
      const response = await fetch(`/api/billing/payment-methods/${paymentMethodId}/default`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to set default payment method');

      // Update local state
      setPaymentMethods(methods => 
        methods.map(method => ({
          ...method,
          is_default: method.id === paymentMethodId
        }))
      );
    } catch (err) {
      setError('Failed to set default payment method');
    } finally {
      setProcessing(null);
    }
  };

  const handleRemove = async (paymentMethodId: string) => {
    if (!confirm('Are you sure you want to remove this payment method?')) {
      return;
    }

    try {
      setProcessing(paymentMethodId);
      
      const response = await fetch(`/api/billing/payment-methods/${paymentMethodId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      });

      if (!response.ok) throw new Error('Failed to remove payment method');

      // Remove from local state
      setPaymentMethods(methods => 
        methods.filter(method => method.id !== paymentMethodId)
      );
    } catch (err) {
      setError('Failed to remove payment method');
    } finally {
      setProcessing(null);
    }
  };

  const getCardIcon = (brand?: string) => {
    // In a real implementation, you'd have different icons for each brand
    return <CreditCard className="h-6 w-6 text-gray-600" />;
  };

  const formatExpiryDate = (month?: number, year?: number) => {
    if (!month || !year) return '';
    return `${month.toString().padStart(2, '0')}/${year.toString().slice(-2)}`;
  };

  const isExpired = (month?: number, year?: number) => {
    if (!month || !year) return false;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    return year < currentYear || (year === currentYear && month < currentMonth);
  };

  const isExpiringSoon = (month?: number, year?: number) => {
    if (!month || !year) return false;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    // Check if expiring in the next 2 months
    if (year === currentYear) {
      return month - currentMonth <= 2 && month >= currentMonth;
    } else if (year === currentYear + 1) {
      return month + 12 - currentMonth <= 2;
    }
    
    return false;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Payment Methods</h2>
          <p className="text-gray-600">Manage your payment methods and billing information</p>
        </div>
        <Button onClick={handleAddPaymentMethod} disabled={processing === 'add'}>
          <Plus className="h-4 w-4 mr-2" />
          {processing === 'add' ? 'Adding...' : 'Add Payment Method'}
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
          <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
          <span className="text-red-800">{error}</span>
        </div>
      )}

      {/* Payment Methods Grid */}
      {paymentMethods.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CreditCard className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No payment methods</h3>
            <p className="text-gray-600 text-center mb-6">
              Add a payment method to manage your subscription and billing
            </p>
            <Button onClick={handleAddPaymentMethod} disabled={processing === 'add'}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Payment Method
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paymentMethods.map((method) => {
            const expired = isExpired(method.exp_month, method.exp_year);
            const expiringSoon = isExpiringSoon(method.exp_month, method.exp_year);
            const isProcessingThis = processing === method.id;

            return (
              <Card 
                key={method.id} 
                className={`relative ${
                  expired 
                    ? 'border-red-200 bg-red-50' 
                    : expiringSoon 
                    ? 'border-yellow-200 bg-yellow-50' 
                    : method.is_default 
                    ? 'border-green-200 bg-green-50' 
                    : ''
                }`}
              >
                {method.is_default && (
                  <div className="absolute -top-2 -right-2">
                    <Badge className="bg-green-600 text-white">
                      <Star className="h-3 w-3 mr-1" />
                      Default
                    </Badge>
                  </div>
                )}

                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getCardIcon(method.brand)}
                      <div>
                        <CardTitle className="text-base capitalize">
                          {method.brand || method.type} •••• {method.last4}
                        </CardTitle>
                        <CardDescription>
                          Added {new Date(method.created_at).toLocaleDateString()}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Expiry Information */}
                  {method.exp_month && method.exp_year && (
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-600">
                        Expires {formatExpiryDate(method.exp_month, method.exp_year)}
                      </span>
                      {expired && (
                        <Badge variant="destructive" className="text-xs">
                          Expired
                        </Badge>
                      )}
                      {expiringSoon && !expired && (
                        <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                          Expiring Soon
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Warning Messages */}
                  {expired && (
                    <div className="p-3 bg-red-100 border border-red-200 rounded-md">
                      <div className="flex items-start">
                        <AlertCircle className="h-4 w-4 text-red-600 mr-2 mt-0.5" />
                        <div className="text-sm">
                          <p className="text-red-800 font-medium">Card Expired</p>
                          <p className="text-red-700">Update your payment method to continue service.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {expiringSoon && !expired && (
                    <div className="p-3 bg-yellow-100 border border-yellow-200 rounded-md">
                      <div className="flex items-start">
                        <AlertCircle className="h-4 w-4 text-yellow-600 mr-2 mt-0.5" />
                        <div className="text-sm">
                          <p className="text-yellow-800 font-medium">Card Expiring Soon</p>
                          <p className="text-yellow-700">Please update your payment information.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex space-x-2 pt-2">
                    {!method.is_default && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetDefault(method.id)}
                        disabled={isProcessingThis}
                        className="flex-1"
                      >
                        {isProcessingThis ? (
                          'Setting...'
                        ) : (
                          <>
                            <Check className="h-4 w-4 mr-1" />
                            Set Default
                          </>
                        )}
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemove(method.id)}
                      disabled={isProcessingThis}
                      className={`${method.is_default ? 'flex-1' : ''} text-red-600 hover:text-red-700 hover:bg-red-50`}
                    >
                      {isProcessingThis ? (
                        'Removing...'
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-1" />
                          Remove
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Add New Card */}
          <Card className="border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Plus className="h-8 w-8 text-gray-400 mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">Add Payment Method</h3>
              <p className="text-gray-600 text-center text-sm mb-4">
                Add a new credit or debit card
              </p>
              <Button 
                variant="outline" 
                onClick={handleAddPaymentMethod}
                disabled={processing === 'add'}
              >
                {processing === 'add' ? 'Adding...' : 'Add Card'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payment Security Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <CreditCard className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900">Secure Payment Processing</h3>
              <p className="text-blue-800 text-sm mt-1">
                Your payment information is encrypted and processed securely through Stripe. 
                We never store your full card details on our servers.
              </p>
              <div className="flex items-center space-x-4 mt-3 text-xs text-blue-700">
                <span>• PCI DSS Compliant</span>
                <span>• 256-bit SSL Encryption</span>
                <span>• Fraud Protection</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};