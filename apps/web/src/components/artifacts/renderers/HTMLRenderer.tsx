import React, { useRef, useEffect, useState } from 'react';
import { Artifact } from '@penny/types';

interface HTMLRendererProps {
  artifact: Artifact;
  theme?: 'light' | 'dark' | 'auto';
  interactive?: boolean;
  onError?: (error: Error) => void;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  className?: string;
}

const HTMLRenderer: React.FC<HTMLRendererProps> = ({
  artifact,
  theme = 'auto',
  interactive = true,
  onError,
  onLoadStart,
  onLoadEnd,
  className = ''
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'preview' | 'source'>('preview');
  
  const htmlContent = typeof artifact.content === 'string' ? artifact.content : artifact.content?.html || '';

  useEffect(() => {
    if (!iframeRef.current || viewMode !== 'preview') return;
    
    try {
      onLoadStart?.();
      setLoading(true);
      
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      
      if (doc) {
        doc.open();
        doc.write(htmlContent);
        doc.close();
        
        // Add responsive meta tag if not present
        if (!doc.querySelector('meta[name="viewport"]')) {
          const meta = doc.createElement('meta');
          meta.name = 'viewport';
          meta.content = 'width=device-width, initial-scale=1';
          doc.head.appendChild(meta);
        }
        
        setLoading(false);
        onLoadEnd?.();
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to render HTML');
      onError?.(err);
      setLoading(false);
    }
  }, [htmlContent, viewMode, onLoadStart, onLoadEnd, onError]);

  const containerClasses = [
    'html-renderer w-full h-full flex flex-col',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClasses}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center space-x-2">
<div className="flex items-center space-x-1 bg-gray-200 dark:bg-gray-700 rounded p-1">
            <button
              onClick={() => setViewMode('preview')}
              className={`px-3 py-1 text-sm rounded ${
                viewMode === 'preview' 
                  ? 'bg-white dark:bg-gray-600 shadow' 
                  : 'hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              Preview
            </button>
            <button
              onClick={() => setViewMode('source')}
              className={`px-3 py-1 text-sm rounded ${
                viewMode === 'source' 
                  ? 'bg-white dark:bg-gray-600 shadow' 
                  : 'hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              Source
            </button>
          </div>
        </div>
       
       <div className="text-sm text-gray-600 dark:text-gray-400">
          HTML Document • {htmlContent.length} chars
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'preview' ? (
<div className="relative w-full h-full">
            {loading && (
<div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                <div className="flex items-center space-x-2">
<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="text-sm">Loading HTML...</span>
                </div>
              </div>
            )}
            <iframe
              ref={iframeRef}
              className="w-full h-full border-0"
              sandbox={interactive ? "allow-scripts allow-same-origin" : ""}
              title="HTML Preview"
            />
          </div>
        ) : (
<pre className="p-4 text-sm font-mono whitespace-pre-wrap overflow-auto h-full bg-gray-50 dark:bg-gray-900">
            {htmlContent}
          </pre>
        )}
      </div>
    </div>
  );
};

export default HTMLRenderer;