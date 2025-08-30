import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Activity, Cpu, HardDrive, Wifi } from 'lucide-react';

interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  lastCheck: string;
  responseTime: number;
  message?: string;
  metadata?: any;
}

interface SystemMetrics {
  cpu: { usage: number; cores: number };
  memory: { used: number; total: number; percentage: number };
  disk: { used: number; total: number; percentage: number };
  network: { bytesReceived: number; bytesSent: number };
}

interface SystemHealthProps {
  refreshInterval?: number;
}

export const SystemHealth: React.FC<SystemHealthProps> = ({ 
  refreshInterval = 30000 
}) => {
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [overallStatus, setOverallStatus] = useState<'healthy' | 'unhealthy' | 'degraded'>('healthy');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchHealthData = async () => {
    try {
      const [healthResponse, metricsResponse] = await Promise.all([\n        fetch('/api/health'),\n        fetch('/api/metrics/system')
      ]);

      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        setHealthChecks(healthData.checks || []);
        setOverallStatus(healthData.status || 'healthy');
      }

      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        setSystemMetrics(metricsData);
      }

      setLastUpdated(new Date());
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch health data:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
    const interval = setInterval(fetchHealthData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'degraded':\n        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'unhealthy':\n        return <XCircle className="w-5 h-5 text-red-500" />;
      default:\n        return <Activity className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'unhealthy':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatBytes = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const getMetricStatus = (percentage: number, type: 'cpu' | 'memory' | 'disk') => {
    const thresholds = {
      cpu: { warning: 70, critical: 90 },
      memory: { warning: 80, critical: 95 },
      disk: { warning: 85, critical: 95 }
    };
    
    const threshold = thresholds[type];
    if (percentage >= threshold.critical) return 'critical';
    if (percentage >= threshold.warning) return 'warning';
    return 'normal';
  };

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-sm border">
        <div className="animate-pulse">\n          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">\n            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>\n            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (\n    <div className="space-y-6">
      {/* Overall Status Header */}
      <div className={`p-4 rounded-lg border-2 ${getStatusColor(overallStatus)}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getStatusIcon(overallStatus)}
            <div>\n              <h2 className="text-lg font-semibold capitalize">
                System {overallStatus}
              </h2>\n              <p className="text-sm opacity-75">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </p>
            </div>
          </div>
          <button
            onClick={fetchHealthData}
            className="px-3 py-1 text-sm bg-white bg-opacity-20 rounded hover:bg-opacity-30 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* System Metrics */}
      {systemMetrics && (\n        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* CPU Usage */}
          <div className="p-4 bg-white rounded-lg shadow-sm border">
            <div className="flex items-center justify-between mb-3">\n              <div className="flex items-center space-x-2">
                <Cpu className="w-5 h-5 text-blue-500" />\n                <span className="font-medium">CPU Usage</span>
              </div>\n              <span className={`text-sm px-2 py-1 rounded ${
                getMetricStatus(systemMetrics.cpu.usage, 'cpu') === 'critical' ? 'bg-red-100 text-red-800' :
                getMetricStatus(systemMetrics.cpu.usage, 'cpu') === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              }`}>
                {systemMetrics.cpu.usage.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div\n                className={`h-2 rounded-full ${
                  getMetricStatus(systemMetrics.cpu.usage, 'cpu') === 'critical' ? 'bg-red-500' :
                  getMetricStatus(systemMetrics.cpu.usage, 'cpu') === 'warning' ? 'bg-yellow-500' :
                  'bg-green-500'
                }`}
                style={{ width: `${systemMetrics.cpu.usage}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {systemMetrics.cpu.cores} cores available
            </p>
          </div>

          {/* Memory Usage */}
          <div className="p-4 bg-white rounded-lg shadow-sm border">
            <div className="flex items-center justify-between mb-3">\n              <div className="flex items-center space-x-2">
                <Activity className="w-5 h-5 text-green-500" />\n                <span className="font-medium">Memory</span>
              </div>\n              <span className={`text-sm px-2 py-1 rounded ${
                getMetricStatus(systemMetrics.memory.percentage, 'memory') === 'critical' ? 'bg-red-100 text-red-800' :
                getMetricStatus(systemMetrics.memory.percentage, 'memory') === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              }`}>
                {systemMetrics.memory.percentage.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div\n                className={`h-2 rounded-full ${
                  getMetricStatus(systemMetrics.memory.percentage, 'memory') === 'critical' ? 'bg-red-500' :
                  getMetricStatus(systemMetrics.memory.percentage, 'memory') === 'warning' ? 'bg-yellow-500' :
                  'bg-green-500'
                }`}
                style={{ width: `${systemMetrics.memory.percentage}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {formatBytes(systemMetrics.memory.used)} / {formatBytes(systemMetrics.memory.total)}
            </p>
          </div>

          {/* Disk Usage */}
          <div className="p-4 bg-white rounded-lg shadow-sm border">
            <div className="flex items-center justify-between mb-3">\n              <div className="flex items-center space-x-2">
                <HardDrive className="w-5 h-5 text-purple-500" />\n                <span className="font-medium">Disk Usage</span>
              </div>\n              <span className={`text-sm px-2 py-1 rounded ${
                getMetricStatus(systemMetrics.disk.percentage, 'disk') === 'critical' ? 'bg-red-100 text-red-800' :
                getMetricStatus(systemMetrics.disk.percentage, 'disk') === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              }`}>
                {systemMetrics.disk.percentage.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div\n                className={`h-2 rounded-full ${
                  getMetricStatus(systemMetrics.disk.percentage, 'disk') === 'critical' ? 'bg-red-500' :
                  getMetricStatus(systemMetrics.disk.percentage, 'disk') === 'warning' ? 'bg-yellow-500' :
                  'bg-green-500'
                }`}
                style={{ width: `${systemMetrics.disk.percentage}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {formatBytes(systemMetrics.disk.used)} / {formatBytes(systemMetrics.disk.total)}
            </p>
          </div>

          {/* Network I/O */}
          <div className="p-4 bg-white rounded-lg shadow-sm border">
            <div className="flex items-center justify-between mb-3">\n              <div className="flex items-center space-x-2">
                <Wifi className="w-5 h-5 text-orange-500" />\n                <span className="font-medium">Network I/O</span>
              </div>
            </div>\n            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Received:</span>\n                <span className="font-medium">
                  {formatBytes(systemMetrics.network.bytesReceived)}
                </span>
              </div>\n              <div className="flex justify-between text-sm">
                <span>Sent:</span>\n                <span className="font-medium">
                  {formatBytes(systemMetrics.network.bytesSent)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Health Checks */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b">\n          <h3 className="text-lg font-semibold">Service Health Checks</h3>
        </div>\n        <div className="divide-y">
          {healthChecks.map((check) => (\n            <div key={check.name} className="p-4">
              <div className="flex items-center justify-between">\n                <div className="flex items-center space-x-3">
                  {getStatusIcon(check.status)}
                  <div>\n                    <h4 className="font-medium">{check.name}</h4>
                    {check.message && (\n                      <p className="text-sm text-gray-600">{check.message}</p>
                    )}
                  </div>
                </div>\n                <div className="text-right">\n                  <div className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    getStatusColor(check.status)
                  }`}>
                    {check.status}
                  </div>\n                  <p className="text-xs text-gray-500 mt-1">
                    {check.responseTime}ms
                  </p>\n                  <p className="text-xs text-gray-400">
                    {new Date(check.lastCheck).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};