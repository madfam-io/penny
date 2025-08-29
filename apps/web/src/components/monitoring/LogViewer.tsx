import React, { useState, useEffect, useRef } from 'react';
import { Search, Filter, Download, RefreshCw, AlertTriangle, Info, XCircle, CheckCircle } from 'lucide-react';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug' | 'trace';
  message: string;
  service?: string;
  metadata?: Record<string, any>;
  traceId?: string;
  spanId?: string;
}

interface LogViewerProps {
  height?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
  maxEntries?: number;
}

export const LogViewer: React.FC<LogViewerProps> = ({
  height = '600px',
  autoRefresh = true,
  refreshInterval = 5000,
  maxEntries = 1000
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [selectedService, setSelectedService] = useState<string>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [services, setServices] = useState<string[]>([]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: maxEntries.toString(),
        ...(selectedLevel !== 'all' && { level: selectedLevel }),
        ...(selectedService !== 'all' && { service: selectedService }),
        ...(searchTerm && { search: searchTerm })
      });

      const response = await fetch(`/api/logs?${params}`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
        
        // Extract unique services
        const uniqueServices = Array.from(new Set(data.logs?.map((log: LogEntry) => log.service).filter(Boolean)));
        setServices(uniqueServices as string[]);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter logs based on search and filters
  useEffect(() => {
    let filtered = logs;

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(searchLower) ||
        log.service?.toLowerCase().includes(searchLower) ||
        JSON.stringify(log.metadata || {}).toLowerCase().includes(searchLower)
      );
    }

    setFilteredLogs(filtered);
  }, [logs, searchTerm]);

  // Auto-refresh logs
  useEffect(() => {
    fetchLogs();
    
    if (autoRefresh) {
      const interval = setInterval(fetchLogs, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, selectedLevel, selectedService]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warn':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'info':
        return <Info className="w-4 h-4 text-blue-500" />;
      case 'debug':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'trace':
        return <div className="w-4 h-4 bg-gray-400 rounded-full"></div>;
      default:
        return <div className="w-4 h-4 bg-gray-300 rounded-full"></div>;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'border-l-red-500 bg-red-50';
      case 'warn':
        return 'border-l-yellow-500 bg-yellow-50';
      case 'info':
        return 'border-l-blue-500 bg-blue-50';
      case 'debug':
        return 'border-l-green-500 bg-green-50';
      case 'trace':
        return 'border-l-gray-500 bg-gray-50';
      default:
        return 'border-l-gray-300 bg-gray-50';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const exportLogs = () => {
    const exportData = filteredLogs.map(log => ({
      timestamp: log.timestamp,
      level: log.level,
      service: log.service,
      message: log.message,
      metadata: JSON.stringify(log.metadata)
    }));

    const csv = [
      ['Timestamp', 'Level', 'Service', 'Message', 'Metadata'].join(','),
      ...exportData.map(log => [
        log.timestamp,
        log.level,
        log.service || '',
        `"${log.message.replace(/"/g, '""')}"`,
        `"${log.metadata.replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">System Logs</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded hover:bg-gray-100 ${
                showFilters ? 'bg-gray-100 text-blue-600' : 'text-gray-600'
              }`}
            >
              <Filter className="w-4 h-4" />
            </button>
            <button
              onClick={exportLogs}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded"
              title="Export logs"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={fetchLogs}
              className={`p-2 text-gray-600 hover:bg-gray-100 rounded ${
                loading ? 'animate-spin' : ''
              }`}
              disabled={loading}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Log Level
              </label>
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="all">All Levels</option>
                <option value="error">Error</option>
                <option value="warn">Warning</option>
                <option value="info">Info</option>
                <option value="debug">Debug</option>
                <option value="trace">Trace</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Service
              </label>
              <select
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="all">All Services</option>
                {services.map(service => (
                  <option key={service} value={service}>{service}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Auto-scroll</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Log Entries */}
      <div 
        ref={logContainerRef}
        className="overflow-y-auto font-mono text-sm"
        style={{ height }}
      >
        {loading && filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            Loading logs...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No logs found matching your criteria.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredLogs.map((log) => (
              <div 
                key={log.id}
                className={`border-l-4 ${getLevelColor(log.level)} p-3 hover:bg-gray-50`}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    {getLevelIcon(log.level)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-xs text-gray-500">
                        {formatTimestamp(log.timestamp)}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                        log.level === 'error' ? 'bg-red-100 text-red-800' :
                        log.level === 'warn' ? 'bg-yellow-100 text-yellow-800' :
                        log.level === 'info' ? 'bg-blue-100 text-blue-800' :
                        log.level === 'debug' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {log.level.toUpperCase()}
                      </span>
                      {log.service && (
                        <span className="text-xs bg-gray-100 text-gray-800 px-2 py-0.5 rounded">
                          {log.service}
                        </span>
                      )}
                      {log.traceId && (
                        <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                          trace: {log.traceId.substring(0, 8)}...
                        </span>
                      )}
                    </div>
                    <div className="text-gray-900 break-words">
                      {log.message}
                    </div>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                          Show metadata
                        </summary>
                        <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t bg-gray-50 flex items-center justify-between text-xs text-gray-500">
        <span>
          Showing {filteredLogs.length} of {logs.length} entries
        </span>
        <div className="flex items-center space-x-4">
          {autoRefresh && (
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Auto-refresh: {refreshInterval / 1000}s</span>
            </div>
          )}
          <span>Max: {maxEntries} entries</span>
        </div>
      </div>
    </div>
  );
};