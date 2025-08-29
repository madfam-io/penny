import React, { useState, useMemo } from 'react';

interface VariableInspectorProps {
  variables: Record<string, VariableData>;
  onVariableSelect?: (name: string, data: VariableData) => void;
  onVariableDelete?: (name: string) => void;
  onVariableExport?: (name: string, format: 'json' | 'csv' | 'pickle') => void;
  className?: string;
  searchable?: boolean;
  groupByType?: boolean;
  showMemoryUsage?: boolean;
}

interface VariableData {
  type: string;
  value: any;
  shape?: number[];
  dtype?: string;
  preview?: string;
  size?: number;
  serializable?: boolean;
  truncated?: boolean;
  module?: string;
  memory_usage?: number;
  statistics?: {
    min?: number;
    max?: number;
    mean?: number;
    std?: number;
  };
  head?: any[];
  tail?: any[];
  columns?: string[];
  index?: any[];
  length?: number;
}

type SortKey = 'name' | 'type' | 'size' | 'memory';
type SortDirection = 'asc' | 'desc';

const VariableInspector: React.FC<VariableInspectorProps> = ({
  variables,
  onVariableSelect,
  onVariableDelete,
  onVariableExport,
  className = '',
  searchable = true,
  groupByType = false,
  showMemoryUsage = true
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [expandedVariables, setExpandedVariables] = useState<Set<string>>(new Set());
  const [selectedVariable, setSelectedVariable] = useState<string | null>(null);

  const filteredAndSortedVariables = useMemo(() => {
    let entries = Object.entries(variables);

    // Filter by search term
    if (searchTerm) {
      entries = entries.filter(([name, data]) =>
        name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        data.type.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort
    entries.sort(([aName, aData], [bName, bData]) => {
      let aValue: any, bValue: any;

      switch (sortKey) {
        case 'name':
          aValue = aName;
          bValue = bName;
          break;
        case 'type':
          aValue = aData.type;
          bValue = bData.type;
          break;
        case 'size':
          aValue = aData.size || 0;
          bValue = bData.size || 0;
          break;
        case 'memory':
          aValue = aData.memory_usage || 0;
          bValue = bData.memory_usage || 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return entries;
  }, [variables, searchTerm, sortKey, sortDirection]);

  const groupedVariables = useMemo(() => {
    if (!groupByType) return { '': filteredAndSortedVariables };

    const groups: Record<string, Array<[string, VariableData]>> = {};
    
    filteredAndSortedVariables.forEach(([name, data]) => {
      const groupKey = data.type;
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push([name, data]);
    });

    return groups;
  }, [filteredAndSortedVariables, groupByType]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const toggleExpanded = (name: string) => {
    const newExpanded = new Set(expandedVariables);
    if (newExpanded.has(name)) {
      newExpanded.delete(name);
    } else {
      newExpanded.add(name);
    }
    setExpandedVariables(newExpanded);
  };

  const handleVariableClick = (name: string, data: VariableData) => {
    setSelectedVariable(name);
    onVariableSelect?.(name, data);
  };

  const formatValue = (data: VariableData): string => {
    if (data.preview) return data.preview;
    
    if (data.type === 'numpy.ndarray') {
      return `Array${data.shape ? `(${data.shape.join(', ')})` : ''} dtype=${data.dtype}`;
    }
    
    if (data.type === 'pandas.DataFrame') {
      return `DataFrame(${data.shape ? data.shape.join(' × ') : 'unknown shape'})`;
    }
    
    if (data.type === 'pandas.Series') {
      return `Series(${data.length || 'unknown'} elements)`;
    }
    
    if (data.serializable && typeof data.value !== 'object') {
      return String(data.value);
    }
    
    if (Array.isArray(data.value)) {
      return `[${data.value.slice(0, 3).map(v => String(v)).join(', ')}${data.value.length > 3 ? ', ...' : ''}]`;
    }
    
    if (typeof data.value === 'object' && data.value !== null) {
      const keys = Object.keys(data.value).slice(0, 3);
      return `{${keys.join(', ')}${Object.keys(data.value).length > 3 ? ', ...' : ''}}`;
    }
    
    return String(data.value).slice(0, 50) + (String(data.value).length > 50 ? '...' : '');
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getTypeIcon = (type: string): string => {
    const typeIcons: Record<string, string> = {
      'int': '🔢',
      'float': '🔢',
      'str': '📝',
      'bool': '✅',
      'list': '📋',
      'dict': '📚',
      'tuple': '📦',
      'set': '🎯',
      'numpy.ndarray': '🧮',
      'pandas.DataFrame': '📊',
      'pandas.Series': '📈',
      'function': '⚙️',
      'module': '📦',
      'type': '🏷️',
    };
    
    return typeIcons[type] || '❓';
  };

  const renderVariableDetails = (name: string, data: VariableData) => {
    return (
      <div className="variable-details">
        {/* Statistics for numeric arrays */}
        {data.statistics && (
          <div className="statistics-section">
            <h4>Statistics</h4>
            <div className="statistics-grid">
              {data.statistics.min !== undefined && (
                <div className="stat-item">
                  <span className="stat-label">Min</span>
                  <span className="stat-value">{data.statistics.min.toFixed(4)}</span>
                </div>
              )}
              {data.statistics.max !== undefined && (
                <div className="stat-item">
                  <span className="stat-label">Max</span>
                  <span className="stat-value">{data.statistics.max.toFixed(4)}</span>
                </div>
              )}
              {data.statistics.mean !== undefined && (
                <div className="stat-item">
                  <span className="stat-label">Mean</span>
                  <span className="stat-value">{data.statistics.mean.toFixed(4)}</span>
                </div>
              )}
              {data.statistics.std !== undefined && (
                <div className="stat-item">
                  <span className="stat-label">Std</span>
                  <span className="stat-value">{data.statistics.std.toFixed(4)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* DataFrame columns */}
        {data.columns && (
          <div className="columns-section">
            <h4>Columns ({data.columns.length})</h4>
            <div className="columns-list">
              {data.columns.map((col, index) => (
                <span key={index} className="column-item">{col}</span>
              ))}
            </div>
          </div>
        )}

        {/* Data preview */}
        {(data.head || data.value) && (
          <div className="preview-section">
            <h4>Preview</h4>
            <div className="preview-content">
              {data.head ? (
                <pre>{JSON.stringify(data.head, null, 2)}</pre>
              ) : data.serializable ? (
                <pre>{JSON.stringify(data.value, null, 2)}</pre>
              ) : (
                <pre>{formatValue(data)}</pre>
              )}
            </div>
          </div>
        )}

        {/* Export options */}
        {onVariableExport && data.serializable && (
          <div className="export-section">
            <h4>Export</h4>
            <div className="export-buttons">
              <button
                className="export-btn"
                onClick={() => onVariableExport(name, 'json')}
              >
                JSON
              </button>
              {(data.type === 'pandas.DataFrame' || data.type === 'pandas.Series') && (
                <button
                  className="export-btn"
                  onClick={() => onVariableExport(name, 'csv')}
                >
                  CSV
                </button>
              )}
              <button
                className="export-btn"
                onClick={() => onVariableExport(name, 'pickle')}
              >
                Pickle
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderVariable = (name: string, data: VariableData) => {
    const isExpanded = expandedVariables.has(name);
    const isSelected = selectedVariable === name;

    return (
      <div
        key={name}
        className={`variable-item ${isSelected ? 'selected' : ''}`}
      >
        <div 
          className="variable-header"
          onClick={() => handleVariableClick(name, data)}
        >
          <button
            className="expand-button"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpanded(name);
            }}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
          
          <span className="variable-icon">{getTypeIcon(data.type)}</span>
          <span className="variable-name">{name}</span>
          <span className="variable-type">{data.type}</span>
          
          {data.shape && (
            <span className="variable-shape">
              {Array.isArray(data.shape) ? `(${data.shape.join(', ')})` : data.shape}
            </span>
          )}
          
          {data.size && (
            <span className="variable-size">{formatBytes(data.size)}</span>
          )}
          
          {showMemoryUsage && data.memory_usage && (
            <span className="variable-memory">{formatBytes(data.memory_usage)}</span>
          )}
          
          <div className="variable-actions">
            {onVariableDelete && (
              <button
                className="action-btn delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onVariableDelete(name);
                }}
                title="Delete variable"
              >
                🗑️
              </button>
            )}
          </div>
        </div>
        
        <div className="variable-value">
          {formatValue(data)}
          {data.truncated && (
            <span className="truncated-indicator"> (truncated)</span>
          )}
        </div>
        
        {isExpanded && renderVariableDetails(name, data)}
      </div>
    );
  };

  const totalMemory = useMemo(() => {
    return Object.values(variables).reduce((total, data) => {
      return total + (data.memory_usage || data.size || 0);
    }, 0);
  }, [variables]);

  return (
    <div className={`variable-inspector ${className}`}>
      <div className="inspector-header">
        <div className="inspector-title">
          <span>Variables ({Object.keys(variables).length})</span>
          {showMemoryUsage && totalMemory > 0 && (
            <span className="total-memory">
              Total: {formatBytes(totalMemory)}
            </span>
          )}
        </div>
        
        {searchable && (
          <div className="search-box">
            <input
              type="text"
              placeholder="Search variables..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
        )}
      </div>
      
      <div className="inspector-controls">
        <div className="sort-controls">
          <label>Sort by:</label>
          {(['name', 'type', 'size'] as SortKey[]).map(key => (
            <button
              key={key}
              className={`sort-btn ${sortKey === key ? 'active' : ''}`}
              onClick={() => handleSort(key)}
            >
              {key}
              {sortKey === key && (
                <span className="sort-direction">
                  {sortDirection === 'asc' ? '↑' : '↓'}
                </span>
              )}
            </button>
          ))}
        </div>
        
        <div className="view-controls">
          <label>
            <input
              type="checkbox"
              checked={groupByType}
              onChange={(e) => setGroupByType(e.target.checked)}
            />
            Group by type
          </label>
        </div>
      </div>
      
      <div className="variables-list">
        {Object.keys(variables).length === 0 ? (
          <div className="empty-state">
            <span>No variables defined</span>
          </div>
        ) : (
          Object.entries(groupedVariables).map(([groupName, groupVariables]) => (
            <div key={groupName} className="variable-group">
              {groupByType && groupName && (
                <div className="group-header">
                  <span className="group-icon">{getTypeIcon(groupName)}</span>
                  <span className="group-name">{groupName}</span>
                  <span className="group-count">({groupVariables.length})</span>
                </div>
              )}
              
              {groupVariables.map(([name, data]) => renderVariable(name, data))}
            </div>
          ))
        )}
      </div>

      <style jsx>{`
        .variable-inspector {
          border: 1px solid #d1d5db;
          border-radius: 8px;
          background: white;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .inspector-header {
          padding: 12px;
          border-bottom: 1px solid #e5e7eb;
          background: #f9fafb;
        }

        .inspector-title {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 8px;
        }

        .total-memory {
          font-size: 12px;
          color: #6b7280;
          font-weight: normal;
        }

        .search-input {
          width: 100%;
          padding: 6px 10px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 14px;
        }

        .inspector-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          border-bottom: 1px solid #e5e7eb;
          background: #f8fafc;
          font-size: 12px;
        }

        .sort-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .sort-btn {
          padding: 4px 8px;
          border: 1px solid #d1d5db;
          background: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .sort-btn:hover {
          background: #f3f4f6;
        }

        .sort-btn.active {
          background: #dbeafe;
          border-color: #3b82f6;
          color: #1d4ed8;
        }

        .sort-direction {
          font-size: 10px;
        }

        .view-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .view-controls label {
          display: flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
        }

        .variables-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }

        .empty-state {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 200px;
          color: #9ca3af;
        }

        .variable-group {
          margin-bottom: 16px;
        }

        .group-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: #f3f4f6;
          border-radius: 6px;
          margin-bottom: 8px;
          font-weight: 500;
          color: #374151;
        }

        .group-count {
          font-size: 12px;
          color: #6b7280;
        }

        .variable-item {
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          margin-bottom: 8px;
          background: white;
          transition: all 0.2s;
        }

        .variable-item:hover {
          border-color: #d1d5db;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .variable-item.selected {
          border-color: #3b82f6;
          box-shadow: 0 0 0 1px #3b82f6;
        }

        .variable-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          cursor: pointer;
        }

        .expand-button {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 12px;
          color: #6b7280;
          width: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .variable-icon {
          font-size: 16px;
        }

        .variable-name {
          font-weight: 600;
          color: #1f2937;
          min-width: 0;
          flex-shrink: 0;
        }

        .variable-type {
          padding: 2px 6px;
          background: #dbeafe;
          color: #1d4ed8;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
        }

        .variable-shape,
        .variable-size,
        .variable-memory {
          font-size: 12px;
          color: #6b7280;
          font-family: monospace;
        }

        .variable-actions {
          margin-left: auto;
          display: flex;
          gap: 4px;
        }

        .action-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          font-size: 12px;
        }

        .action-btn:hover {
          background: #f3f4f6;
        }

        .action-btn.delete:hover {
          background: #fee2e2;
        }

        .variable-value {
          padding: 0 12px 10px 36px;
          font-family: monospace;
          font-size: 12px;
          color: #4b5563;
          line-height: 1.4;
          word-break: break-all;
        }

        .truncated-indicator {
          color: #9ca3af;
          font-style: italic;
        }

        .variable-details {
          padding: 12px;
          border-top: 1px solid #f3f4f6;
          background: #f8fafc;
        }

        .variable-details h4 {
          margin: 0 0 8px 0;
          font-size: 14px;
          color: #374151;
        }

        .statistics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
          gap: 8px;
          margin-bottom: 16px;
        }

        .stat-item {
          text-align: center;
          padding: 8px;
          background: white;
          border-radius: 4px;
        }

        .stat-label {
          display: block;
          font-size: 10px;
          color: #6b7280;
          margin-bottom: 2px;
        }

        .stat-value {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #1f2937;
          font-family: monospace;
        }

        .columns-list {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-bottom: 16px;
        }

        .column-item {
          padding: 2px 6px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          font-size: 11px;
          color: #4b5563;
        }

        .preview-content {
          max-height: 200px;
          overflow-y: auto;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          padding: 8px;
          margin-bottom: 16px;
        }

        .preview-content pre {
          margin: 0;
          font-size: 11px;
          line-height: 1.4;
          white-space: pre-wrap;
        }

        .export-buttons {
          display: flex;
          gap: 8px;
        }

        .export-btn {
          padding: 4px 8px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
        }

        .export-btn:hover {
          background: #2563eb;
        }
      `}</style>
    </div>
  );
};

export default VariableInspector;