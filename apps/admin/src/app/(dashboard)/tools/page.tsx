import { Suspense } from 'react';\nimport { ToolsRegistry } from '@/components/tools/ToolsRegistry';\nimport { ToolFilters } from '@/components/tools/ToolFilters';\nimport { ToolStats } from '@/components/tools/ToolStats';\nimport { CreateToolDialog } from '@/components/tools/CreateToolDialog';\nimport { Breadcrumbs } from '@/components/layout/Breadcrumbs';\nimport { LoadingSpinner } from '@/components/ui/LoadingSpinner';\nimport { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';\nimport { Button } from '@/components/ui/button';
import { Wrench, Plus, Download, RefreshCw, Settings, Filter } from 'lucide-react';

export default function ToolsPage() {
  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Tools Registry' }
  ];

  return (
    <div className="space-y-6">\n      <div className="flex items-center justify-between">
        <div>
          <Breadcrumbs items={breadcrumbItems} />\n          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mt-2">
            Tools Registry
          </h1>\n          <p className="text-muted-foreground">
            Manage tools, functions, and integrations available to users
          </p>
        </div>\n        <div className="flex items-center gap-2">
          <CreateToolDialog />\n          <Button variant="outline" size="sm">\n            <Download className="h-4 w-4 mr-2" />
            Export Registry
          </Button>\n          <Button variant="outline" size="sm">\n            <Settings className="h-4 w-4 mr-2" />
            Registry Settings
          </Button>\n          <Button variant="outline" size="sm">\n            <RefreshCw className="h-4 w-4 mr-2" />
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
        <CardHeader>\n          <CardTitle className="flex items-center gap-2">\n            <Filter className="h-4 w-4" />
            Tool Filters
          </CardTitle>
        </CardHeader>
        <CardContent>\n          <Suspense fallback={<div className="h-16 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />}>
            <ToolFilters />
          </Suspense>
        </CardContent>
      </Card>

      {/* Tools Registry Table */}
      <Card>
        <CardHeader>\n          <CardTitle className="flex items-center gap-2">\n            <Wrench className="h-4 w-4" />
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