/**
 * Error Boundary Component
 * Provides user-friendly error handling and recovery options
 * Requirements: 5.4, 4.4
 */

'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  RefreshCw, 
  Home, 
  Bug, 
  Mail,
} from 'lucide-react';
import { errorHandlingService, ErrorType, ErrorSeverity } from '@/lib/error-handling-service';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
  retryCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorId: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorId: null,
      retryCount: 0,
    };
  }

  async componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError } = this.props;
    
    // Log the error
    const errorId = await errorHandlingService.logError(
      ErrorType.UNKNOWN_ERROR,
      error,
      {
        metadata: {
          componentStack: errorInfo.componentStack,
          errorBoundary: true,
          retryCount: this.state.retryCount,
        },
      },
      ErrorSeverity.HIGH
    );

    this.setState({ errorId });

    // Call custom error handler if provided
    if (onError) {
      onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorId: null,
        retryCount: prevState.retryCount + 1,
      }));
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleReportBug = () => {
    const { error, errorId } = this.state;
    const subject = encodeURIComponent(`Bug Report - Error ID: ${errorId}`);
    const body = encodeURIComponent(`
Error Details:
- Error ID: ${errorId}
- Message: ${error?.message || 'Unknown error'}
- Stack: ${error?.stack || 'No stack trace available'}
- URL: ${window.location.href}
- User Agent: ${navigator.userAgent}
- Timestamp: ${new Date().toISOString()}
    `);
    
    window.open(`mailto:support@yourapp.com?subject=${subject}&body=${body}`);
  };

  render() {
    const { hasError, error, errorId, retryCount } = this.state;
    const { children, fallback, showDetails = false } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      const canRetry = retryCount < this.maxRetries;
      const userFriendlyError = errorHandlingService.getUserFriendlyError(
        ErrorType.UNKNOWN_ERROR,
        error?.message
      );

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="w-full max-w-2xl">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle className="text-2xl">Something went wrong</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {userFriendlyError.message}
                </AlertDescription>
              </Alert>

              {errorId && (
                <div className="text-center text-sm text-muted-foreground">
                  Error ID: <code className="font-mono">{errorId}</code>
                </div>
              )}

              {showDetails && error && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Technical Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <strong>Error:</strong> {error.message}
                      </div>
                      {error.stack && (
                        <div>
                          <strong>Stack Trace:</strong>
                          <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">
                            {error.stack}
                          </pre>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex flex-col gap-3">
                {canRetry && userFriendlyError.canRetry && (
                  <Button onClick={this.handleRetry} className="w-full">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again ({this.maxRetries - retryCount} attempts left)
                  </Button>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" onClick={this.handleReload}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reload Page
                  </Button>
                  <Button variant="outline" onClick={this.handleGoHome}>
                    <Home className="h-4 w-4 mr-2" />
                    Go Home
                  </Button>
                </div>

                <Button variant="outline" onClick={this.handleReportBug}>
                  <Bug className="h-4 w-4 mr-2" />
                  Report Bug
                </Button>
              </div>

              {userFriendlyError.supportContact && (
                <Alert>
                  <Mail className="h-4 w-4" />
                  <AlertDescription>
                    If this problem persists, please contact our support team with the Error ID above.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return children;
  }
}

// Hook for functional components to handle errors
export function useErrorHandler() {
  const handleError = async (error: Error, context?: Record<string, any>) => {
    const errorId = await errorHandlingService.logError(
      ErrorType.UNKNOWN_ERROR,
      error,
      context,
      ErrorSeverity.MEDIUM
    );

    // You could also show a toast notification here
    console.error('Error caught by useErrorHandler:', error, 'Error ID:', errorId);
    
    return errorId;
  };

  return { handleError };
}

// Higher-order component for wrapping components with error handling
export function withErrorHandling<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Partial<Props>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorHandling(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}
