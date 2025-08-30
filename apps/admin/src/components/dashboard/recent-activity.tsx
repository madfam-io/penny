'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@penny/ui';
import { formatDistanceToNow } from 'date-fns';

const activities = [
  {
    id: 1,
    user: {
      name: 'John Doe',
      email: 'john@example.com',
      avatar: null,
    },
    action: 'created a new workspace',
    target: 'Marketing Team',
    timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
  },
  {
    id: 2,
    user: {
      name: 'Jane Smith',
      email: 'jane@example.com',
      avatar: null,
    },
    action: 'invited 3 users to',
    target: 'Engineering Workspace',
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
  },
  {
    id: 3,
    user: {
      name: 'Bob Johnson',
      email: 'bob@example.com',
      avatar: null,
    },
    action: 'upgraded subscription to',
    target: 'Enterprise Plan',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
  },
  {
    id: 4,
    user: {
      name: 'Alice Brown',
      email: 'alice@example.com',
      avatar: null,
    },
    action: 'configured SSO for',
    target: 'Acme Corp',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
  },
  {
    id: 5,
    user: {
      name: 'Charlie Wilson',
      email: 'charlie@example.com',
      avatar: null,
    },
    action: 'enabled 2FA for',
    target: 'all users',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
  },
];

export function RecentActivity() {
  return (
    <div className="space-y-8">
      {activities.map((activity) => (\n        <div key={activity.id} className="flex items-center">
          <Avatar className="h-9 w-9">\n            <AvatarImage src={activity.user.avatar || ''} alt={activity.user.name} />
            <AvatarFallback>
              {activity.user.name\n                .split(' ')
                .map((n) => n[0])
                .join('')}
            </AvatarFallback>
          </Avatar>\n          <div className="ml-4 space-y-1">
            <p className="text-sm font-medium leading-none">{activity.user.name}</p>\n            <p className="text-sm text-muted-foreground">
              {activity.action} <span className="font-medium">{activity.target}</span>
            </p>
          </div>\n          <div className="ml-auto font-medium text-sm text-muted-foreground">
            {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
          </div>
        </div>
      ))}
    </div>
  );
}
