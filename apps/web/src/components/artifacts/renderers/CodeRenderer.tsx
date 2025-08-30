import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CodeArtifact } from '@penny/types';

interface CodeRendererProps {
  artifact: CodeArtifact;
  theme?: 'light' | 'dark' | 'auto';
  interactive?: boolean;
  onError?: (error: Error) => void;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  onAnnotate?: (annotation: any) => void;
  isFullscreen?: boolean;
  className?: string;
}

const CodeRenderer: React.FC<CodeRendererProps> = ({
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
  const editorRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [currentLine, setCurrentLine] = useState(1);
  const [totalLines, setTotalLines] = useState(0);
  const [selectedText, setSelectedText] = useState('');
  const [copied, setCopied] = useState(false);

  const { code, language, filename, config } = artifact.content;
  const isDarkMode = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    onLoadStart?.();
    setLoading(true);
    
    // Simulate syntax highlighting load
    const timer = setTimeout(() => {
      setTotalLines(code.split('\n').length);
      setLoading(false);
      onLoadEnd?.();
    }, 100);

    return () => clearTimeout(timer);
  }, [code, onLoadStart, onLoadEnd]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!interactive) return;

      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'f':
            e.preventDefault();
            setSearchVisible(true);
            break;
          case 'g':
            e.preventDefault();
            // Go to line functionality
            break;
          case 'c':
            if (selectedText) {
              e.preventDefault();
              handleCopy();
            }
            break;
        }
      }
      
      if (e.key === 'Escape' && searchVisible) {
        setSearchVisible(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [interactive, selectedText, searchVisible]);

  const handleCopy = useCallback(async () => {
    const textToCopy = selectedText || code;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [selectedText, code]);

  const handleLineClick = useCallback((lineNumber: number) => {
    setCurrentLine(lineNumber);
    if (onAnnotate) {
      onAnnotate({
        type: 'line',
        line: lineNumber,
        code: code.split('\n')[lineNumber - 1]
      });
    }
  }, [code, onAnnotate]);

  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString() || '';
    setSelectedText(text);
  }, []);

  const highlightSearchTerm = useCallback((text: string) => {
    if (!searchTerm) return text;
   
   const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\]/g, '\$&')})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800">$1</mark>');
  }, [searchTerm]);

  const getLanguageIcon = (lang: string) => {
    const icons: { [key: string]: string } = {
      javascript: '🟨',
      typescript: '🔷',
      python: '🐍',
      java: '☕',
      cpp: '⚙️',
      c: '⚙️',
      rust: '🦀',
      go: '🔵',
      php: '🐘',
      ruby: '💎',
      swift: '🧡',
      kotlin: '🟣',
      scala: '🔴',
      html: '🌐',
      css: '🎨',
      json: '📄',
      xml: '📋',
      yaml: '📝',
      markdown: '📖',
      sql: '🗃️',
      bash: '💻',
      powershell: '💻',
      dockerfile: '🐳'
    };
    return icons[lang.toLowerCase()] || '📄';
  };

  const renderLineNumbers = () => {
    const lines = code.split('\n');
    return lines.map((_, index) => (
      <div
        key={index + 1}
        className={`line-number px-2 py-0 text-right text-xs select-none cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 ${
          currentLine === index + 1 ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
        } ${config.highlightLines?.includes(index + 1) ? 'bg-yellow-100 dark:bg-yellow-900' : ''}`}
        onClick={() => handleLineClick(index + 1)}
        style={{ width: '60px', minWidth: '60px' }}
      >
        {index + 1}
      </div>
    ));
  };

  const renderCode = () => {
    const lines = code.split('\n');
    return lines.map((line, index) => (
      <div
        key={index}
        className={`code-line px-4 py-0 font-mono text-sm whitespace-pre ${
          currentLine === index + 1 ? 'bg-blue-50 dark:bg-blue-900/20' : ''
        } ${config.highlightLines?.includes(index + 1) ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}`}
        style={{ minHeight: '1.5rem', lineHeight: '1.5rem' }}
      >
        {searchTerm ? (
          <span dangerouslySetInnerHTML={{ __html: highlightSearchTerm(line) }} />
        ) : (
          <span>{line || ' '}</span>
        )}
      </div>
    ));
  };

  const containerClasses = [
    'code-renderer w-full h-full flex flex-col',
    isDarkMode ? 'dark bg-gray-900 text-gray-100' : 'bg-white text-gray-900',
    className
  ].filter(Boolean).join(' ');

  if (loading) {
    return (
      <div className={containerClasses}>
<div className="flex-1 flex items-center justify-center">
          <div className="flex items-center space-x-2">
<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-sm">Loading code...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      {/* Code header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center space-x-2">
<span className="text-lg">{getLanguageIcon(language)}</span>
          <span className="font-medium">{language}</span>
          {filename && (
            <>
<span className="text-gray-400">•</span>
              <span className="text-sm text-gray-600 dark:text-gray-400">{filename}</span>
            </>
          )}
        </div>
       
       <div className="flex items-center space-x-2">
          {/* Line info */}
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {totalLines} lines • Line {currentLine}
          </span>
          
          {/* Search toggle */}
          {interactive && (
            <button
              onClick={() => setSearchVisible(!searchVisible)}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              title="Search (Ctrl+F)"
            >
<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          )}
          
          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 relative"
            title="Copy to clipboard"
          >
            {copied ? (
<svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Search bar */}
      {searchVisible && (
<div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Search in code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              autoFocus
            />
            <button
              onClick={() => {
                setSearchVisible(false);
                setSearchTerm('');
              }}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            >
<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Code content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Line numbers */}
        {config.showLineNumbers && (
<div className="flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-hidden">
            {renderLineNumbers()}
          </div>
        )}

        {/* Code content */}
        <div 
          ref={editorRef}
          className="flex-1 overflow-auto font-mono text-sm"
          onMouseUp={handleTextSelection}
          style={{ fontSize: `${config.fontSize}px` }}
        >
          {renderCode()}
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-2 text-xs border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center space-x-4">
          <span>Language: {language}</span>
          <span>Encoding: UTF-8</span>
          <span>Tab Size: {config.tabSize}</span>
        </div>
       
       <div className="flex items-center space-x-4">
          {selectedText && (
            <span>{selectedText.length} characters selected</span>
          )}
          <span>Line {currentLine} of {totalLines}</span>
        </div>
      </div>
    </div>
  );
};

export default CodeRenderer;