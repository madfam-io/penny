import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  DollarSign, 
  Users, 
  TrendingUp, 
  TrendingDown, 
  CreditCard,
  AlertCircle,
  Download,
  Filter,
  Calendar,
  BarChart3,
  PieChart
} from 'lucide-react';
import { RevenueChart } from './RevenueChart';
import { SubscriptionMetrics } from './SubscriptionMetrics';
import { CustomerBilling } from './CustomerBilling';

interface BillingStats {
  total_revenue: number;
  monthly_recurring_revenue: number;
  annual_recurring_revenue: number;
  average_revenue_per_user: number;
  total_customers: number;
  active_subscriptions: number;
  churned_this_month: number;
  growth_rate: number;
  failed_payments: number;
  overdue_invoices: number;
}

interface RevenueMetrics {
  current_month: number;
  previous_month: number;
  growth_percentage: number;
  yearly_total: number;
}

export const BillingOverview: React.FC = () => {
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [revenueMetrics, setRevenueMetrics] = useState<RevenueMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('30d');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchBillingData();
  }, [dateRange]);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      
      const [statsResponse, metricsResponse] = await Promise.all([
        fetch(`/api/admin/billing/stats?range=${dateRange}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        }),
        fetch(`/api/admin/billing/revenue-metrics?range=${dateRange}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        })
      ]);

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        setRevenueMetrics(metricsData);
      }

    } catch (err) {
      setError('Failed to load billing data');
      console.error('Billing data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportData = async (type: 'revenue' | 'subscriptions' | 'customers') => {
    try {
      const response = await fetch(`/api/admin/billing/export/${type}?range=${dateRange}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}-export-${dateRange}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const getChangeIcon = (value: number) => {
    return value >= 0 ? (
      <TrendingUp className="h-4 w-4 text-green-600" />
    ) : (
      <TrendingDown className="h-4 w-4 text-red-600" />
    );
  };

  const getChangeColor = (value: number) => {
    return value >= 0 ? 'text-green-600' : 'text-red-600';
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
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
          <span className="text-red-800">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Billing Overview</h1>
          <p className="text-gray-600 mt-1">Monitor revenue, subscriptions, and billing metrics</p>
        </div>
       
       <div className="flex space-x-3">
          {/* Date Range Selector */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>

          <Button variant="outline" onClick={() => exportData('revenue')}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.total_revenue)}</div>
              {revenueMetrics && (
                <div className={`text-xs flex items-center mt-1 ${getChangeColor(revenueMetrics.growth_percentage)}`}>
                  {getChangeIcon(revenueMetrics.growth_percentage)}
                  <span className="ml-1">{formatPercentage(revenueMetrics.growth_percentage)} from last month</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Recurring Revenue</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.monthly_recurring_revenue)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                ARR: {formatCurrency(stats.annual_recurring_revenue)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.active_subscriptions.toLocaleString()}</div>
              <div className={`text-xs flex items-center mt-1 ${getChangeColor(-stats.churned_this_month)}`}>
                <span>{stats.churned_this_month} churned this month</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Revenue Per User</CardTitle>
              <PieChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.average_revenue_per_user)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.total_customers.toLocaleString()} total customers
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Alerts */}
      {stats && (stats.failed_payments > 0 || stats.overdue_invoices > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.failed_payments > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-600 mr-3" />
                  <div>
                    <div className="font-medium text-red-900">
                      {stats.failed_payments} Failed Payments
                    </div>
                    <div className="text-red-700 text-sm">
                      Require immediate attention to prevent churn
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {stats.overdue_invoices > 0 && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <CreditCard className="h-5 w-5 text-yellow-600 mr-3" />
                  <div>
                    <div className="font-medium text-yellow-900">
                      {stats.overdue_invoices} Overdue Invoices
                    </div>
                    <div className="text-yellow-700 text-sm">
                      Follow up on payment collection
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Revenue</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Trends</CardTitle>
                <CardDescription>Monthly revenue breakdown and growth</CardDescription>
              </CardHeader>
              <CardContent>
                <RevenueChart />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue Distribution</CardTitle>
                <CardDescription>Revenue by plan type</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
                      <span className="font-medium">Pro Plan</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(45000)}</div>
                      <div className="text-sm text-gray-600">65% of total</div>
                    </div>
                  </div>
                 
                 <div className="flex items-center justify-between p-3 bg-purple-50 rounded">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-purple-500 rounded-full mr-3"></div>
                      <span className="font-medium">Enterprise Plan</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(28000)}</div>
                      <div className="text-sm text-gray-600">30% of total</div>
                    </div>
                  </div>
                 
                 <div className="flex items-center justify-between p-3 bg-green-50 rounded">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                      <span className="font-medium">Overage & Add-ons</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(8000)}</div>
                      <div className="text-sm text-gray-600">5% of total</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="subscriptions">
          <SubscriptionMetrics />
        </TabsContent>

        <TabsContent value="customers">
          <CustomerBilling />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Churn Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-red-600">5.2%</div>
                    <div className="text-sm text-gray-600">Monthly churn rate</div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Voluntary churn:</span>
                      <span className="font-medium">3.8%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Involuntary churn:</span>
                      <span className="font-medium">1.4%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Conversion Rates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Trial to paid:</span>
                      <span className="font-medium">68%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{width: '68%'}}></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Free to pro:</span>
                      <span className="font-medium">12%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{width: '12%'}}></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Pro to enterprise:</span>
                      <span className="font-medium">8%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-purple-500 h-2 rounded-full" style={{width: '8%'}}></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Customer Lifetime Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">{formatCurrency(2400)}</div>
                    <div className="text-sm text-gray-600">Average CLV</div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Pro plan CLV:</span>
                      <span className="font-medium">{formatCurrency(1800)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Enterprise CLV:</span>
                      <span className="font-medium">{formatCurrency(4200)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};