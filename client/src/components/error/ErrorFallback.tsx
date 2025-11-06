import React from 'react';
import { ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';

interface ErrorFallbackProps {
  error: Error;
  errorInfo: ErrorInfo | null;
  onReset: () => void;
}

export function ErrorFallback({
  error,
  errorInfo,
  onReset,
}: ErrorFallbackProps) {
  const isDevelopment = import.meta.env.DEV;

  const handleReportError = () => {
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    console.error('Error Report:', errorReport);
    // In production, this could send to an error reporting service
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full bg-card rounded-lg shadow-lg p-6 border border-border">
        <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-500/10 rounded-full mb-4">
          <AlertTriangle className="w-6 h-6 text-red-500" />
        </div>

        <div className="text-center">
          <h1 className="text-xl font-semibold text-foreground mb-2">
            Something went wrong
          </h1>
          <p className="text-muted-foreground mb-6">
            We&apos;re sorry, but something unexpected happened. Please try
            refreshing the page or go back to the home page.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={onReset}
            className="w-full flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </button>

          <button
            onClick={handleGoHome}
            className="w-full flex items-center justify-center px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
          >
            <Home className="w-4 h-4 mr-2" />
            Go Home
          </button>
        </div>

        {isDevelopment && (
          <div className="mt-6 p-4 bg-destructive/10 rounded-md border border-destructive/20">
            <div className="flex items-center mb-2">
              <Bug className="w-4 h-4 text-destructive mr-2" />
              <h3 className="text-sm font-medium text-destructive">
                Development Error Details
              </h3>
            </div>
            <div className="text-xs text-destructive/90 space-y-2">
              <div>
                <strong>Error:</strong> {error.message}
              </div>
              {error.stack && (
                <div>
                  <strong>Stack:</strong>
                  <pre className="mt-1 whitespace-pre-wrap text-xs bg-destructive/5 p-2 rounded overflow-x-auto border border-destructive/10">
                    {error.stack}
                  </pre>
                </div>
              )}
              {errorInfo?.componentStack && (
                <div>
                  <strong>Component Stack:</strong>
                  <pre className="mt-1 whitespace-pre-wrap text-xs bg-destructive/5 p-2 rounded overflow-x-auto border border-destructive/10">
                    {errorInfo.componentStack}
                  </pre>
                </div>
              )}
            </div>
            <button
              onClick={handleReportError}
              className="mt-3 text-xs text-destructive hover:text-destructive/80 underline"
            >
              Copy error details to console
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
