import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Artifact } from '@penny/types';
import { ArtifactTabs } from './ArtifactTabs';
import { ArtifactViewer } from './ArtifactViewer';

interface ArtifactPanelProps {
  artifacts: Artifact[];
  activeArtifactId?: string;
  onArtifactChange?: (artifactId: string) => void;
  onClose?: () => void;
  onExport?: (artifactId: string, format: string) => void;
  onShare?: (artifactId: string) => void;
  onEdit?: (artifactId: string) => void;
  onDelete?: (artifactId: string) => void;
  onAnnotate?: (artifactId: string, annotation: any) => void;
  className?: string;
  theme?: 'light' | 'dark' | 'auto';
  resizable?: boolean;
  collapsible?: boolean;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  position?: 'left' | 'right';
}

export const ArtifactPanel: React.FC<ArtifactPanelProps> = ({
  artifacts,
  activeArtifactId,
  onArtifactChange,
  onClose,
  onExport,
  onShare,
  onEdit,
  onDelete,
  onAnnotate,
  className = '',
  theme = 'auto',
  resizable = true,
  collapsible = true,
  defaultWidth = 400,
  minWidth = 300,
  maxWidth = 800,
  position = 'right'
}) => {
  const [width, setWidth] = useState(defaultWidth);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const resizerRef = useRef<HTMLDivElement>(null);

  // Get active artifact
  const activeArtifact = artifacts.find(a => a.id === activeArtifactId) || artifacts[0];

  // Handle resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !panelRef.current) return;

    const panelRect = panelRef.current.getBoundingClientRect();
    const newWidth = position === 'right' 
      ? window.innerWidth - e.clientX
      : e.clientX - panelRect.left;

    const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
    setWidth(clampedWidth);
  }, [isResizing, position, minWidth, maxWidth]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'ew-resize';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
      
      if (e.key === 'F11' || (e.key === 'f' && e.metaKey)) {
        e.preventDefault();
        setIsFullscreen(!isFullscreen);
      }
      
      if (e.key === 'Tab' && e.ctrlKey && artifacts.length > 1) {
        e.preventDefault();
        const currentIndex = artifacts.findIndex(a => a.id === activeArtifactId);
        const nextIndex = e.shiftKey 
          ? (currentIndex - 1 + artifacts.length) % artifacts.length
          : (currentIndex + 1) % artifacts.length;
        onArtifactChange?.(artifacts[nextIndex].id);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, artifacts, activeArtifactId, onArtifactChange]);

  const handleFullscreenToggle = useCallback(() => {
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  const handleCollapse = useCallback(() => {
    setIsCollapsed(!isCollapsed);
  }, [isCollapsed]);

  const handleTabChange = useCallback((artifactId: string) => {
    onArtifactChange?.(artifactId);
  }, [onArtifactChange]);

  const handleTabClose = useCallback((artifactId: string) => {
    const newArtifacts = artifacts.filter(a => a.id !== artifactId);
    if (newArtifacts.length === 0) {
      onClose?.();
    } else if (artifactId === activeArtifactId) {
      const currentIndex = artifacts.findIndex(a => a.id === artifactId);
      const nextIndex = currentIndex > 0 ? currentIndex - 1 : 0;
      onArtifactChange?.(newArtifacts[nextIndex].id);
    }
  }, [artifacts, activeArtifactId, onArtifactChange, onClose]);

  // Don't render if no artifacts
  if (!artifacts.length) {
    return null;
  }

  const panelClasses = [
    'artifact-panel',
    'flex flex-col bg-white border-l border-gray-200 shadow-lg',
    position === 'left' ? 'border-l-0 border-r' : '',
    theme === 'dark' ? 'dark bg-gray-900 border-gray-700 text-white' : 'bg-white text-gray-900',
    isFullscreen ? 'fixed inset-0 z-50' : 'relative',
    isCollapsed ? 'w-12' : '',
    isResizing ? 'select-none' : '',
    className
  ].filter(Boolean).join(' ');

  const contentStyle: React.CSSProperties = {
    width: isFullscreen ? '100%' : isCollapsed ? '48px' : `${width}px`,
    transition: isResizing ? 'none' : 'width 0.2s ease-in-out'
  };

  return (
    <div ref={panelRef} className={panelClasses} style={contentStyle}>
      {/* Resizer */}
      {resizable && !isFullscreen && !isCollapsed && (
        <div
          ref={resizerRef}
          className={`absolute top-0 ${position === 'right' ? '-left-1' : '-right-1'} w-2 h-full cursor-ew-resize hover:bg-blue-500 hover:opacity-20 transition-colors z-10`}
          onMouseDown={handleMouseDown}
        />
      )}

      {/* Collapse button */}
      {collapsible && !isFullscreen && (
        <button
          onClick={handleCollapse}
          className="absolute top-4 -left-3 w-6 h-6 bg-white border border-gray-300 rounded-full flex items-center justify-center hover:bg-gray-50 z-20 shadow-sm"
          aria-label={isCollapsed ? 'Expand panel' : 'Collapse panel'}
        >
          <svg
            className={`w-3 h-3 text-gray-600 transition-transform ${isCollapsed ? 'rotate-180' : ''} ${position === 'left' ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Collapsed state */}
      {isCollapsed && (
<div className="flex flex-col items-center py-4 space-y-2">
          <button
            onClick={handleCollapse}
            className="p-2 hover:bg-gray-100 rounded"
            aria-label="Expand panel"
          >
<svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
<div className="text-xs text-gray-500 text-center writing-mode-vertical">
            {artifacts.length} artifact{artifacts.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Expanded state */}
      {!isCollapsed && (
        <>
          {/* Tabs */}
          {artifacts.length > 1 && (
            <ArtifactTabs
              artifacts={artifacts}
              activeArtifactId={activeArtifactId}
              onTabChange={handleTabChange}
              onTabClose={handleTabClose}
              theme={theme}
            />
          )}

          {/* Active artifact viewer */}
          {activeArtifact && (
<div className="flex-1 overflow-hidden">
              <ArtifactViewer
                artifact={activeArtifact}
                isFullscreen={isFullscreen}
                onFullscreenToggle={handleFullscreenToggle}
                onExport={onExport ? (format) => onExport(activeArtifact.id, format) : undefined}
                onShare={onShare ? () => onShare(activeArtifact.id) : undefined}
                onEdit={onEdit ? () => onEdit(activeArtifact.id) : undefined}
                onDelete={onDelete ? () => onDelete(activeArtifact.id) : undefined}
                onAnnotate={onAnnotate ? (annotation) => onAnnotate(activeArtifact.id, annotation) : undefined}
                theme={theme}
              />
            </div>
          )}

          {/* Close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-2 right-2 p-1 hover:bg-gray-100 rounded z-30"
              aria-label="Close panel"
            >
<svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default ArtifactPanel;