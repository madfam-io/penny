'use client';

import React, { ReactNode } from 'react';
import { BaseErrorBoundary } from './BaseErrorBoundary';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '@penny/ui';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface SectionErrorBoundaryProps {
  children: ReactNode;
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function SectionErrorBoundary({ 
  children, 
  title = 'Section Error',
  description = 'This section failed to load properly',
  onRetry,
  className = ''
}: SectionErrorBoundaryProps) {
  const fallbackUI = (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-600">
          <AlertTriangle className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Other parts of the page should continue to work normally.
          </p>
          {onRetry && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onRetry}
              className="ml-4"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <BaseErrorBoundary
      level="section"
      name={title}
      fallback={fallbackUI}
      showErrorDetails={false}
      allowRetry={!!onRetry}
      allowNavigation={false}
    >
      {children}
    </BaseErrorBoundary>
  );
}