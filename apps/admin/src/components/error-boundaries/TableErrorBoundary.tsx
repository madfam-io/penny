'use client';

import React, { ReactNode } from 'react';
import { BaseErrorBoundary } from './BaseErrorBoundary';
import { Table, TableBody, TableCell, TableRow, Button } from '@penny/ui';
import { AlertTriangle, RefreshCw, Database } from 'lucide-react';

interface TableErrorBoundaryProps {
  children: ReactNode;
  tableName?: string;
  onRefresh?: () => void;
  colSpan?: number;
}

export function TableErrorBoundary({ 
  children, 
  tableName = 'Table',
  onRefresh,
  colSpan = 5
}: TableErrorBoundaryProps) {
  const fallbackUI = (
    <Table>
      <TableBody>
        <TableRow>
          <TableCell colSpan={colSpan} className="text-center py-12">
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-medium">
                  {tableName} Error
                </span>
              </div>
              
              <p className="text-sm text-gray-600 max-w-md">
                Unable to load table data. This could be due to a network issue or a data processing error.
              </p>
              
              <div className="flex gap-2">
                {onRefresh && (
                  <Button variant="outline" size="sm" onClick={onRefresh}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry Loading
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => window.location.reload()}
                >
                  <Database className="h-4 w-4 mr-2" />
                  Refresh Page
                </Button>
              </div>
            </div>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );

  return (
    <BaseErrorBoundary
      level="section"
      name={`${tableName} Table`}
      fallback={fallbackUI}
      showErrorDetails={false}
      allowRetry={!!onRefresh}
      allowNavigation={false}
    >
      {children}
    </BaseErrorBoundary>
  );
}