import React from 'react';
import { Play, Download, Star, Clock, Users, DollarSign } from 'lucide-react';

interface ToolCardProps {
  tool: any;
  viewMode: 'grid' | 'list';
  onExecute: () => void;
  onInstall: () => void;
  userPermissions: string[];
}

export const ToolCard: React.FC<ToolCardProps> = ({
  tool,
  viewMode,
  onExecute,
  onInstall,
  userPermissions
}) => {
  const canExecute = !tool.config?.permissions?.length || 
    tool.config.permissions.every((perm: string) => userPermissions.includes(perm));

  const baseClasses = "bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow";
  const classes = viewMode === 'grid' ? baseClasses : `${baseClasses} flex items-center space-x-6`;

  return (
    <div className={classes}>
      <div className={viewMode === 'grid' ? '' : 'flex-shrink-0'}>
        <div className="flex items-center space-x-3 mb-4">
          <span className="text-2xl">{tool.icon}</span>
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <h3 className="font-semibold text-gray-900">{tool.displayName}</h3>
              {tool.featured && <Star size={16} className="text-yellow-500 fill-current" />}
            </div>
            <p className="text-sm text-gray-600">{tool.category} • v{tool.version}</p>
          </div>
        </div>
      </div>

      <div className={viewMode === 'grid' ? '' : 'flex-1'}>
        <p className="text-gray-700 mb-4 line-clamp-3">{tool.description}</p>

        <div className="flex flex-wrap gap-2 mb-4">
          {tool.tags.slice(0, 3).map((tag: string) => (
            <span
              key={tag}
              className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
          <span>by {tool.author}</span>
          {tool.metadata?.usageCount && (
            <div className="flex items-center space-x-1">
              <Users size={14} />
              <span>{tool.metadata.usageCount}</span>
            </div>
          )}
        </div>

        <div className="flex space-x-2">
          <button
            onClick={onExecute}
            disabled={!canExecute}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium ${
              canExecute
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Play size={16} />
            <span>Execute</span>
          </button>
          
          <button
            onClick={onInstall}
            className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download size={16} />
            <span>Install</span>
          </button>
        </div>
      </div>
    </div>
  );
};