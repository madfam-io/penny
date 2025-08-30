import React, { useState, useRef, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface OutputPanelProps {
  output: {
    stdout: string;
    stderr: string;
    plots: PlotData[];
    variables: Record<string, VariableData>;
    executionTime?: number;
    timestamp?: Date;
  };
  isStreaming?: boolean;
  className?: string;
  maxHeight?: string;
  showVariables?: boolean;
  showPlots?: boolean;
  showMetrics?: boolean;
  autoScroll?: boolean;
  clearOnNewExecution?: boolean;
}

interface PlotData {
  id: string;
  format: 'png' | 'svg' | 'html';
  data: string;
  metadata: {
    width: number;
    height: number;
    title?: string;
    xlabel?: string;
    ylabel?: string;
  };
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
}

type OutputTab = 'output' | 'variables' | 'plots' | 'metrics';

const OutputPanel: React.FC<OutputPanelProps> = ({
  output,
  isStreaming = false,
  className = '',
  maxHeight = '400px',
  showVariables = true,
  showPlots = true,
  showMetrics = true,
  autoScroll = true,
  clearOnNewExecution = true
}) => {
  const [activeTab, setActiveTab] = useState<OutputTab>('output');
  const [isExpanded, setIsExpanded] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  const [outputHistory, setOutputHistory] = useState<string[]>([]);

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    if (autoScroll && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output.stdout, output.stderr, autoScroll]);

  // Update output history
  useEffect(() => {
    if (output.stdout || output.stderr) {
      const newOutput = output.stdout + output.stderr;
      if (clearOnNewExecution) {
        setOutputHistory([newOutput]);
      } else {
        setOutputHistory(prev => [...prev, newOutput]);
      }
    }
  }, [output.stdout, output.stderr, clearOnNewExecution]);

  const clearOutput = () => {
    setOutputHistory([]);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // Show success notification
      console.log('Copied to clipboard');
    });
  };

  const downloadOutput = () => {
    const content = output.stdout + output.stderr;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `output-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderOutput = () => {
    const hasStdout = output.stdout && output.stdout.trim();
    const hasStderr = output.stderr && output.stderr.trim();

    if (!hasStdout && !hasStderr) {
      return (
        <div className="empty-output">
          {isStreaming ? (
            <div className="streaming-indicator">
              <div className="spinner" />
              <span>Executing code...</span>
            </div>
          ) : (
<span className="text-gray-500">No output yet. Run some code to see results here.</span>
          )}
        </div>
      );
    }

    return (
      <div className="output-content">
        {hasStdout && (
<div className="stdout-section">
            <pre className="output-text">{output.stdout}</pre>
          </div>
        )}
        
        {hasStderr && (
<div className="stderr-section">
            <div className="stderr-header">
<span className="error-icon">⚠️</span>
              <span>Errors/Warnings</span>
            </div>
<pre className="output-text error">{output.stderr}</pre>
          </div>
        )}
        
        {isStreaming && (
<div className="streaming-cursor">
            <span className="blinking-cursor">|</span>
          </div>
        )}
      </div>
    );
  };

  const renderVariables = () => {
    const variables = Object.entries(output.variables || {});
    
    if (variables.length === 0) {
      return (
        <div className="empty-section">
          <span className="text-gray-500">No variables to display</span>
        </div>
      );
    }

    return (
      <div className="variables-list">
        {variables.map(([name, data]) => (
<div key={name} className="variable-item">
            <div className="variable-header">
<span className="variable-name">{name}</span>
              <span className="variable-type">{data.type}</span>
{data.shape && (
<span className="variable-shape">
{Array.isArray(data.shape) ? `(${data.shape.join(', ')})` : data.shape}
                </span>
              )}
              {data.size && (
                <span className="variable-size">
                  {formatBytes(data.size)}
                </span>
              )}
            </div>
           
           <div className="variable-content">
              {data.preview ? (
<pre className="variable-preview">{data.preview}</pre>
              ) : data.serializable ? (
<pre className="variable-value">{JSON.stringify(data.value, null, 2)}</pre>
              ) : (
<span className="variable-repr">{String(data.value).slice(0, 200)}...</span>
              )}
            </div>
            
            {data.truncated && (
<div className="truncated-indicator">
                <span>... (truncated)</span>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderPlots = () => {
    if (!output.plots || output.plots.length === 0) {
      return (
        <div className="empty-section">
          <span className="text-gray-500">No plots to display</span>
        </div>
      );
    }

    return (
      <div className="plots-grid">
        {output.plots.map((plot, index) => (
<div key={plot.id} className="plot-item">
            <div className="plot-header">
<span className="plot-title">
{plot.metadata?.title || `Plot ${index + 1}`}
              </span>
              <div className="plot-actions">
                <button
                  className="btn-icon"
                  onClick={() => downloadPlot(plot)}
                  title="Download plot"
                >
                  💾
                </button>
                <button
                  className="btn-icon"
                  onClick={() => copyPlotToClipboard(plot)}
                  title="Copy to clipboard"
                >
                  📋
                </button>
              </div>
            </div>
           
           <div className="plot-content">
              {plot.format === 'html' ? (
                <iframe
                  srcDoc={atob(plot.data)}
                  className="plot-iframe"
                  title={plot.metadata?.title}
                />
              ) : (
                <img
                  src={`data:image/${plot.format};base64,${plot.data}`}
                  alt={plot.metadata?.title}
                  className="plot-image"
                />
              )}
            </div>
           
           <div className="plot-metadata">
              <span className="plot-format">{plot.format.toUpperCase()}</span>
              <span className="plot-dimensions">
                {plot.metadata.width}×{plot.metadata.height}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderMetrics = () => {
    if (!output.executionTime && !output.timestamp) {
      return (
        <div className="empty-section">
          <span className="text-gray-500">No metrics available</span>
        </div>
      );
    }

    return (
      <div className="metrics-grid">
        {output.executionTime !== undefined && (
<div className="metric-item">
            <span className="metric-label">Execution Time</span>
<span className="metric-value">{formatDuration(output.executionTime)}</span>
          </div>
        )}
        
        {output.timestamp && (
<div className="metric-item">
            <span className="metric-label">Executed</span>
<span className="metric-value">
              {formatDistanceToNow(output.timestamp, { addSuffix: true })}
            </span>
          </div>
        )}
       
       <div className="metric-item">
          <span className="metric-label">Output Lines</span>
<span className="metric-value">
{(output.stdout?.split('
').length || 0) + (output.stderr?.split('
').length || 0)}
          </span>
        </div>
       
       <div className="metric-item">
          <span className="metric-label">Variables</span>
<span className="metric-value">
            {Object.keys(output.variables || {}).length}
          </span>
        </div>
       
       <div className="metric-item">
          <span className="metric-label">Plots</span>
<span className="metric-value">
            {output.plots?.length || 0}
          </span>
        </div>
      </div>
    );
  };

  const downloadPlot = (plot: PlotData) => {
    const link = document.createElement('a');
    link.href = `data:image/${plot.format};base64,${plot.data}`;
    link.download = `${plot.metadata?.title || 'plot'}.${plot.format}`;
    link.click();
  };

  const copyPlotToClipboard = async (plot: PlotData) => {
    try {
      const blob = await fetch(`data:image/${plot.format};base64,${plot.data}`).then(r => r.blob());
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ]);
    } catch (error) {
      console.error('Failed to copy plot to clipboard:', error);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
  };

  const getTabCount = (tab: OutputTab): number => {
    switch (tab) {
      case 'variables':
        return Object.keys(output.variables || {}).length;
      case 'plots':
        return output.plots?.length || 0;
      default:
        return 0;
    }
  };

  return (
    <div className={`output-panel ${className} ${isExpanded ? 'expanded' : ''}`}>
      <div className="output-header">
        <div className="output-tabs">
          <button
            className={`tab-button ${activeTab === 'output' ? 'active' : ''}`}
            onClick={() => setActiveTab('output')}
          >
            Output
            {(output.stdout || output.stderr) && (
              <span className="tab-indicator">•</span>
            )}
          </button>
          
          {showVariables && (
            <button
              className={`tab-button ${activeTab === 'variables' ? 'active' : ''}`}
              onClick={() => setActiveTab('variables')}
            >
              Variables
              {getTabCount('variables') > 0 && (
                <span className="tab-count">({getTabCount('variables')})</span>
              )}
            </button>
          )}
          
          {showPlots && (
            <button
              className={`tab-button ${activeTab === 'plots' ? 'active' : ''}`}
              onClick={() => setActiveTab('plots')}
            >
              Plots
              {getTabCount('plots') > 0 && (
                <span className="tab-count">({getTabCount('plots')})</span>
              )}
            </button>
          )}
          
          {showMetrics && (
            <button
              className={`tab-button ${activeTab === 'metrics' ? 'active' : ''}`}
              onClick={() => setActiveTab('metrics')}
            >
              Metrics
            </button>
          )}
        </div>
       
       <div className="output-actions">
          <button
            className="btn-icon"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
{isExpanded ? '⏷' : '⏶'}
          </button>
          
          {activeTab === 'output' && (
            <>
              <button
                className="btn-icon"
                onClick={clearOutput}
                title="Clear output"
              >
                🗑️
              </button>
              <button
                className="btn-icon"
                onClick={() => copyToClipboard(output.stdout + output.stderr)}
                title="Copy to clipboard"
              >
                📋
              </button>
              <button
                className="btn-icon"
                onClick={downloadOutput}
                title="Download output"
              >
                💾
              </button>
            </>
          )}
        </div>
      </div>
      
      <div 
        ref={outputRef}
        className="output-body"
        style={{ maxHeight: isExpanded ? 'none' : maxHeight }}
      >
        {activeTab === 'output' && renderOutput()}
        {activeTab === 'variables' && renderVariables()}
        {activeTab === 'plots' && renderPlots()}
        {activeTab === 'metrics' && renderMetrics()}
      </div>

      <style jsx>{`
        .output-panel {
          border: 1px solid #d1d5db;
          border-radius: 8px;
          background: white;
          overflow: hidden;
        }

        .output-panel.expanded .output-body {
          max-height: 80vh !important;
        }

        .output-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: #f9fafb;
          border-bottom: 1px solid #d1d5db;
        }

        .output-tabs {
          display: flex;
          gap: 2px;
        }

        .tab-button {
          padding: 6px 12px;
          border: none;
          background: transparent;
          color: #6b7280;
          cursor: pointer;
          border-radius: 4px;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: all 0.2s;
        }

        .tab-button:hover {
          background: #e5e7eb;
          color: #374151;
        }

        .tab-button.active {
          background: white;
          color: #1f2937;
          font-weight: 500;
          border: 1px solid #d1d5db;
        }

        .tab-indicator {
          color: #ef4444;
          font-size: 18px;
        }

        .tab-count {
          font-size: 12px;
          opacity: 0.7;
        }

        .output-actions {
          display: flex;
          gap: 4px;
        }

        .btn-icon {
          padding: 4px 6px;
          border: none;
          background: transparent;
          cursor: pointer;
          border-radius: 4px;
          font-size: 14px;
          color: #6b7280;
          transition: all 0.2s;
        }

        .btn-icon:hover {
          background: #e5e7eb;
          color: #374151;
        }

        .output-body {
          overflow-y: auto;
          padding: 12px;
        }

        .empty-output {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100px;
          color: #9ca3af;
        }

        .streaming-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid #e5e7eb;
          border-top: 2px solid #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .output-content {
          position: relative;
        }

        .stdout-section,
        .stderr-section {
          margin-bottom: 16px;
        }

        .stderr-header {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 8px;
          color: #dc2626;
          font-weight: 500;
          font-size: 14px;
        }

        .output-text {
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 13px;
          line-height: 1.4;
          white-space: pre-wrap;
          margin: 0;
          padding: 12px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          color: #1e293b;
        }

        .output-text.error {
          background: #fef2f2;
          border-color: #fecaca;
          color: #dc2626;
        }

        .streaming-cursor {
          margin-top: 8px;
        }

        .blinking-cursor {
          animation: blink 1s infinite;
          font-family: monospace;
          font-size: 14px;
        }

        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }

        .empty-section {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100px;
        }

        .variables-list {
          space-y: 12px;
        }

        .variable-item {
          padding: 12px;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          margin-bottom: 12px;
        }

        .variable-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          flex-wrap: wrap;
        }

        .variable-name {
          font-weight: 600;
          color: #1f2937;
        }

        .variable-type {
          padding: 2px 6px;
          background: #dbeafe;
          color: #1d4ed8;
          border-radius: 4px;
          font-size: 12px;
        }

        .variable-shape,
        .variable-size {
          font-size: 12px;
          color: #6b7280;
        }

        .variable-content {
          max-height: 200px;
          overflow-y: auto;
        }

        .variable-preview,
        .variable-value {
          font-family: monospace;
          font-size: 12px;
          line-height: 1.4;
          margin: 0;
          white-space: pre-wrap;
          background: #f8fafc;
          padding: 8px;
          border-radius: 4px;
        }

        .variable-repr {
          font-family: monospace;
          font-size: 12px;
          color: #6b7280;
        }

        .truncated-indicator {
          margin-top: 8px;
          text-align: center;
        }

        .truncated-indicator span {
          font-size: 12px;
          color: #9ca3af;
          font-style: italic;
        }

        .plots-grid {
          display: grid;
          gap: 16px;
        }

        .plot-item {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
        }

        .plot-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
        }

        .plot-title {
          font-weight: 500;
          color: #1f2937;
        }

        .plot-actions {
          display: flex;
          gap: 4px;
        }

        .plot-content {
          padding: 12px;
          text-align: center;
        }

        .plot-image {
          max-width: 100%;
          height: auto;
          border-radius: 4px;
        }

        .plot-iframe {
          width: 100%;
          height: 400px;
          border: none;
          border-radius: 4px;
        }

        .plot-metadata {
          display: flex;
          justify-content: space-between;
          padding: 8px 12px;
          background: #f9fafb;
          border-top: 1px solid #e5e7eb;
          font-size: 12px;
          color: #6b7280;
        }

        .plot-format {
          font-weight: 500;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }

        .metric-item {
          padding: 12px;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          text-align: center;
        }

        .metric-label {
          display: block;
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 4px;
        }

        .metric-value {
          display: block;
          font-size: 18px;
          font-weight: 600;
          color: #1f2937;
        }
      `}</style>
    </div>
  );
};

export default OutputPanel;