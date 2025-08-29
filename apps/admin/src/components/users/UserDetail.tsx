'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  User, 
  Mail, 
  Calendar, 
  MapPin, 
  Building, 
  UserCheck,
  Clock,
  Edit
} from 'lucide-react';
import { format } from 'date-fns';

interface UserDetailProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    tenantId: string;
    tenantName: string;
    createdAt: Date;
    lastLoginAt: Date;
    emailVerified: boolean;
    mfaEnabled: boolean;
    avatar?: string | null;
    metadata?: {
      department?: string;
      jobTitle?: string;
      location?: string;
    };
  };
}

export function UserDetail({ user }: UserDetailProps) {
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/20';
      case 'inactive': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20';
      case 'suspended': return 'bg-red-100 text-red-800 dark:bg-red-900/20';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20';
      case 'manager': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20';
      case 'creator': return 'bg-green-100 text-green-800 dark:bg-green-900/20';
      case 'viewer': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <CardTitle>User Profile</CardTitle>
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-2" />
              Edit Profile
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={user.avatar || undefined} alt={user.name} />
              <AvatarFallback className="text-lg font-semibold">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-semibold">{user.name}</h2>
                <Badge className={getStatusColor(user.status)}>
                  {user.status}
                </Badge>
                <Badge className={getRoleColor(user.role)}>
                  {user.role}
                </Badge>
              </div>
              
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>{user.email}</span>
                {user.emailVerified && (
                  <Badge variant="outline" className="ml-2">
                    <UserCheck className="h-3 w-3 mr-1" />
                    Verified
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building className="h-4 w-4" />
                <span>{user.tenantName}</span>
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-medium text-lg">Account Information</h3>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Created:</span>
                  <span>{format(user.createdAt, 'MMM d, yyyy')}</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Last Login:</span>
                  <span>{format(user.lastLoginAt, 'MMM d, yyyy \'at\' h:mm a')}</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">User ID:</span>
                  <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                    {user.id}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-medium text-lg">Additional Details</h3>
              
              <div className="space-y-3">
                {user.metadata?.jobTitle && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Job Title:</span>
                    <span>{user.metadata.jobTitle}</span>
                  </div>
                )}
                
                {user.metadata?.department && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Department:</span>
                    <span>{user.metadata.department}</span>
                  </div>
                )}
                
                {user.metadata?.location && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Location:</span>
                    <span>{user.metadata.location}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">127</div>
              <div className="text-sm text-muted-foreground">Conversations</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">1,543</div>
              <div className="text-sm text-muted-foreground">Messages Sent</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">89</div>
              <div className="text-sm text-muted-foreground">Tools Used</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}