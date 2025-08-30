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
} from '@penny/ui';
import { Plus, Search } from 'lucide-react';
import { PageErrorBoundary, TableErrorBoundary, FormErrorBoundary } from '@/components/error-boundaries';
import { TenantsTable } from '@/components/tenants/tenants-table';
import { CreateTenantDialog } from '@/components/tenants/create-tenant-dialog';

function TenantsPageContent() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleRefreshTable = () => {
    // This would typically trigger a refetch of tenant data
    window.location.reload();
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tenants</h1>
          <p className="text-muted-foreground">Manage tenant organizations and their settings</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
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
        <CardContent>
          <div className="mb-4 relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tenants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <TableErrorBoundary 
            tableName="Tenants" 
            onRefresh={handleRefreshTable}
            colSpan={6}
          >
            <TenantsTable searchQuery={searchQuery} />
          </TableErrorBoundary>
        </CardContent>
      </Card>

      <FormErrorBoundary 
        formName="Create Tenant Dialog"
        onReset={() => setIsCreateOpen(false)}
      >
        <CreateTenantDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      </FormErrorBoundary>
    </div>
  );
}

export default function TenantsPage() {
  return (
    <PageErrorBoundary pageName="Tenants">
      <TenantsPageContent />
    </PageErrorBoundary>
  );
}
