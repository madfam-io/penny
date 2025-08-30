'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Area,
  AreaChart
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@penny/uicard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@penny/uitabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@penny/uiselect';
import { BarChart3, TrendingUp, Activity } from 'lucide-react';
import { useState } from 'react';

interface ActivityData {
  date: string;
  users: number;
  conversations: number;
  messages: number;
  apiCalls: number;
  toolInvocations: number;
}

interface ActivityChartProps {
  data?: ActivityData[];
  timeRange?: '7d' | '30d' | '90d' | '1y';
  onTimeRangeChange?: (range: '7d' | '30d' | '90d' | '1y') => void;
  className?: string;
}

// Mock data generator
function generateMockData(days: number): ActivityData[] {
  const data: ActivityData[] = [];
  const now = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    data.push({
      date: date.toISOString().split('T')[0],
      users: Math.floor(Math.random() * 1000) + 500,
      conversations: Math.floor(Math.random() * 500) + 200,
      messages: Math.floor(Math.random() * 2000) + 800,
      apiCalls: Math.floor(Math.random() * 5000) + 2000,
      toolInvocations: Math.floor(Math.random() * 300) + 100
    });
  }
  
  return data;
}

export function ActivityChart({ 
  data,
 timeRange = '30d', 
  onTimeRangeChange,
  className 
}: ActivityChartProps) {
  const [chartType, setChartType] = useState<'line' | 'bar' | 'area'>('line');
  
  const chartData = useMemo(() => {
    if (data) return data;
    
    const days = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365
    }[timeRange];
    
    return generateMockData(days);
  }, [data, timeRange]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (timeRange === '7d') {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else if (timeRange === '30d') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border rounded-lg shadow-sm">
          <p className="text-sm font-medium mb-2">{formatDate(label)}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div
               className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="capitalize">{entry.dataKey}:</span>
              <span className="font-medium">{entry.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    };

    switch (chartType) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
             dataKey="date" 
              tickFormatter={formatDate}
              className="text-xs"
            />
            <YAxis className="text-xs" />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="users" fill="#3b82f6" radius={[2, 2, 0, 0]} />
            <Bar dataKey="conversations" fill="#10b981" radius={[2, 2, 0, 0]} />
            <Bar dataKey="messages" fill="#f59e0b" radius={[2, 2, 0, 0]} />
          </BarChart>
        );
      
      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
             dataKey="date" 
              tickFormatter={formatDate}
              className="text-xs"
            />
            <YAxis className="text-xs" />
            <Tooltip content={<CustomTooltip />} />
            <Area
             type="monotone"
             dataKey="users"
             stackId="1"
              stroke="#3b82f6"
             fill="#3b82f6" 
              fillOpacity={0.6}
            />
            <Area
             type="monotone"
             dataKey="conversations"
             stackId="1"
              stroke="#10b981"
             fill="#10b981" 
              fillOpacity={0.6}
            />
            <Area
             type="monotone"
             dataKey="messages"
             stackId="1"
              stroke="#f59e0b"
             fill="#f59e0b" 
              fillOpacity={0.6}
            />
          </AreaChart>
        );
      
      default:
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
             dataKey="date" 
              tickFormatter={formatDate}
              className="text-xs"
            />
            <YAxis className="text-xs" />
            <Tooltip content={<CustomTooltip />} />
            <Line
             type="monotone"
             dataKey="users"
             stroke="#3b82f6" 
              strokeWidth={2}
              dot={{ fill: '#3b82f6', strokeWidth: 2, r: 3 }}
            />
            <Line
             type="monotone"
             dataKey="conversations"
             stroke="#10b981" 
              strokeWidth={2}
              dot={{ fill: '#10b981', strokeWidth: 2, r: 3 }}
            />
            <Line
             type="monotone"
             dataKey="messages"
             stroke="#f59e0b" 
              strokeWidth={2}
              dot={{ fill: '#f59e0b', strokeWidth: 2, r: 3 }}
            />
          </LineChart>
        );
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Platform Activity
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={chartType} onValueChange={(value: any) => setChartType(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="line">Line Chart</SelectItem>
                <SelectItem value="bar">Bar Chart</SelectItem>
                <SelectItem value="area">Area Chart</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={timeRange} onValueChange={onTimeRangeChange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="1y">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
       
       <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-sm text-muted-foreground">Active Users</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-sm text-muted-foreground">Conversations</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="text-sm text-muted-foreground">Messages</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}