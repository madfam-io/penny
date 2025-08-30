'use client';

import React, { ReactNode } from 'react';
import { BaseErrorBoundary } from './BaseErrorBoundary';
import { Card, CardContent, CardHeader, CardTitle, Button, Alert, AlertDescription } from '@penny/ui';
import { AlertTriangle, RefreshCw, Save, X } from 'lucide-react';

interface FormErrorBoundaryProps {
  children: ReactNode;
  formName?: string;
  onReset?: () => void;
  onCancel?: () => void;
  showInline?: boolean;
}

export function FormErrorBoundary({ 
  children, 
  formName = 'Form',
  onReset,
  onCancel,
  showInline = false
}: FormErrorBoundaryProps) {
  // Inline error display for smaller form sections
  const inlineFallbackUI = (
    <Alert variant="destructive" className="my-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>{formName} encountered an error</span>
        <div className="flex gap-2 ml-4">
          {onReset && (
            <Button variant="outline" size="sm" onClick={onReset}>
              <RefreshCw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          )}
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <X className="h-3 w-3 mr-1" />
              Cancel
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );

  // Full card error display for main forms
  const cardFallbackUI = (
    <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-600">
          <AlertTriangle className="h-5 w-5" />
          {formName} Error
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-red-700 dark:text-red-300">
          The form encountered an error and cannot be processed right now. 
          Your data may not be saved.
        </p>
        
        <div className="flex gap-2">
          {onReset && (
            <Button variant="outline" size="sm" onClick={onReset}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset Form
            </Button>
          )}
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => window.location.reload()}
          >
            <Save className="h-4 w-4 mr-2" />
            Refresh Page
          </Button>
        </div>
        
        <p className="text-xs text-gray-600">
          Try refreshing the page or contact support if the problem persists.
        </p>
      </CardContent>
    </Card>
  );

  return (
    <BaseErrorBoundary
      level="section"
      name={formName}
      fallback={showInline ? inlineFallbackUI : cardFallbackUI}
      showErrorDetails={false}
      allowRetry={!!onReset}
      allowNavigation={false}
    >
      {children}
    </BaseErrorBoundary>
  );
}