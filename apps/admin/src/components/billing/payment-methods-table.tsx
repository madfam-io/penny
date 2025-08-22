'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  Button,
} from '@penny/ui';
import { CreditCard, Building, Trash } from 'lucide-react';

interface PaymentMethod {
  id: string;
  tenant: string;
  type: 'card' | 'bank_account';
  brand?: string;
  last4: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
}

const paymentMethods: PaymentMethod[] = [
  {
    id: '1',
    tenant: 'Acme Corporation',
    type: 'card',
    brand: 'Visa',
    last4: '4242',
    expiryMonth: 12,
    expiryYear: 2025,
    isDefault: true,
  },
  {
    id: '2',
    tenant: 'TechStart Inc',
    type: 'card',
    brand: 'Mastercard',
    last4: '5555',
    expiryMonth: 6,
    expiryYear: 2024,
    isDefault: true,
  },
  {
    id: '3',
    tenant: 'Digital Agency',
    type: 'bank_account',
    last4: '6789',
    isDefault: true,
  },
  {
    id: '4',
    tenant: 'Acme Corporation',
    type: 'card',
    brand: 'Amex',
    last4: '3782',
    expiryMonth: 3,
    expiryYear: 2026,
    isDefault: false,
  },
];

const brandIcons: Record<string, string> = {
  Visa: '💳',
  Mastercard: '💳',
  Amex: '💳',
  Discover: '💳',
};

export function PaymentMethodsTable() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tenant</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Details</TableHead>
          <TableHead>Expiry</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {paymentMethods.map((method) => (
          <TableRow key={method.id}>
            <TableCell className="font-medium">
              {method.tenant}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                {method.type === 'card' ? (
                  <CreditCard className="h-4 w-4" />
                ) : (
                  <Building className="h-4 w-4" />
                )}
                <span className="capitalize">{method.type.replace('_', ' ')}</span>
              </div>
            </TableCell>
            <TableCell>
              {method.type === 'card' ? (
                <span>{method.brand} ****{method.last4}</span>
              ) : (
                <span>****{method.last4}</span>
              )}
            </TableCell>
            <TableCell>
              {method.expiryMonth && method.expiryYear ? (
                <span>{method.expiryMonth.toString().padStart(2, '0')}/{method.expiryYear}</span>
              ) : (
                '-'
              )}
            </TableCell>
            <TableCell>
              {method.isDefault && (
                <Badge variant="default">Default</Badge>
              )}
            </TableCell>
            <TableCell className="text-right">
              <Button
                variant="ghost"
                size="icon"
                disabled={method.isDefault}
              >
                <Trash className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}