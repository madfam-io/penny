import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { DataTable } from '../common/DataTable';
import { 
  Users, 
  TrendingUp, 
  TrendingDown,
  AlertCircle,
  Crown,
  Building,
  Calendar,
  DollarSign,
  RefreshCw
} from 'lucide-react';

interface SubscriptionData {
  id: string;
  tenant_name: string;
  plan_name: string;
  status: string;
  billing_interval: 'month' | 'year';
  price: number;
  currency: string;
  current_period_start: string;
  current_period_end: string;
  created_at: string;
  trial_end?: string;
  canceled_at?: string;
}

interface SubscriptionStats {
  total_subscriptions: number;
  active_subscriptions: number;
  trialing_subscriptions: number;
  canceled_subscriptions: number;
  past_due_subscriptions: number;
  churn_rate: number;
  growth_rate: number;
  conversion_rate: number;
  plan_distribution: Record<string, number>;
}

export const SubscriptionMetrics: React.FC = () => {
  const [subscriptions, setSubscriptions] = useState<SubscriptionData[]>([]);
  const [stats, setStats] = useState<SubscriptionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchSubscriptionData();
  }, [statusFilter]);

  const fetchSubscriptionData = async () => {
    try {
      setLoading(true);
      
      const [subscriptionsResponse, statsResponse] = await Promise.all([
        fetch(`/api/admin/billing/subscriptions?status=${statusFilter}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        }),
        fetch('/api/admin/billing/subscription-stats', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        })
      ]);

      if (subscriptionsResponse.ok) {
        const subscriptionsData = await subscriptionsResponse.json();
        setSubscriptions(subscriptionsData.subscriptions || []);
      }

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      } else {
        // Mock stats data
        setStats({
          total_subscriptions: 1247,
          active_subscriptions: 1089,
          trialing_subscriptions: 67,
          canceled_subscriptions: 91,
          past_due_subscriptions: 23,
          churn_rate: 5.2,
          growth_rate: 12.3,
          conversion_rate: 68.4,
          plan_distribution: {
            'free': 452,
            'pro': 689,
            'enterprise': 106
          }
        });
      }

    } catch (err) {
      setError('Failed to load subscription data');
      console.error('Subscription data fetch error:', err);
    } finally {
      setLoading(false);
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
      month: 'short',
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

  const getPlanIcon = (planName: string) => {
    switch (planName.toLowerCase()) {
      case 'pro': return <Crown className="h-4 w-4 text-blue-600" />;
      case 'enterprise': return <Building className="h-4 w-4 text-purple-600" />;
      default: return <Users className="h-4 w-4 text-gray-600" />;
    }
  };

  const columns = [
    {
      header: 'Customer',
      accessorKey: 'tenant_name',
      cell: ({ row }: any) => (
        <div className="font-medium text-gray-900">{row.original.tenant_name}</div>
      ),
    },
    {
      header: 'Plan',
      accessorKey: 'plan_name',
      cell: ({ row }: any) => (
        <div className="flex items-center space-x-2">
          {getPlanIcon(row.original.plan_name)}
          <span className="font-medium">{row.original.plan_name}</span>
        </div>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }: any) => (
        <Badge className={getStatusColor(row.original.status)}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      header: 'Revenue',
      accessorKey: 'price',
      cell: ({ row }: any) => (
        <div>
          <div className="font-medium">
            {formatCurrency(row.original.price, row.original.currency)}
          </div>
          <div className="text-sm text-gray-600">
            /{row.original.billing_interval}
          </div>
        </div>
      ),
    },
    {
      header: 'Period',
      accessorKey: 'current_period_end',
      cell: ({ row }: any) => (
        <div className="text-sm">
          <div>{formatDate(row.original.current_period_start)}</div>
          <div className="text-gray-600">to {formatDate(row.original.current_period_end)}</div>
        </div>
      ),
    },
    {
      header: 'Created',
      accessorKey: 'created_at',
      cell: ({ row }: any) => (
        <div className="text-sm text-gray-600">
          {formatDate(row.original.created_at)}
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Subscriptions</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_subscriptions.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.active_subscriptions} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Growth Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">+{stats.growth_rate}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                Month over month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.churn_rate}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                Monthly churn rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Trial Conversion</CardTitle>
              <RefreshCw className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.conversion_rate}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                Trial to paid conversion
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Plan Distribution */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Plan Distribution</CardTitle>
              <CardDescription>Current subscription breakdown by plan</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(stats.plan_distribution).map(([plan, count]) => {
                  const percentage = (count / stats.total_subscriptions) * 100;
                  return (
                    <div key={plan} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getPlanIcon(plan)}
                        <span className="font-medium capitalize">{plan}</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 w-24">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="text-sm font-medium w-12 text-right">
                          {count}
                        </div>
                        <div className="text-sm text-gray-600 w-12 text-right">
                          ({percentage.toFixed(1)}%)
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status Overview</CardTitle>
              <CardDescription>Subscription status breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span>Active</span>
                  </div>
                  <div className="font-medium">{stats?.active_subscriptions.toLocaleString()}</div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span>Trialing</span>
                  </div>
                  <div className="font-medium">{stats?.trialing_subscriptions.toLocaleString()}</div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <span>Past Due</span>
                  </div>
                  <div className="font-medium text-yellow-600">{stats?.past_due_subscriptions.toLocaleString()}</div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span>Canceled</span>
                  </div>
                  <div className="font-medium text-red-600">{stats?.canceled_subscriptions.toLocaleString()}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Alerts */}
      {stats && stats.past_due_subscriptions > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-yellow-600 mr-3" />
              <div>
                <div className="font-medium text-yellow-900">
                  {stats.past_due_subscriptions} subscriptions are past due
                </div>
                <div className="text-yellow-700 text-sm">
                  These customers need payment method updates or dunning management
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subscriptions Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Subscriptions</CardTitle>
              <CardDescription>
                All customer subscriptions and their current status
              </CardDescription>
            </div>
            
            <div className="flex space-x-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="trialing">Trialing</option>
                <option value="past_due">Past Due</option>
                <option value="canceled">Canceled</option>
              </select>
              
              <Button variant="outline" onClick={fetchSubscriptionData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable 
            columns={columns} 
            data={subscriptions}
            searchPlaceholder="Search subscriptions..."
          />
        </CardContent>
      </Card>
    </div>
  );
};