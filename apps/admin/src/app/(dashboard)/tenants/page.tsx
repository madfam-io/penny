'use client';

import { useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,\n} from '@penny/ui';
import { Plus, Search } from 'lucide-react';\nimport { TenantsTable } from '@/components/tenants/tenants-table';\nimport { CreateTenantDialog } from '@/components/tenants/create-tenant-dialog';

export default function TenantsPage() {\n  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <div className="space-y-8">\n      <div className="flex items-center justify-between">
        <div>\n          <h1 className="text-3xl font-bold tracking-tight">Tenants</h1>\n          <p className="text-muted-foreground">Manage tenant organizations and their settings</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>\n          <Plus className="mr-2 h-4 w-4" />
          Create Tenant
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Tenants</CardTitle>
          <CardDescription>
            View and manage all tenant organizations on the platform
          </CardDescription>
        </CardHeader>
        <CardContent>\n          <div className="mb-4 relative">\n            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input\n              placeholder="Search tenants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}\n              className="pl-8"
            />
          </div>
          <TenantsTable searchQuery={searchQuery} />
        </CardContent>
      </Card>

      <CreateTenantDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </div>
  );
}
