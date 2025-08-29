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
  TabsTrigger,
} from '@penny/ui';
import { Plus, Search, Upload, Download } from 'lucide-react';
import { UsersTable } from '@/components/users/users-table';
import { InviteUserDialog } from '@/components/users/invite-user-dialog';
import { BulkImportDialog } from '@/components/users/bulk-import-dialog';

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">Manage users across all tenants and workspaces</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => setIsBulkImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Bulk Import
          </Button>
          <Button onClick={() => setIsInviteOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Invite User
          </Button>
        </div>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Users</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="suspended">Suspended</TabsTrigger>
        </TabsList>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>User Directory</CardTitle>
                <CardDescription>View and manage all users on the platform</CardDescription>
              </div>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users by name, email, or tenant..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>

            <TabsContent value="all">
              <UsersTable searchQuery={searchQuery} status="all" />
            </TabsContent>
            <TabsContent value="active">
              <UsersTable searchQuery={searchQuery} status="active" />
            </TabsContent>
            <TabsContent value="pending">
              <UsersTable searchQuery={searchQuery} status="pending" />
            </TabsContent>
            <TabsContent value="suspended">
              <UsersTable searchQuery={searchQuery} status="suspended" />
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>

      <InviteUserDialog open={isInviteOpen} onOpenChange={setIsInviteOpen} />

      <BulkImportDialog open={isBulkImportOpen} onOpenChange={setIsBulkImportOpen} />
    </div>
  );
}
