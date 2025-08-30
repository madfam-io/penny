import { Suspense } from 'react';
import { SystemSettings } from '@/components/settings/SystemSettings';
import { SecuritySettings } from '@/components/settings/SecuritySettings';
import { EmailSettings } from '@/components/settings/EmailSettings';
import { IntegrationSettings } from '@/components/settings/IntegrationSettings';
import { MaintenanceMode } from '@/components/settings/MaintenanceMode';
import { BackupSettings } from '@/components/settings/BackupSettings';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { LoadingSpinner } from '@penny/ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@penny/ui';
import { Settings, Shield, Mail, Plug, Wrench, Database, Save } from 'lucide-react';
import { Button } from '@penny/ui';

export default function SettingsPage() {
  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'System Settings' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumbs items={breadcrumbItems} />
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mt-2">
            System Settings
          </h1>
          <p className="text-muted-foreground">
            Configure platform-wide settings and preferences
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Database className="h-4 w-4 mr-2" />
            Backup Settings
          </Button>
          <Button size="sm">
            <Save className="h-4 w-4 mr-2" />
            Save All Changes
          </Button>
        </div>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="backup">Backup</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Suspense fallback={<LoadingSpinner />}>
            <SystemSettings />
          </Suspense>
        </TabsContent>

        <TabsContent value="security">
          <Suspense fallback={<LoadingSpinner />}>
            <SecuritySettings />
          </Suspense>
        </TabsContent>

        <TabsContent value="email">
          <Suspense fallback={<LoadingSpinner />}>
            <EmailSettings />
          </Suspense>
        </TabsContent>

        <TabsContent value="integrations">
          <Suspense fallback={<LoadingSpinner />}>
            <IntegrationSettings />
          </Suspense>
        </TabsContent>

        <TabsContent value="maintenance">
          <Suspense fallback={<LoadingSpinner />}>
            <MaintenanceMode />
          </Suspense>
        </TabsContent>

        <TabsContent value="backup">
          <Suspense fallback={<LoadingSpinner />}>
            <BackupSettings />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}