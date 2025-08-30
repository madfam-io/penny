import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Tabs } from '../ui/tabs';
import { UserAnalytics } from './UserAnalytics';
import { UsageAnalytics } from './UsageAnalytics';
import { RevenueAnalytics } from './RevenueAnalytics';
import { AIInsights } from './AIInsights';
import { CustomReports } from './CustomReports';
import { BarChart3, Users, DollarSign, Brain, FileText, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';

interface DashboardMetrics {
  totalUsers: number;
  activeUsers: number;
  revenue: number;
  apiCalls: number;
  errorRate: number;
  uptime: number;
  trends: {
    users: number;
    revenue: number;
    usage: number;
  };
}

interface AnalyticsDashboardProps {
  tenantId?: string;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ tenantId }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardMetrics = async () => {
    try {
      setRefreshing(true);
      const params = tenantId ? `?tenantId=${tenantId}` : '';
      const response = await fetch(`/api/admin/analytics/dashboard${params}`);
      
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard metrics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardMetrics();
    // Refresh every 5 minutes
    const interval = setInterval(fetchDashboardMetrics, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [tenantId]);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) {
      return <TrendingUp className="w-4 h-4 text-green-500" />;
    }
    return <TrendingUp className="w-4 h-4 text-red-500 rotate-180" />;
  };

  const getTrendColor = (trend: number) => {
    return trend > 0 ? 'text-green-600' : 'text-red-600';
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'usage', label: 'Usage', icon: BarChart3 },
    { id: 'revenue', label: 'Revenue', icon: DollarSign },
    { id: 'insights', label: 'AI Insights', icon: Brain },
    { id: 'reports', label: 'Reports', icon: FileText }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600">
            {tenantId ? `Tenant: ${tenantId}` : 'Platform-wide analytics'}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={fetchDashboardMetrics}
            className={`px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ${
              refreshing ? 'animate-pulse' : ''
            }`}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      </div>

      {/* Key Metrics Overview */}
      {metrics && activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex items-center space-x-1">
                {getTrendIcon(metrics.trends.users)}
                <span className={`text-sm font-medium ${getTrendColor(metrics.trends.users)}`}>
                  {metrics.trends.users > 0 ? '+' : ''}{metrics.trends.users.toFixed(1)}%
                </span>
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {formatNumber(metrics.totalUsers)}
              </p>
              <p className="text-sm text-gray-600">Total Users</p>
              <p className="text-xs text-gray-500 mt-1">
                {formatNumber(metrics.activeUsers)} active today
              </p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex items-center space-x-1">
                {getTrendIcon(metrics.trends.revenue)}
                <span className={`text-sm font-medium ${getTrendColor(metrics.trends.revenue)}`}>
                  {metrics.trends.revenue > 0 ? '+' : ''}{metrics.trends.revenue.toFixed(1)}%
                </span>
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(metrics.revenue)}
              </p>
              <p className="text-sm text-gray-600">Monthly Revenue</p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <BarChart3 className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex items-center space-x-1">
                {getTrendIcon(metrics.trends.usage)}
                <span className={`text-sm font-medium ${getTrendColor(metrics.trends.usage)}`}>
                  {metrics.trends.usage > 0 ? '+' : ''}{metrics.trends.usage.toFixed(1)}%
                </span>
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {formatNumber(metrics.apiCalls)}
              </p>
              <p className="text-sm text-gray-600">API Calls (30d)</p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-orange-100 rounded-lg">
                {metrics.errorRate < 1 ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-orange-600" />
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Uptime</p>
                <p className="text-sm font-medium text-gray-900">
                  {(metrics.uptime * 100).toFixed(2)}%
                </p>
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {metrics.errorRate.toFixed(2)}%
              </p>
              <p className="text-sm text-gray-600">Error Rate</p>
            </div>
          </Card>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick overview components can go here */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Platform Overview</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-600">
                    {metrics ? formatNumber(metrics.totalUsers) : '0'}
                  </p>
                  <p className="text-gray-600">Total Users</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-600">
                    {metrics ? formatCurrency(metrics.revenue) : '$0'}
                  </p>
                  <p className="text-gray-600">Monthly Revenue</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-purple-600">
                    {metrics ? formatNumber(metrics.apiCalls) : '0'}
                  </p>
                  <p className="text-gray-600">API Calls</p>
                </div>
              </div>
            </Card>
          </div>
        )}
        
        {activeTab === 'users' && <UserAnalytics tenantId={tenantId} />}
        {activeTab === 'usage' && <UsageAnalytics tenantId={tenantId} />}
        {activeTab === 'revenue' && <RevenueAnalytics tenantId={tenantId} />}
        {activeTab === 'insights' && <AIInsights tenantId={tenantId} />}
        {activeTab === 'reports' && <CustomReports tenantId={tenantId} />}
      </div>
    </div>
  );
};"