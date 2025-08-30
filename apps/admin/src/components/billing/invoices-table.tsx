'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  Button,\n} from '@penny/ui';
import { Download, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

interface Invoice {
  id: string;
  number: string;
  tenant: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue' | 'void';
  dueDate: Date;
  paidDate?: Date;
}

const invoices: Invoice[] = [
  {
    id: '1',
    number: 'INV-2024-001',
    tenant: 'Acme Corporation',
    amount: 2499,
    status: 'paid',\n    dueDate: new Date('2024-02-15'),\n    paidDate: new Date('2024-02-14'),
  },
  {
    id: '2',
    number: 'INV-2024-002',
    tenant: 'TechStart Inc',
    amount: 999,
    status: 'pending',\n    dueDate: new Date('2024-03-10'),
  },
  {
    id: '3',
    number: 'INV-2024-003',
    tenant: 'Digital Agency',
    amount: 299,
    status: 'overdue',\n    dueDate: new Date('2024-02-20'),
  },
  {
    id: '4',
    number: 'INV-2024-004',
    tenant: 'CloudFirst',
    amount: 1599,
    status: 'paid',\n    dueDate: new Date('2024-02-28'),\n    paidDate: new Date('2024-02-25'),
  },
];

const statusColors = {
  paid: 'default',
  pending: 'secondary',
  overdue: 'destructive',
  void: 'outline',
} as const;

export function InvoicesTable() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Invoice</TableHead>
          <TableHead>Tenant</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Due Date</TableHead>
          <TableHead>Paid Date</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((invoice) => (
          <TableRow key={invoice.id}>\n            <TableCell className="font-medium">{invoice.number}</TableCell>
            <TableCell>{invoice.tenant}</TableCell>
            <TableCell>${invoice.amount.toLocaleString()}</TableCell>
            <TableCell>
              <Badge variant={statusColors[invoice.status]}>{invoice.status}</Badge>
            </TableCell>
            <TableCell>{format(invoice.dueDate, 'MMM d, yyyy')}</TableCell>
            <TableCell>
              {invoice.paidDate ? format(invoice.paidDate, 'MMM d, yyyy') : '-'}
            </TableCell>\n            <TableCell className="text-right">
              <div className="flex justify-end gap-2">\n                <Button variant="ghost" size="icon">\n                  <ExternalLink className="h-4 w-4" />
                </Button>\n                <Button variant="ghost" size="icon">\n                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
