import { Suspense } from 'react';\nimport { ConversationsTable } from '@/components/conversations/ConversationsTable';\nimport { ConversationFilters } from '@/components/conversations/ConversationFilters';\nimport { ConversationStats } from '@/components/conversations/ConversationStats';\nimport { Breadcrumbs } from '@/components/layout/Breadcrumbs';\nimport { LoadingSpinner } from '@/components/ui/LoadingSpinner';\nimport { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';\nimport { Button } from '@/components/ui/button';
import { MessageCircle, Download, RefreshCw, Search, Filter } from 'lucide-react';

export default function ConversationsPage() {
  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Conversations' }
  ];

  return (
    <div className="space-y-6">\n      <div className="flex items-center justify-between">
        <div>
          <Breadcrumbs items={breadcrumbItems} />\n          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mt-2">
            Conversation Monitoring
          </h1>\n          <p className="text-muted-foreground">
            Monitor and manage all conversations across your platform
          </p>
        </div>\n        <div className="flex items-center gap-2">\n          <Button variant="outline" size="sm">\n            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>\n          <Button variant="outline" size="sm">\n            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Statistics Overview */}
      <Suspense fallback={<LoadingSpinner />}>
        <ConversationStats />
      </Suspense>

      {/* Filters and Search */}
      <Card>
        <CardHeader>\n          <CardTitle className="flex items-center gap-2">\n            <Filter className="h-4 w-4" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>\n          <Suspense fallback={<div className="h-16 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />}>
            <ConversationFilters />
          </Suspense>
        </CardContent>
      </Card>

      {/* Conversations Table */}
      <Card>
        <CardHeader>\n          <CardTitle className="flex items-center gap-2">\n            <MessageCircle className="h-4 w-4" />
            All Conversations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<LoadingSpinner />}>
            <ConversationsTable />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}