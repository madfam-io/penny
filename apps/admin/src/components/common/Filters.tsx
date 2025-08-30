'use client';

import { useState, useCallback } from 'react';
import { Button } from '@penny/ui';
import { Input } from '@penny/ui';
import { Label } from '@penny/ui';
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
import { Calendar } from '@penny/ui';
import { Checkbox } from '@penny/ui';
import { Badge } from '@penny/ui';
import { 
  Filter, 
  X, 
  Calendar as CalendarIcon,
  Search,
  RotateCcw
} from 'lucide-react';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  type: 'text' | 'select' | 'multiselect' | 'date' | 'daterange' | 'checkbox';
  options?: FilterOption[];
  placeholder?: string;
  defaultValue?: any;
}

export interface FilterValues {
  [key: string]: any;
}

interface FiltersProps {
  config: FilterConfig[];
  values: FilterValues;
  onValuesChange: (values: FilterValues) => void;
  onReset?: () => void;
  className?: string;
}

export function Filters({
  config,
  values,
  onValuesChange,
  onReset,
  className
}: FiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const updateValue = useCallback((key: string, value: any) => {
    onValuesChange({
      ...values,
      [key]: value
    });
  }, [values, onValuesChange]);

  const removeFilter = useCallback((key: string) => {
    const newValues = { ...values };
    delete newValues[key];
    onValuesChange(newValues);
  }, [values, onValuesChange]);

  const resetFilters = useCallback(() => {
    onValuesChange({});
    onReset?.();
  }, [onValuesChange, onReset]);

  const activeFilters = Object.keys(values).filter(key => {
    const value = values[key];
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'string') return value.trim() !== '';
    if (typeof value === 'object' && value !== null) {
      if (value.from || value.to) return true;
    }
    return value !== null && value !== undefined && value !== '';
  });

  const renderFilterInput = (filterConfig: FilterConfig) => {
    const { key, type, options, placeholder, defaultValue } = filterConfig;
    const value = values[key] || defaultValue;

    switch (type) {
      case 'text':
        return (
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={placeholder}
              value={value || ''}
              onChange={(e) => updateValue(key, e.target.value)}
              className="pl-8"
            />
          </div>
        );

      case 'select':
        return (
          <Select value={value || ''} onValueChange={(val) => updateValue(key, val)}>
            <SelectTrigger>
              <SelectValue placeholder={placeholder || 'Select...'} />
            </SelectTrigger>
            <SelectContent>
              {options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'multiselect':
        return (
          <div className="space-y-2">
            {options?.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`${key}-${option.value}`}
                  checked={Array.isArray(value) && value.includes(option.value)}
                  onCheckedChange={(checked) => {
                    const currentValues = Array.isArray(value) ? value : [];
                    if (checked) {
                      updateValue(key, [...currentValues, option.value]);
                    } else {
                      updateValue(key, currentValues.filter(v => v !== option.value));
                    }
                  }}
                />
                <Label
                  htmlFor={`${key}-${option.value}`}
                  className="text-sm font-normal"
                >
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
        );

      case 'date':
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value ? format(value, 'PPP') : placeholder || 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={value}
                onSelect={(date) => updateValue(key, date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        );

      case 'daterange':
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value?.from ? (
                  value.to ? (
                    <>
                      {format(value.from, 'LLL dd, y')} -{' '}
                      {format(value.to, 'LLL dd, y')}
                    </>
                  ) : (
                    format(value.from, 'LLL dd, y')
                  )
                ) : (
                  placeholder || 'Pick a date range'
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={value?.from}
                selected={value}
                onSelect={(range: DateRange | undefined) => updateValue(key, range)}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        );

      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={key}
              checked={!!value}
              onCheckedChange={(checked) => updateValue(key, checked)}
            />
            <Label htmlFor={key} className="text-sm font-normal">
              {placeholder || 'Enable'}
            </Label>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-2 flex-wrap">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              Filters
              {activeFilters.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {activeFilters.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-96" align="start">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Filters</h4>
                {activeFilters.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset
                  </Button>
                )}
              </div>

              {config.map((filterConfig) => (
                <div key={filterConfig.key} className="space-y-2">
                  <Label className="text-sm font-medium">
                    {filterConfig.label}
                  </Label>
                  {renderFilterInput(filterConfig)}
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Active Filters */}
        {activeFilters.map((key) => {
          const filterConfig = config.find(c => c.key === key);
          if (!filterConfig) return null;

          const value = values[key];
          let displayValue: string;

          if (Array.isArray(value)) {
            displayValue = `${value.length} selected`;
          } else if (typeof value === 'object' && value !== null && (value.from || value.to)) {
            if (value.from && value.to) {
              displayValue = `${format(value.from, 'MMM d')} - ${format(value.to, 'MMM d')}`;
            } else if (value.from) {
              displayValue = `From ${format(value.from, 'MMM d')}`;
            } else {
              displayValue = `To ${format(value.to, 'MMM d')}`;
            }
          } else if (typeof value === 'boolean') {
            displayValue = value ? 'Yes' : 'No';
          } else {
            // For select filters, try to find the label
            if (filterConfig.options) {
              const option = filterConfig.options.find(o => o.value === value);
              displayValue = option ? option.label : String(value);
            } else {
              displayValue = String(value);
            }
          }

          return (
            <Badge key={key} variant="secondary" className="gap-1">
              <span className="text-xs">
                {filterConfig.label}: {displayValue}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removeFilter(key)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          );
        })}
      </div>
    </div>
  );
}