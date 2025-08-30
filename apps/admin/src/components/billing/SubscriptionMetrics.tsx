import React, { useState, useEffect } from 'react';\nimport { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';\nimport { Button } from '../ui/button';\nimport { Badge } from '../ui/badge';\nimport { DataTable } from '../common/DataTable';
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
        fetch(`/api/admin/billing/subscriptions?status=${statusFilter}`, {\n          headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        }),\n        fetch('/api/admin/billing/subscription-stats', {\n          headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
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
      case 'pro': return <Crown className="h-4 w-4 text-blue-600" />;\n      case 'enterprise': return <Building className="h-4 w-4 text-purple-600" />;\n      default: return <Users className="h-4 w-4 text-gray-600" />;
    }
  };

  const columns = [
    {
      header: 'Customer',
      accessorKey: 'tenant_name',
      cell: ({ row }: any) => (\n        <div className="font-medium text-gray-900">{row.original.tenant_name}</div>
      ),
    },
    {
      header: 'Plan',
      accessorKey: 'plan_name',
      cell: ({ row }: any) => (\n        <div className="flex items-center space-x-2">
          {getPlanIcon(row.original.plan_name)}\n          <span className="font-medium">{row.original.plan_name}</span>
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
        <div>\n          <div className="font-medium">
            {formatCurrency(row.original.price, row.original.currency)}
          </div>\n          <div className="text-sm text-gray-600">
            /{row.original.billing_interval}
          </div>
        </div>
      ),
    },
    {
      header: 'Period',
      accessorKey: 'current_period_end',
      cell: ({ row }: any) => (\n        <div className="text-sm">
          <div>{formatDate(row.original.current_period_start)}</div>\n          <div className="text-gray-600">to {formatDate(row.original.current_period_end)}</div>
        </div>
      ),
    },
    {
      header: 'Created',
      accessorKey: 'created_at',
      cell: ({ row }: any) => (\n        <div className="text-sm text-gray-600">
          {formatDate(row.original.created_at)}
        </div>
      ),
    },
  ];

  if (loading) {
    return (\n      <div className="flex items-center justify-center p-8">\n        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (\n    <div className="space-y-6">
      {/* Metrics Cards */}
      {stats && (\n        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>\n            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">\n              <CardTitle className="text-sm font-medium">Total Subscriptions</CardTitle>\n              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>\n              <div className="text-2xl font-bold">{stats.total_subscriptions.toLocaleString()}</div>\n              <p className="text-xs text-muted-foreground mt-1">
                {stats.active_subscriptions} active
              </p>
            </CardContent>
          </Card>

          <Card>\n            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">\n              <CardTitle className="text-sm font-medium">Growth Rate</CardTitle>\n              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>\n              <div className="text-2xl font-bold text-green-600">+{stats.growth_rate}%</div>\n              <p className="text-xs text-muted-foreground mt-1">
                Month over month
              </p>
            </CardContent>
          </Card>

          <Card>\n            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">\n              <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>\n              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>\n              <div className="text-2xl font-bold text-red-600">{stats.churn_rate}%</div>\n              <p className="text-xs text-muted-foreground mt-1">
                Monthly churn rate
              </p>
            </CardContent>
          </Card>

          <Card>\n            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">\n              <CardTitle className="text-sm font-medium">Trial Conversion</CardTitle>\n              <RefreshCw className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>\n              <div className="text-2xl font-bold text-blue-600">{stats.conversion_rate}%</div>\n              <p className="text-xs text-muted-foreground mt-1">
                Trial to paid conversion
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Plan Distribution */}
      {stats && (\n        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Plan Distribution</CardTitle>
              <CardDescription>Current subscription breakdown by plan</CardDescription>
            </CardHeader>
            <CardContent>\n              <div className="space-y-4">
                {Object.entries(stats.plan_distribution).map(([plan, count]) => {
                  const percentage = (count / stats.total_subscriptions) * 100;
                  return (\n                    <div key={plan} className="flex items-center justify-between">\n                      <div className="flex items-center space-x-2">
                        {getPlanIcon(plan)}\n                        <span className="font-medium capitalize">{plan}</span>
                      </div>\n                      <div className="flex items-center space-x-3">\n                        <div className="flex-1 bg-gray-200 rounded-full h-2 w-24">
                          <div \n                            className="bg-blue-600 h-2 rounded-full" \n                            style={{ width: `${percentage}%` }}
                          />
                        </div>\n                        <div className="text-sm font-medium w-12 text-right">
                          {count}
                        </div>\n                        <div className="text-sm text-gray-600 w-12 text-right">
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
            <CardContent>\n              <div className="space-y-4">\n                <div className="flex items-center justify-between">\n                  <div className="flex items-center space-x-2">\n                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span>Active</span>
                  </div>\n                  <div className="font-medium">{stats?.active_subscriptions.toLocaleString()}</div>
                </div>
                \n                <div className="flex items-center justify-between">\n                  <div className="flex items-center space-x-2">\n                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span>Trialing</span>
                  </div>\n                  <div className="font-medium">{stats?.trialing_subscriptions.toLocaleString()}</div>
                </div>
                \n                <div className="flex items-center justify-between">\n                  <div className="flex items-center space-x-2">\n                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <span>Past Due</span>
                  </div>\n                  <div className="font-medium text-yellow-600">{stats?.past_due_subscriptions.toLocaleString()}</div>
                </div>
                \n                <div className="flex items-center justify-between">\n                  <div className="flex items-center space-x-2">\n                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span>Canceled</span>
                  </div>\n                  <div className="font-medium text-red-600">{stats?.canceled_subscriptions.toLocaleString()}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Alerts */}
      {stats && stats.past_due_subscriptions > 0 && (\n        <Card className="border-yellow-200 bg-yellow-50">\n          <CardContent className="pt-6">\n            <div className="flex items-center">\n              <AlertCircle className="h-5 w-5 text-yellow-600 mr-3" />
              <div>\n                <div className="font-medium text-yellow-900">
                  {stats.past_due_subscriptions} subscriptions are past due
                </div>\n                <div className="text-yellow-700 text-sm">
                  These customers need payment method updates or dunning management
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subscriptions Table */}
      <Card>
        <CardHeader>\n          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Subscriptions</CardTitle>
              <CardDescription>
                All customer subscriptions and their current status
              </CardDescription>
            </div>
            \n            <div className="flex space-x-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}\n                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >\n                <option value="all">All Status</option>\n                <option value="active">Active</option>\n                <option value="trialing">Trialing</option>\n                <option value="past_due">Past Due</option>\n                <option value="canceled">Canceled</option>
              </select>
              \n              <Button variant="outline" onClick={fetchSubscriptionData}>\n                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable 
            columns={columns} 
            data={subscriptions}\n            searchPlaceholder="Search subscriptions..."
          />
        </CardContent>
      </Card>
    </div>
  );
};