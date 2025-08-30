import React, { useState, useCallback, useMemo, ErrorInfo } from 'react';
import { Artifact } from '@penny/types';
import { ArtifactHeader } from './ArtifactHeader';
import ChartRenderer from './renderers/ChartRenderer';
import TableRenderer from './renderers/TableRenderer';
import CodeRenderer from './renderers/CodeRenderer';
import MarkdownRenderer from './renderers/MarkdownRenderer';
import ImageRenderer from './renderers/ImageRenderer';
import PDFRenderer from './renderers/PDFRenderer';
import JSONRenderer from './renderers/JSONRenderer';
import HTMLRenderer from './renderers/HTMLRenderer';
import VideoRenderer from './renderers/VideoRenderer';
import AudioRenderer from './renderers/AudioRenderer';
import ModelRenderer from './renderers/ModelRenderer';
import MapRenderer from './renderers/MapRenderer';

interface ArtifactViewerProps {
  artifact: Artifact;
  isFullscreen?: boolean;
  onFullscreenToggle?: () => void;
  onExport?: (format: string) => void;
  onShare?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onAnnotate?: (annotation: any) => void;
  className?: string;
  theme?: 'light' | 'dark' | 'auto';
  interactive?: boolean;
}

interface ArtifactViewerState {
  hasError: boolean;
  error?: Error;
}

class ArtifactErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: (error: Error, errorInfo: ErrorInfo) => void },
  ArtifactViewerState
> {
  constructor(props: { children: React.ReactNode; onError?: (error: Error, errorInfo: ErrorInfo) => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ArtifactViewerState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ArtifactViewer Error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-64 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-center p-6">
<div className="text-red-600 mb-2">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.962-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
<h3 className="text-lg font-medium text-red-900 mb-2">Artifact Loading Error</h3>
            <p className="text-sm text-red-700 mb-4">
              {this.state.error?.message || 'An unexpected error occurred while loading this artifact.'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export const ArtifactViewer: React.FC<ArtifactViewerProps> = ({
  artifact,
  isFullscreen = false,
  onFullscreenToggle,
  onExport,
  onShare,
  onEdit,
  onDelete,
  onAnnotate,
  className = '',
  theme = 'auto',
  interactive = true
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleError = useCallback((error: Error) => {
    console.error('ArtifactViewer Error:', error);
    setError(error.message);
    setLoading(false);
  }, []);

  const handleLoadStart = useCallback(() => {
    setLoading(true);
    setError(null);
  }, []);

  const handleLoadEnd = useCallback(() => {
    setLoading(false);
  }, []);

  const rendererProps = useMemo(() => ({
    artifact,
    theme,
    interactive,
    onError: handleError,
    onLoadStart: handleLoadStart,
    onLoadEnd: handleLoadEnd,
    onAnnotate,
    isFullscreen
  }), [artifact, theme, interactive, handleError, handleLoadStart, handleLoadEnd, onAnnotate, isFullscreen]);

  const renderArtifact = useCallback(() => {
    switch (artifact.type) {
      case 'chart':
        return <ChartRenderer {...rendererProps} />;
      case 'table':
        return <TableRenderer {...rendererProps} />;
      case 'code':
        return <CodeRenderer {...rendererProps} />;
      case 'markdown':
        return <MarkdownRenderer {...rendererProps} />;
      case 'image':
        return <ImageRenderer {...rendererProps} />;
      case 'pdf':
        return <PDFRenderer {...rendererProps} />;
      case 'json':
        return <JSONRenderer {...rendererProps} />;
      case 'html':
        return <HTMLRenderer {...rendererProps} />;
      case 'video':
        return <VideoRenderer {...rendererProps} />;
      case 'audio':
        return <AudioRenderer {...rendererProps} />;
      case 'model':
        return <ModelRenderer {...rendererProps} />;
      case 'map':
        return <MapRenderer {...rendererProps} />;
      default:
        return (
          <div className="flex items-center justify-center h-64 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="text-center p-6">
<div className="text-gray-400 mb-2">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
<h3 className="text-lg font-medium text-gray-900 mb-2">Unsupported Artifact Type</h3>
              <p className="text-sm text-gray-600">
The artifact type "{artifact.type}" is not yet supported.
              </p>
            </div>
          </div>
        );
    }
  }, [artifact.type, rendererProps]);

  const containerClasses = useMemo(() => {
    return [
      'artifact-viewer',
      'flex flex-col h-full',
      isFullscreen ? 'fixed inset-0 z-50 bg-white' : 'relative',
      theme === 'dark' ? 'dark bg-gray-900 text-white' : 'bg-white text-gray-900',
      className
    ].filter(Boolean).join(' ');
  }, [isFullscreen, theme, className]);

  const contentClasses = useMemo(() => {
    return [
      'flex-1 overflow-hidden',
      loading ? 'flex items-center justify-center' : ''
    ].filter(Boolean).join(' ');
  }, [loading]);

  if (error) {
    return (
      <div className={containerClasses}>
        <ArtifactHeader
          artifact={artifact}
          onFullscreenToggle={onFullscreenToggle}
          onExport={onExport}
          onShare={onShare}
          onEdit={onEdit}
          onDelete={onDelete}
          isFullscreen={isFullscreen}
          theme={theme}
        />
<div className="flex-1 flex items-center justify-center">
          <div className="text-center p-6">
<div className="text-red-600 mb-2">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
<h3 className="text-lg font-medium text-red-900 mb-2">Error Loading Artifact</h3>
            <p className="text-sm text-red-700 mb-4">{error}</p>
            <button
              onClick={() => setError(null)}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ArtifactErrorBoundary onError={handleError}>
<div className={containerClasses} role="main" aria-label={`Artifact: ${artifact.title}`}>
        <ArtifactHeader
          artifact={artifact}
          onFullscreenToggle={onFullscreenToggle}
          onExport={onExport}
          onShare={onShare}
          onEdit={onEdit}
          onDelete={onDelete}
          isFullscreen={isFullscreen}
          theme={theme}
          loading={loading}
        />
        
        <div className={contentClasses}>
          {loading && (
<div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
<span className="text-sm text-gray-600">Loading artifact...</span>
            </div>
          )}
          
          {!loading && renderArtifact()}
        </div>
      </div>
    </ArtifactErrorBoundary>
  );
};

export default ArtifactViewer;