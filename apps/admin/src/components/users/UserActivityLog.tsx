'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Clock, 
  Shield, 
  MessageCircle, 
  Wrench, 
  LogIn,
  LogOut,
  User,
  Settings,
  RefreshCw,
  Download
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ActivityLogEntry {
  id: string;
  type: 'auth' | 'conversation' | 'tool' | 'security' | 'profile' | 'system';
  action: string;
  description: string;
  timestamp: Date;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

interface UserActivityLogProps {
  userId: string;
}

// Mock data generator
function generateActivityLog(userId: string): ActivityLogEntry[] {
  const activities: ActivityLogEntry[] = [
    {
      id: '1',
      type: 'auth',
      action: 'login',
      description: 'User logged in successfully',
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
      ip: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    },
    {
      id: '2',
      type: 'conversation',
      action: 'conversation.created',
      description: 'Started new conversation',
      timestamp: new Date(Date.now() - 1000 * 60 * 45),
      metadata: { conversationId: 'conv-123', title: 'Data Analysis Query' }
    },
    {
      id: '3',
      type: 'tool',
      action: 'tool.invoked',
      description: 'Invoked weather tool',
      timestamp: new Date(Date.now() - 1000 * 60 * 60),
      metadata: { toolName: 'get_weather', location: 'San Francisco', duration: 1200 }
    },
    {
      id: '4',
      type: 'profile',
      action: 'profile.updated',
      description: 'Updated profile information',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      metadata: { fields: ['jobTitle', 'department'] }
    },
    {
      id: '5',
      type: 'security',
      action: 'mfa.enabled',
      description: 'Enabled multi-factor authentication',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
      ip: '192.168.1.100'
    },
    {
      id: '6',
      type: 'auth',
      action: 'password.changed',
      description: 'Password changed successfully',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
      ip: '192.168.1.100'
    }
  ];

  return activities;
}

export function UserActivityLog({ userId }: UserActivityLogProps) {
  const [activities] = useState<ActivityLogEntry[]>(generateActivityLog(userId));
  const [filter, setFilter] = useState<string>('all');

  const getIcon = (type: ActivityLogEntry['type']) => {
    switch (type) {
      case 'auth': return LogIn;
      case 'conversation': return MessageCircle;
      case 'tool': return Wrench;
      case 'security': return Shield;
      case 'profile': return User;
      case 'system': return Settings;
      default: return Clock;
    }
  };

  const getTypeColor = (type: ActivityLogEntry['type']) => {
    switch (type) {
      case 'auth': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20';
      case 'conversation': return 'bg-green-100 text-green-800 dark:bg-green-900/20';
      case 'tool': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20';
      case 'security': return 'bg-red-100 text-red-800 dark:bg-red-900/20';
      case 'profile': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20';
      case 'system': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20';
    }
  };

  const filteredActivities = activities.filter(activity => 
    filter === 'all' || activity.type === filter
  );

  const activityCounts = {
    all: activities.length,
    auth: activities.filter(a => a.type === 'auth').length,
    conversation: activities.filter(a => a.type === 'conversation').length,
    tool: activities.filter(a => a.type === 'tool').length,
    security: activities.filter(a => a.type === 'security').length,
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Activity Log
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={filter} onValueChange={setFilter} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">
              All ({activityCounts.all})
            </TabsTrigger>
            <TabsTrigger value="auth">
              Auth ({activityCounts.auth})
            </TabsTrigger>
            <TabsTrigger value="conversation">
              Chat ({activityCounts.conversation})
            </TabsTrigger>
            <TabsTrigger value="tool">
              Tools ({activityCounts.tool})
            </TabsTrigger>
            <TabsTrigger value="security">
              Security ({activityCounts.security})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={filter} className="mt-6">
            <ScrollArea className="h-96">
              <div className="space-y-4">
                {filteredActivities.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No activity found for this filter</p>
                  </div>
                ) : (
                  filteredActivities.map((activity) => {
                    const Icon = getIcon(activity.type);
                    
                    return (
                      <div
                        key={activity.id}
                        className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className={`p-2 rounded-full ${getTypeColor(activity.type)}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium">{activity.description}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {activity.type}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {activity.ip && (
                            <p className="text-xs text-muted-foreground">
                              IP: {activity.ip}
                            </p>
                          )}
                          
                          {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                            <div className="text-xs text-muted-foreground">
                              <details className="cursor-pointer">
                                <summary className="hover:text-foreground">
                                  Show details
                                </summary>
                                <div className="mt-2 p-2 bg-muted rounded text-xs font-mono">
                                  {JSON.stringify(activity.metadata, null, 2)}
                                </div>
                              </details>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}