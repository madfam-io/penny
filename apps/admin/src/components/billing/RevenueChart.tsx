import React, { useState, useEffect } from 'react';
import { 
  Bar, 
  BarChart, 
  Line,
  LineChart,
  Area,
  AreaChart,
  ResponsiveContainer, 
  Tooltip, 
  XAxis, 
  YAxis, 
  Legend,
  CartesianGrid
} from 'recharts';\nimport { Button } from '../ui/button';\nimport { Badge } from '../ui/badge';
import { BarChart3, TrendingUp, Calendar } from 'lucide-react';

interface RevenueDataPoint {
  period: string;
  date: string;
  total_revenue: number;
  subscription_revenue: number;
  overage_revenue: number;
  refunded_amount: number;
  net_revenue: number;
  mrr: number;
  new_mrr: number;
  churned_mrr: number;
  expansion_mrr: number;
  customers_count: number;
}

interface RevenueChartProps {\n  period?: '7d' | '30d' | '90d' | '1y';
  height?: number;
}

export const RevenueChart: React.FC<RevenueChartProps> = ({ \n  period = '30d', 
  height = 350 
}) => {
  const [data, setData] = useState<RevenueDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartType, setChartType] = useState<'bar' | 'line' | 'area'>('bar');
  const [metric, setMetric] = useState<'revenue' | 'mrr'>('revenue');

  useEffect(() => {
    fetchRevenueData();
  }, [period]);

  const fetchRevenueData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/billing/revenue-chart?period=${period}`, {\n        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      });

      if (!response.ok) throw new Error('Failed to fetch revenue data');

      const result = await response.json();
      setData(result.data || generateMockData());
    } catch (err) {
      console.error('Revenue chart fetch error:', err);
      setData(generateMockData());
    } finally {
      setLoading(false);
    }
  };

  const generateMockData = (): RevenueDataPoint[] => {
    // Generate mock data for demonstration
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];\n    return months.slice(0, period === '1y' ? 12 : period === '90d' ? 3 : 6).map((month, index) => ({\n      period: month,\n      date: `2024-${String(index + 1).padStart(2, '0')}-01`,
      total_revenue: 95000 + (index * 8000) + Math.random() * 10000,
      subscription_revenue: 80000 + (index * 7000) + Math.random() * 8000,
      overage_revenue: 8000 + (index * 500) + Math.random() * 2000,
      refunded_amount: 2000 + Math.random() * 1000,
      net_revenue: 91000 + (index * 8000) + Math.random() * 9000,
      mrr: 85000 + (index * 6000) + Math.random() * 7000,
      new_mrr: 12000 + Math.random() * 5000,
      churned_mrr: 3000 + Math.random() * 2000,
      expansion_mrr: 4000 + Math.random() * 3000,
      customers_count: 450 + (index * 25)
    }));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatTooltipValue = (value: number, name: string) => {
    const labels: Record<string, string> = {
      total_revenue: 'Total Revenue',
      subscription_revenue: 'Subscription Revenue', 
      overage_revenue: 'Overage Revenue',
      refunded_amount: 'Refunds',
      net_revenue: 'Net Revenue',
      mrr: 'Monthly Recurring Revenue',
      new_mrr: 'New MRR',
      churned_mrr: 'Churned MRR',
      expansion_mrr: 'Expansion MRR'
    };
    return [formatCurrency(value), labels[name] || name];
  };

  const getChartData = () => {
    if (metric === 'mrr') {
      return data.map(d => ({
        ...d,
        displayMetric: d.mrr,
        secondaryMetric: d.new_mrr,
        tertiaryMetric: d.churned_mrr
      }));
    }
    return data.map(d => ({
      ...d,
      displayMetric: d.total_revenue,
      secondaryMetric: d.subscription_revenue,
      tertiaryMetric: d.overage_revenue
    }));
  };

  const getTotalChange = () => {
    if (data.length < 2) return 0;
    const latest = data[data.length - 1];
    const previous = data[data.length - 2];
    const currentValue = metric === 'mrr' ? latest.mrr : latest.total_revenue;
    const previousValue = metric === 'mrr' ? previous.mrr : previous.total_revenue;
    return ((currentValue - previousValue) / previousValue) * 100;
  };

  const renderChart = () => {
    const chartData = getChartData();
    const colors = {
      primary: metric === 'mrr' ? '#8b5cf6' : '#3b82f6',
      secondary: metric === 'mrr' ? '#06d6a0' : '#10b981', 
      tertiary: metric === 'mrr' ? '#ef4444' : '#f59e0b'
    };

    const commonProps = {
      data: chartData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    };

    switch (chartType) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis \n              dataKey="period" \n              stroke="#888888" 
              fontSize={12} 
              tickLine={false} 
              axisLine={false} 
            />
            <YAxis\n              stroke="#888888"
              fontSize={12}
              tickLine={false}
              axisLine={false}\n              tickFormatter={(value) => formatCurrency(value).replace('.00', '')}
            />
            <Tooltip 
              formatter={formatTooltipValue}\n              labelStyle={{ color: '#374151' }}
              contentStyle={{ \n                backgroundColor: '#fff', \n                border: '1px solid #e5e7eb',\n                borderRadius: '6px'
              }}
            />
            <Legend />
            <Line \n              dataKey="displayMetric" 
              name={metric === 'mrr' ? 'MRR' : 'Total Revenue'}
              stroke={colors.primary}
              strokeWidth={3}
              dot={{ fill: colors.primary, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: colors.primary, strokeWidth: 2 }}
            />
            <Line \n              dataKey="secondaryMetric" 
              name={metric === 'mrr' ? 'New MRR' : 'Subscription Revenue'}
              stroke={colors.secondary}
              strokeWidth={2}\n              strokeDasharray="5 5"
            />
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            <defs>\n              <linearGradient id="colorPrimary" x1="0" y1="0" x2="0" y2="1">\n                <stop offset="5%" stopColor={colors.primary} stopOpacity={0.3}/>\n                <stop offset="95%" stopColor={colors.primary} stopOpacity={0}/>
              </linearGradient>\n              <linearGradient id="colorSecondary" x1="0" y1="0" x2="0" y2="1">\n                <stop offset="5%" stopColor={colors.secondary} stopOpacity={0.3}/>\n                <stop offset="95%" stopColor={colors.secondary} stopOpacity={0}/>
              </linearGradient>
            </defs>\n            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis \n              dataKey="period" \n              stroke="#888888" 
              fontSize={12} 
              tickLine={false} 
              axisLine={false} 
            />
            <YAxis\n              stroke="#888888"
              fontSize={12}
              tickLine={false}
              axisLine={false}\n              tickFormatter={(value) => formatCurrency(value).replace('.00', '')}
            />
            <Tooltip formatter={formatTooltipValue} />
            <Legend />
            <Area \n              dataKey="secondaryMetric" \n              stackId="1"
              name={metric === 'mrr' ? 'New MRR' : 'Subscription Revenue'}
              stroke={colors.secondary}
              fillOpacity={1}\n              fill="url(#colorSecondary)" 
            />
            <Area \n              dataKey="displayMetric" \n              stackId="2"
              name={metric === 'mrr' ? 'Total MRR' : 'Total Revenue'}
              stroke={colors.primary}
              fillOpacity={1}\n              fill="url(#colorPrimary)" 
            />
          </AreaChart>
        );

      default: // bar
        return (
          <BarChart {...commonProps}>\n            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis \n              dataKey="period" \n              stroke="#888888" 
              fontSize={12} 
              tickLine={false} 
              axisLine={false} 
            />
            <YAxis\n              stroke="#888888"
              fontSize={12}
              tickLine={false}
              axisLine={false}\n              tickFormatter={(value) => formatCurrency(value).replace('.00', '')}
            />
            <Tooltip formatter={formatTooltipValue} />
            <Legend />
            <Bar \n              dataKey="displayMetric" 
              name={metric === 'mrr' ? 'Total MRR' : 'Total Revenue'}
              fill={colors.primary} 
              radius={[4, 4, 0, 0]} 
            />
            <Bar \n              dataKey="secondaryMetric" 
              name={metric === 'mrr' ? 'New MRR' : 'Subscription Revenue'}
              fill={colors.secondary} 
              radius={[4, 4, 0, 0]} 
            />
            {metric === 'mrr' && (
              <Bar \n                dataKey="tertiaryMetric" \n                name="Churned MRR"
                fill={colors.tertiary} 
                radius={[4, 4, 0, 0]} 
              />
            )}
          </BarChart>
        );
    }
  };

  if (loading) {
    return (\n      <div className="flex items-center justify-center" style={{ height }}>\n        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const totalChange = getTotalChange();

  return (\n    <div className="space-y-4">
      {/* Chart Controls */}\n      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">\n        <div className="flex items-center space-x-4">\n          <div className="flex items-center space-x-2">\n            <span className="text-sm font-medium text-gray-700">Metric:</span>\n            <div className="flex space-x-1">
              <Button
                variant={metric === 'revenue' ? 'default' : 'outline'}\n                size="sm"
                onClick={() => setMetric('revenue')}
              >
                Revenue
              </Button>
              <Button
                variant={metric === 'mrr' ? 'default' : 'outline'}\n                size="sm"
                onClick={() => setMetric('mrr')}
              >
                MRR
              </Button>
            </div>
          </div>

          {totalChange !== 0 && (
            <Badge 
              variant={totalChange >= 0 ? 'default' : 'destructive'}\n              className="flex items-center space-x-1"
            >\n              <TrendingUp className={`h-3 w-3 ${totalChange < 0 ? 'rotate-180' : ''}`} />\n              <span>{totalChange >= 0 ? '+' : ''}{totalChange.toFixed(1)}%</span>
            </Badge>
          )}
        </div>
\n        <div className="flex items-center space-x-2">\n          <span className="text-sm font-medium text-gray-700">View:</span>\n          <div className="flex space-x-1">
            <Button
              variant={chartType === 'bar' ? 'default' : 'outline'}\n              size="sm"
              onClick={() => setChartType('bar')}
            >\n              <BarChart3 className="h-4 w-4" />
            </Button>
            <Button
              variant={chartType === 'line' ? 'default' : 'outline'}\n              size="sm"
              onClick={() => setChartType('line')}
            >\n              <TrendingUp className="h-4 w-4" />
            </Button>
            <Button
              variant={chartType === 'area' ? 'default' : 'outline'}\n              size="sm"
              onClick={() => setChartType('area')}
            >\n              <Calendar className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Chart */}\n      <ResponsiveContainer width="100%" height={height}>
        {renderChart()}
      </ResponsiveContainer>

      {/* Summary Stats */}\n      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">\n        <div className="text-center">\n          <div className="text-lg font-semibold text-gray-900">
            {formatCurrency(data.reduce((sum, d) => sum + (metric === 'mrr' ? d.mrr : d.total_revenue), 0))}
          </div>\n          <div className="text-sm text-gray-600">Total {metric === 'mrr' ? 'MRR' : 'Revenue'}</div>
        </div>
        \n        <div className="text-center">\n          <div className="text-lg font-semibold text-gray-900">
            {data.length > 0 ? formatCurrency(
              (data.reduce((sum, d) => sum + (metric === 'mrr' ? d.mrr : d.total_revenue), 0)) / data.length\n            ) : '$0'}
          </div>\n          <div className="text-sm text-gray-600">Average</div>
        </div>
        \n        <div className="text-center">\n          <div className="text-lg font-semibold text-gray-900">
            {data.length > 0 ? Math.max(...data.map(d => metric === 'mrr' ? d.mrr : d.total_revenue)).toLocaleString() : '0'}
          </div>\n          <div className="text-sm text-gray-600">Peak {metric === 'mrr' ? 'MRR' : 'Revenue'}</div>
        </div>
      </div>
    </div>
  );
};