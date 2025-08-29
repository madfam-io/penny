'use client';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/utils/cn';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
    isPositive?: boolean;
  };
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray';
  className?: string;
}

const colorVariants = {
  blue: 'text-blue-600 bg-blue-100 dark:bg-blue-900/20',
  green: 'text-green-600 bg-green-100 dark:bg-green-900/20',
  yellow: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20',
  red: 'text-red-600 bg-red-100 dark:bg-red-900/20',
  purple: 'text-purple-600 bg-purple-100 dark:bg-purple-900/20',
  gray: 'text-gray-600 bg-gray-100 dark:bg-gray-900/20'
};

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'blue',
  className
}: StatsCardProps) {
  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CardContent className="p-6">
        <div className="flex items-center">
          <div className={cn(
            'flex h-12 w-12 items-center justify-center rounded-lg',
            colorVariants[color]
          )}>
            <Icon className="h-6 w-6" />
          </div>
          
          <div className="ml-4 flex-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {typeof value === 'number' ? value.toLocaleString() : value}
              </p>
              {trend && (
                <div className={cn(
                  'flex items-center gap-1 text-xs font-medium',
                  trend.isPositive 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                )}>
                  {trend.isPositive ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {trend.value}%
                </div>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
            {trend && (
              <p className="text-xs text-muted-foreground mt-1">{trend.label}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}