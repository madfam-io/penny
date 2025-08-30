import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Bot, User, Loader2 } from 'lucide-react';\nimport { cn } from '@/utils/cn';\nimport MessageBubble from '@/components/MessageBubble';\nimport ArtifactViewer from '@/components/ArtifactViewer';

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

export default function ChatView() {
  const [messages, setMessages] = useState<Message[]>([
    {\n      id: '1',
      role: 'assistant',
      content:
        "Hello! I'm PENNY, your AI assistant. I can help you with data analysis, create dashboards, and much more. How can I assist you today?",
      timestamp: new Date(),
    },
  ]);\n  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);\n    setInput('');
    setIsLoading(true);

    // Simulate AI response
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content:\n          "I understand you want to analyze some data. Let me help you with that. Here's a dashboard showing your company KPIs for this month.",
        timestamp: new Date(),
        artifacts: [
          {
            id: 'art_1',
            type: 'dashboard',
            name: 'Company KPIs - MTD',
          },
        ],
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1500);
  };

  return (\n    <div className="flex h-full">
      {/* Chat section */}
      <div className={cn('flex flex-col', selectedArtifact ? 'w-1/2' : 'w-full')}>
        {/* Messages */}\n        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onArtifactClick={setSelectedArtifact}
            />
          ))}

          {isLoading && (\n            <div className="flex items-center gap-2 text-gray-500">\n              <Loader2 className="h-4 w-4 animate-spin" />\n              <span className="text-sm">PENNY is thinking...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}\n        <div className="border-t border-gray-200 dark:border-gray-700 p-4">\n          <div className="flex items-end gap-2">\n            <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">\n              <Paperclip className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
\n            <div className="flex-1">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}\n                placeholder="Ask PENNY anything..."\n                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                rows={1}
              />
            </div>

            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className={cn(
                'p-2 rounded-lg transition-colors',
                input.trim() && !isLoading
                  ? 'bg-brand-500 hover:bg-brand-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed',
              )}
            >\n              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Artifact viewer */}
      {selectedArtifact && (\n        <div className="w-1/2 border-l border-gray-200 dark:border-gray-700">
          <ArtifactViewer artifactId={selectedArtifact} onClose={() => setSelectedArtifact(null)} />
        </div>
      )}
    </div>
  );
}
