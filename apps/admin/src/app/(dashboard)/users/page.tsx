'use client';

import { useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,\n} from '@penny/ui';
import { Plus, Search, Upload, Download } from 'lucide-react';\nimport { UsersTable } from '@/components/users/users-table';\nimport { InviteUserDialog } from '@/components/users/invite-user-dialog';\nimport { BulkImportDialog } from '@/components/users/bulk-import-dialog';

export default function UsersPage() {\n  const [searchQuery, setSearchQuery] = useState('');
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

  return (
    <div className="space-y-8">\n      <div className="flex items-center justify-between">
        <div>\n          <h1 className="text-3xl font-bold tracking-tight">Users</h1>\n          <p className="text-muted-foreground">Manage users across all tenants and workspaces</p>
        </div>\n        <div className="flex space-x-2">\n          <Button variant="outline" onClick={() => setIsBulkImportOpen(true)}>\n            <Upload className="mr-2 h-4 w-4" />
            Bulk Import
          </Button>
          <Button onClick={() => setIsInviteOpen(true)}>\n            <Plus className="mr-2 h-4 w-4" />
            Invite User
          </Button>
        </div>
      </div>
\n      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>\n          <TabsTrigger value="all">All Users</TabsTrigger>\n          <TabsTrigger value="active">Active</TabsTrigger>\n          <TabsTrigger value="pending">Pending</TabsTrigger>\n          <TabsTrigger value="suspended">Suspended</TabsTrigger>
        </TabsList>

        <Card>
          <CardHeader>\n            <div className="flex items-center justify-between">
              <div>
                <CardTitle>User Directory</CardTitle>
                <CardDescription>View and manage all users on the platform</CardDescription>
              </div>\n              <Button variant="outline" size="sm">\n                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </CardHeader>
          <CardContent>\n            <div className="mb-4 relative">\n              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input\n                placeholder="Search users by name, email, or tenant..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}\n                className="pl-8"
              />
            </div>
\n            <TabsContent value="all">\n              <UsersTable searchQuery={searchQuery} status="all" />
            </TabsContent>\n            <TabsContent value="active">\n              <UsersTable searchQuery={searchQuery} status="active" />
            </TabsContent>\n            <TabsContent value="pending">\n              <UsersTable searchQuery={searchQuery} status="pending" />
            </TabsContent>\n            <TabsContent value="suspended">\n              <UsersTable searchQuery={searchQuery} status="suspended" />
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>

      <InviteUserDialog open={isInviteOpen} onOpenChange={setIsInviteOpen} />

      <BulkImportDialog open={isBulkImportOpen} onOpenChange={setIsBulkImportOpen} />
    </div>
  );
}
