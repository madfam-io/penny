import { Suspense } from 'react';
import { ToolsRegistry } from '@/components/tools/ToolsRegistry';
import { ToolFilters } from '@/components/tools/ToolFilters';
import { ToolStats } from '@/components/tools/ToolStats';
import { CreateToolDialog } from '@/components/tools/CreateToolDialog';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wrench, Plus, Download, RefreshCw, Settings, Filter } from 'lucide-react';

export default function ToolsPage() {
  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Tools Registry' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumbs items={breadcrumbItems} />
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mt-2">
            Tools Registry
          </h1>
          <p className="text-muted-foreground">
            Manage tools, functions, and integrations available to users
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CreateToolDialog />
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Registry
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Registry Settings
          </Button>
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tool Statistics */}
      <Suspense fallback={<LoadingSpinner />}>
        <ToolStats />
      </Suspense>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Tool Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="h-16 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />}>
            <ToolFilters />
          </Suspense>
        </CardContent>
      </Card>

      {/* Tools Registry Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Registered Tools
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<LoadingSpinner />}>
            <ToolsRegistry />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}