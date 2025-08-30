'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@penny/ui';
import { format } from 'date-fns';

interface AuditLog {
  id: string;
  timestamp: Date;
  user: string;
  action: string;
  resource: string;
  details: string;
  ipAddress: string;
  status: 'success' | 'failure';
}

export function AuditLogTable() {
  const [logs] = useState<AuditLog[]>([
    {
      id: '1',
      timestamp: new Date(),
      user: 'admin@example.com',
      action: 'LOGIN',
      resource: 'AUTH',
      details: 'User logged in successfully',
      ipAddress: '192.168.1.1',
      status: 'success',
    },
  ]);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Timestamp</TableHead>
          <TableHead>User</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Resource</TableHead>
          <TableHead>Details</TableHead>
          <TableHead>IP Address</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log) => (
          <TableRow key={log.id}>
            <TableCell>{format(log.timestamp, 'PPpp')}</TableCell>
            <TableCell>{log.user}</TableCell>
            <TableCell>{log.action}</TableCell>
            <TableCell>{log.resource}</TableCell>
            <TableCell>{log.details}</TableCell>
            <TableCell>{log.ipAddress}</TableCell>
            <TableCell>
              <span
                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  log.status === 'success'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {log.status}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}