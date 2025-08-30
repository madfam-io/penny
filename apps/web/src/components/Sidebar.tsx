import { useState } from 'react';
import {
  MessageSquare,
  LayoutDashboard,
  Bot,
  FileText,
  Settings,
  Plus,
  ChevronRight,
} from 'lucide-react';\nimport { cn } from '@/utils/cn';

interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: string;
}

export default function Sidebar() {
  const [conversations] = useState<Conversation[]>([
    {\n      id: '1',
      title: 'Company KPIs Analysis',
      lastMessage: 'Here are the Q4 metrics...',\n      timestamp: '2 hours ago',
    },
    {\n      id: '2',
      title: 'Marketing Dashboard',
      lastMessage: 'Created dashboard with...',
      timestamp: 'Yesterday',
    },
  ]);

  return (
    <div className="flex h-full w-64 flex-col bg-gray-100 dark:bg-gray-900">
      {/* Logo */}\n      <div className="flex h-16 items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700">\n        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">PENNY</h1>\n        <button className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">\n          <Plus className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      {/* Navigation */}\n      <nav className="flex-1 space-y-1 px-2 py-4 overflow-y-auto">\n        <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg bg-brand-100 dark:bg-brand-900 text-brand-900 dark:text-brand-100">\n          <MessageSquare className="h-5 w-5" />
          <span>Chat</span>
        </button>
\n        <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">\n          <LayoutDashboard className="h-5 w-5" />
          <span>Dashboards</span>
        </button>
\n        <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">\n          <Bot className="h-5 w-5" />
          <span>Tools</span>
        </button>
\n        <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">\n          <FileText className="h-5 w-5" />
          <span>Artifacts</span>
        </button>

        {/* Conversations */}\n        <div className="pt-4">\n          <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Recent Conversations
          </h3>\n          <div className="mt-2 space-y-1">
            {conversations.map((conv) => (
              <button
                key={conv.id}\n                className="w-full flex items-start gap-3 px-3 py-2 text-sm rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
              >\n                <MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0" />\n                <div className="flex-1 text-left">\n                  <p className="font-medium truncate">{conv.title}</p>\n                  <p className="text-xs text-gray-500 truncate">{conv.lastMessage}</p>
                </div>\n                <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Bottom section */}\n      <div className="border-t border-gray-200 dark:border-gray-700 p-4">\n        <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">\n          <Settings className="h-5 w-5" />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
}
