'use client';

import React, { ReactNode, useState, useEffect } from 'react';
import { BaseErrorBoundary } from './BaseErrorBoundary';
import { Button, Alert, AlertDescription, LoadingSpinner } from '@penny/ui';
import { AlertTriangle, RefreshCw, Wifi, WifiOff } from 'lucide-react';

interface AsyncErrorBoundaryProps {
  children: ReactNode;
  operationName?: string;
  onRetry?: () => Promise<void>;
  retryDelay?: number;
  maxRetries?: number;
}

export function AsyncErrorBoundary({ 
  children, 
  operationName = 'Operation',
  onRetry,
  retryDelay = 1000,
  maxRetries = 3
}: AsyncErrorBoundaryProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = async () => {
    if (!onRetry || isRetrying || retryCount >= maxRetries) return;

    setIsRetrying(true);
    setRetryCount(prev => prev + 1);

    try {
      // Add delay before retry
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      await onRetry();
    } catch (error) {
      console.error('Retry failed:', error);
      // Let the error boundary catch this
      throw error;
    } finally {
      setIsRetrying(false);
    }
  };

  const getErrorMessage = () => {
    if (!isOnline) {
      return 'You appear to be offline. Please check your internet connection.';
    }
    
    if (retryCount >= maxRetries) {
      return `${operationName} failed after ${maxRetries} attempts. Please try again later.`;
    }
    
    return `${operationName} encountered an error. This might be a temporary issue.`;
  };

  const getRetryButtonText = () => {
    if (isRetrying) return 'Retrying...';
    if (retryCount >= maxRetries) return 'Max Retries Reached';
    if (retryCount === 0) return 'Retry';
    return `Retry (${retryCount}/${maxRetries})`;
  };

  const fallbackUI = (
    <Alert variant="destructive" className="my-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          {!isOnline ? (
            <WifiOff className="h-5 w-5 text-red-500" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-red-500" />
          )}
        </div>
        
        <div className="flex-1">
          <AlertDescription className="text-sm">
            {getErrorMessage()}
          </AlertDescription>
          
          <div className="flex items-center gap-2 mt-3">
            {onRetry && retryCount < maxRetries && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                disabled={isRetrying || !isOnline}
                className="text-xs"
              >
                {isRetrying ? (
                  <>
                    <LoadingSpinner className="h-3 w-3 mr-1" />
                    {getRetryButtonText()}
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1" />
                    {getRetryButtonText()}
                  </>
                )}
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.location.reload()}
              className="text-xs"
            >
              <Wifi className="h-3 w-3 mr-1" />
              Refresh Page
            </Button>
            
            {!isOnline && (
              <div className="text-xs text-amber-600 flex items-center gap-1">
                <WifiOff className="h-3 w-3" />
                Offline
              </div>
            )}
          </div>
        </div>
      </div>
    </Alert>
  );

  return (
    <BaseErrorBoundary
      level="component"
      name={`${operationName} (Async)`}
      fallback={fallbackUI}
      showErrorDetails={false}
      allowRetry={!!onRetry && retryCount < maxRetries}
      allowNavigation={false}
    >
      {children}
    </BaseErrorBoundary>
  );
}