import React, { useState, useCallback, useRef, useEffect } from 'react';\nimport { ImageArtifact } from '@penny/types';

interface ImageRendererProps {
  artifact: ImageArtifact;
  theme?: 'light' | 'dark' | 'auto';
  interactive?: boolean;
  onError?: (error: Error) => void;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  onAnnotate?: (annotation: any) => void;
  isFullscreen?: boolean;
  className?: string;
}

const ImageRenderer: React.FC<ImageRendererProps> = ({
  artifact,
  theme = 'auto',
  interactive = true,
  onError,
  onLoadStart,
  onLoadEnd,
  onAnnotate,
  isFullscreen = false,\n  className = ''
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showMetadata, setShowMetadata] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [filters, setFilters] = useState({
    brightness: 1,
    contrast: 1,
    saturation: 1,
    blur: 0,
    grayscale: false,
    sepia: false,
    invert: false
  });

  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { src, alt, width, height, config } = artifact.content;

  useEffect(() => {
    onLoadStart?.();
    setLoading(true);
  }, [src, onLoadStart]);

  const handleImageLoad = useCallback(() => {
    setLoading(false);
    setError(null);
    onLoadEnd?.();
  }, [onLoadEnd]);

  const handleImageError = useCallback(() => {
    const error = new Error('Failed to load image');
    setError('Failed to load image');
    setLoading(false);
    onError?.(error);
  }, [onError]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    if (!config.zoomable) return;
    setZoom(prev => Math.min(prev * 1.2, config.zoom?.max || 5));
  }, [config]);

  const handleZoomOut = useCallback(() => {
    if (!config.zoomable) return;
    setZoom(prev => Math.max(prev / 1.2, config.zoom?.min || 0.1));
  }, [config]);

  const handleZoomReset = useCallback(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
    setFilters({
      brightness: 1,
      contrast: 1,
      saturation: 1,
      blur: 0,
      grayscale: false,
      sepia: false,
      invert: false
    });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!config.zoomable || !interactive) return;
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(config.zoom?.min || 0.1, Math.min(config.zoom?.max || 5, prev * delta)));
  }, [config, interactive]);

  // Pan controls
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!config.pan?.enabled || !interactive) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  }, [config, interactive, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Rotation
  const handleRotate = useCallback((angle: number) => {
    if (!config.rotation?.enabled) return;
    setRotation(prev => prev + angle);
  }, [config]);

  // Filter controls
  const updateFilter = useCallback((filterName: keyof typeof filters, value: any) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  }, []);

  // Download image
  const handleDownload = useCallback(async () => {
    if (!config.downloadable) return;
    
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = artifact.title || 'image';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download failed:', err);
    }
  }, [src, config.downloadable, artifact.title]);

  // Handle click for annotations
  const handleImageClick = useCallback((e: React.MouseEvent) => {
    if (!interactive || !onAnnotate) return;
    
    const rect = imageRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    onAnnotate({
      type: 'point',
      position: { x, y },
      relativePosition: {
        x: x / rect.width,
        y: y / rect.height
      }
    });
  }, [interactive, onAnnotate]);

  const imageStyle: React.CSSProperties = {
    transform: `scale(${zoom}) rotate(${rotation}deg) translate(${position.x}px, ${position.y}px)`,\n    filter: `brightness(${filters.brightness}) contrast(${filters.contrast}) saturate(${filters.saturation}) blur(${filters.blur}px) ${
      filters.grayscale ? 'grayscale(100%)' : ''
    } ${filters.sepia ? 'sepia(100%)' : ''} ${filters.invert ? 'invert(100%)' : ''}`.trim(),
    cursor: isDragging ? 'grabbing' : config.pan?.enabled ? 'grab' : 'default',
    transition: isDragging ? 'none' : 'transform 0.2s ease-out, filter 0.2s ease-out'
  };

  const containerClasses = [
    'image-renderer w-full h-full flex flex-col bg-gray-100 dark:bg-gray-900',
    className\n  ].filter(Boolean).join(' ');

  if (error) {
    return (
      <div className={containerClasses}>
        <div className="flex-1 flex items-center justify-center">\n          <div className="text-center">\n            <div className="text-red-500 mb-2">\n              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>\n            <h3 className="text-lg font-medium mb-2">Image Error</h3>\n            <p className="text-sm text-gray-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      {/* Image controls */}\n      <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">\n        <div className="flex items-center space-x-2">
          {/* Zoom controls */}
          {config.zoomable && (\n            <div className="flex items-center space-x-1">
              <button
                onClick={handleZoomOut}\n                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"\n                title="Zoom out"
              >\n                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                </svg>
              </button>
              \n              <span className="text-sm font-mono w-12 text-center">
                {Math.round(zoom * 100)}%
              </span>
              
              <button
                onClick={handleZoomIn}\n                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"\n                title="Zoom in"
              >\n                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
              </button>
              
              <button
                onClick={handleZoomReset}\n                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"\n                title="Reset view"
              >\n                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0V9a8 8 0 1115.356 2m-15.356 0H4v5" />
                </svg>
              </button>
            </div>
          )}

          {/* Rotation controls */}
          {config.rotation?.enabled && (\n            <div className="flex items-center space-x-1 border-l border-gray-300 dark:border-gray-600 pl-2">
              <button
                onClick={() => handleRotate(-90)}\n                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"\n                title="Rotate left"
              >\n                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5v10zM3 12h9" />
                </svg>
              </button>
              
              <button
                onClick={() => handleRotate(90)}\n                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"\n                title="Rotate right"
              >\n                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5v10zM3 12h9" />
                </svg>
              </button>
            </div>
          )}
        </div>
\n        <div className="flex items-center space-x-2">
          {/* Metadata toggle */}
          {config.showMetadata && (
            <button
              onClick={() => setShowMetadata(!showMetadata)}\n              className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
                showMetadata ? 'bg-blue-100 dark:bg-blue-900 text-blue-600' : ''
              }`}\n              title="Show metadata"
            >\n              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          )}

          {/* Download */}
          {config.downloadable && (
            <button
              onClick={handleDownload}\n              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"\n              title="Download image"
            >\n              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Image viewer */}\n      <div className="flex-1 flex">
        {/* Main image area */}
        <div
          ref={containerRef}\n          className="flex-1 flex items-center justify-center overflow-hidden relative"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {loading && (\n            <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 z-10">\n              <div className="flex items-center space-x-2">\n                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>\n                <span className="text-sm">Loading image...</span>
              </div>
            </div>
          )}

          <img
            ref={imageRef}
            src={src}
            alt={alt}
            style={imageStyle}
            onLoad={handleImageLoad}
            onError={handleImageError}
            onClick={handleImageClick}\n            className="max-w-none max-h-none select-none"
            draggable={false}
          />

          {/* Annotations overlay */}
          {config.annotations.map((annotation, index) => (
            <div
              key={annotation.id || index}\n              className="absolute pointer-events-none"
              style={{\n                left: `${annotation.position.x}px`,\n                top: `${annotation.position.y}px`,
                transform: 'translate(-50%, -50%)'
              }}
            >
              {annotation.type === 'marker' && (\n                <div className="w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-lg"></div>
              )}
              {annotation.content && (\n                <div className="mt-2 bg-black/80 text-white text-xs px-2 py-1 rounded max-w-xs">
                  {annotation.content}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Metadata sidebar */}
        {showMetadata && config.showMetadata && (\n          <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 overflow-auto">\n            <h3 className="font-semibold mb-4">Image Information</h3>
            \n            <div className="space-y-3 text-sm">
              {width && height && (
                <div>\n                  <span className="font-medium">Dimensions:</span> {width} × {height} px
                </div>
              )}
              
              {artifact.size && (
                <div>\n                  <span className="font-medium">File Size:</span> {(artifact.size / 1024).toFixed(1)} KB
                </div>
              )}
              
              {artifact.mimeType && (
                <div>\n                  <span className="font-medium">Format:</span> {artifact.mimeType}
                </div>
              )}
              
              <div>\n                <span className="font-medium">Zoom:</span> {Math.round(zoom * 100)}%
              </div>
              
              {rotation !== 0 && (
                <div>\n                  <span className="font-medium">Rotation:</span> {rotation}°
                </div>
              )}
            </div>

            {/* Filter controls */}
            {config.filters?.enabled && (\n              <div className="mt-6">\n                <h4 className="font-medium mb-3">Filters</h4>\n                <div className="space-y-3">
                  <div>\n                    <label className="block text-xs font-medium mb-1">Brightness</label>
                    <input\n                      type="range"\n                      min="0"\n                      max="2"\n                      step="0.1"
                      value={filters.brightness}
                      onChange={(e) => updateFilter('brightness', parseFloat(e.target.value))}\n                      className="w-full"
                    />
                  </div>
                  
                  <div>\n                    <label className="block text-xs font-medium mb-1">Contrast</label>
                    <input\n                      type="range"\n                      min="0"\n                      max="2"\n                      step="0.1"
                      value={filters.contrast}
                      onChange={(e) => updateFilter('contrast', parseFloat(e.target.value))}\n                      className="w-full"
                    />
                  </div>
                  
                  <div>\n                    <label className="block text-xs font-medium mb-1">Saturation</label>
                    <input\n                      type="range"\n                      min="0"\n                      max="2"\n                      step="0.1"
                      value={filters.saturation}
                      onChange={(e) => updateFilter('saturation', parseFloat(e.target.value))}\n                      className="w-full"
                    />
                  </div>
                  \n                  <div className="flex items-center space-x-2">
                    <input\n                      type="checkbox"
                      checked={filters.grayscale}
                      onChange={(e) => updateFilter('grayscale', e.target.checked)}\n                      className="rounded border-gray-300"
                    />\n                    <label className="text-xs">Grayscale</label>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageRenderer;