import React, { useState, useCallback, useMemo } from 'react';
import { Artifact } from '@penny/types';

interface MarkdownRendererProps {
  artifact: Artifact;
  theme?: 'light' | 'dark' | 'auto';
  interactive?: boolean;
  onError?: (error: Error) => void;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  onAnnotate?: (annotation: any) => void;
  isFullscreen?: boolean;
  className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  artifact,
  theme = 'auto',
  interactive = true,
  onError,
  onLoadStart,
  onLoadEnd,
  className = ''
}) => {
  const [showToc, setShowToc] = useState(false);
  const [activeHeading, setActiveHeading] = useState<string>('');

  const content = typeof artifact.content === 'string' ? artifact.content : artifact.content?.markdown || '';
  const isDarkMode = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  // Simple markdown parser (in production, use a library like react-markdown)
  const parseMarkdown = useCallback((md: string) => {
    onLoadStart?.();
    
    let html = md
      // Headers
      .replace(/^### (.*$)/gim, '<h3 id="$1">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 id="$1">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 id="$1">$1</h1>')
     
     // Code blocks
      .replace(/```(\w+)?
([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
     
     // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
     
     // Images
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full h-auto rounded" />')
      
      // Bold and italic
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      
      // Lists
      .replace(/^\* (.+)/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      .replace(/^\d+\. (.+)/gm, '<li>$1</li>')
     
     // Blockquotes
      .replace(/^> (.+)/gm, '<blockquote class="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic">$1</blockquote>')
      
      // Line breaks
      .replace(/
/g, '<br>');

    onLoadEnd?.();
    return html;
  }, [onLoadStart, onLoadEnd]);

  const parsedContent = useMemo(() => parseMarkdown(content), [content, parseMarkdown]);

  // Extract headings for table of contents
  const headings = useMemo(() => {
    const headingRegex = /^(#{1,6})\s+(.*)$/gm;
    const matches = [];
    let match;
    
    while ((match = headingRegex.exec(content)) !== null) {
      matches.push({
        level: match[1].length,
        title: match[2],
        id: match[2].toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
      });
    }
    
    return matches;
  }, [content]);

  const handleHeadingClick = useCallback((headingId: string) => {
    const element = document.getElementById(headingId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setActiveHeading(headingId);
    }
  }, []);

  const containerClasses = [
    'markdown-renderer w-full h-full flex',
    isDarkMode ? 'dark' : '',
    className
  ].filter(Boolean).join(' ');

  const contentClasses = [
    'flex-1 overflow-auto p-6 prose prose-gray max-w-none',
    isDarkMode ? 'prose-invert' : '',
    'prose-headings:scroll-mt-6',
    'prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800',
    'prose-code:bg-gray-100 dark:prose-code:bg-gray-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded',
    'prose-blockquote:border-l-blue-500',
    'prose-a:text-blue-600 hover:prose-a:text-blue-800',
    'prose-img:rounded-lg prose-img:shadow-md'
  ].join(' ');

  return (
    <div className={containerClasses}>
      {/* Table of contents sidebar */}
      {showToc && headings.length > 0 && (
<div className="w-64 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 overflow-auto">
          <div className="flex items-center justify-between mb-4">
<h3 className="font-semibold text-sm">Table of Contents</h3>
            <button
              onClick={() => setShowToc(false)}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            >
<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
         
         <nav className="space-y-1">
            {headings.map((heading, index) => (
              <button
                key={index}
                onClick={() => handleHeadingClick(heading.id)}
                className={`block w-full text-left text-sm py-1 px-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
                  activeHeading === heading.id ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'
                }`}
                style={{ paddingLeft: `${heading.level * 8 + 8}px` }}
              >
                {heading.title}
              </button>
            ))}
          </nav>
        </div>
      )}

      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center space-x-2">
<span className="text-sm font-medium">Markdown</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
{content.split('\n').length} lines • {content.split(/\s+/).length} words
            </span>
          </div>
         
         <div className="flex items-center space-x-2">
            {/* Table of contents toggle */}
            {headings.length > 0 && (
              <button
                onClick={() => setShowToc(!showToc)}
                className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
                  showToc ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' : ''
                }`}
                title="Table of Contents"
              >
<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>
            )}

            {/* Print */}
            <button
              onClick={() => window.print()}
              className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              title="Print"
            >
<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className={contentClasses}>
          <div dangerouslySetInnerHTML={{ __html: parsedContent }} />
        </div>
      </div>
    </div>
  );
};

export default MarkdownRenderer;