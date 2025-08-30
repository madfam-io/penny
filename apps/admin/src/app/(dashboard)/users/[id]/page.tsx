import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { UserDetail } from '@/components/users/UserDetail';
import { UserActions } from '@/components/users/UserActions';
import { UserActivityLog } from '@/components/users/UserActivityLog';
import { UserSubscriptions } from '@/components/users/UserSubscriptions';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit, Shield, Trash2, UserCheck } from 'lucide-react';
import Link from 'next/link';

interface UserDetailPageProps {
  params: {
    id: string;
  };
}

// Mock data - replace with actual API call
async function getUserById(id: string) {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100));
 
 if (id === '999') {
    return null;
  }
  
  return {
    id,
    name: 'John Doe',
    email: 'john.doe@example.com',
    role: 'admin',
    status: 'active',
    tenantId: 'tenant-1',
    tenantName: 'Acme Corp',\n    createdAt: new Date('2024-01-15'),\n    lastLoginAt: new Date('2024-08-28'),
    emailVerified: true,
    mfaEnabled: true,
    avatar: null,
    metadata: {
      department: 'Engineering',
      jobTitle: 'Senior Developer',
      location: 'San Francisco, CA'
    }
  };
}

export default async function UserDetailPage({ params }: UserDetailPageProps) {
  const user = await getUserById(params.id);
  
  if (!user) {
    notFound();
  }

  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Users', href: '/users' },
    { label: user.name }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'suspended': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-800';
      case 'manager': return 'bg-blue-100 text-blue-800';
      case 'creator': return 'bg-green-100 text-green-800';
      case 'viewer': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumbs items={breadcrumbItems} />\n          <div className="flex items-center gap-4 mt-4">
            <Button variant="ghost" size="sm" asChild>\n              <Link href="/users" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Users
              </Link>
            </Button>\n            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                {user.name}
              </h1>
              <Badge className={getStatusColor(user.status)}>
                {user.status}
              </Badge>
              <Badge className={getRoleColor(user.role)}>
                {user.role}
              </Badge>
            </div>
          </div>
        </div>\n        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">\n            <Edit className="h-4 w-4 mr-2" />
            Edit User
          </Button>\n          <Button variant="outline" size="sm">\n            <Shield className="h-4 w-4 mr-2" />
            Reset Password
          </Button>\n          <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete User
          </Button>
        </div>
      </div>
\n      <Tabs defaultValue="details" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">\n          <TabsTrigger value="details">Details</TabsTrigger>\n          <TabsTrigger value="activity">Activity Log</TabsTrigger>\n          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>\n          <TabsTrigger value="permissions">Permissions</TabsTrigger>
        </TabsList>
\n        <TabsContent value="details">\n          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Suspense fallback={<LoadingSpinner />}>
                <UserDetail user={user} />
              </Suspense>
            </div>\n            <div className="space-y-6">
              <Card>
                <CardHeader>\n                  <CardTitle className="text-lg">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <UserActions userId={user.id} />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>\n                  <CardTitle className="text-lg">Security</CardTitle>
                </CardHeader>\n                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">\n                    <span className="text-sm">Email Verified</span>
                    <div className="flex items-center gap-2">
                      {user.emailVerified ? (
                        <>\n                          <UserCheck className="h-4 w-4 text-green-600" />
                          <span className="text-green-600 text-sm">Verified</span>
                        </>
                      ) : (
                        <>\n                          <Shield className="h-4 w-4 text-red-600" />
                          <span className="text-red-600 text-sm">Not Verified</span>
                        </>
                      )}
                    </div>
                  </div>
                 
                 <div className="flex items-center justify-between">
                    <span className="text-sm">MFA Enabled</span>\n                    <div className="flex items-center gap-2">
                      {user.mfaEnabled ? (
                        <>\n                          <Shield className="h-4 w-4 text-green-600" />
                          <span className="text-green-600 text-sm">Enabled</span>
                        </>
                      ) : (
                        <>\n                          <Shield className="h-4 w-4 text-yellow-600" />
                          <span className="text-yellow-600 text-sm">Disabled</span>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
\n        <TabsContent value="activity">
          <Suspense fallback={<LoadingSpinner />}>
            <UserActivityLog userId={user.id} />
          </Suspense>
        </TabsContent>
\n        <TabsContent value="subscriptions">
          <Suspense fallback={<LoadingSpinner />}>
            <UserSubscriptions userId={user.id} />
          </Suspense>
        </TabsContent>
\n        <TabsContent value="permissions">
          <Card>
            <CardHeader>
              <CardTitle>User Permissions</CardTitle>
            </CardHeader>
            <CardContent>\n              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>\n                    <h3 className="font-medium mb-2">Tenant Access</h3>
                    <div className="space-y-2">\n                      <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                        <span className="text-sm">{user.tenantName}</span>
                        <Badge className={getRoleColor(user.role)}>{user.role}</Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div>\n                    <h3 className="font-medium mb-2">System Permissions</h3>
                    <div className="space-y-2">\n                      <div className="flex items-center justify-between text-sm">
                        <span>User Management</span>\n                        <span className="text-green-600">✓</span>
                      </div>\n                      <div className="flex items-center justify-between text-sm">
                        <span>Billing Access</span>\n                        <span className="text-green-600">✓</span>
                      </div>\n                      <div className="flex items-center justify-between text-sm">
                        <span>System Settings</span>\n                        <span className="text-red-600">✗</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}