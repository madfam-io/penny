import { Suspense } from 'react';
import { WebhooksTable } from '@/components/webhooks/WebhooksTable';
import { WebhookFilters } from '@/components/webhooks/WebhookFilters';
import { WebhookStats } from '@/components/webhooks/WebhookStats';
import { CreateWebhookDialog } from '@/components/webhooks/CreateWebhookDialog';
import { WebhookTester } from '@/components/webhooks/WebhookTester';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Webhook, Plus, Download, RefreshCw, Settings, Filter, TestTube } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function WebhooksPage() {
  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Webhooks' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumbs items={breadcrumbItems} />
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mt-2">
            Webhook Management
          </h1>
          <p className="text-muted-foreground">
            Configure and monitor webhooks for external integrations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CreateWebhookDialog />
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Logs
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Webhook Statistics */}
      <Suspense fallback={<LoadingSpinner />}>
        <WebhookStats />
      </Suspense>

      <Tabs defaultValue="webhooks" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="logs">Delivery Logs</TabsTrigger>
          <TabsTrigger value="tester">Webhook Tester</TabsTrigger>
        </TabsList>

        <TabsContent value="webhooks" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Webhook Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<div className="h-16 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />}>
                <WebhookFilters />
              </Suspense>
            </CardContent>
          </Card>

          {/* Webhooks Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-4 w-4" />
                Configured Webhooks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<LoadingSpinner />}>
                <WebhooksTable />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Webhook Delivery Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Webhook className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Delivery Logs</h3>
                <p>View webhook delivery attempts, responses, and retry history</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tester" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-4 w-4" />
                Webhook Tester
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<LoadingSpinner />}>
                <WebhookTester />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}