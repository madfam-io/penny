'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@penny/ui';
import { Button, Badge } from '@penny/ui';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@penny/ui';
import { CreditCard, Download, DollarSign, TrendingUp, Calendar } from 'lucide-react';

interface TenantBillingProps {
  tenantId: string;
  billing: {
    nextBillingDate: Date;
    monthlyRevenue: number;
    totalRevenue: number;
  };
}

export function TenantBilling({ tenantId, billing }: TenantBillingProps) {
  const invoices = [
    { id: 'INV-001', date: '2024-08-01', amount: 2500, status: 'paid', period: 'Aug 2024' },
    { id: 'INV-002', date: '2024-07-01', amount: 2500, status: 'paid', period: 'Jul 2024' },
    { id: 'INV-003', date: '2024-06-01', amount: 2500, status: 'paid', period: 'Jun 2024' },
    { id: 'INV-004', date: '2024-05-01', amount: 2500, status: 'paid', period: 'May 2024' },
    { id: 'INV-005', date: '2024-04-01', amount: 2500, status: 'paid', period: 'Apr 2024' },
  ];

  const paymentMethod = {
    type: 'card',
    brand: 'Visa',
    last4: '4242',
    expiry: '12/25',
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current MRR</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${billing.monthlyRevenue}</div>
            <p className="text-xs text-muted-foreground">per month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${billing.totalRevenue}</div>
            <p className="text-xs text-muted-foreground">lifetime value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Billing</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Date(billing.nextBillingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date(billing.nextBillingDate).toLocaleDateString('en-US', { year: 'numeric' })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payment Method</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">•••• {paymentMethod.last4}</div>
            <p className="text-xs text-muted-foreground">{paymentMethod.brand} - Exp {paymentMethod.expiry}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Billing History</CardTitle>
              <CardDescription>Recent invoices and payment history</CardDescription>
            </div>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export Invoices
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.id}</TableCell>
                  <TableCell>{invoice.date}</TableCell>
                  <TableCell>{invoice.period}</TableCell>
                  <TableCell>${invoice.amount}</TableCell>
                  <TableCell>
                    <Badge className="bg-green-100 text-green-800">
                      {invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment Method</CardTitle>
          <CardDescription>Manage payment method for this tenant</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <CreditCard className="h-8 w-8" />
              <div>
                <p className="font-medium">{paymentMethod.brand} ending in {paymentMethod.last4}</p>
                <p className="text-sm text-muted-foreground">Expires {paymentMethod.expiry}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">Update</Button>
              <Button variant="outline" size="sm">Remove</Button>
            </div>
          </div>
          <Button className="w-full">Add Payment Method</Button>
        </CardContent>
      </Card>
    </div>
  );
}