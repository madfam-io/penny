import React, { useState, useCallback } from 'react';
import { Artifact } from '@penny/types';

interface PDFRendererProps {
  artifact: Artifact;
  theme?: 'light' | 'dark' | 'auto';
  interactive?: boolean;
  onError?: (error: Error) => void;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  className?: string;
}

const PDFRenderer: React.FC<PDFRendererProps> = ({
  artifact,
  theme = 'auto',
  interactive = true,
  onError,
  onLoadStart,
  onLoadEnd,\n  className = ''
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages] = useState(10); // Mock - would come from PDF library
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(false);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(Math.max(1, Math.min(totalPages, page)));
  }, [totalPages]);

  const handleZoomChange = useCallback((newZoom: number) => {
    setZoom(Math.max(0.25, Math.min(3, newZoom)));
  }, []);

  const containerClasses = [
    'pdf-renderer w-full h-full flex flex-col bg-gray-100 dark:bg-gray-900',
    className\n  ].filter(Boolean).join(' ');

  const pdfUrl = typeof artifact.content === 'string' ? artifact.content : artifact.content?.url || artifact.url;

  return (
    <div className={containerClasses}>
      {/* PDF Controls */}
      <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-4">
          {/* Page Navigation */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
            >\n              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
           
           <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
            
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
            >\n              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center space-x-2 border-l border-gray-300 dark:border-gray-600 pl-4">
            <button
              onClick={() => handleZoomChange(zoom - 0.25)}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            >\n              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
              </svg>
            </button>
           
           <span className="text-sm font-mono w-16 text-center">
              {Math.round(zoom * 100)}%
            </span>
            
            <button
              onClick={() => handleZoomChange(zoom + 0.25)}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            >\n              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
            </button>
          </div>
        </div>
\n        <div className="flex items-center space-x-2">
          <button className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
            Print
          </button>\n          <button className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
            Download
          </button>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 overflow-auto p-4">
        {loading && (\n          <div className="flex items-center justify-center h-full">
            <div className="flex items-center space-x-2">\n              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="text-sm">Loading PDF...</span>
            </div>
          </div>
        )}
        
        {pdfUrl ? (\n          <div className="flex justify-center">
            <div
             className="bg-white shadow-lg max-w-full"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
            >
              <iframe
                src={pdfUrl}
                className="w-full h-full min-h-[800px]"
                title="PDF Document"
              />
            </div>
          </div>
        ) : (\n          <div className="flex items-center justify-center h-full">
            <div className="text-center">\n              <div className="text-gray-400 mb-2">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>\n              <h3 className="text-lg font-medium mb-2">No PDF to Display</h3>
              <p className="text-sm text-gray-600">PDF content is not available</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PDFRenderer;