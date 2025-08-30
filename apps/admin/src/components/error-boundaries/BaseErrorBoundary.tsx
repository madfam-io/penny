'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@penny/ui';
import { AlertTriangle, RefreshCw, Home, Bug, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  children: ReactNode;
  level: 'app' | 'page' | 'section' | 'component';
  name?: string;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showErrorDetails?: boolean;
  allowRetry?: boolean;
  allowNavigation?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  retryCount: number;
}

export class BaseErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error
    this.logError(error, errorInfo);

    // Call custom error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private logError = (error: Error, errorInfo: ErrorInfo) => {
    const errorData = {
      level: this.props.level,
      name: this.props.name,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      retryCount: this.state.retryCount,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    };

    // Console log for development
    console.error(`[${this.props.level.toUpperCase()} ERROR BOUNDARY]`, errorData);

    // Send to monitoring service (implement based on your monitoring solution)
    if (process.env.NODE_ENV === 'production') {
      this.sendErrorReport(errorData);
    }
  };

  private sendErrorReport = async (errorData: any) => {
    try {
      // Replace with your error reporting service
      // Examples: Sentry, LogRocket, DataDog, custom endpoint
      await fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorData),
      });
    } catch (reportError) {
      console.error('Failed to report error:', reportError);
    }
  };

  private handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      retryCount: prevState.retryCount + 1,
    }));
  };

  private handleNavigation = (path: string) => {
    if (typeof window !== 'undefined') {
      window.location.href = path;
    }
  };

  private toggleDetails = () => {
    this.setState(prevState => ({
      showDetails: !prevState.showDetails,
    }));
  };

  private getErrorTitle = (): string => {
    const { level, name } = this.props;
    switch (level) {
      case 'app':
        return 'Application Error';
      case 'page':
        return `Page Error${name ? ` - ${name}` : ''}`;
      case 'section':
        return `Section Error${name ? ` - ${name}` : ''}`;
      case 'component':
        return `Component Error${name ? ` - ${name}` : ''}`;
      default:
        return 'Unknown Error';
    }
  };

  private getErrorDescription = (): string => {
    const { level } = this.props;
    switch (level) {
      case 'app':
        return 'A critical application error has occurred. Please try refreshing the page.';
      case 'page':
        return 'This page encountered an error and cannot be displayed properly.';
      case 'section':
        return 'This section failed to load. Other parts of the page may still work normally.';
      case 'component':
        return 'A component failed to render. This may not affect the rest of the page.';
      default:
        return 'An unexpected error occurred.';
    }
  };

  private renderFallbackUI = () => {
    const { level, showErrorDetails, allowRetry, allowNavigation } = this.props;
    const { error, errorInfo, showDetails } = this.state;

    // Use custom fallback if provided
    if (this.props.fallback) {
      return this.props.fallback;
    }

    // Different UI based on error level
    const cardSize = level === 'app' || level === 'page' ? 'w-full max-w-lg mx-auto' : 'w-full';

    return (
      <Card className={cardSize}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            {this.getErrorTitle()}
          </CardTitle>
          <CardDescription>
            {this.getErrorDescription()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            {allowRetry && (
              <Button onClick={this.handleRetry} size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            )}
            {allowNavigation && level !== 'component' && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => this.handleNavigation('/dashboard')}
              >
                <Home className="h-4 w-4 mr-2" />
                Go to Dashboard
              </Button>
            )}
            {showErrorDetails && process.env.NODE_ENV === 'development' && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={this.toggleDetails}
              >
                <Bug className="h-4 w-4 mr-2" />
                {showDetails ? (
                  <>
                    <ChevronUp className="h-4 w-4 ml-1" />
                    Hide Details
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 ml-1" />
                    Show Details
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Error details (development only) */}
          {showDetails && showErrorDetails && process.env.NODE_ENV === 'development' && (
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg space-y-2">
              <div>
                <h4 className="font-medium text-sm">Error Message:</h4>
                <p className="text-sm text-red-600 font-mono">{error?.message}</p>
              </div>
              {error?.stack && (
                <div>
                  <h4 className="font-medium text-sm">Stack Trace:</h4>
                  <pre className="text-xs text-gray-600 overflow-auto max-h-32 whitespace-pre-wrap">
                    {error.stack}
                  </pre>
                </div>
              )}
              {errorInfo?.componentStack && (
                <div>
                  <h4 className="font-medium text-sm">Component Stack:</h4>
                  <pre className="text-xs text-gray-600 overflow-auto max-h-32 whitespace-pre-wrap">
                    {errorInfo.componentStack}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* User feedback */}
          <div className="text-sm text-gray-500 border-t pt-4">
            {level === 'app' && (
              <p>If this problem persists, please contact support or try again later.</p>
            )}
            {level === 'page' && (
              <p>You can try navigating to a different page or refreshing the browser.</p>
            )}
            {level === 'section' && (
              <p>The rest of the page should continue to work normally.</p>
            )}
            {level === 'component' && (
              <p>This is a minor issue that shouldn't affect your overall experience.</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  render() {
    if (this.state.hasError) {
      return this.renderFallbackUI();
    }

    return this.props.children;
  }
}