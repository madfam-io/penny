'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,\n} from '@penny/ui';
import { MoreHorizontal, Settings, Users, Shield, Trash } from 'lucide-react';
import { format } from 'date-fns';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  status: 'active' | 'suspended' | 'trial';
  users: number;
  storage: number;
  createdAt: Date;
}

// Mock data
const tenants: Tenant[] = [
  {\n    id: '1',
    name: 'Acme Corporation',
    slug: 'acme-corp',
    plan: 'enterprise',
    status: 'active',
    users: 250,
    storage: 128.5,\n    createdAt: new Date('2024-01-15'),
  },
  {\n    id: '2',
    name: 'TechStart Inc',
    slug: 'techstart',
    plan: 'pro',
    status: 'active',
    users: 45,
    storage: 23.8,\n    createdAt: new Date('2024-02-01'),
  },
  {\n    id: '3',
    name: 'Digital Agency',
    slug: 'digital-agency',
    plan: 'starter',
    status: 'trial',
    users: 12,
    storage: 5.2,\n    createdAt: new Date('2024-02-20'),
  },
];

const planColors = {
  free: 'secondary',
  starter: 'default',
  pro: 'default',
  enterprise: 'default',
} as const;

const statusColors = {
  active: 'default',
  suspended: 'destructive',
  trial: 'secondary',
} as const;

export function TenantsTable({ searchQuery }: { searchQuery: string }) {
  const filteredTenants = tenants.filter(
    (tenant) =>
      tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.slug.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tenant</TableHead>
          <TableHead>Plan</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Users</TableHead>
          <TableHead>Storage</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredTenants.map((tenant) => (
          <TableRow key={tenant.id}>
            <TableCell>
              <div>\n                <div className="font-medium">{tenant.name}</div>\n                <div className="text-sm text-muted-foreground">{tenant.slug}</div>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant={planColors[tenant.plan]}>{tenant.plan.toUpperCase()}</Badge>
            </TableCell>
            <TableCell>
              <Badge variant={statusColors[tenant.status]}>{tenant.status}</Badge>
            </TableCell>
            <TableCell>{tenant.users}</TableCell>
            <TableCell>{tenant.storage} GB</TableCell>
            <TableCell>{format(tenant.createdAt, 'MMM d, yyyy')}</TableCell>\n            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>\n                  <Button variant="ghost" className="h-8 w-8 p-0">\n                    <span className="sr-only">Open menu</span>\n                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>\n                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>\n                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>\n                    <Users className="mr-2 h-4 w-4" />
                    <span>Manage Users</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>\n                    <Shield className="mr-2 h-4 w-4" />
                    <span>Security</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />\n                  <DropdownMenuItem className="text-red-600">\n                    <Trash className="mr-2 h-4 w-4" />
                    <span>Delete</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
