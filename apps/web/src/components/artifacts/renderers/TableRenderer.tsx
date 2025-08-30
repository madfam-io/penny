import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { TableArtifact } from '@penny/types';

interface TableRendererProps {
  artifact: TableArtifact;
  theme?: 'light' | 'dark' | 'auto';
  interactive?: boolean;
  onError?: (error: Error) => void;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  onAnnotate?: (annotation: any) => void;
  isFullscreen?: boolean;
  className?: string;
}

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

interface FilterConfig {
  [key: string]: string;
}

const TableRenderer: React.FC<TableRendererProps> = ({
  artifact,
  theme = 'auto',
  interactive = true,
  onError,
  onLoadStart,
  onLoadEnd,
  isFullscreen = false,\n  className = ''
}) => {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [filterConfig, setFilterConfig] = useState<FilterConfig>({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(artifact.content.config.pagination.pageSize);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  const { columns, data, config } = artifact.content;

  useEffect(() => {
    onLoadStart?.();
    setLoading(true);
    // Simulate loading
    const timeout = setTimeout(() => {
      setLoading(false);
      onLoadEnd?.();
    }, 100);
    return () => clearTimeout(timeout);
  }, [onLoadStart, onLoadEnd]);

  // Apply filters and sorting
  const processedData = useMemo(() => {
    let filtered = data;

    // Apply global filter
    if (globalFilter && config.filtering.searchable) {
      filtered = filtered.filter(row =>
        Object.values(row).some(value =>
          String(value).toLowerCase().includes(globalFilter.toLowerCase())
        )
      );
    }

    // Apply column filters
    Object.entries(filterConfig).forEach(([columnKey, filterValue]) => {
      if (filterValue) {
        filtered = filtered.filter(row =>
          String(row[columnKey]).toLowerCase().includes(filterValue.toLowerCase())
        );
      }
    });

    // Apply sorting
    if (sortConfig && config.sorting.enabled) {
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        
        let comparison = 0;
        if (aVal > bVal) comparison = 1;
        else if (aVal < bVal) comparison = -1;
        
        return sortConfig.direction === 'desc' ? -comparison : comparison;
      });
    }

    return filtered;
  }, [data, globalFilter, filterConfig, sortConfig, config]);

  // Pagination
  const paginatedData = useMemo(() => {
    if (!config.pagination.enabled) return processedData;
    
    const startIndex = (currentPage - 1) * pageSize;
    return processedData.slice(startIndex, startIndex + pageSize);
  }, [processedData, currentPage, pageSize, config.pagination.enabled]);

  const totalPages = Math.ceil(processedData.length / pageSize);

  const handleSort = useCallback((columnKey: string) => {
    if (!config.sorting.enabled) return;
    
    setSortConfig(prev => ({
      key: columnKey,
      direction: prev?.key === columnKey && prev?.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, [config.sorting.enabled]);

  const handleFilter = useCallback((columnKey: string, value: string) => {
    setFilterConfig(prev => ({ ...prev, [columnKey]: value }));
    setCurrentPage(1); // Reset to first page when filtering
  }, []);

  const handleRowSelect = useCallback((rowIndex: number, isSelected: boolean) => {
    if (!config.selection.enabled) return;
    
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (isSelected) {
        if (!config.selection.multiple) {
          newSet.clear();
        }
        newSet.add(rowIndex);
      } else {
        newSet.delete(rowIndex);
      }
      return newSet;
    });
  }, [config.selection]);

  const handleSelectAll = useCallback((isSelected: boolean) => {
    if (!config.selection.enabled || !config.selection.multiple) return;
    
    if (isSelected) {
      setSelectedRows(new Set(paginatedData.map((_, index) => index)));
    } else {
      setSelectedRows(new Set());
    }
  }, [config.selection, paginatedData]);

  const handleExport = useCallback((format: 'csv' | 'excel' | 'pdf' | 'json') => {
    if (!config.export.enabled) return;
    
    // In a real implementation, you would export the data
    console.log(`Exporting ${processedData.length} rows as ${format}`);
  }, [config.export.enabled, processedData]);

  const formatCellValue = useCallback((value: any, column: typeof columns[0]) => {
    if (value == null) return '';
    
    if (column.format) {
      switch (column.type) {
        case 'date':
          return new Date(value).toLocaleDateString();
        case 'number':
          return typeof value === 'number' ? value.toLocaleString() : value;
        default:
          return String(value);
      }
    }
    
    return String(value);
  }, []);

  const containerClasses = [
    'table-renderer w-full h-full flex flex-col',
    theme === 'dark' ? 'dark' : '',
    className
  ].filter(Boolean).join(' ');

  const tableClasses = [
    'min-w-full divide-y divide-gray-200',
    theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'\n  ].join(' ');

  if (loading) {
    return (
      <div className={containerClasses}>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center space-x-2">\n            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-sm">Loading table...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      {/* Table controls */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        {/* Global search */}
        {config.filtering.searchable && (\n          <div className="flex-1 max-w-md">
            <div className="relative">
              <input\n                type="text"\n                placeholder="Search table..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="w-full pl-8 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
              />\n              <svg className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        )}

        {/* Export buttons */}
        {config.export.enabled && (\n          <div className="flex items-center space-x-2">
            {config.export.formats.map(format => (
              <button
                key={format}
                onClick={() => handleExport(format as any)}
                className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
              >
                {format.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table container */}
      <div ref={tableRef} className="flex-1 overflow-auto">
        <table className={tableClasses}>\n          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {/* Selection column */}
              {config.selection.enabled && (\n                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  {config.selection.multiple && (
                    <input\n                      type="checkbox"
                      checked={selectedRows.size === paginatedData.length && paginatedData.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  )}
                </th>
              )}

              {/* Data columns */}
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${
                    config.sorting.enabled && column.sortable ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700' : ''
                  }`}
                  style={{ width: column.width ? `${column.width}px` : 'auto' }}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center space-x-1">
                    <span>{column.title}</span>
                    {column.sortable && sortConfig?.key === column.key && (\n                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {sortConfig.direction === 'asc' ? (\n                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        ) : (\n                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        )}
                      </svg>
                    )}
                  </div>
                  
                  {/* Column filter */}
                  {config.filtering.enabled && column.filterable && (\n                    <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                      <input\n                        type="text"\n                        placeholder="Filter..."\n                        value={filterConfig[column.key] || ''}
                        onChange={(e) => handleFilter(column.key, e.target.value)}
                        className="w-full text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
         
         <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {paginatedData.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={`${
                  selectedRows.has(rowIndex) ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                } ${config.selection.enabled ? 'cursor-pointer' : ''}`}
                onClick={() => config.selection.enabled && handleRowSelect(rowIndex, !selectedRows.has(rowIndex))}
              >
                {/* Selection column */}
                {config.selection.enabled && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input\n                      type="checkbox"
                      checked={selectedRows.has(rowIndex)}
                      onChange={(e) => handleRowSelect(rowIndex, e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                )}

                {/* Data columns */}
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 ${
                      column.align === 'center' ? 'text-center' :
                      column.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {formatCellValue(row[column.key], column)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Empty state */}
        {paginatedData.length === 0 && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>\n            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No data</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {globalFilter || Object.keys(filterConfig).some(key => filterConfig[key])
                ? 'No results match your search criteria.'
                : 'No data to display.'}
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {config.pagination.enabled && totalPages > 1 && (\n        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">\n            <span className="text-sm text-gray-700 dark:text-gray-300">
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, processedData.length)} of {processedData.length} results
            </span>
            
            {config.pagination.showSizeChanger && (
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="ml-4 text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 dark:bg-gray-800 dark:text-white"
              >
                {[10, 25, 50, 100].map(size => (
                  <option key={size} value={size}>{size} per page</option>
                ))}
              </select>
            )}
          </div>
\n          <div className="flex items-center space-x-1">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Previous
            </button>
            
            {/* Page numbers */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded ${
                    page === currentPage 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {page}
                </button>
              );
            })}
            
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableRenderer;