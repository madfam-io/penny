'use client';

import { useState } from 'react';\nimport { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';\nimport { Badge } from '@/components/ui/badge';\nimport { Button } from '@/components/ui/button';\nimport { ScrollArea } from '@/components/ui/scroll-area';\nimport { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Clock, 
  User, 
  MessageCircle, 
  Wrench, 
  Shield, 
  CreditCard,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ActivityItem {
  id: string;
  type: 'user' | 'conversation' | 'tool' | 'security' | 'billing' | 'system';
  action: string;
  description: string;
  timestamp: Date;
  user?: {
    name: string;
    email: string;
    avatar?: string;
  };
  tenant?: {
    name: string;
    id: string;
  };
  severity?: 'info' | 'warning' | 'error' | 'success';
  metadata?: Record<string, any>;
}

interface RecentActivityProps {
  className?: string;
}

// Mock data generator
function generateMockActivities(): ActivityItem[] {
  const activities: ActivityItem[] = [
    {\n      id: '1',
      type: 'user',
      action: 'user.created',
      description: 'New user registered',
      timestamp: new Date(Date.now() - 1000 * 60 * 5),
      user: { name: 'John Doe', email: 'john@example.com' },
      tenant: { name: 'Acme Corp', id: 'acme' },
      severity: 'success'
    },
    {\n      id: '2',
      type: 'security',
      action: 'auth.failed_login',
      description: 'Multiple failed login attempts detected',
      timestamp: new Date(Date.now() - 1000 * 60 * 15),
      user: { name: 'Unknown', email: 'attacker@malicious.com' },
      severity: 'error'
    },
    {\n      id: '3',
      type: 'conversation',
      action: 'conversation.created',
      description: 'New conversation started',
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
      user: { name: 'Sarah Wilson', email: 'sarah@example.com' },
      tenant: { name: 'TechStart Inc', id: 'techstart' },
      severity: 'info'
    },
    {\n      id: '4',
      type: 'tool',
      action: 'tool.invocation',
      description: 'API tool invoked successfully',
      timestamp: new Date(Date.now() - 1000 * 60 * 45),
      user: { name: 'Mike Johnson', email: 'mike@example.com' },
      tenant: { name: 'DevCorp', id: 'devcorp' },
      severity: 'success',
      metadata: { toolName: 'get_weather', duration: 1200 }
    },
    {\n      id: '5',
      type: 'billing',
      action: 'payment.processed',
      description: 'Monthly subscription payment processed',
      timestamp: new Date(Date.now() - 1000 * 60 * 60),
      tenant: { name: 'Acme Corp', id: 'acme' },
      severity: 'success',
      metadata: { amount: 99.99, currency: 'USD' }
    },
    {\n      id: '6',
      type: 'system',
      action: 'system.maintenance',
      description: 'Scheduled maintenance completed',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      severity: 'info',\n      metadata: { duration: '45 minutes', affectedServices: ['API', 'WebSocket'] }
    }
  ];

  return activities;
}

export function RecentActivity({ className }: RecentActivityProps) {
  const [activities] = useState<ActivityItem[]>(generateMockActivities());
  const [filter, setFilter] = useState<string>('all');

  const getIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'user': return User;
      case 'conversation': return MessageCircle;
      case 'tool': return Wrench;
      case 'security': return Shield;
      case 'billing': return CreditCard;
      case 'system': return RefreshCw;
      default: return Clock;
    }
  };

  const getSeverityColor = (severity: ActivityItem['severity']) => {
    switch (severity) {
      case 'success': return 'text-green-600 bg-green-100 dark:bg-green-900/20';
      case 'warning': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20';
      case 'error': return 'text-red-600 bg-red-100 dark:bg-red-900/20';
      case 'info': 
      default: return 'text-blue-600 bg-blue-100 dark:bg-blue-900/20';
    }
  };

  const getSeverityIcon = (severity: ActivityItem['severity']) => {
    switch (severity) {
      case 'success': return CheckCircle;
      case 'warning': return AlertTriangle;
      case 'error': return XCircle;
      case 'info':
      default: return Clock;
    }
  };

  const filteredActivities = activities.filter(activity => 
    filter === 'all' || activity.type === filter
  );

  const activityCounts = {
    all: activities.length,
    user: activities.filter(a => a.type === 'user').length,
    security: activities.filter(a => a.type === 'security').length,
    system: activities.filter(a => a.type === 'system').length,
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">\n          <CardTitle className="flex items-center gap-2">\n            <Clock className="h-5 w-5" />
            Recent Activity
          </CardTitle>\n          <Button variant="outline" size="sm">\n            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>\n        <Tabs value={filter} onValueChange={setFilter} className="w-full">\n          <TabsList className="grid w-full grid-cols-4">\n            <TabsTrigger value="all">
              All ({activityCounts.all})
            </TabsTrigger>\n            <TabsTrigger value="user">
              Users ({activityCounts.user})
            </TabsTrigger>\n            <TabsTrigger value="security">
              Security ({activityCounts.security})
            </TabsTrigger>\n            <TabsTrigger value="system">
              System ({activityCounts.system})
            </TabsTrigger>
          </TabsList>
\n          <TabsContent value={filter} className="mt-4">\n            <ScrollArea className="h-96">\n              <div className="space-y-3">
                {filteredActivities.length === 0 ? (\n                  <div className="text-center py-8 text-muted-foreground">\n                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No recent activities found</p>
                  </div>
                ) : (
                  filteredActivities.map((activity) => {
                    const Icon = getIcon(activity.type);
                    const SeverityIcon = getSeverityIcon(activity.severity);
                    
                    return (
                      <div
                        key={activity.id}\n                        className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className={`p-2 rounded-full ${getSeverityColor(activity.severity)}`}>\n                          <Icon className="h-4 w-4" />
                        </div>
                        \n                        <div className="flex-1 space-y-1">\n                          <div className="flex items-center justify-between">\n                            <div className="flex items-center gap-2">\n                              <p className="text-sm font-medium">{activity.description}</p>\n                              <Badge variant="outline" className="text-xs">
                                {activity.type}
                              </Badge>
                            </div>\n                            <div className="flex items-center gap-1 text-xs text-muted-foreground">\n                              <SeverityIcon className="h-3 w-3" />
                              {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                            </div>
                          </div>
                          
                          {activity.user && (\n                            <p className="text-xs text-muted-foreground">
                              User: {activity.user.name} ({activity.user.email})
                            </p>
                          )}
                          
                          {activity.tenant && (\n                            <p className="text-xs text-muted-foreground">
                              Tenant: {activity.tenant.name}
                            </p>
                          )}
                          
                          {activity.metadata && Object.keys(activity.metadata).length > 0 && (\n                            <div className="text-xs text-muted-foreground">
                              {Object.entries(activity.metadata).map(([key, value]) => (\n                                <span key={key} className="mr-3">
                                  {key}: {String(value)}
                                </span>
                              ))}
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