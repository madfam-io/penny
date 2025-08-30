import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Artifact } from '@penny/types';

interface ModelRendererProps {
  artifact: Artifact;
  theme?: 'light' | 'dark' | 'auto';
  interactive?: boolean;
  onError?: (error: Error) => void;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  className?: string;
}

const ModelRenderer: React.FC<ModelRendererProps> = ({
  artifact,
  theme = 'auto',
  interactive = true,
  onError,
  onLoadStart,
  onLoadEnd,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [rotation, setRotation] = useState({ x: 0, y: 0, z: 0 });
  const [zoom, setZoom] = useState(1);
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const isDarkMode = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const modelUrl = typeof artifact.content === 'string' ? artifact.content : artifact.content?.url || artifact.url;

  useEffect(() => {
    // Simulate 3D model loading
    onLoadStart?.();
    setLoading(true);
    
    const timer = setTimeout(() => {
      setLoading(false);
      onLoadEnd?.();
      // Initialize mock 3D scene
      initializeScene();
    }, 1500);

    return () => clearTimeout(timer);
  }, [onLoadStart, onLoadEnd]);

  useEffect(() => {
    let animationId: number;
    
    if (autoRotate && !loading) {
      const animate = () => {
        setRotation(prev => ({
          ...prev,
          y: (prev.y + 1) % 360
        }));
        animationId = requestAnimationFrame(animate);
      };
      animationId = requestAnimationFrame(animate);
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [autoRotate, loading]);

  const initializeScene = useCallback(() => {
    // Mock 3D scene initialization
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Clear canvas
    ctx.fillStyle = isDarkMode ? '#1f2937' : '#f3f4f6';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Draw mock 3D object (cube)
    drawMock3DObject(ctx, rect.width / 2, rect.height / 2);
  }, [isDarkMode]);

  const drawMock3DObject = (ctx: CanvasRenderingContext2D, centerX: number, centerY: number) => {
    const size = 100 * zoom;
    const rotX = (rotation.x * Math.PI) / 180;
    const rotY = (rotation.y * Math.PI) / 180;

    ctx.save();
    ctx.translate(centerX, centerY);

    // Draw a simple 3D-looking cube
    if (wireframe) {
      ctx.strokeStyle = isDarkMode ? '#60a5fa' : '#3b82f6';
      ctx.lineWidth = 2;
      
      // Front face
      ctx.strokeRect(-size/2, -size/2, size, size);
      
      // Back face (offset)
      const offset = size * 0.3;
      ctx.strokeRect(-size/2 + offset, -size/2 - offset, size, size);
      
      // Connect corners
      ctx.beginPath();
      ctx.moveTo(-size/2, -size/2);
      ctx.lineTo(-size/2 + offset, -size/2 - offset);
      ctx.moveTo(size/2, -size/2);
      ctx.lineTo(size/2 + offset, -size/2 - offset);
      ctx.moveTo(size/2, size/2);
      ctx.lineTo(size/2 + offset, size/2 - offset);
      ctx.moveTo(-size/2, size/2);
      ctx.lineTo(-size/2 + offset, size/2 - offset);
      ctx.stroke();
    } else {
      // Solid faces with basic shading
      const gradient = ctx.createLinearGradient(-size/2, -size/2, size/2, size/2);
      gradient.addColorStop(0, isDarkMode ? '#4f46e5' : '#6366f1');
      gradient.addColorStop(1, isDarkMode ? '#1e1b4b' : '#312e81');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(-size/2, -size/2, size, size);
      
      // Add some depth
      ctx.fillStyle = isDarkMode ? '#312e81' : '#1e1b4b';
      const offset = size * 0.2;
      ctx.beginPath();
      ctx.moveTo(size/2, -size/2);
      ctx.lineTo(size/2 + offset, -size/2 - offset);
      ctx.lineTo(size/2 + offset, size/2 - offset);
      ctx.lineTo(size/2, size/2);
      ctx.closePath();
      ctx.fill();
      
      ctx.beginPath();
      ctx.moveTo(-size/2, -size/2);
      ctx.lineTo(-size/2 + offset, -size/2 - offset);
      ctx.lineTo(size/2 + offset, -size/2 - offset);
      ctx.lineTo(size/2, -size/2);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  };

  // Redraw when rotation or zoom changes
  useEffect(() => {
    if (!loading) {
      initializeScene();
    }
  }, [rotation, zoom, wireframe, loading, initializeScene]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!interactive) return;
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startRotation = { ...rotation };

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      setRotation({
        x: startRotation.x + deltaY * 0.5,
        y: startRotation.y + deltaX * 0.5,
        z: startRotation.z
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [interactive, rotation]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!interactive) return;
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.1, Math.min(3, prev * delta)));
  }, [interactive]);

  const resetView = useCallback(() => {
    setRotation({ x: 0, y: 0, z: 0 });
    setZoom(1);
  }, []);

  const containerClasses = [
    'model-renderer w-full h-full flex flex-col',
    isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClasses}>
      {/* Model Controls */}
      <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-4">
          {/* View controls */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setWireframe(!wireframe)}
              className={`px-3 py-1 text-sm rounded border transition-colors ${
                wireframe 
                  ? 'bg-blue-600 text-white border-blue-600' 
                  : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Wireframe
            </button>
            
            <button
              onClick={() => setAutoRotate(!autoRotate)}
              className={`px-3 py-1 text-sm rounded border transition-colors ${
                autoRotate 
                  ? 'bg-blue-600 text-white border-blue-600' 
                  : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Auto Rotate
            </button>
          </div>

          {/* Zoom info */}
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Zoom: {Math.round(zoom * 100)}%
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={resetView}
            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Reset View
          </button>
          
          <button
            onClick={() => setShowControls(!showControls)}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            title="Toggle controls"
          >
<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
            </svg>
          </button>
        </div>
      </div>

      {/* 3D Viewer */}
      <div className="flex-1 relative overflow-hidden">
        {loading && (
<div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 z-10">
            <div className="flex items-center space-x-2">
<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="text-sm">Loading 3D model...</span>
            </div>
          </div>
        )}
        
        {modelUrl ? (
          <canvas
            ref={canvasRef}
            className="w-full h-full cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onWheel={handleWheel}
          />
        ) : (
<div className="flex items-center justify-center h-full">
            <div className="text-center">
<div className="text-gray-400 mb-2">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
<h3 className="text-lg font-medium mb-2">No 3D Model to Display</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">3D model content is not available</p>
            </div>
          </div>
        )}

        {/* Control instructions */}
        {showControls && interactive && !loading && modelUrl && (
<div className="absolute bottom-4 left-4 bg-black/70 text-white text-xs p-3 rounded">
            <div className="space-y-1">
              <div>• Click and drag to rotate</div>
              <div>• Scroll to zoom</div>
              <div>• Use controls above for options</div>
            </div>
          </div>
        )}
      </div>

      {/* Model information */}
      <div className="p-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-sm">
        <div className="flex items-center justify-between">
<div className="flex items-center space-x-4">
            <span>Model: {artifact.title}</span>
            {artifact.metadata?.format && (
<span className="text-gray-600 dark:text-gray-400">
                Format: {artifact.metadata.format}
              </span>
            )}
          </div>
         
         <div className="flex items-center space-x-4 text-gray-600 dark:text-gray-400">
            <span>X: {Math.round(rotation.x)}°</span>
            <span>Y: {Math.round(rotation.y)}°</span>
            <span>Z: {Math.round(rotation.z)}°</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelRenderer;