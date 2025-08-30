import React, { useState, useEffect } from 'react';
import { Search, Filter, Grid, List, Star, Download, Play, Settings } from 'lucide-react';
import { ToolCard } from './ToolCard';
import { ToolForm } from './ToolForm';
import { ToolExecution } from './ToolExecution';
import { ToolResults } from './ToolResults';
import { LoadingSpinner } from '../ui/LoadingSpinner';

interface Tool {
  name: string;
  displayName: string;
  description: string;
  category: string;
  version: string;
  icon?: string;
  tags: string[];
  author: string;
  featured?: boolean;
  config?: {
    requiresAuth?: boolean;
    permissions?: string[];
    cost?: number;
  };
  metadata?: {
    usageCount?: number;
    userRating?: number;
    lastUsed?: string;
  };
}

interface ToolRegistryProps {
  userId?: string;
  tenantId?: string;
  permissions?: string[];
}

export const ToolRegistry: React.FC<ToolRegistryProps> = ({
  userId,
  tenantId,
  permissions = []
}) => {
  const [tools, setTools] = useState<Tool[]>([]);
  const [filteredTools, setFilteredTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [showExecutionModal, setShowExecutionModal] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  
  // Filter states\n  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showOnlyFeatured, setShowOnlyFeatured] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'category' | 'rating' | 'usage'>('name');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Categories for filtering
  const categories = [
    'all', 'analytics', 'productivity', 'communication', 'development', 
    'data', 'utility', 'integration', 'visualization', 'automation'
  ];

  // Load available tools
  useEffect(() => {
    loadTools();
  }, [userId, tenantId]);

  // Filter tools based on search and filters
  useEffect(() => {
    let filtered = [...tools];

    // Text search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(tool => 
        tool.name.toLowerCase().includes(query) ||
        tool.displayName.toLowerCase().includes(query) ||
        tool.description.toLowerCase().includes(query) ||
        tool.tags.some(tag => tag.toLowerCase().includes(query)) ||
        tool.author.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(tool => tool.category === selectedCategory);
    }

    // Featured filter
    if (showOnlyFeatured) {
      filtered = filtered.filter(tool => tool.featured);
    }

    // Permission filter - only show tools user can execute
    filtered = filtered.filter(tool => {
      if (!tool.config?.permissions?.length) return true;
      return tool.config.permissions.every(permission => 
        permissions.includes(permission)
      );
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'category':
          return a.category.localeCompare(b.category);
        case 'rating':
          return (b.metadata?.userRating || 0) - (a.metadata?.userRating || 0);
        case 'usage':
          return (b.metadata?.usageCount || 0) - (a.metadata?.usageCount || 0);
        default:
          return a.displayName.localeCompare(b.displayName);
      }
    });

    setFilteredTools(filtered);
  }, [tools, searchQuery, selectedCategory, showOnlyFeatured, sortBy, permissions]);

  const loadTools = async () => {
    try {
      setLoading(true);
      setError(null);
     
     const response = await fetch('/api/tools', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Tenant-ID': tenantId || '',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load tools: ${response.statusText}`);
      }

      const data = await response.json();
      setTools(data.tools || []);
    } catch (err: any) {
      console.error('Error loading tools:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteTool = (tool: Tool) => {
    setSelectedTool(tool);
    setShowExecutionModal(true);
  };

  const handleExecutionComplete = (result: any) => {
    setExecutionResult(result);
    setShowExecutionModal(false);
  };

  const handleInstallTool = async (toolName: string) => {
    try {
      const response = await fetch(`/api/tools/${toolName}/install`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Tenant-ID': tenantId || '',
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        await loadTools(); // Refresh tools list
      }
    } catch (err) {
      console.error('Error installing tool:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="large" />
        <span className="ml-3 text-lg">Loading tools...</span>
      </div>
    );
  }

  if (error) {
    return (\n      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-semibold mb-2">Error Loading Tools</h3>\n        <p className="text-red-700 mb-4">{error}</p>
        <button
          onClick={loadTools}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (\n    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>\n          <h2 className="text-2xl font-bold text-gray-900">Tool Registry</h2>
          <p className="text-gray-600">
            Browse and execute tools to enhance your workflow
          </p>
        </div>\n        <div className="flex space-x-2">
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"\n            title={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
          >
            {viewMode === 'grid' ? <List size={20} /> : <Grid size={20} />}
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input\n              type="text"\n              placeholder="Search tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {categories.map(category => (
              <option key={category} value={category}>
                {category === 'all' ? 'All Categories' : category.charAt(0).toUpperCase() + category.slice(1)}
              </option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >\n            <option value="name">Sort by Name</option>\n            <option value="category">Sort by Category</option>\n            <option value="rating">Sort by Rating</option>\n            <option value="usage">Sort by Usage</option>
          </select>

          {/* Featured Filter */}
          <label className="flex items-center space-x-2 cursor-pointer">
            <input\n              type="checkbox"
              checked={showOnlyFeatured}
              onChange={(e) => setShowOnlyFeatured(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />\n            <span className="text-sm text-gray-700">Featured only</span>
            <Star size={16} className="text-yellow-500" />
          </label>
        </div>
      </div>

      {/* Results Summary */}
      <div className="flex justify-between items-center text-sm text-gray-600">
        <span>
          Showing {filteredTools.length} of {tools.length} tools
        </span>
        {searchQuery && (
          <span>\n            Search results for "{searchQuery}"
          </span>
        )}
      </div>

      {/* Tools Grid/List */}
      <div className={
        viewMode === 'grid' 
          ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' 
          : 'space-y-4'
      }>
        {filteredTools.length > 0 ? (
          filteredTools.map(tool => (
            <ToolCard
              key={tool.name}
              tool={tool}
              viewMode={viewMode}
              onExecute={() => handleExecuteTool(tool)}
              onInstall={() => handleInstallTool(tool.name)}
              userPermissions={permissions}
            />
          ))
        ) : (\n          <div className="col-span-full text-center py-12">
            <Filter className="mx-auto h-12 w-12 text-gray-400" />\n            <h3 className="mt-4 text-lg font-medium text-gray-900">No tools found</h3>
            <p className="mt-2 text-gray-500">
              {searchQuery || selectedCategory !== 'all' || showOnlyFeatured
                ? 'Try adjusting your search criteria or filters'
                : 'No tools are available for your account'
              }
            </p>
            {(searchQuery || selectedCategory !== 'all' || showOnlyFeatured) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                  setShowOnlyFeatured(false);
                }}
                className="mt-4 text-blue-600 hover:text-blue-800"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tool Execution Modal */}
      {showExecutionModal && selectedTool && (\n        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-hidden">\n            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">\n                <span className="text-2xl">{selectedTool.icon}</span>
                <div>\n                  <h3 className="text-lg font-semibold">{selectedTool.displayName}</h3>
                  <p className="text-sm text-gray-600">{selectedTool.description}</p>
                </div>
              </div>
              <button
                onClick={() => setShowExecutionModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>\n            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <ToolExecution
                tool={selectedTool}
                onComplete={handleExecutionComplete}
                onCancel={() => setShowExecutionModal(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Results Modal */}
      {executionResult && (\n        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-6xl max-h-[90vh] overflow-hidden">\n            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Execution Results</h3>
              <button
                onClick={() => setExecutionResult(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>\n            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <ToolResults result={executionResult} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};