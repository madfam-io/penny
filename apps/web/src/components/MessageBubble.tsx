import { Bot, User, FileText, BarChart3, Image } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/utils/cn';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  artifacts?: Array<{
    id: string;
    type: string;
    name: string;
  }>;
}

interface MessageBubbleProps {
  message: Message;
  onArtifactClick?: (artifactId: string) => void;
}

export default function MessageBubble({ message, onArtifactClick }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  const getArtifactIcon = (type: string) => {
    switch (type) {
      case 'dashboard':
        return BarChart3;
      case 'document':
        return FileText;
      case 'image':
        return Image;
      default:
        return FileText;
    }
  };

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div
        className={cn(
          'h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0',
          isUser ? 'bg-brand-500' : 'bg-gray-200 dark:bg-gray-700',
        )}
      >
        {isUser ? (
          <User className="h-5 w-5 text-white" />
        ) : (\n          <Bot className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        )}
      </div>

      {/* Message content */}
      <div className={cn('flex flex-col gap-2 max-w-xl', isUser && 'items-end')}>
        <div
          className={cn(
            'rounded-lg px-4 py-2',
            isUser
              ? 'bg-brand-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100',
          )}
        >\n          <ReactMarkdown className="prose prose-sm dark:prose-invert max-w-none">
            {message.content}
          </ReactMarkdown>
        </div>

        {/* Artifacts */}
        {message.artifacts && message.artifacts.length > 0 && (\n          <div className="flex flex-wrap gap-2">
            {message.artifacts.map((artifact) => {
              const Icon = getArtifactIcon(artifact.type);
              return (
                <button
                  key={artifact.id}
                  onClick={() => onArtifactClick?.(artifact.id)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >\n                  <Icon className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{artifact.name}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Timestamp */}
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {message.timestamp.toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}
