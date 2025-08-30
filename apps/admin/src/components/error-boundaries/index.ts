import React from 'react';

// Error Boundary Components
export { BaseErrorBoundary } from './BaseErrorBoundary';
export { PageErrorBoundary } from './PageErrorBoundary';
export { SectionErrorBoundary } from './SectionErrorBoundary';
export { ComponentErrorBoundary } from './ComponentErrorBoundary';
export { TableErrorBoundary } from './TableErrorBoundary';
export { FormErrorBoundary } from './FormErrorBoundary';
export { AsyncErrorBoundary } from './AsyncErrorBoundary';

// Re-export types
export type { ErrorInfo } from 'react';

// Error boundary utilities
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: {
    level?: 'app' | 'page' | 'section' | 'component';
    name?: string;
    fallback?: React.ReactNode;
  }
) {
  const { BaseErrorBoundary } = require('./BaseErrorBoundary');
  
  function WrappedComponent(props: P) {
    return React.createElement(
      BaseErrorBoundary,
      errorBoundaryProps,
      React.createElement(Component, props)
    );
  }
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

// Error reporting utilities
export const reportError = async (error: Error, context?: Record<string, any>) => {
  const errorData = {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
    context,
  };

  if (process.env.NODE_ENV === 'development') {
    console.error('[ERROR REPORT]', errorData);
    return;
  }

  try {
    await fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(errorData),
    });
  } catch (reportError) {
    console.error('Failed to report error:', reportError);
  }
};