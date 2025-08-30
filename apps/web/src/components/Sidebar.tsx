import { useState } from 'react';
import {
  MessageSquare,
  LayoutDashboard,
  Bot,
  FileText,
  Settings,
  Plus,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/utils/cn';

interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: string;
}

export default function Sidebar() {
  const [conversations] = useState<Conversation[]>([
    {
      id: '1',
      title: 'Company KPIs Analysis',
      lastMessage: 'Here are the Q4 metrics...',
      timestamp: '2 hours ago',
    },
    {
      id: '2',
      title: 'Marketing Dashboard',
      lastMessage: 'Created dashboard with...',
      timestamp: 'Yesterday',
    },
  ]);

  return (
    <div className="flex h-full w-64 flex-col bg-gray-100 dark:bg-gray-900">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">PENNY</h1>
<button className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
          <Plus className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-4 overflow-y-auto">
        <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg bg-brand-100 dark:bg-brand-900 text-brand-900 dark:text-brand-100">
<MessageSquare className="h-5 w-5" />
          <span>Chat</span>
        </button>

        <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
          <LayoutDashboard className="h-5 w-5" />
          <span>Dashboards</span>
        </button>

        <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
          <Bot className="h-5 w-5" />
          <span>Tools</span>
        </button>

        <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
          <FileText className="h-5 w-5" />
          <span>Artifacts</span>
        </button>

        {/* Conversations */}
        <div className="pt-4">
          <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Recent Conversations
          </h3>
<div className="mt-2 space-y-1">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                className="w-full flex items-start gap-3 px-3 py-2 text-sm rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
              >
<MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div className="flex-1 text-left">
<p className="font-medium truncate">{conv.title}</p>
                  <p className="text-xs text-gray-500 truncate">{conv.lastMessage}</p>
                </div>
<ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Bottom section */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
<Settings className="h-5 w-5" />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
}
