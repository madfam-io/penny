import React, { useState, useRef, useCallback, useEffect } from 'react';\nimport { Artifact } from '@penny/types';

interface ArtifactTabsProps {
  artifacts: Artifact[];
  activeArtifactId?: string;
  onTabChange?: (artifactId: string) => void;
  onTabClose?: (artifactId: string) => void;
  onTabReorder?: (fromIndex: number, toIndex: number) => void;
  theme?: 'light' | 'dark' | 'auto';
  closeable?: boolean;
  reorderable?: boolean;
  showIcons?: boolean;
  maxTabWidth?: number;
  scrollable?: boolean;
}

const getArtifactIcon = (type: string) => {
  switch (type) {
    case 'chart':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      );
    case 'table':
      return (\n        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0V4a1 1 0 011-1h16a1 1 0 011 1v16a1 1 0 01-1 1H4a1 1 0 01-1-1z" />
        </svg>
      );
    case 'code':
      return (\n        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      );
    case 'image':
      return (\n        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case 'video':
      return (\n        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      );
    case 'audio':
      return (\n        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M9 21H5a2 2 0 01-2-2v-8a2 2 0 012-2h4l7-7v22l-7-7z" />
        </svg>
      );
    case 'pdf':
      return (\n        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case 'map':
      return (\n        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      );
    default:
      return (\n        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
  }
};

export const ArtifactTabs: React.FC<ArtifactTabsProps> = ({
  artifacts,
  activeArtifactId,
  onTabChange,
  onTabClose,
  onTabReorder,
  theme = 'auto',
  closeable = true,
  reorderable = true,
  showIcons = true,
  maxTabWidth = 200,
  scrollable = true
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const tabsRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Scroll functions
  const canScrollLeft = scrollPosition > 0;
  const canScrollRight = scrollable && tabsRef.current 
    ? tabsRef.current.scrollWidth > tabsRef.current.clientWidth + scrollPosition
    : false;

  const scrollLeft = useCallback(() => {
    if (tabsRef.current) {
      const newPosition = Math.max(0, scrollPosition - 120);
      tabsRef.current.scrollTo({ left: newPosition, behavior: 'smooth' });
      setScrollPosition(newPosition);
    }
  }, [scrollPosition]);

  const scrollRight = useCallback(() => {
    if (tabsRef.current) {
      const maxScroll = tabsRef.current.scrollWidth - tabsRef.current.clientWidth;
      const newPosition = Math.min(maxScroll, scrollPosition + 120);
      tabsRef.current.scrollTo({ left: newPosition, behavior: 'smooth' });
      setScrollPosition(newPosition);
    }
  }, [scrollPosition]);

  // Handle scroll events
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollPosition(e.currentTarget.scrollLeft);
  }, []);

  // Handle drag and drop for reordering
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    if (!reorderable) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', artifacts[index].id);
  }, [reorderable, artifacts]);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (!reorderable || draggedIndex === null) return;
    e.dataTransfer.dropEffect = 'move';
    setDropIndex(index);
  }, [reorderable, draggedIndex]);

  const handleDragEnd = useCallback(() => {
    if (draggedIndex !== null && dropIndex !== null && draggedIndex !== dropIndex) {
      onTabReorder?.(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
    setDropIndex(null);
  }, [draggedIndex, dropIndex, onTabReorder]);

  // Handle tab selection
  const handleTabClick = useCallback((artifact: Artifact) => {
    onTabChange?.(artifact.id);
  }, [onTabChange]);

  // Handle tab close
  const handleTabClose = useCallback((e: React.MouseEvent, artifactId: string) => {
    e.stopPropagation();
    onTabClose?.(artifactId);
  }, [onTabClose]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        const prevIndex = Math.max(0, index - 1);
        tabRefs.current[prevIndex]?.focus();
        onTabChange?.(artifacts[prevIndex].id);
        break;
      case 'ArrowRight':
        e.preventDefault();
        const nextIndex = Math.min(artifacts.length - 1, index + 1);
        tabRefs.current[nextIndex]?.focus();
        onTabChange?.(artifacts[nextIndex].id);
        break;
      case 'Home':
        e.preventDefault();
        tabRefs.current[0]?.focus();
        onTabChange?.(artifacts[0].id);
        break;
      case 'End':
        e.preventDefault();
        const lastIndex = artifacts.length - 1;
        tabRefs.current[lastIndex]?.focus();
        onTabChange?.(artifacts[lastIndex].id);
        break;
      case 'Delete':
      case 'Backspace':
        if (closeable) {
          e.preventDefault();
          onTabClose?.(artifacts[index].id);
        }
        break;
    }
  }, [artifacts, closeable, onTabChange, onTabClose]);

  // Truncate tab title
  const truncateTitle = useCallback((title: string, maxLength: number) => {\n    return title.length > maxLength ? title.substring(0, maxLength - 3) + '...' : title;
  }, []);

  const tabsClasses = [
    'flex items-center border-b border-gray-200',
    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'\n  ].join(' ');

  const scrollButtonClasses = [
    'flex-shrink-0 p-1 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed',
    theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'\n  ].join(' ');

  return (\n    <div className={tabsClasses} role="tablist">
      {/* Left scroll button */}
      {scrollable && (
        <button
          onClick={scrollLeft}
          disabled={!canScrollLeft}
          className={scrollButtonClasses}\n          aria-label="Scroll tabs left"
        >\n          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Tabs container */}
      <div
        ref={tabsRef}\n        className="flex-1 flex overflow-x-auto scrollbar-hide"
        onScroll={handleScroll}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {artifacts.map((artifact, index) => {
          const isActive = artifact.id === activeArtifactId;
          const isDragging = draggedIndex === index;
          const isDropTarget = dropIndex === index;

          const tabClasses = [
            'flex items-center space-x-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
            isActive 
              ? theme === 'dark' 
                ? 'text-blue-400 border-blue-400 bg-gray-800' 
                : 'text-blue-600 border-blue-600 bg-blue-50'
              : theme === 'dark'
                ? 'text-gray-400 border-transparent hover:text-gray-300 hover:border-gray-600'
                : 'text-gray-600 border-transparent hover:text-gray-900 hover:border-gray-300',
            isDragging ? 'opacity-50' : '',
            isDropTarget ? 'bg-blue-100' : '',
            reorderable ? 'cursor-move' : 'cursor-pointer'\n          ].filter(Boolean).join(' ');

          const tabStyle: React.CSSProperties = {
            maxWidth: `${maxTabWidth}px`,\n            minWidth: '120px',
            flexShrink: 0
          };

          return (
            <button
              key={artifact.id}
              ref={el => tabRefs.current[index] = el}\n              role="tab"
              aria-selected={isActive}\n              aria-controls={`artifact-panel-${artifact.id}`}
              className={tabClasses}
              style={tabStyle}
              onClick={() => handleTabClick(artifact)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              draggable={reorderable}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              title={artifact.title}
            >
              {/* Icon */}
              {showIcons && (\n                <span className="flex-shrink-0">
                  {getArtifactIcon(artifact.type)}
                </span>
              )}

              {/* Title */}\n              <span className="truncate">
                {truncateTitle(artifact.title, 20)}
              </span>

              {/* Close button */}
              {closeable && (
                <button
                  onClick={(e) => handleTabClose(e, artifact.id)}\n                  className="flex-shrink-0 ml-1 p-1 rounded hover:bg-gray-200 hover:text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-400"\n                  aria-label={`Close ${artifact.title}`}
                  tabIndex={-1}
                >\n                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </button>
          );
        })}
      </div>

      {/* Right scroll button */}
      {scrollable && (
        <button
          onClick={scrollRight}
          disabled={!canScrollRight}
          className={scrollButtonClasses}\n          aria-label="Scroll tabs right"
        >\n          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default ArtifactTabs;