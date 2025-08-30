import { Suspense } from 'react';\nimport { SystemSettings } from '@/components/settings/SystemSettings';\nimport { SecuritySettings } from '@/components/settings/SecuritySettings';\nimport { EmailSettings } from '@/components/settings/EmailSettings';\nimport { IntegrationSettings } from '@/components/settings/IntegrationSettings';\nimport { MaintenanceMode } from '@/components/settings/MaintenanceMode';\nimport { BackupSettings } from '@/components/settings/BackupSettings';\nimport { Breadcrumbs } from '@/components/layout/Breadcrumbs';\nimport { LoadingSpinner } from '@/components/ui/LoadingSpinner';\nimport { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Shield, Mail, Plug, Wrench, Database, Save } from 'lucide-react';\nimport { Button } from '@/components/ui/button';

export default function SettingsPage() {
  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'System Settings' }
  ];

  return (
    <div className="space-y-6">\n      <div className="flex items-center justify-between">
        <div>
          <Breadcrumbs items={breadcrumbItems} />\n          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mt-2">
            System Settings
          </h1>\n          <p className="text-muted-foreground">
            Configure platform-wide settings and preferences
          </p>
        </div>\n        <div className="flex items-center gap-2">\n          <Button variant="outline" size="sm">\n            <Database className="h-4 w-4 mr-2" />
            Backup Settings
          </Button>\n          <Button size="sm">\n            <Save className="h-4 w-4 mr-2" />
            Save All Changes
          </Button>
        </div>
      </div>
\n      <Tabs defaultValue="general" className="space-y-6">\n        <TabsList className="grid w-full grid-cols-6">\n          <TabsTrigger value="general">General</TabsTrigger>\n          <TabsTrigger value="security">Security</TabsTrigger>\n          <TabsTrigger value="email">Email</TabsTrigger>\n          <TabsTrigger value="integrations">Integrations</TabsTrigger>\n          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>\n          <TabsTrigger value="backup">Backup</TabsTrigger>
        </TabsList>
\n        <TabsContent value="general">
          <Suspense fallback={<LoadingSpinner />}>
            <SystemSettings />
          </Suspense>
        </TabsContent>
\n        <TabsContent value="security">
          <Suspense fallback={<LoadingSpinner />}>
            <SecuritySettings />
          </Suspense>
        </TabsContent>
\n        <TabsContent value="email">
          <Suspense fallback={<LoadingSpinner />}>
            <EmailSettings />
          </Suspense>
        </TabsContent>
\n        <TabsContent value="integrations">
          <Suspense fallback={<LoadingSpinner />}>
            <IntegrationSettings />
          </Suspense>
        </TabsContent>
\n        <TabsContent value="maintenance">
          <Suspense fallback={<LoadingSpinner />}>
            <MaintenanceMode />
          </Suspense>
        </TabsContent>
\n        <TabsContent value="backup">
          <Suspense fallback={<LoadingSpinner />}>
            <BackupSettings />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}