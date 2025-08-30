import React, { useState, useCallback, useRef, useEffect } from 'react';\nimport { MapArtifact } from '@penny/types';

interface MapRendererProps {
  artifact: MapArtifact;
  theme?: 'light' | 'dark' | 'auto';
  interactive?: boolean;
  onError?: (error: Error) => void;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  onAnnotate?: (annotation: any) => void;
  className?: string;
}

const MapRenderer: React.FC<MapRendererProps> = ({
  artifact,
  theme = 'auto',
  interactive = true,
  onError,
  onLoadStart,
  onLoadEnd,
  onAnnotate,\n  className = ''
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [mapStyle, setMapStyle] = useState(artifact.content.config.style);
  const [showLayers, setShowLayers] = useState(false);
  const [showMarkers, setShowMarkers] = useState(true);
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);
  const [zoom, setZoom] = useState(artifact.content.zoom);
  const [center, setCenter] = useState(artifact.content.center);

  const { markers, layers, config } = artifact.content;
  const isDarkMode = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    // Simulate map loading
    onLoadStart?.();
    setLoading(true);
    
    const timer = setTimeout(() => {
      setLoading(false);
      onLoadEnd?.();
    }, 1000);

    return () => clearTimeout(timer);
  }, [onLoadStart, onLoadEnd]);

  const handleMapClick = useCallback((event: React.MouseEvent) => {
    if (!interactive || !onAnnotate) return;
    
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Convert pixel coordinates to lat/lng (mock calculation)
    const lat = center.lat + (y - rect.height / 2) * 0.001;
    const lng = center.lng + (x - rect.width / 2) * 0.001;
    
    onAnnotate({
      type: 'marker',
      position: { lat, lng },
      pixel: { x, y }
    });
  }, [interactive, onAnnotate, center]);

  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(20, prev + 1));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(1, prev - 1));
  }, []);

  const handleMarkerClick = useCallback((markerId: string) => {
    setSelectedMarker(selectedMarker === markerId ? null : markerId);
  }, [selectedMarker]);

  const getMapStyleName = (style: string) => {
    const styles: Record<string, string> = {
      streets: 'Streets',
      satellite: 'Satellite',
      terrain: 'Terrain',
      dark: 'Dark',
      light: 'Light'
    };
    return styles[style] || style;
  };

  const containerClasses = [
    'map-renderer w-full h-full flex flex-col',
    isDarkMode ? 'dark' : '',
    className\n  ].filter(Boolean).join(' ');

  return (
    <div className={containerClasses}>
      {/* Map Controls */}
      <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">\n        <div className="flex items-center space-x-4">
          {/* Map Style Selector */}\n          <div className="flex items-center space-x-2">\n            <label className="text-sm font-medium">Style:</label>
            <select
              value={mapStyle}
              onChange={(e) => setMapStyle(e.target.value as any)}\n              className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >\n              <option value="streets">Streets</option>\n              <option value="satellite">Satellite</option>\n              <option value="terrain">Terrain</option>\n              <option value="dark">Dark</option>\n              <option value="light">Light</option>
            </select>
          </div>

          {/* Layer toggle */}
          {layers.length > 0 && (
            <button
              onClick={() => setShowLayers(!showLayers)}
              className={`px-3 py-1 text-sm rounded border transition-colors ${
                showLayers 
                  ? 'bg-blue-600 text-white border-blue-600' 
                  : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Layers ({layers.length})
            </button>
          )}

          {/* Markers toggle */}
          <button
            onClick={() => setShowMarkers(!showMarkers)}
            className={`px-3 py-1 text-sm rounded border transition-colors ${
              showMarkers 
                ? 'bg-blue-600 text-white border-blue-600' 
                : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Markers ({markers.length})
          </button>
        </div>
\n        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
          <span>Zoom: {zoom}</span>
          <span>•</span>
          <span>{center.lat.toFixed(4)}, {center.lng.toFixed(4)}</span>
        </div>
      </div>

      {/* Map Container */}\n      <div className="flex-1 relative overflow-hidden">
        {loading && (\n          <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 z-20">\n            <div className="flex items-center space-x-2">\n              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>\n              <span className="text-sm">Loading map...</span>
            </div>
          </div>
        )}

        {/* Mock Map */}
        <div 
          ref={mapRef}\n          className="w-full h-full relative cursor-crosshair"
          onClick={handleMapClick}
          style={{
            backgroundImage: mapStyle === 'satellite' 
              ? 'linear-gradient(45deg, #1a5f3f, #2d5a3d, #1a5f3f)' 
              : mapStyle === 'dark'
              ? 'linear-gradient(45deg, #1f2937, #374151, #1f2937)'
              : 'linear-gradient(45deg, #e5e7eb, #f3f4f6, #e5e7eb)',\n            backgroundSize: '40px 40px'
          }}
        >
          {/* Grid pattern to simulate map tiles */}\n          <div className="absolute inset-0" style={{
            backgroundImage: `
              linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)\n            `,\n            backgroundSize: '40px 40px'
          }} />

          {/* Zoom Controls */}
          {config.controls.zoom && (\n            <div className="absolute top-4 right-4 flex flex-col bg-white dark:bg-gray-800 rounded shadow-lg z-10">
              <button
                onClick={handleZoomIn}\n                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-600"\n                title="Zoom in"
              >\n                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button
                onClick={handleZoomOut}\n                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700"\n                title="Zoom out"
              >\n                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
            </div>
          )}

          {/* Markers */}
          {showMarkers && markers.map((marker, index) => {
            // Calculate marker position (mock positioning)
            const x = 50 + (marker.position.lng - center.lng) * 100;
            const y = 50 + (center.lat - marker.position.lat) * 100;
            const isSelected = selectedMarker === marker.id;
            
            return (
              <div
                key={marker.id}\n                className="absolute cursor-pointer transform -translate-x-1/2 -translate-y-full"
                style={{ left: `${x}%`, top: `${y}%` }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleMarkerClick(marker.id);
                }}
              >
                {/* Marker Pin */}\n                <div className={`w-6 h-6 rounded-full border-2 border-white shadow-lg ${
                  isSelected ? 'bg-red-600' : 'bg-blue-600'
                } relative`}>\n                  <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-4 border-transparent border-t-current"></div>
                </div>
                
                {/* Marker Popup */}
                {(isSelected || marker.popup) && (marker.title || marker.description) && (\n                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 -translate-y-2 bg-white dark:bg-gray-800 p-2 rounded shadow-lg border border-gray-200 dark:border-gray-700 whitespace-nowrap z-20">
                    {marker.title && (\n                      <div className="font-medium text-sm">{marker.title}</div>
                    )}
                    {marker.description && (\n                      <div className="text-xs text-gray-600 dark:text-gray-400">{marker.description}</div>
                    )}
                    {/* Popup arrow */}\n                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-4 border-transparent border-t-white dark:border-t-gray-800"></div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Scale */}
          {config.controls.scale && (\n            <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-800 px-2 py-1 rounded shadow-lg text-xs">\n              <div className="flex items-center space-x-2">\n                <div className="w-16 h-1 bg-gray-400 dark:bg-gray-500"></div>
                <span>1 km</span>
              </div>
            </div>
          )}
        </div>

        {/* Layers Panel */}
        {showLayers && layers.length > 0 && (\n          <div className="absolute top-4 left-4 bg-white dark:bg-gray-800 rounded shadow-lg border border-gray-200 dark:border-gray-700 p-3 z-10">\n            <h3 className="font-medium text-sm mb-2">Map Layers</h3>\n            <div className="space-y-2">
              {layers.map((layer, index) => (\n                <label key={layer.id} className="flex items-center space-x-2 text-sm">
                  <input\n                    type="checkbox"
                    checked={layer.visible}
                    onChange={() => {
                      // Handle layer visibility toggle\n                      console.log(`Toggle layer: ${layer.id}`);
                    }}\n                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>{layer.id}</span>\n                  <span className="text-xs text-gray-500 dark:text-gray-400">({layer.type})</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Map Status Bar */}\n      <div className="flex items-center justify-between px-4 py-2 text-xs bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">\n        <div className="flex items-center space-x-4">
          <span>Style: {getMapStyleName(mapStyle)}</span>
          <span>Zoom: {zoom}</span>
          <span>Markers: {markers.length}</span>
          {layers.length > 0 && <span>Layers: {layers.filter(l => l.visible).length}/{layers.length}</span>}
        </div>
        \n        <div className="text-gray-500 dark:text-gray-400">
          Coordinates: {center.lat.toFixed(6)}, {center.lng.toFixed(6)}
        </div>
      </div>
    </div>
  );
};

export default MapRenderer;