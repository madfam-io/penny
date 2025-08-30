import { Suspense } from 'react';\nimport { WebhooksTable } from '@/components/webhooks/WebhooksTable';\nimport { WebhookFilters } from '@/components/webhooks/WebhookFilters';\nimport { WebhookStats } from '@/components/webhooks/WebhookStats';\nimport { CreateWebhookDialog } from '@/components/webhooks/CreateWebhookDialog';\nimport { WebhookTester } from '@/components/webhooks/WebhookTester';\nimport { Breadcrumbs } from '@/components/layout/Breadcrumbs';\nimport { LoadingSpinner } from '@/components/ui/LoadingSpinner';\nimport { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';\nimport { Button } from '@/components/ui/button';
import { Webhook, Plus, Download, RefreshCw, Settings, Filter, TestTube } from 'lucide-react';\nimport { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function WebhooksPage() {
  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Webhooks' }
  ];

  return (
    <div className="space-y-6">\n      <div className="flex items-center justify-between">
        <div>
          <Breadcrumbs items={breadcrumbItems} />\n          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mt-2">
            Webhook Management
          </h1>\n          <p className="text-muted-foreground">
            Configure and monitor webhooks for external integrations
          </p>
        </div>\n        <div className="flex items-center gap-2">
          <CreateWebhookDialog />\n          <Button variant="outline" size="sm">\n            <Download className="h-4 w-4 mr-2" />
            Export Logs
          </Button>\n          <Button variant="outline" size="sm">\n            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>\n          <Button variant="outline" size="sm">\n            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Webhook Statistics */}
      <Suspense fallback={<LoadingSpinner />}>
        <WebhookStats />
      </Suspense>
\n      <Tabs defaultValue="webhooks" className="space-y-6">\n        <TabsList className="grid w-full grid-cols-3">\n          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>\n          <TabsTrigger value="logs">Delivery Logs</TabsTrigger>\n          <TabsTrigger value="tester">Webhook Tester</TabsTrigger>
        </TabsList>
\n        <TabsContent value="webhooks" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardHeader>\n              <CardTitle className="flex items-center gap-2">\n                <Filter className="h-4 w-4" />
                Webhook Filters
              </CardTitle>
            </CardHeader>
            <CardContent>\n              <Suspense fallback={<div className="h-16 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />}>
                <WebhookFilters />
              </Suspense>
            </CardContent>
          </Card>

          {/* Webhooks Table */}
          <Card>
            <CardHeader>\n              <CardTitle className="flex items-center gap-2">\n                <Webhook className="h-4 w-4" />
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
\n        <TabsContent value="logs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Webhook Delivery Logs</CardTitle>
            </CardHeader>
            <CardContent>\n              <div className="text-center py-8 text-muted-foreground">\n                <Webhook className="h-12 w-12 mx-auto mb-4 opacity-50" />\n                <h3 className="text-lg font-medium mb-2">Delivery Logs</h3>
                <p>View webhook delivery attempts, responses, and retry history</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
\n        <TabsContent value="tester" className="space-y-6">
          <Card>
            <CardHeader>\n              <CardTitle className="flex items-center gap-2">\n                <TestTube className="h-4 w-4" />
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