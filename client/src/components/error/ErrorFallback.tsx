import React from 'react';
import { ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug, WifiOff, Clock, Shield } from 'lucide-react';
import { parseApiError, getErrorMessage, isRetryableError } from '@/lib/errorUtils';

interface ErrorFallbackProps {
  error: Error;
  errorInfo: ErrorInfo | null;
  onReset: () => void;
}

function getErrorIcon(code: string) {
  switch (code) {
    case 'NETWORK_ERROR':
      return <WifiOff className="w-6 h-6 text-red-500" />;
    case 'TIMEOUT':
      return <Clock className="w-6 h-6 text-yellow-500" />;
    case 'UNAUTHORIZED':
    case 'FORBIDDEN':
      return <Shield className="w-6 h-6 text-orange-500" />;
    default:
      return <AlertTriangle className="w-6 h-6 text-red-500" />;
  }
}

function getErrorTitle(code: string): string {
  switch (code) {
    case 'NETWORK_ERROR':
      return 'Connection Problem';
    case 'TIMEOUT':
      return 'Request Timed Out';
    case 'UNAUTHORIZED':
      return 'Authentication Required';
    case 'FORBIDDEN':
      return 'Access Denied';
    case 'NOT_FOUND':
      return 'Page Not Found';
    case 'SERVICE_UNAVAILABLE':
      return 'Service Unavailable';
    case 'RATE_LIMIT_EXCEEDED':
      return 'Too Many Requests';
    default:
      return 'Something Went Wrong';
  }
}

export function ErrorFallback({
  error,
  errorInfo,
  onReset,
}: ErrorFallbackProps) {
  const isDevelopment = import.meta.env.DEV;
  const parsed = parseApiError(error);
  const userMessage = getErrorMessage(parsed.code, parsed.message);
  const canRetry = isRetryableError(parsed.code);

  const handleReportError = () => {
    const errorReport = {
      code: parsed.code,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    console.error('Error Report:', errorReport);

    // Copy to clipboard for easy sharing
    navigator.clipboard?.writeText(JSON.stringify(errorReport, null, 2));
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full bg-card rounded-lg shadow-lg p-6 border border-border">
        <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-500/10 rounded-full mb-4">
          {getErrorIcon(parsed.code)}
        </div>

        <div className="text-center">
          <h1 className="text-xl font-semibold text-foreground mb-2">
            {getErrorTitle(parsed.code)}
          </h1>
          <p className="text-muted-foreground mb-6">
            {userMessage}
          </p>

          {parsed.code === 'NETWORK_ERROR' && (
            <p className="text-sm text-muted-foreground mb-4">
              Please check your internet connection and try again.
            </p>
          )}

          {parsed.code === 'RATE_LIMIT_EXCEEDED' && parsed.retryAfter && (
            <p className="text-sm text-muted-foreground mb-4">
              Please wait {parsed.retryAfter} seconds before trying again.
            </p>
          )}
        </div>

        <div className="space-y-3">
          {canRetry && (
            <button
              onClick={onReset}
              className="w-full flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </button>
          )}

          <button
            onClick={handleGoHome}
            className={`w-full flex items-center justify-center px-4 py-2 rounded-md transition-colors ${
              canRetry
                ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
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
                <strong>Code:</strong> {parsed.code}
              </div>
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
              Copy error details to clipboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
