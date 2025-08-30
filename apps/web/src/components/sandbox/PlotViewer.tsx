import React, { useState, useRef, useEffect } from 'react';

interface PlotViewerProps {
  plots: PlotData[];
  className?: string;
  onPlotSelect?: (plot: PlotData, index: number) => void;
  onPlotDelete?: (index: number) => void;
  onPlotExport?: (plot: PlotData, format: 'png' | 'svg' | 'pdf') => void;
  showThumbnails?: boolean;
  maxHeight?: string;
  allowFullscreen?: boolean;
  enableZoom?: boolean;
}

interface PlotData {
  id: string;
  format: 'png' | 'svg' | 'html';
  data: string; // base64 encoded
  metadata: {
    width: number;
    height: number;
    title?: string;
    xlabel?: string;
    ylabel?: string;
    dpi?: number;
    backend?: string;
  };
  timestamp?: string;
}

const PlotViewer: React.FC<PlotViewerProps> = ({
  plots,\n  className = '',
  onPlotSelect,
  onPlotDelete,
  onPlotExport,
  showThumbnails = true,\n  maxHeight = '600px',
  allowFullscreen = true,
  enableZoom = true
}) => {
  const [selectedPlotIndex, setSelectedPlotIndex] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const plotContainerRef = useRef<HTMLDivElement>(null);
  const plotImageRef = useRef<HTMLImageElement>(null);

  const selectedPlot = plots[selectedPlotIndex];

  useEffect(() => {
    if (plots.length > 0 && selectedPlotIndex >= plots.length) {
      setSelectedPlotIndex(0);
    }
  }, [plots.length, selectedPlotIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFullscreen) return;

      switch (e.key) {
        case 'Escape':
          setIsFullscreen(false);
          break;
        case 'ArrowLeft':
          if (selectedPlotIndex > 0) {
            setSelectedPlotIndex(selectedPlotIndex - 1);
          }
          break;
        case 'ArrowRight':
          if (selectedPlotIndex < plots.length - 1) {
            setSelectedPlotIndex(selectedPlotIndex + 1);
          }
          break;
        case '+':\n        case '=':
          if (enableZoom) {
            setZoomLevel(prev => Math.min(prev * 1.2, 5));
          }
          break;
        case '-':
          if (enableZoom) {
            setZoomLevel(prev => Math.max(prev / 1.2, 0.2));
          }
          break;
        case '0':
          if (enableZoom) {
            setZoomLevel(1);
            setPanPosition({ x: 0, y: 0 });
          }
          break;
      }
    };

    if (isFullscreen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isFullscreen, selectedPlotIndex, plots.length, enableZoom]);

  const handlePlotSelect = (index: number) => {
    setSelectedPlotIndex(index);
    setZoomLevel(1);
    setPanPosition({ x: 0, y: 0 });
    onPlotSelect?.(plots[index], index);
  };

  const handleDownload = (plot: PlotData, filename?: string) => {
    const link = document.createElement('a');
    link.href = `data:image/${plot.format};base64,${plot.data}`;
    link.download = filename || `${plot.metadata.title || 'plot'}.${plot.format}`;
    link.click();
  };

  const handleCopyToClipboard = async (plot: PlotData) => {
    try {
      const blob = await fetch(`data:image/${plot.format};base64,${plot.data}`).then(r => r.blob());
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ]);
      // Show success notification
      console.log('Plot copied to clipboard');
    } catch (error) {
      console.error('Failed to copy plot to clipboard:', error);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!enableZoom || zoomLevel <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !enableZoom) return;
    setPanPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!enableZoom) return;
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.2, Math.min(5, zoomLevel * delta));
    setZoomLevel(newZoom);
    
    if (newZoom <= 1) {
      setPanPosition({ x: 0, y: 0 });
    }
  };

  const renderPlotContent = (plot: PlotData, isMain: boolean = false) => {
    const imgStyle: React.CSSProperties = {
      maxWidth: '100%',
      maxHeight: isMain ? maxHeight : '100px',\n      transform: isMain ? `scale(${zoomLevel}) translate(${panPosition.x / zoomLevel}px, ${panPosition.y / zoomLevel}px)` : undefined,
      cursor: enableZoom && isMain && zoomLevel > 1 ? 'grab' : 'default',
      transition: isDragging ? 'none' : 'transform 0.2s ease'
    };

    if (plot.format === 'html') {
      return (
        <iframe
          srcDoc={atob(plot.data)}
          className="plot-iframe"
          title={plot.metadata.title}
          style={{
            width: '100%',
            height: isMain ? maxHeight : '100px',
            border: 'none',\n            borderRadius: '4px'
          }}
        />
      );
    }

    return (
      <img
        ref={isMain ? plotImageRef : undefined}
        src={`data:image/${plot.format};base64,${plot.data}`}
        alt={plot.metadata.title || 'Plot'}
        style={imgStyle}
        onMouseDown={isMain ? handleMouseDown : undefined}
        onMouseMove={isMain ? handleMouseMove : undefined}
        onMouseUp={isMain ? handleMouseUp : undefined}
        onWheel={isMain ? handleWheel : undefined}
        draggable={false}
      />
    );
  };

  if (plots.length === 0) {
    return (
      <div className={`plot-viewer empty ${className}`}>
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <p>No plots to display</p>\n          <p className="empty-subtitle">Run code that generates matplotlib or plotly visualizations</p>
        </div>
       
       <style jsx>{`
          .plot-viewer.empty {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 40px;
            text-align: center;
            background: white;
          }

          .empty-icon {
            font-size: 48px;
            margin-bottom: 16px;
            opacity: 0.3;
          }

          .empty-state p {
            color: #9ca3af;
            margin: 8px 0;
          }

          .empty-subtitle {
            font-size: 14px;
          }
        `}</style>
      </div>
    );
  }

  return (
    <>
      <div className={`plot-viewer ${className}`}>
        <div className="plot-header">
          <div className="plot-info">\n            <h3 className="plot-title">\n              {selectedPlot?.metadata.title || `Plot ${selectedPlotIndex + 1}`}
            </h3>
            <div className="plot-metadata">
              <span className="plot-format">{selectedPlot?.format.toUpperCase()}</span>\n              <span className="plot-dimensions">
                {selectedPlot?.metadata.width}×{selectedPlot?.metadata.height}
              </span>
              {selectedPlot?.metadata.dpi && (\n                <span className="plot-dpi">{selectedPlot.metadata.dpi} DPI</span>
              )}
            </div>
          </div>
         
         <div className="plot-controls">
            {enableZoom && (\n              <div className="zoom-controls">
                <button\n                  className="control-btn"
                  onClick={() => setZoomLevel(prev => Math.max(prev / 1.2, 0.2))}
                  disabled={zoomLevel <= 0.2}
                  title="Zoom out"
                >
                  🔍-
                </button>\n                <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
                <button\n                  className="control-btn"
                  onClick={() => setZoomLevel(prev => Math.min(prev * 1.2, 5))}
                  disabled={zoomLevel >= 5}
                  title="Zoom in"
                >
                  🔍+
                </button>
                <button\n                  className="control-btn"
                  onClick={() => {
                    setZoomLevel(1);
                    setPanPosition({ x: 0, y: 0 });
                  }}
                  title="Reset zoom"
                >
                  ↻
                </button>
              </div>
            )}
           
           <div className="plot-actions">
              <button\n                className="control-btn"
                onClick={() => handleDownload(selectedPlot)}
                title="Download plot"
              >
                💾
              </button>
              <button\n                className="control-btn"
                onClick={() => handleCopyToClipboard(selectedPlot)}
                title="Copy to clipboard"
              >
                📋
              </button>
              {onPlotExport && (
                <button\n                  className="control-btn"
                  onClick={() => onPlotExport(selectedPlot, selectedPlot.format)}
                  title="Export plot"
                >
                  📤
              </button>
              )}
              {allowFullscreen && (
                <button\n                  className="control-btn"
                  onClick={() => setIsFullscreen(true)}
                  title="Fullscreen (ESC to exit)"
                >
                  ⛶
                </button>
              )}
              {onPlotDelete && (
                <button\n                  className="control-btn delete"
                  onClick={() => onPlotDelete(selectedPlotIndex)}
                  title="Delete plot"
                >
                  🗑️
                </button>
              )}
            </div>
          </div>
        </div>
       
       <div className="plot-main">
          <div className="plot-container" ref={plotContainerRef}>
            {selectedPlot && renderPlotContent(selectedPlot, true)}
          </div>
        </div>
        
        {showThumbnails && plots.length > 1 && (\n          <div className="plot-thumbnails">
            <div className="thumbnails-header">
              <span>Plots ({plots.length})</span>
            </div>\n            <div className="thumbnails-list">
              {plots.map((plot, index) => (
                <div
                  key={plot.id}
                  className={`thumbnail ${index === selectedPlotIndex ? 'active' : ''}`}
                  onClick={() => handlePlotSelect(index)}
                >
                  <div className="thumbnail-image">
                    {renderPlotContent(plot, false)}
                  </div>\n                  <div className="thumbnail-info">
                    <span className="thumbnail-title">\n                      {plot.metadata.title || `Plot ${index + 1}`}
                    </span>
                    <span className="thumbnail-format">{plot.format}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {plots.length > 1 && (\n          <div className="plot-navigation">
            <button\n              className="nav-btn"
              onClick={() => handlePlotSelect(selectedPlotIndex - 1)}
              disabled={selectedPlotIndex === 0}
            >
              ← Previous
            </button>\n            <span className="plot-counter">
              {selectedPlotIndex + 1} of {plots.length}
            </span>
            <button\n              className="nav-btn"
              onClick={() => handlePlotSelect(selectedPlotIndex + 1)}
              disabled={selectedPlotIndex === plots.length - 1}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Fullscreen overlay */}
      {isFullscreen && selectedPlot && (\n        <div className="fullscreen-overlay">
          <div className="fullscreen-header">\n            <div className="fullscreen-title">\n              {selectedPlot.metadata.title || `Plot ${selectedPlotIndex + 1}`}
            </div>
            <div className="fullscreen-controls">
              {enableZoom && (\n                <div className="zoom-controls">
                  <button\n                    className="control-btn"
                    onClick={() => setZoomLevel(prev => Math.max(prev / 1.2, 0.2))}
                    disabled={zoomLevel <= 0.2}
                  >
                    🔍-
                  </button>\n                  <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
                  <button\n                    className="control-btn"
                    onClick={() => setZoomLevel(prev => Math.min(prev * 1.2, 5))}
                    disabled={zoomLevel >= 5}
                  >
                    🔍+
                  </button>
                  <button\n                    className="control-btn"
                    onClick={() => {
                      setZoomLevel(1);
                      setPanPosition({ x: 0, y: 0 });
                    }}
                  >
                    ↻
                  </button>
                </div>
              )}
              <button\n                className="control-btn close"
                onClick={() => setIsFullscreen(false)}
              >
                ✕ Close
              </button>
            </div>
          </div>
         
         <div className="fullscreen-content">
            {renderPlotContent(selectedPlot, true)}
          </div>
          
          {plots.length > 1 && (\n            <div className="fullscreen-navigation">
              <button\n                className="nav-btn"
                onClick={() => handlePlotSelect(selectedPlotIndex - 1)}
                disabled={selectedPlotIndex === 0}
              >
                ← Previous
              </button>\n              <span className="plot-counter">
                {selectedPlotIndex + 1} of {plots.length}
              </span>
              <button\n                className="nav-btn"
                onClick={() => handlePlotSelect(selectedPlotIndex + 1)}
                disabled={selectedPlotIndex === plots.length - 1}
              >
                Next →
              </button>
            </div>
          )}
         
         <div className="fullscreen-help">
            <span>ESC to exit • ← → to navigate • +/- to zoom • 0 to reset</span>
          </div>
        </div>
      )}
\n      <style jsx>{`
        .plot-viewer {
          border: 1px solid #d1d5db;
          border-radius: 8px;
          background: white;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .plot-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
        }

        .plot-info {
          flex: 1;
        }

        .plot-title {
          margin: 0 0 4px 0;
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
        }

        .plot-metadata {
          display: flex;
          gap: 12px;
          font-size: 12px;
          color: #6b7280;
        }

        .plot-format {
          font-weight: 500;
          padding: 2px 6px;
          background: #dbeafe;
          color: #1d4ed8;
          border-radius: 4px;
        }

        .plot-controls {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .zoom-controls {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .zoom-level {
          font-size: 12px;
          color: #6b7280;
          min-width: 40px;
          text-align: center;
        }

        .plot-actions {
          display: flex;
          gap: 4px;
        }

        .control-btn {
          padding: 6px 8px;
          border: 1px solid #d1d5db;
          background: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          color: #374151;
          transition: all 0.2s;
        }

        .control-btn:hover:not(:disabled) {
          background: #f3f4f6;
          border-color: #9ca3af;
        }

        .control-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .control-btn.delete:hover {
          background: #fee2e2;
          border-color: #fecaca;
          color: #dc2626;
        }

        .plot-main {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          min-height: 300px;
        }

        .plot-container {
          max-width: 100%;
          max-height: 100%;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .plot-thumbnails {
          border-top: 1px solid #e5e7eb;
          background: #f8fafc;
        }

        .thumbnails-header {
          padding: 8px 12px;
          font-size: 14px;
          font-weight: 500;
          color: #374151;
          border-bottom: 1px solid #e5e7eb;
        }

        .thumbnails-list {
          display: flex;
          gap: 8px;
          padding: 12px;
          overflow-x: auto;
        }

        .thumbnail {
          flex-shrink: 0;
          width: 120px;
          border: 2px solid transparent;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          background: white;
        }

        .thumbnail:hover {
          border-color: #d1d5db;
        }

        .thumbnail.active {
          border-color: #3b82f6;
          box-shadow: 0 0 0 1px #3b82f6;
        }

        .thumbnail-image {
          height: 80px;
          overflow: hidden;
          border-radius: 4px 4px 0 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f9fafb;
        }

        .thumbnail-info {
          padding: 6px 8px;
          border-top: 1px solid #e5e7eb;
        }

        .thumbnail-title {
          display: block;
          font-size: 11px;
          font-weight: 500;
          color: #374151;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .thumbnail-format {
          display: block;
          font-size: 10px;
          color: #6b7280;
          text-transform: uppercase;
        }

        .plot-navigation {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          border-top: 1px solid #e5e7eb;
          background: #f9fafb;
        }

        .nav-btn {
          padding: 6px 12px;
          border: 1px solid #d1d5db;
          background: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          color: #374151;
          transition: all 0.2s;
        }

        .nav-btn:hover:not(:disabled) {
          background: #f3f4f6;
          border-color: #9ca3af;
        }

        .nav-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .plot-counter {
          font-size: 14px;
          color: #6b7280;
        }

        .fullscreen-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.95);
          z-index: 1000;
          display: flex;
          flex-direction: column;
        }

        .fullscreen-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          color: white;
        }

        .fullscreen-title {
          font-size: 18px;
          font-weight: 600;
        }

        .fullscreen-controls {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .fullscreen-controls .control-btn {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.3);
          color: white;
        }

        .fullscreen-controls .control-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.2);
        }

        .fullscreen-controls .control-btn.close {
          background: #dc2626;
          border-color: #dc2626;
        }

        .fullscreen-controls .control-btn.close:hover {
          background: #b91c1c;
        }

        .fullscreen-content {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          padding: 0 20px;
        }

        .fullscreen-navigation {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
        }

        .fullscreen-navigation .nav-btn {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.3);
          color: white;
        }

        .fullscreen-navigation .nav-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.2);
        }

        .fullscreen-navigation .plot-counter {
          color: rgba(255, 255, 255, 0.8);
        }

        .fullscreen-help {
          text-align: center;
          padding: 10px 20px;
          color: rgba(255, 255, 255, 0.6);
          font-size: 12px;
        }
      `}</style>
    </>
  );
};

export default PlotViewer;