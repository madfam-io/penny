'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Badge,
  Button,\n} from '@penny/ui';
import { DollarSign, TrendingUp, CreditCard, FileText, Download } from 'lucide-react';\nimport { RevenueChart } from '@/components/billing/revenue-chart';\nimport { SubscriptionsTable } from '@/components/billing/subscriptions-table';\nimport { InvoicesTable } from '@/components/billing/invoices-table';\nimport { PaymentMethodsTable } from '@/components/billing/payment-methods-table';

const stats = [
  {
    title: 'Monthly Recurring Revenue',\n    value: '$124,550',\n    change: '+12.5%',
    icon: DollarSign,
  },
  {
    title: 'Annual Recurring Revenue',\n    value: '$1,494,600',\n    change: '+18.2%',
    icon: TrendingUp,
  },
  {
    title: 'Active Subscriptions',\n    value: '482',\n    change: '+8',
    icon: CreditCard,
  },
  {
    title: 'Outstanding Invoices',\n    value: '$12,450',\n    change: '5 overdue',
    icon: FileText,
  },
];

export default function BillingPage() {
  return (
    <div className="space-y-8">\n      <div className="flex items-center justify-between">
        <div>\n          <h1 className="text-3xl font-bold tracking-tight">Billing</h1>\n          <p className="text-muted-foreground">
            Manage subscriptions, invoices, and payment methods
          </p>
        </div>
        <Button>\n          <Download className="mr-2 h-4 w-4" />
          Export Report
        </Button>
      </div>
\n      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>\n            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">\n              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>\n              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>\n              <div className="text-2xl font-bold">{stat.value}</div>\n              <p className="text-xs text-muted-foreground">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue Overview</CardTitle>
          <CardDescription>Monthly recurring revenue over the last 12 months</CardDescription>
        </CardHeader>
        <CardContent>
          <RevenueChart />
        </CardContent>
      </Card>
\n      <Tabs defaultValue="subscriptions" className="space-y-4">
        <TabsList>\n          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>\n          <TabsTrigger value="invoices">Invoices</TabsTrigger>\n          <TabsTrigger value="payment-methods">Payment Methods</TabsTrigger>
        </TabsList>
\n        <TabsContent value="subscriptions">
          <Card>
            <CardHeader>
              <CardTitle>Active Subscriptions</CardTitle>
              <CardDescription>Manage tenant subscriptions and plans</CardDescription>
            </CardHeader>
            <CardContent>
              <SubscriptionsTable />
            </CardContent>
          </Card>
        </TabsContent>
\n        <TabsContent value="invoices">
          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
              <CardDescription>View and manage billing invoices</CardDescription>
            </CardHeader>
            <CardContent>
              <InvoicesTable />
            </CardContent>
          </Card>
        </TabsContent>
\n        <TabsContent value="payment-methods">
          <Card>
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>Stored payment methods for all tenants</CardDescription>
            </CardHeader>
            <CardContent>
              <PaymentMethodsTable />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
