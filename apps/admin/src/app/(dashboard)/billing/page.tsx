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
  Button,
} from '@penny/ui';
import { DollarSign, TrendingUp, CreditCard, FileText, Download } from 'lucide-react';
import { RevenueChart } from '@/components/billing/revenue-chart';
import { SubscriptionsTable } from '@/components/billing/subscriptions-table';
import { InvoicesTable } from '@/components/billing/invoices-table';
import { PaymentMethodsTable } from '@/components/billing/payment-methods-table';

const stats = [
  {
    title: 'Monthly Recurring Revenue',
    value: '$124,550',
    change: '+12.5%',
    icon: DollarSign,
  },
  {
    title: 'Annual Recurring Revenue',
    value: '$1,494,600',
    change: '+18.2%',
    icon: TrendingUp,
  },
  {
    title: 'Active Subscriptions',
    value: '482',
    change: '+8',
    icon: CreditCard,
  },
  {
    title: 'Outstanding Invoices',
    value: '$12,450',
    change: '5 overdue',
    icon: FileText,
  },
];

export default function BillingPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
          <p className="text-muted-foreground">
            Manage subscriptions, invoices, and payment methods
          </p>
        </div>
        <Button>
          <Download className="mr-2 h-4 w-4" />
          Export Report
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.change}</p>
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

      <Tabs defaultValue="subscriptions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payment-methods">Payment Methods</TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions">
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

        <TabsContent value="invoices">
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

        <TabsContent value="payment-methods">
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
