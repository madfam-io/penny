import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Activity, Users, Zap, Clock } from 'lucide-react';

interface MetricCard {
  title: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'stable';
  icon: React.ReactNode;
  color: string;
}

interface ChartData {
  name: string;
  value: number;
  timestamp?: string;
}

interface MetricsDashboardProps {
  timeRange?: '1h' | '24h' | '7d' | '30d';
  refreshInterval?: number;
  tenantId?: string;
}

export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({
  timeRange = '24h',
  refreshInterval = 30000,
  tenantId
}) => {
  const [metrics, setMetrics] = useState<MetricCard[]>([]);
  const [requestsData, setRequestsData] = useState<ChartData[]>([]);
  const [responseTimeData, setResponseTimeData] = useState<ChartData[]>([]);
  const [errorDistribution, setErrorDistribution] = useState<ChartData[]>([]);
  const [topEndpoints, setTopEndpoints] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState(timeRange);

  const fetchMetricsData = async () => {
    try {
      const params = new URLSearchParams({
        timeRange: selectedTimeRange,
        ...(tenantId && { tenantId })
      });

      const [metricsRes, requestsRes, responseTimeRes, errorsRes, endpointsRes] = await Promise.all([
        fetch(`/api/metrics/summary?${params}`),
        fetch(`/api/metrics/requests?${params}`),
        fetch(`/api/metrics/response-time?${params}`),
        fetch(`/api/metrics/errors?${params}`),
        fetch(`/api/metrics/endpoints?${params}`)
      ]);

      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setMetrics([
          {
            title: 'Total Requests',
            value: data.totalRequests?.toLocaleString() || '0',
            change: data.requestsChange || 0,
            trend: data.requestsChange > 0 ? 'up' : data.requestsChange < 0 ? 'down' : 'stable',
            icon: <Activity className="w-6 h-6" />,
            color: 'text-blue-600'
          },
          {
            title: 'Active Users',\n            value: data.activeUsers?.toLocaleString() || '0',
            change: data.usersChange || 0,
            trend: data.usersChange > 0 ? 'up' : data.usersChange < 0 ? 'down' : 'stable',\n            icon: <Users className="w-6 h-6" />,
            color: 'text-green-600'
          },
          {
            title: 'Avg Response Time',\n            value: `${data.avgResponseTime || 0}ms`,
            change: data.responseTimeChange || 0,
            trend: data.responseTimeChange < 0 ? 'up' : data.responseTimeChange > 0 ? 'down' : 'stable', // Lower is better for response time
            icon: <Clock className="w-6 h-6" />,
            color: 'text-purple-600'
          },
          {
            title: 'Error Rate',\n            value: `${(data.errorRate || 0).toFixed(2)}%`,
            change: data.errorRateChange || 0,
            trend: data.errorRateChange < 0 ? 'up' : data.errorRateChange > 0 ? 'down' : 'stable', // Lower is better for error rate
            icon: <Zap className="w-6 h-6" />,
            color: 'text-red-600'
          }
        ]);
      }

      if (requestsRes.ok) {
        const data = await requestsRes.json();
        setRequestsData(data.map((item: any) => ({
          name: new Date(item.timestamp).toLocaleDateString(),
          value: item.count,
          timestamp: item.timestamp
        })));
      }

      if (responseTimeRes.ok) {
        const data = await responseTimeRes.json();
        setResponseTimeData(data.map((item: any) => ({
          name: new Date(item.timestamp).toLocaleDateString(),
          value: item.avgResponseTime,
          timestamp: item.timestamp
        })));
      }

      if (errorsRes.ok) {
        const data = await errorsRes.json();
        setErrorDistribution(data.map((item: any) => ({
          name: item.errorType,
          value: item.count
        })));
      }

      if (endpointsRes.ok) {
        const data = await endpointsRes.json();
        setTopEndpoints(data.slice(0, 10).map((item: any) => ({
          name: item.endpoint.length > 30 ? item.endpoint.substring(0, 30) + '...' : item.endpoint,
          value: item.count
        })));
      }

      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetricsData();
    const interval = setInterval(fetchMetricsData, refreshInterval);
    return () => clearInterval(interval);
  }, [selectedTimeRange, refreshInterval, tenantId]);

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':\n        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'down':\n        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:\n        return <div className="w-4 h-4" />;
    }
  };
\n  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'];

  if (loading) {
    return (\n      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (\n            <div key={i} className="bg-gray-200 h-32 rounded-lg"></div>
          ))}
        </div>\n        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-200 h-64 rounded-lg"></div>\n          <div className="bg-gray-200 h-64 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (\n    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Real-time Metrics</h2>\n        <div className="flex space-x-2">\n          {['1h', '24h', '7d', '30d'].map((range) => (
            <button
              key={range}
              onClick={() => setSelectedTimeRange(range as any)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                selectedTimeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <div key={index} className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between mb-4">
              <div className={metric.color}>
                {metric.icon}
              </div>\n              <div className="flex items-center space-x-1">
                {getTrendIcon(metric.trend!)}
                {metric.change && (\n                  <span className={`text-sm font-medium ${
                    metric.trend === 'up' ? 'text-green-600' : 
                    metric.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {metric.change > 0 ? '+' : ''}{metric.change.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
            <div>\n              <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
              <p className="text-sm text-gray-600">{metric.title}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Requests Over Time */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">Requests Over Time</h3>\n          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={requestsData}>\n                <CartesianGrid strokeDasharray="3 3" />\n                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line
                 type="monotone"
                 dataKey="value"
                 stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Response Time */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">Average Response Time</h3>\n          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={responseTimeData}>\n                <CartesianGrid strokeDasharray="3 3" />\n                <XAxis dataKey="name" />
                <YAxis />\n                <Tooltip formatter={(value) => [`${value}ms`, 'Response Time']} />
                <Line
                 type="monotone"
                 dataKey="value"
                 stroke="#8b5cf6" 
                  strokeWidth={2}
                  dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Endpoints */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">Top Endpoints</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topEndpoints}>\n                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                 dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                />
                <YAxis />
                <Tooltip />\n                <Bar dataKey="value" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Error Distribution */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">Error Distribution</h3>\n          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={errorDistribution}
                  cx="50%"\n                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {errorDistribution.map((entry, index) => (\n                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>\n          <div className="mt-4 space-y-2">
            {errorDistribution.map((entry, index) => (\n              <div key={entry.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2">
                  <div
                   className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  ></div>
                  <span>{entry.name}</span>
                </div>\n                <span className="font-medium">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Real-time Updates Indicator */}
      <div className="flex items-center justify-center text-sm text-gray-500">
        <div className="flex items-center space-x-2">\n          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span>Live data • Updates every {refreshInterval / 1000}s</span>
        </div>
      </div>
    </div>
  );
};