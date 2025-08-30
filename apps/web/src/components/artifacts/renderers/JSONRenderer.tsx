import React, { useState, useCallback, useMemo } from 'react';
import { Artifact } from '@penny/types';

interface JSONRendererProps {
  artifact: Artifact;
  theme?: 'light' | 'dark' | 'auto';
  interactive?: boolean;
  onError?: (error: Error) => void;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  onAnnotate?: (annotation: any) => void;
  isFullscreen?: boolean;
  className?: string;
}

interface JSONNode {
  key?: string;
  value: any;
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  path: string;
  level: number;
  isExpandable: boolean;
}

const JSONRenderer: React.FC<JSONRendererProps> = ({
  artifact,
  theme = 'auto',
  interactive = true,
  onError,
  onLoadStart,
  onLoadEnd,\n  className = ''
}) => {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['/']));
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [viewMode, setViewMode] = useState<'tree' | 'raw'>('tree');

  const isDarkMode = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  // Parse JSON content
  const jsonData = useMemo(() => {
    try {
      onLoadStart?.();
      const data = typeof artifact.content === 'string' 
        ? JSON.parse(artifact.content) 
        : artifact.content;
      onLoadEnd?.();
      return data;
    } catch (error) {
      const err = new Error('Invalid JSON format');
      onError?.(err);
      return null;
    }
  }, [artifact.content, onError, onLoadStart, onLoadEnd]);

  // Convert JSON to tree structure
  const jsonTree = useMemo(() => {
    if (!jsonData) return [];

    const buildTree = (obj: any, path = '/', level = 0): JSONNode[] => {
      const nodes: JSONNode[] = [];

      if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          const itemPath = `${path}[${index}]`;
          const type = getValueType(item);
          const isExpandable = type === 'object' || type === 'array';
          
          nodes.push({
            key: `[${index}]`,
            value: item,
            type,
            path: itemPath,
            level,
            isExpandable
          });

          if (isExpandable && expandedPaths.has(itemPath)) {
            nodes.push(...buildTree(item, itemPath, level + 1));
          }
        });
      } else if (obj && typeof obj === 'object') {
        Object.entries(obj).forEach(([key, value]) => {
          const itemPath = path === '/' ? `/${key}` : `${path}/${key}`;
          const type = getValueType(value);
          const isExpandable = type === 'object' || type === 'array';
          
          nodes.push({
            key,
            value,
            type,
            path: itemPath,
            level,
            isExpandable
          });

          if (isExpandable && expandedPaths.has(itemPath)) {
            nodes.push(...buildTree(value, itemPath, level + 1));
          }
        });
      }

      return nodes;
    };

    return buildTree(jsonData);
  }, [jsonData, expandedPaths]);

  // Filter tree based on search
  const filteredTree = useMemo(() => {
    if (!searchTerm) return jsonTree;

    return jsonTree.filter(node => {
      const keyMatch = node.key?.toLowerCase().includes(searchTerm.toLowerCase());
      const valueMatch = String(node.value).toLowerCase().includes(searchTerm.toLowerCase());
      const pathMatch = node.path.toLowerCase().includes(searchTerm.toLowerCase());
      
      return keyMatch || valueMatch || pathMatch;
    });
  }, [jsonTree, searchTerm]);

  const getValueType = (value: any): JSONNode['type'] => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value as JSONNode['type'];
  };

  const formatValue = (value: any, type: JSONNode['type']): string => {
    switch (type) {
      case 'string':
        return `"${value}"`;
      case 'number':
        return String(value);
      case 'boolean':
        return String(value);
      case 'null':
        return 'null';
      case 'array':
        return `Array[${value.length}]`;
      case 'object':
        return `Object{${Object.keys(value).length}}`;
      default:
        return String(value);
    }
  };

  const getValueColor = (type: JSONNode['type']) => {
    const colors = {
      string: isDarkMode ? 'text-green-400' : 'text-green-600',
      number: isDarkMode ? 'text-blue-400' : 'text-blue-600',
      boolean: isDarkMode ? 'text-purple-400' : 'text-purple-600',
      null: isDarkMode ? 'text-gray-500' : 'text-gray-500',
      array: isDarkMode ? 'text-yellow-400' : 'text-yellow-600',
      object: isDarkMode ? 'text-orange-400' : 'text-orange-600'
    };
    return colors[type];
  };

  const toggleExpanded = useCallback((path: string) => {
    setExpandedPaths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  }, []);

  const handleNodeClick = useCallback((node: JSONNode) => {
    setSelectedPath(node.path);
    if (node.isExpandable) {
      toggleExpanded(node.path);
    }
  }, [toggleExpanded]);

  const handleCopy = useCallback(async (value: any) => {
    try {
      const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  const expandAll = useCallback(() => {
    const allPaths = new Set(['/']);
    const addPaths = (obj: any, path = '/') => {
      if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          const itemPath = `${path}[${index}]`;
          allPaths.add(itemPath);
          if (typeof item === 'object' && item !== null) {
            addPaths(item, itemPath);
          }
        });
      } else if (obj && typeof obj === 'object') {
        Object.keys(obj).forEach(key => {
          const itemPath = path === '/' ? `/${key}` : `${path}/${key}`;
          allPaths.add(itemPath);
          if (typeof obj[key] === 'object' && obj[key] !== null) {
            addPaths(obj[key], itemPath);
          }
        });
      }
    };
    
    if (jsonData) {
      addPaths(jsonData);
      setExpandedPaths(allPaths);
    }
  }, [jsonData]);

  const collapseAll = useCallback(() => {
    setExpandedPaths(new Set(['/']));
  }, []);

  const containerClasses = [
    'json-renderer w-full h-full flex flex-col',
    isDarkMode ? 'dark bg-gray-900 text-gray-100' : 'bg-white text-gray-900',
    className
  ].filter(Boolean).join(' ');

  if (!jsonData) {
    return (
      <div className={containerClasses}>\n        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">\n            <div className="text-red-500 mb-2">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>\n            <h3 className="text-lg font-medium mb-2">Invalid JSON</h3>
            <p className="text-sm text-gray-600">Unable to parse JSON content</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center space-x-4">
          {/* View mode toggle */}
          <div className="flex items-center space-x-1 bg-gray-200 dark:bg-gray-700 rounded p-1">
            <button
              onClick={() => setViewMode('tree')}
              className={`px-3 py-1 text-sm rounded ${
                viewMode === 'tree' 
                  ? 'bg-white dark:bg-gray-600 shadow' 
                  : 'hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              Tree
            </button>
            <button
              onClick={() => setViewMode('raw')}
              className={`px-3 py-1 text-sm rounded ${
                viewMode === 'raw' 
                  ? 'bg-white dark:bg-gray-600 shadow' 
                  : 'hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              Raw
            </button>
          </div>

          {/* Search */}
          {viewMode === 'tree' && (
            <div className="relative">
              <input\n                type="text"\n                placeholder="Search JSON..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-4 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />\n              <svg className="absolute left-2 top-1.5 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Expand/Collapse controls */}
          {viewMode === 'tree' && (
            <>
              <button
                onClick={expandAll}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Collapse All
              </button>
            </>
          )}

          {/* Copy button */}
          <button
            onClick={() => handleCopy(jsonData)}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            title="Copy JSON"
          >\n            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {viewMode === 'tree' ? (\n          <div className="p-4">
            {filteredTree.length === 0 ? (\n              <div className="text-center py-8 text-gray-500">
                {searchTerm ? 'No matches found' : 'No data to display'}
              </div>
            ) : (\n              <div className="space-y-1">
                {filteredTree.map((node, index) => (
                  <div\n                    key={`${node.path}-${index}`}
                    className={`flex items-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-2 py-1 cursor-pointer ${
                      selectedPath === node.path ? 'bg-blue-100 dark:bg-blue-900/30' : ''
                    }`}
                    style={{ paddingLeft: `${node.level * 20 + 8}px` }}
                    onClick={() => handleNodeClick(node)}
                  >
                    {/* Expand/collapse arrow */}
                    <div className="w-4 h-4 flex items-center justify-center mr-2">
                      {node.isExpandable && (
                        <svg
                          className={`w-3 h-3 transition-transform ${
                            expandedPaths.has(node.path) ? 'rotate-90' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"\n                          viewBox="0 0 24 24"
                        >\n                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </div>

                    {/* Key */}
                    {node.key && (\n                      <span className="font-medium text-gray-700 dark:text-gray-300 mr-2">
                        {node.key}:
                      </span>
                    )}

                    {/* Value */}
                    <span className={getValueColor(node.type)}>
                      {formatValue(node.value, node.type)}
                    </span>

                    {/* Type badge */}
                    <span className="ml-2 px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 rounded">
                      {node.type}
                    </span>

                    {/* Copy button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(node.value);
                      }}
                      className="ml-auto p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                      title="Copy value"
                    >\n                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (\n          <pre className="p-4 text-sm font-mono whitespace-pre-wrap overflow-auto">
            {JSON.stringify(jsonData, null, 2)}
          </pre>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-2 text-xs border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center space-x-4">
          <span>
            {Array.isArray(jsonData)
             ? `Array with ${jsonData.length} items`
              : `Object with ${Object.keys(jsonData).length} properties`
            }
          </span>
          {searchTerm && (
            <span>{filteredTree.length} matches</span>
          )}
        </div>
        
        {selectedPath && (\n          <span className="font-mono text-gray-600 dark:text-gray-400">
            Path: {selectedPath}
          </span>
        )}
      </div>
    </div>
  );
};

export default JSONRenderer;