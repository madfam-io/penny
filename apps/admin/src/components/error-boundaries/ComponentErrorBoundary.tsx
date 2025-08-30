'use client';

import React, { ReactNode } from 'react';
import { BaseErrorBoundary } from './BaseErrorBoundary';
import { Alert, AlertDescription } from '@penny/ui';
import { AlertTriangle } from 'lucide-react';

interface ComponentErrorBoundaryProps {
  children: ReactNode;
  componentName?: string;
  silent?: boolean;
  fallbackContent?: ReactNode;
}

export function ComponentErrorBoundary({ 
  children, 
  componentName,
  silent = false,
  fallbackContent
}: ComponentErrorBoundaryProps) {
  // Silent error boundary - just doesn't render the component
  if (silent) {
    return (
      <BaseErrorBoundary
        level="component"
        name={componentName}
        fallback={fallbackContent || null}
        showErrorDetails={false}
        allowRetry={false}
        allowNavigation={false}
      >
        {children}
      </BaseErrorBoundary>
    );
  }

  // Default component error UI
  const fallbackUI = (
    <Alert variant="destructive" className="my-2">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        {componentName ? `${componentName} failed to load` : 'Component error occurred'}
      </AlertDescription>
    </Alert>
  );

  return (
    <BaseErrorBoundary
      level="component"
      name={componentName}
      fallback={fallbackContent || fallbackUI}
      showErrorDetails={false}
      allowRetry={false}
      allowNavigation={false}
    >
      {children}
    </BaseErrorBoundary>
  );
}