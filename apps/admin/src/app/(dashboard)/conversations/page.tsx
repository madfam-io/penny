import { Suspense } from 'react';
import { ConversationsTable } from '@/components/conversations/ConversationsTable';
import { ConversationFilters } from '@/components/conversations/ConversationFilters';
import { ConversationStats } from '@/components/conversations/ConversationStats';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle, Download, RefreshCw, Search, Filter } from 'lucide-react';

export default function ConversationsPage() {
  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Conversations' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumbs items={breadcrumbItems} />\n          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mt-2">
            Conversation Monitoring
          </h1>\n          <p className="text-muted-foreground">
            Monitor and manage all conversations across your platform
          </p>
        </div>\n        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">\n            <Download className="h-4 w-4 mr-2" />
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
        <CardHeader>\n          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
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
        <CardHeader>\n          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
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