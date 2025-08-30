import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { TenantDetail } from '@/components/tenants/TenantDetail';
import { TenantUsers } from '@/components/tenants/TenantUsers';
import { TenantBilling } from '@/components/tenants/TenantBilling';
import { TenantSettings } from '@/components/tenants/TenantSettings';
import { TenantUsage } from '@/components/tenants/TenantUsage';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { LoadingSpinner } from '@penny/ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@penny/ui';
import { Card, CardContent, CardHeader, CardTitle } from '@penny/ui';
import { Badge } from '@penny/ui';
import { Button } from '@penny/ui';
import { ArrowLeft, Edit, Settings, Trash2, Users, CreditCard, BarChart3 } from 'lucide-react';
import Link from 'next/link';

interface TenantDetailPageProps {
  params: {
    id: string;
  };
}

// Mock data - replace with actual API call
async function getTenantById(id: string) {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100));
 
 if (id === '999') {
    return null;
  }
  
  return {
    id,
    name: 'Acme Corporation',
    slug: 'acme-corp',
    domain: 'acme.com',
    status: 'active',
    plan: 'enterprise',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-08-28'),
    userCount: 45,
    maxUsers: 100,
    billingEmail: 'billing@acme.com',
    adminEmail: 'admin@acme.com',
    settings: {
      allowSignups: false,
      requireEmailVerification: true,
      enableMFA: true,
      maxFileSize: 100,
      retentionDays: 90
    },
    usage: {
      storageUsed: 2.4,
      storageLimit: 10,
      apiCalls: 12450,
      apiLimit: 50000,
      messagesThisMonth: 1250
    },
    billing: {
      nextBillingDate: new Date('2024-09-15'),
      monthlyRevenue: 2500,
      totalRevenue: 15000
    }
  };
}

export default async function TenantDetailPage({ params }: TenantDetailPageProps) {
  const tenant = await getTenantById(params.id);
  
  if (!tenant) {
    notFound();
  }

  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Tenants', href: '/tenants' },
    { label: tenant.name }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'suspended': return 'bg-red-100 text-red-800';
      case 'trial': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'enterprise': return 'bg-purple-100 text-purple-800';
      case 'professional': return 'bg-blue-100 text-blue-800';
      case 'starter': return 'bg-green-100 text-green-800';
      case 'trial': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumbs items={breadcrumbItems} />
          <div className="flex items-center gap-4 mt-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/tenants" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Tenants
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                {tenant.name}
              </h1>
              <Badge className={getStatusColor(tenant.status)}>
                {tenant.status}
              </Badge>
              <Badge className={getPlanColor(tenant.plan)}>
                {tenant.plan}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-2" />
            Edit Tenant
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Tenant
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div className="ml-2">
                <p className="text-sm font-medium leading-none">Users</p>
                <p className="text-2xl font-bold">{tenant.userCount}</p>
                <p className="text-xs text-muted-foreground">
                  of {tenant.maxUsers} limit
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <div className="ml-2">
                <p className="text-sm font-medium leading-none">Storage</p>
                <p className="text-2xl font-bold">{tenant.usage.storageUsed}GB</p>
                <p className="text-xs text-muted-foreground">
                  of {tenant.usage.storageLimit}GB
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <div className="ml-2">
                <p className="text-sm font-medium leading-none">Monthly Revenue</p>
                <p className="text-2xl font-bold">${tenant.billing.monthlyRevenue}</p>
                <p className="text-xs text-muted-foreground">
                  ${tenant.billing.totalRevenue} total
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <div className="ml-2">
                <p className="text-sm font-medium leading-none">API Calls</p>
                <p className="text-2xl font-bold">{tenant.usage.apiCalls.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">
                  of {tenant.usage.apiLimit.toLocaleString()} limit
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="details" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="usage">Usage & Analytics</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Suspense fallback={<LoadingSpinner />}>
            <TenantDetail tenant={tenant} />
          </Suspense>
        </TabsContent>

        <TabsContent value="users">
          <Suspense fallback={<LoadingSpinner />}>
            <TenantUsers tenantId={tenant.id} />
          </Suspense>
        </TabsContent>

        <TabsContent value="usage">
          <Suspense fallback={<LoadingSpinner />}>
            <TenantUsage tenantId={tenant.id} usage={tenant.usage} />
          </Suspense>
        </TabsContent>

        <TabsContent value="billing">
          <Suspense fallback={<LoadingSpinner />}>
            <TenantBilling tenantId={tenant.id} billing={tenant.billing} />
          </Suspense>
        </TabsContent>

        <TabsContent value="settings">
          <Suspense fallback={<LoadingSpinner />}>
            <TenantSettings tenantId={tenant.id} settings={tenant.settings} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}