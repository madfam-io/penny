import { Suspense } from 'react';
import { AuditLogTable } from '@/components/audit/AuditLogTable';
import { AuditFilters } from '@/components/audit/AuditFilters';
import { AuditStats } from '@/components/audit/AuditStats';
import { AuditExport } from '@/components/audit/AuditExport';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { LoadingSpinner } from '@penny/uiLoadingSpinner';
import { Card, CardContent, CardHeader, CardTitle } from '@penny/ui';
import { Button } from '@penny/ui';
import { Shield, Download, RefreshCw, Search, Filter, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@penny/ui';

export default function AuditLogPage() {
  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Audit Logs' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumbs items={breadcrumbItems} />
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mt-2">
            Audit Log Viewer
          </h1>
          <p className="text-muted-foreground">
            Monitor security events, user actions, and system changes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AuditExport />
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Security Alert */}
      <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/10">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <AlertTitle className="text-yellow-800 dark:text-yellow-200">
          Security Notice
        </AlertTitle>
        <AlertDescription className="text-yellow-700 dark:text-yellow-300">
          3 suspicious login attempts detected in the last 24 hours.
         <Button variant="link" className="h-auto p-0 ml-1 text-yellow-800 dark:text-yellow-200">
            View Details →
          </Button>
        </AlertDescription>
      </Alert>

      {/* Audit Statistics */}
      <Suspense fallback={<LoadingSpinner />}>
        <AuditStats />
      </Suspense>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="h-20 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />}>
            <AuditFilters />
          </Suspense>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Audit Events
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<LoadingSpinner />}>
            <AuditLogTable />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}