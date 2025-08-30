import { useState, useEffect } from 'react';
import {
  X,
  Download,
  Maximize2,
  Share2,
  RefreshCw,
  TrendingUp,
  Users,
  DollarSign,
  Activity,
} from 'lucide-react';
import { cn } from '../utils/cn';

export interface Artifact {
  id: string;
  type: 'dashboard' | 'chart' | 'table' | 'document' | 'image' | 'code';
  name: string;
  content: any;
  mimeType?: string;
  metadata?: Record<string, any>;
  createdAt?: string;
}

interface ArtifactViewerProps {
  artifact: Artifact | null;
  onClose: () => void;
  onFullscreen?: () => void;
  className?: string;
}

export default function ArtifactViewer({
  artifact,
  onClose,
  onFullscreen,
  className,
}: ArtifactViewerProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'inline' | 'fullscreen'>('inline');

  if (!artifact) {
    return (
      <div className={cn('h-full flex items-center justify-center', className)}>
        <p className="text-gray-500 dark:text-gray-400">No artifact selected</p>
      </div>
    );
  }

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate refresh - in real app would refetch data
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const handleDownload = () => {
    // Create download link
    const dataStr = JSON.stringify(artifact.content, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `${artifact.name.toLowerCase().replace(/\s+/g, '-')}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };
  return (
    <div className={cn('h-full flex flex-col bg-white dark:bg-gray-800', className)}>
      {/* Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {artifact.name}
          </h2>
<span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">
            {artifact.type}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            disabled={isRefreshing}
          >
            <RefreshCw
              className={cn(
                'h-5 w-5 text-gray-600 dark:text-gray-400',
                isRefreshing && 'animate-spin',
              )}
            />
          </button>
          <button
            onClick={() => {}}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
<Share2 className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
          <button
            onClick={handleDownload}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
<Download className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
          <button
            onClick={onFullscreen}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
<Maximize2 className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
<X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto">
        {artifact.type === 'dashboard' && <DashboardRenderer content={artifact.content} />}
        {artifact.type === 'chart' && <ChartRenderer content={artifact.content} />}
        {artifact.type === 'table' && <TableRenderer content={artifact.content} />}
        {artifact.type === 'document' && <DocumentRenderer content={artifact.content} />}
        {artifact.type === 'code' && <CodeRenderer content={artifact.content} />}
        {artifact.type === 'image' && <ImageRenderer content={artifact.content} />}
      </div>
    </div>
  );
}

// Dashboard Renderer Component
function DashboardRenderer({ content }: { content: any }) {
  const widgets = content?.widgets || [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {widgets.map((widget: any, index: number) => (
        <WidgetRenderer key={index} widget={widget} />
      ))}
    </div>
  );
}

// Widget Renderer Component
function WidgetRenderer({ widget }: { widget: any }) {
  const getIcon = () => {
    switch (widget.title?.toLowerCase()) {
      case 'revenue':
        return <DollarSign className="h-5 w-5" />;
      case 'customers':
        return <Users className="h-5 w-5" />;
      case 'efficiency':
        return <Activity className="h-5 w-5" />;
      default:
        return <TrendingUp className="h-5 w-5" />;
    }
  };

  if (widget.type === 'metric') {
    return (
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
        <div className="flex items-center justify-between mb-2">
<h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{widget.title}</h3>
          <span className="text-gray-400">{getIcon()}</span>
        </div>
<p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          {formatValue(widget.value, widget.format)}
        </p>
        {widget.change !== undefined && (
          <p
            className={cn(
              'mt-1 text-sm',
              widget.inverse
                ? widget.change < 0
                  ? 'text-green-600'
                  : 'text-red-600'
                : widget.change > 0
                  ? 'text-green-600'
                  : 'text-red-600',
            )}
          >
{widget.change > 0 ? '+' : ''}
            {widget.change}%
          </p>
        )}
      </div>
    );
  }

  if (widget.type === 'chart') {
    return (
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 col-span-2">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
          {widget.title}
        </h3>
<div className="h-48 flex items-center justify-center text-gray-400">
          {/* In production, integrate with Chart.js or Recharts */}
          <p>Chart: {widget.chartType}</p>
        </div>
      </div>
    );
  }

  if (widget.type === 'gauge') {
    const percentage = (widget.value / widget.max) * 100;
    return (
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
          {widget.title}
        </h3>
<div className="relative h-32">
          <div className="absolute inset-0 flex items-center justify-center">
<span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {widget.value}%
            </span>
          </div>
<svg className="w-full h-full transform -rotate-90">
            <circle
              cx="50%"
              cy="50%"
              r="40%"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              className="text-gray-200 dark:text-gray-700"
            />
            <circle
              cx="50%"
              cy="50%"
              r="40%"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              strokeDasharray={`${percentage * 2.51} 251`}
              className="text-blue-600 dark:text-blue-400"
            />
          </svg>
        </div>
      </div>
    );
  }

  return null;
}

// Chart Renderer Component
function ChartRenderer({ content }: { content: any }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
      <div className="h-64 flex items-center justify-center text-gray-400">
        <p>Chart visualization will be rendered here</p>
      </div>
    </div>
  );
}

// Table Renderer Component
function TableRenderer({ content }: { content: any }) {
  const { columns = [], rows = [] } = content;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
<thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            {columns.map((col: string, i: number) => (
              <th
                key={i}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
<tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {rows.map((row: any[], i: number) => (
            <tr key={i}>
              {row.map((cell: any, j: number) => (
                <td
                  key={j}
                  className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Document Renderer Component
function DocumentRenderer({ content }: { content: any }) {
  return (
    <div className="prose dark:prose-invert max-w-none">
      {typeof content === 'string' ? (
        <div dangerouslySetInnerHTML={{ __html: content }} />
      ) : (
<pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-auto">
          {JSON.stringify(content, null, 2)}
        </pre>
      )}
    </div>
  );
}

// Code Renderer Component
function CodeRenderer({ content }: { content: any }) {
  const code =
    typeof content === 'string' ? content : content.code || JSON.stringify(content, null, 2);
  const language = content.language || 'javascript';

  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
<span className="text-xs text-gray-400">{language}</span>
        <button
          onClick={() => navigator.clipboard.writeText(code)}
          className="text-xs text-gray-400 hover:text-gray-200"
        >
          Copy
        </button>
      </div>
<pre className="text-sm text-gray-100 overflow-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// Image Renderer Component
function ImageRenderer({ content }: { content: any }) {
  const src = typeof content === 'string' ? content : content.url || content.src;
  const alt = content.alt || 'Generated image';

  return (
    <div className="flex items-center justify-center">
      <img src={src} alt={alt} className="max-w-full h-auto rounded-lg shadow-lg" />
    </div>
  );
}

// Helper function to format values
function formatValue(value: any, format?: string): string {
  if (format === 'currency') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }
  if (format === 'percentage') {
    return `${value}%`;
  }
  if (format === 'number') {
    return new Intl.NumberFormat('en-US').format(value);
  }
  return String(value);
}
