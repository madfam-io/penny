'use client';

import { useState } from 'react';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Separator,
} from '@penny/ui';
import { 
  Search, 
  X, 
  Filter,
  SortAsc,
  SortDesc,
  Calendar,
  Tag,
  Users,
  Activity
} from 'lucide-react';

interface FilterState {
  search: string;
  category: string;
  status: string;
  provider: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  dateRange: string;
}

export function ToolFilters() {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    category: '',
    status: '',
    provider: '',
    sortBy: 'name',
    sortOrder: 'asc',
    dateRange: ''
  });

  const [activeFilters, setActiveFilters] = useState<Array<{ key: string; value: string; label: string }>>([]);

  const categories = [
    'Analytics',
    'Visualization', 
    'Communication',
    'Integration',
    'Code Execution',
    'Data Processing',
    'Security',
    'Monitoring'
  ];

  const statuses = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'deprecated', label: 'Deprecated' }
  ];

  const providers = [
    'Internal',
    'OpenAI',
    'Anthropic',
    'SendGrid',
    'Atlassian',
    'Slack',
    'GitHub',
    'AWS'
  ];

  const sortOptions = [
    { value: 'name', label: 'Name' },
    { value: 'category', label: 'Category' },
    { value: 'usage_count', label: 'Usage Count' },
    { value: 'created_at', label: 'Created Date' },
    { value: 'updated_at', label: 'Updated Date' },
    { value: 'last_used', label: 'Last Used' }
  ];

  const dateRanges = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'quarter', label: 'This Quarter' },
    { value: 'year', label: 'This Year' }
  ];

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    
    // Update active filters
    if (value && key !== 'search' && key !== 'sortBy' && key !== 'sortOrder') {
      const filterLabel = getFilterLabel(key, value);
      setActiveFilters(prev => {
        const filtered = prev.filter(f => f.key !== key);
        return [...filtered, { key, value, label: filterLabel }];
      });
    } else if (!value) {
      setActiveFilters(prev => prev.filter(f => f.key !== key));
    }
  };

  const getFilterLabel = (key: string, value: string): string => {
    switch (key) {
      case 'category':
        return `Category: ${value}`;
      case 'status':
        return `Status: ${statuses.find(s => s.value === value)?.label || value}`;
      case 'provider':
        return `Provider: ${value}`;
      case 'dateRange':
        return `Date: ${dateRanges.find(d => d.value === value)?.label || value}`;
      default:
        return `${key}: ${value}`;
    }
  };

  const removeFilter = (key: string) => {
    handleFilterChange(key as keyof FilterState, '');
  };

  const clearAllFilters = () => {
    setFilters({
      search: '',
      category: '',
      status: '',
      provider: '',
      sortBy: 'name',
      sortOrder: 'asc',
      dateRange: ''
    });
    setActiveFilters([]);
  };

  const toggleSortOrder = () => {
    setFilters(prev => ({
      ...prev,
      sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc'
    }));
  };

  return (
    <div className="space-y-4">
      {/* Search and Primary Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search */}
        <div className="space-y-2">
          <Label htmlFor="search" className="text-sm font-medium">
            Search Tools
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Search by name, description..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Category Filter */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Category</Label>
          <Select
            value={filters.category}
            onValueChange={(value) => handleFilterChange('category', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status Filter */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Status</Label>
          <Select
            value={filters.status}
            onValueChange={(value) => handleFilterChange('status', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All statuses</SelectItem>
              {statuses.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Provider Filter */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Provider</Label>
          <Select
            value={filters.provider}
            onValueChange={(value) => handleFilterChange('provider', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All providers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All providers</SelectItem>
              {providers.map((provider) => (
                <SelectItem key={provider} value={provider}>
                  {provider}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Sort By */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Sort By</Label>
          <div className="flex gap-2">
            <Select
              value={filters.sortBy}
              onValueChange={(value) => handleFilterChange('sortBy', value)}
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSortOrder}
              className="px-3"
            >
              {filters.sortOrder === 'asc' ? (
                <SortAsc className="h-4 w-4" />
              ) : (
                <SortDesc className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Date Range */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Date Range</Label>
          <Select
            value={filters.dateRange}
            onValueChange={(value) => handleFilterChange('dateRange', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All time</SelectItem>
              {dateRanges.map((range) => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Actions</Label>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1">
              <Filter className="h-4 w-4 mr-2" />
              Apply Filters
            </Button>
            {activeFilters.length > 0 && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={clearAllFilters}
                className="text-muted-foreground"
              >
                Clear All
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Active Filters */}
      {activeFilters.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Tag className="h-4 w-4" />
              Active Filters:
            </div>
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((filter) => (
                <Badge
                  key={`${filter.key}-${filter.value}`}
                  variant="secondary"
                  className="flex items-center gap-1 px-2 py-1"
                >
                  {filter.label}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFilter(filter.key)}
                    className="h-4 w-4 p-0 hover:bg-transparent"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Filter Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground pt-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Activity className="h-4 w-4" />
            <span>Showing filtered results</span>
          </div>
          {filters.search && (
            <div className="flex items-center gap-1">
              <Search className="h-4 w-4" />
              <span>Search: "{filters.search}"</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Users className="h-4 w-4" />
          <span>125 tools total</span>
        </div>
      </div>
    </div>
  );
}