'use client';

import { useState } from 'react';
import { Button } from '@penny/ui';
import { Input } from '@penny/ui';
import { Badge } from '@penny/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@penny/ui';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@penny/ui';
import {
  Calendar,
  CalendarIcon,
  Search,
  Filter,
  X,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';

interface WebhookFiltersProps {
  onFiltersChange?: (filters: WebhookFilters) => void;
}

interface WebhookFilters {
  search: string;
  status: string;
  events: string[];
  dateRange: {
    from: Date | null;
    to: Date | null;
  };
  successRate: string;
}

const webhookEvents = [
  'user.created',
  'user.updated',
  'user.deleted',
  'payment.succeeded',
  'payment.failed',
  'subscription.created',
  'subscription.cancelled',
  'audit.log.created',
  'system.alert',
  'user.login.failed',
];

export function WebhookFilters({ onFiltersChange }: WebhookFiltersProps) {
  const [filters, setFilters] = useState<WebhookFilters>({
    search: '',
    status: 'all',
    events: [],
    dateRange: {
      from: null,
      to: null,
    },
    successRate: 'all',
  });

  const [showEventFilter, setShowEventFilter] = useState(false);

  const updateFilters = (updates: Partial<WebhookFilters>) => {
    const newFilters = { ...filters, ...updates };
    setFilters(newFilters);
    onFiltersChange?.(newFilters);
  };

  const handleSearchChange = (search: string) => {
    updateFilters({ search });
  };

  const handleStatusChange = (status: string) => {
    updateFilters({ status });
  };

  const handleEventToggle = (event: string) => {
    const newEvents = filters.events.includes(event)
      ? filters.events.filter(e => e !== event)
      : [...filters.events, event];
    updateFilters({ events: newEvents });
  };

  const handleSuccessRateChange = (successRate: string) => {
    updateFilters({ successRate });
  };

  const clearFilters = () => {
    const clearedFilters = {
      search: '',
      status: 'all',
      events: [],
      dateRange: { from: null, to: null },
      successRate: 'all',
    };
    setFilters(clearedFilters);
    onFiltersChange?.(clearedFilters);
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.search) count++;
    if (filters.status !== 'all') count++;
    if (filters.events.length > 0) count++;
    if (filters.dateRange.from || filters.dateRange.to) count++;
    if (filters.successRate !== 'all') count++;
    return count;
  };

  const activeFilterCount = getActiveFilterCount();

  return (
    <div className="space-y-4">
      {/* Primary Filters Row */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="flex-1 min-w-[200px] max-w-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search webhooks..."
              value={filters.search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Status Filter */}
        <div className="min-w-[120px]">
          <Select value={filters.status} onValueChange={handleStatusChange}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Success Rate Filter */}
        <div className="min-w-[140px]">
          <Select value={filters.successRate} onValueChange={handleSuccessRateChange}>
            <SelectTrigger>
              <SelectValue placeholder="Success Rate" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Rates</SelectItem>
              <SelectItem value="excellent">95%+ (Excellent)</SelectItem>
              <SelectItem value="good">85-94% (Good)</SelectItem>
              <SelectItem value="poor">&lt;85% (Poor)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Event Filter */}
        <Popover open={showEventFilter} onOpenChange={setShowEventFilter}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="relative">
              <Filter className="h-4 w-4 mr-2" />
              Events
              {filters.events.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                >
                  {filters.events.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-4" align="start">
            <div className="space-y-3">
              <div className="font-medium text-sm">Filter by Events</div>
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                {webhookEvents.map((event) => (
                  <label
                    key={event}
                    className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={filters.events.includes(event)}
                      onChange={() => handleEventToggle(event)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm font-mono">{event}</span>
                  </label>
                ))}
              </div>
              {filters.events.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateFilters({ events: [] })}
                  className="w-full"
                >
                  Clear Events
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Clear Filters */}
        {activeFilterCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground"
          >
            <X className="h-4 w-4 mr-2" />
            Clear All ({activeFilterCount})
          </Button>
        )}

        {/* Refresh */}
        <Button variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          
          {filters.search && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Search: "{filters.search}"
              <button
                onClick={() => handleSearchChange('')}
                className="ml-1 hover:bg-gray-200 rounded-full p-1"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {filters.status !== 'all' && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Status: {filters.status}
              <button
                onClick={() => handleStatusChange('all')}
                className="ml-1 hover:bg-gray-200 rounded-full p-1"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {filters.successRate !== 'all' && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Success Rate: {filters.successRate}
              <button
                onClick={() => handleSuccessRateChange('all')}
                className="ml-1 hover:bg-gray-200 rounded-full p-1"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {filters.events.length > 0 && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Events: {filters.events.length} selected
              <button
                onClick={() => updateFilters({ events: [] })}
                className="ml-1 hover:bg-gray-200 rounded-full p-1"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}