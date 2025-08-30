'use client';

import React, { ReactNode } from 'react';
import { BaseErrorBoundary } from './BaseErrorBoundary';
import { Button } from '@penny/ui';
import { RefreshCw, Home, ArrowLeft } from 'lucide-react';

interface PageErrorBoundaryProps {
  children: ReactNode;
  pageName?: string;
  showBreadcrumb?: boolean;
}

export function PageErrorBoundary({ 
  children, 
  pageName,
  showBreadcrumb = true 
}: PageErrorBoundaryProps) {
  const handleRefresh = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  const handleGoBack = () => {
    if (typeof window !== 'undefined') {
      window.history.back();
    }
  };

  const fallbackUI = (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Page Error
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {pageName ? `The ${pageName} page` : 'This page'} encountered an error and cannot be displayed.
          </p>
        </div>
        
        <div className="flex gap-3 justify-center">
          <Button onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Page
          </Button>
          <Button variant="outline" onClick={() => window.location.href = '/dashboard'}>
            <Home className="h-4 w-4 mr-2" />
            Go to Dashboard
          </Button>
          <Button variant="outline" onClick={handleGoBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>

        <p className="text-sm text-gray-500">
          If this problem continues, please contact support.
        </p>
      </div>
    </div>
  );

  return (
    <BaseErrorBoundary
      level="page"
      name={pageName}
      fallback={fallbackUI}
      showErrorDetails={true}
      allowRetry={true}
      allowNavigation={true}
    >
      {children}
    </BaseErrorBoundary>
  );
}