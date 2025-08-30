import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ChartArtifact } from '@penny/types';

interface ChartRendererProps {
  artifact: ChartArtifact;
  theme?: 'light' | 'dark' | 'auto';
  interactive?: boolean;
  onError?: (error: Error) => void;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  onAnnotate?: (annotation: any) => void;
  isFullscreen?: boolean;
  className?: string;
}

// Mock Chart.js-like implementation for demonstration
const ChartRenderer: React.FC<ChartRendererProps> = ({
  artifact,
  theme = 'auto',
  interactive = true,
  onError,
  onLoadStart,
  onLoadEnd,
  onAnnotate,
  isFullscreen = false,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<any>(null);

  const isDarkMode = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const createChart = useCallback(async () => {
    if (!canvasRef.current) return;

    try {
      onLoadStart?.();
      setLoading(true);
      setError(null);

      // In a real implementation, you would use Chart.js or D3.js
      // This is a simplified mock implementation
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');

      // Set canvas dimensions
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

      // Clear canvas
      ctx.fillStyle = isDarkMode ? '#1f2937' : '#ffffff';
      ctx.fillRect(0, 0, rect.width, rect.height);

      // Draw chart based on type
      const { chartType, data, config } = artifact.content;
      const colors = config.colors || ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

      switch (chartType) {
        case 'line':
          drawLineChart(ctx, data, rect, colors, isDarkMode, config);
          break;
        case 'bar':
          drawBarChart(ctx, data, rect, colors, isDarkMode, config);
          break;
        case 'pie':
          drawPieChart(ctx, data, rect, colors, isDarkMode, config);
          break;
        case 'scatter':
          drawScatterChart(ctx, data, rect, colors, isDarkMode, config);
          break;
        default:
          drawPlaceholder(ctx, rect, isDarkMode, `${chartType} chart`);
      }

      onLoadEnd?.();
      setLoading(false);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to render chart');
      setError(error.message);
      onError?.(error);
      setLoading(false);
    }
  }, [artifact.content, isDarkMode, onError, onLoadStart, onLoadEnd]);

  useEffect(() => {
    createChart();
  }, [createChart]);

  // Handle canvas interactions
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // In a real implementation, you would calculate which data point was clicked
    console.log('Chart clicked at:', { x, y });
    
    if (onAnnotate) {
      onAnnotate({
        type: 'point',
        position: { x, y },
        data: hoveredPoint
      });
    }
  }, [interactive, onAnnotate, hoveredPoint]);

  const handleCanvasMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // In a real implementation, you would find the nearest data point
    // For now, just show coordinates
    setHoveredPoint({ x, y });
  }, [interactive]);

  const containerClasses = [
    'chart-renderer relative w-full h-full',
    className
  ].filter(Boolean).join(' ');

  if (error) {
    return (
      <div className={containerClasses}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
<div className="text-red-500 mb-2">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
<h3 className="text-lg font-medium mb-2">Chart Error</h3>
            <p className="text-sm text-gray-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      {loading && (
<div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80">
          <div className="flex items-center space-x-2">
<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-sm">Rendering chart...</span>
          </div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMouseMove}
        role="img"
        aria-label={artifact.title}
      />

      {/* Tooltip */}
      {interactive && hoveredPoint && (
<div className="absolute pointer-events-none bg-black/80 text-white text-xs px-2 py-1 rounded shadow-lg">
          x: {Math.round(hoveredPoint.x)}, y: {Math.round(hoveredPoint.y)}
        </div>
      )}

      {/* Chart legend */}
      {artifact.content.config.legend && (
<div className="absolute bottom-4 left-4 bg-white/90 dark:bg-gray-800/90 p-2 rounded shadow">
          <div className="text-xs font-medium mb-1">Legend</div>
          {/* Legend items would be generated based on chart data */}
        </div>
      )}
    </div>
  );
};

// Helper functions for drawing different chart types
function drawLineChart(ctx: CanvasRenderingContext2D, data: any[], rect: DOMRect, colors: string[], isDark: boolean, config: any) {
  const padding = 40;
  const width = rect.width - padding * 2;
  const height = rect.height - padding * 2;

  // Draw axes
  ctx.strokeStyle = isDark ? '#6b7280' : '#9ca3af';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, rect.height - padding);
  ctx.lineTo(rect.width - padding, rect.height - padding);
  ctx.stroke();

  // Draw sample line
  ctx.strokeStyle = colors[0];
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const x = padding + (i / 9) * width;
    const y = padding + Math.random() * height;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawBarChart(ctx: CanvasRenderingContext2D, data: any[], rect: DOMRect, colors: string[], isDark: boolean, config: any) {
  const padding = 40;
  const width = rect.width - padding * 2;
  const height = rect.height - padding * 2;
  const barCount = 5;
  const barWidth = width / barCount * 0.6;
  const barSpacing = width / barCount * 0.4;

  // Draw axes
  ctx.strokeStyle = isDark ? '#6b7280' : '#9ca3af';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, rect.height - padding);
  ctx.lineTo(rect.width - padding, rect.height - padding);
  ctx.stroke();

  // Draw bars
  for (let i = 0; i < barCount; i++) {
    const x = padding + i * (width / barCount) + barSpacing / 2;
    const barHeight = Math.random() * height * 0.8;
    const y = rect.height - padding - barHeight;

    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(x, y, barWidth, barHeight);
  }
}

function drawPieChart(ctx: CanvasRenderingContext2D, data: any[], rect: DOMRect, colors: string[], isDark: boolean, config: any) {
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const radius = Math.min(centerX, centerY) - 40;
  const values = [30, 25, 20, 15, 10]; // Mock values
  const total = values.reduce((a, b) => a + b, 0);

  let currentAngle = -Math.PI / 2;

  for (let i = 0; i < values.length; i++) {
    const sliceAngle = (values[i] / total) * Math.PI * 2;

    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
    ctx.lineTo(centerX, centerY);
    ctx.fill();

    currentAngle += sliceAngle;
  }
}

function drawScatterChart(ctx: CanvasRenderingContext2D, data: any[], rect: DOMRect, colors: string[], isDark: boolean, config: any) {
  const padding = 40;
  const width = rect.width - padding * 2;
  const height = rect.height - padding * 2;

  // Draw axes
  ctx.strokeStyle = isDark ? '#6b7280' : '#9ca3af';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, rect.height - padding);
  ctx.lineTo(rect.width - padding, rect.height - padding);
  ctx.stroke();

  // Draw scatter points
  ctx.fillStyle = colors[0];
  for (let i = 0; i < 50; i++) {
    const x = padding + Math.random() * width;
    const y = padding + Math.random() * height;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlaceholder(ctx: CanvasRenderingContext2D, rect: DOMRect, isDark: boolean, text: string) {
  ctx.fillStyle = isDark ? '#6b7280' : '#9ca3af';
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, rect.width / 2, rect.height / 2);
}

export default ChartRenderer;