import React, { useState, useCallback, useRef } from 'react';
import { Artifact } from '@penny/types';

interface ArtifactHeaderProps {
  artifact: Artifact;
  onFullscreenToggle?: () => void;
  onExport?: (format: string) => void;
  onShare?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onRefresh?: () => void;
  onDownload?: () => void;
  onPrint?: () => void;
  isFullscreen?: boolean;
  theme?: 'light' | 'dark' | 'auto';
  loading?: boolean;
  showMetadata?: boolean;
  editable?: boolean;
  deletable?: boolean;
}

interface DropdownMenuProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  anchorRef: React.RefObject<HTMLElement>;
}

const DropdownMenu: React.FC<DropdownMenuProps> = ({ isOpen, onClose, children, anchorRef }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        menuRef.current &&
        anchorRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !anchorRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50"
      role="menu"
    >
      {children}
    </div>
  );
};

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',\n    hour: '2-digit',\n    minute: '2-digit'
  }).format(date);
};

export const ArtifactHeader: React.FC<ArtifactHeaderProps> = ({
  artifact,
  onFullscreenToggle,
  onExport,
  onShare,
  onEdit,
  onDelete,
  onRefresh,
  onDownload,
  onPrint,
  isFullscreen = false,
  theme = 'auto',
  loading = false,
  showMetadata = false,
  editable = true,
  deletable = true
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showMetadataPanel, setShowMetadataPanel] = useState(showMetadata);
  const exportButtonRef = useRef<HTMLButtonElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  const toggleExportMenu = useCallback(() => {
    setShowExportMenu(!showExportMenu);
  }, [showExportMenu]);

  const toggleMoreMenu = useCallback(() => {
    setShowMoreMenu(!showMoreMenu);
  }, [showMoreMenu]);

  const handleExport = useCallback((format: string) => {
    onExport?.(format);
    setShowExportMenu(false);
  }, [onExport]);

  const handleMetadataToggle = useCallback(() => {
    setShowMetadataPanel(!showMetadataPanel);
  }, [showMetadataPanel]);

  const exportFormats = artifact.exportFormats || ['png', 'svg', 'pdf', 'json'];

  const buttonClasses = 'p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed';
  const iconClasses = 'w-4 h-4';

  return (
    <div className="artifact-header flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      {/* Left section - Title and metadata */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-3">
          {/* Artifact type icon */}
          <div className="flex-shrink-0 p-2 bg-gray-100 dark:bg-gray-800 rounded">
            <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {artifact.type === 'chart' && (\n                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              )}
              {artifact.type === 'table' && (\n                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0V4a1 1 0 011-1h16a1 1 0 011 1v16a1 1 0 01-1 1H4a1 1 0 01-1-1z" />
              )}
              {(artifact.type === 'code' || artifact.type === 'json') && (\n                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              )}
              {artifact.type === 'image' && (\n                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              )}
              {artifact.type !== 'chart' && artifact.type !== 'table' && artifact.type !== 'code' && artifact.type !== 'json' && artifact.type !== 'image' && (\n                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              )}
            </svg>
          </div>

          {/* Title and description */}
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
              {artifact.title}
            </h2>
            {artifact.description && (\n              <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                {artifact.description}
              </p>
            )}
            {showMetadataPanel && (\n              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <div>Type: {artifact.type}</div>
                {artifact.size && <div>Size: {formatFileSize(artifact.size)}</div>}
                <div>Created: {formatDate(artifact.createdAt)}</div>
                {artifact.updatedAt && artifact.updatedAt !== artifact.createdAt && (
                  <div>Updated: {formatDate(artifact.updatedAt)}</div>
                )}
                <div>Version: {artifact.version}</div>
                {artifact.tags.length > 0 && (\n                  <div className="flex items-center space-x-1">
                    <span>Tags:</span>
                    {artifact.tags.map(tag => (\n                      <span key={tag} className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Loading indicator */}
          {loading && (\n            <div className="flex-shrink-0">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            </div>
          )}
        </div>
      </div>

      {/* Right section - Actions */}
      <div className="flex items-center space-x-2">
        {/* Metadata toggle */}
        <button
          onClick={handleMetadataToggle}
          className={buttonClasses}
          title="Toggle metadata"\n          aria-label="Toggle metadata"
        >\n          <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">\n            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>

        {/* Refresh */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            className={buttonClasses}
            title="Refresh"\n            aria-label="Refresh artifact"
          >\n            <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">\n              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0V9a8 8 0 1115.356 2m-15.356 0H4v5" />
            </svg>
          </button>
        )}

        {/* Download */}
        {onDownload && (
          <button
            onClick={onDownload}
            className={buttonClasses}
            title="Download"\n            aria-label="Download artifact"
          >\n            <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">\n              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
        )}

        {/* Export */}
        {onExport && exportFormats.length > 0 && (\n          <div className="relative">
            <button
              ref={exportButtonRef}
              onClick={toggleExportMenu}
              className={buttonClasses}
              title="Export"\n              aria-label="Export artifact"
              aria-expanded={showExportMenu}
              aria-haspopup="menu"
            >\n              <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">\n                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
            
            <DropdownMenu
              isOpen={showExportMenu}
              onClose={() => setShowExportMenu(false)}
              anchorRef={exportButtonRef}
            >\n              <div className="py-1">
                {exportFormats.map(format => (
                  <button
                    key={format}
                    onClick={() => handleExport(format)}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700"
                    role="menuitem"
                  >
                    Export as {format.toUpperCase()}
                  </button>
                ))}
              </div>
            </DropdownMenu>
          </div>
        )}

        {/* Share */}
        {onShare && (
          <button
            onClick={onShare}
            className={buttonClasses}
            title="Share"\n            aria-label="Share artifact"
          >\n            <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">\n              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
            </svg>
          </button>
        )}

        {/* Fullscreen */}
        {onFullscreenToggle && (
          <button
            onClick={onFullscreenToggle}
            className={buttonClasses}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? (\n              <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">\n                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (\n              <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">\n                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            )}
          </button>
        )}

        {/* More actions */}
        {(onEdit || onDelete || onPrint) && (\n          <div className="relative">
            <button
              ref={moreButtonRef}
              onClick={toggleMoreMenu}
              className={buttonClasses}
              title="More actions"\n              aria-label="More actions"
              aria-expanded={showMoreMenu}
              aria-haspopup="menu"
            >\n              <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">\n                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            
            <DropdownMenu
              isOpen={showMoreMenu}
              onClose={() => setShowMoreMenu(false)}
              anchorRef={moreButtonRef}
            >\n              <div className="py-1">
                {onEdit && editable && (
                  <button
                    onClick={() => {
                      onEdit();
                      setShowMoreMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700"
                    role="menuitem"
                  >
                    Edit
                  </button>
                )}
                {onPrint && (
                  <button
                    onClick={() => {
                      onPrint();
                      setShowMoreMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700"
                    role="menuitem"
                  >
                    Print
                  </button>
                )}
                {onDelete && deletable && (
                  <>\n                    <hr className="border-gray-200 dark:border-gray-700" />
                    <button
                      onClick={() => {
                        onDelete();
                        setShowMoreMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:bg-red-50 dark:focus:bg-red-900/20"
                      role="menuitem"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </DropdownMenu>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArtifactHeader;