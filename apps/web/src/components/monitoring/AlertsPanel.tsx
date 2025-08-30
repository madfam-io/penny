import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Clock, Bell, BellOff } from 'lucide-react';

interface Alert {
  id: string;
  name: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  timestamp: string;
  resolved?: boolean;
  resolvedAt?: string;
  metadata?: any;
}

interface AlertsPanelProps {
  maxAlerts?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export const AlertsPanel: React.FC<AlertsPanelProps> = ({
  maxAlerts = 50,
  autoRefresh = true,
  refreshInterval = 10000
}) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filter, setFilter] = useState<'all' | 'unresolved' | 'resolved'>('unresolved');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(true);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: maxAlerts.toString(),
        ...(filter !== 'all' && { resolved: (filter === 'resolved').toString() }),
        ...(severityFilter !== 'all' && { severity: severityFilter })
      });
      
      const response = await fetch(`/api/alerts?${params}`);
      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/alerts/${alertId}/resolve`, {
        method: 'POST'
      });
      if (response.ok) {
        fetchAlerts(); // Refresh the list
      }
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  };

  useEffect(() => {
    fetchAlerts();
    if (autoRefresh) {
      const interval = setInterval(fetchAlerts, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, filter, severityFilter]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-red-500 bg-red-50';
      case 'high': return 'border-orange-500 bg-orange-50';
      case 'medium': return 'border-yellow-500 bg-yellow-50';
      case 'low': return 'border-blue-500 bg-blue-50';
      default: return 'border-gray-500 bg-gray-50';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'high': return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'medium': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'low': return <Clock className="w-5 h-5 text-blue-500" />;
      default: return <AlertTriangle className="w-5 h-5 text-gray-500" />;
    }
  };

  const unResolvedCount = alerts.filter(alert => !alert.resolved).length;
  const criticalCount = alerts.filter(alert => alert.severity === 'critical' && !alert.resolved).length;

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">\n          <div className="flex items-center space-x-3">
            <h3 className="text-lg font-semibold">Alerts</h3>
            {unResolvedCount > 0 && (\n              <span className="bg-red-100 text-red-800 text-xs font-medium px-2 py-1 rounded-full">
                {unResolvedCount} active
              </span>
            )}
            {criticalCount > 0 && (\n              <span className="bg-red-600 text-white text-xs font-medium px-2 py-1 rounded-full animate-pulse">
                {criticalCount} critical
              </span>
            )}
          </div>
          <button
            onClick={() => setAlertsEnabled(!alertsEnabled)}
            className={`p-2 rounded ${
              alertsEnabled 
                ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                : 'text-gray-400 bg-gray-50 hover:bg-gray-100'
            }`}
            title={alertsEnabled ? 'Disable alerts' : 'Enable alerts'}
          >
            {alertsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>\n            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="w-full border rounded px-3 py-2 text-sm"
            >\n              <option value="unresolved">Unresolved</option>\n              <option value="resolved">Resolved</option>\n              <option value="all">All Alerts</option>
            </select>
          </div>
          <div>\n            <label className="block text-sm font-medium text-gray-700 mb-1">
              Severity
            </label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            >\n              <option value="all">All Severities</option>\n              <option value="critical">Critical</option>\n              <option value="high">High</option>\n              <option value="medium">Medium</option>\n              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Alert List */}
      <div className="max-h-96 overflow-y-auto">
        {loading ? (\n          <div className="p-8 text-center text-gray-500">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            Loading alerts...
          </div>
        ) : alerts.length === 0 ? (\n          <div className="p-8 text-center text-gray-500">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
            No alerts found. System is healthy!
          </div>
        ) : (\n          <div className="divide-y divide-gray-200">
            {alerts.map((alert) => (\n              <div key={alert.id} className={`border-l-4 ${getSeverityColor(alert.severity)} p-4`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    {getSeverityIcon(alert.severity)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">\n                        <h4 className="font-medium text-gray-900">{alert.name}</h4>\n                        <span className={`text-xs px-2 py-1 rounded font-medium ${
                          alert.severity === 'critical' ? 'bg-red-100 text-red-800' :
                          alert.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                          alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {alert.severity.toUpperCase()}
                        </span>
                        {alert.resolved && (\n                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-medium">
                            RESOLVED
                          </span>
                        )}
                      </div>\n                      <p className="text-sm text-gray-700 mb-2">{alert.message}</p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>Triggered: {new Date(alert.timestamp).toLocaleString()}</span>
                        {alert.resolvedAt && (
                          <span>Resolved: {new Date(alert.resolvedAt).toLocaleString()}</span>
                        )}
                      </div>
                      {alert.metadata && (\n                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                            Show details
                          </summary>\n                          <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                            {JSON.stringify(alert.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                  {!alert.resolved && (
                    <button
                      onClick={() => resolveAlert(alert.id)}
                      className="ml-3 px-3 py-1 text-xs bg-green-100 text-green-800 hover:bg-green-200 rounded transition-colors"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t bg-gray-50 flex items-center justify-between text-xs text-gray-500">
        <span>Showing {alerts.length} alerts</span>
        {autoRefresh && (\n          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Auto-refresh: {refreshInterval / 1000}s</span>
          </div>
        )}
      </div>
    </div>
  );
};