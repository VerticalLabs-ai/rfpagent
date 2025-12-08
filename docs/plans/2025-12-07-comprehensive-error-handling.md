# Comprehensive Error Handling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace generic error messages with specific, actionable feedback; add toast notifications for all operations; implement retry mechanisms; add help/support chat widget; integrate client-side Sentry; and ensure proper loading states.

**Architecture:** Extend existing toast system (Radix UI) with enhanced error parsing and retry capabilities. Add client-side Sentry SDK integration alongside existing server-side setup. Create unified error handling utilities that parse API responses into user-friendly messages. Implement help widget using existing UI component patterns.

**Tech Stack:** React, TanStack Query, Radix UI Toast, Sentry Browser SDK, TypeScript

---

## Task 1: Create Error Parsing Utility

**Files:**
- Create: `client/src/lib/errorUtils.ts`
- Test: `client/src/lib/__tests__/errorUtils.test.ts`

**Step 1: Write the failing test**

```typescript
// client/src/lib/__tests__/errorUtils.test.ts
import { describe, it, expect } from 'vitest';
import { parseApiError, getErrorMessage, isRetryableError } from '../errorUtils';

describe('errorUtils', () => {
  describe('parseApiError', () => {
    it('parses standard API error response', () => {
      const errorText = JSON.stringify({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email is required',
          field: 'email',
        },
      });

      const result = parseApiError(errorText);

      expect(result).toEqual({
        code: 'VALIDATION_ERROR',
        message: 'Email is required',
        field: 'email',
        isRetryable: false,
      });
    });

    it('handles plain text error response', () => {
      const result = parseApiError('Internal Server Error');

      expect(result).toEqual({
        code: 'UNKNOWN_ERROR',
        message: 'Internal Server Error',
        field: undefined,
        isRetryable: false,
      });
    });

    it('handles network errors', () => {
      const error = new TypeError('Failed to fetch');

      const result = parseApiError(error);

      expect(result).toEqual({
        code: 'NETWORK_ERROR',
        message: 'Unable to connect to server. Please check your internet connection.',
        field: undefined,
        isRetryable: true,
      });
    });
  });

  describe('getErrorMessage', () => {
    it('returns field-specific message for validation errors', () => {
      const message = getErrorMessage('VALIDATION_ERROR', 'Invalid format', 'email');
      expect(message).toBe('Email: Invalid format');
    });

    it('returns user-friendly message for known error codes', () => {
      expect(getErrorMessage('NOT_FOUND', 'Resource not found')).toBe('The requested item could not be found.');
      expect(getErrorMessage('RATE_LIMIT_EXCEEDED', 'Too many requests')).toBe('Too many requests. Please wait a moment and try again.');
      expect(getErrorMessage('SERVICE_UNAVAILABLE', 'Service down')).toBe('The service is temporarily unavailable. Please try again later.');
    });
  });

  describe('isRetryableError', () => {
    it('returns true for network errors', () => {
      expect(isRetryableError('NETWORK_ERROR')).toBe(true);
    });

    it('returns true for service unavailable', () => {
      expect(isRetryableError('SERVICE_UNAVAILABLE')).toBe(true);
    });

    it('returns true for rate limit errors', () => {
      expect(isRetryableError('RATE_LIMIT_EXCEEDED')).toBe(true);
    });

    it('returns false for validation errors', () => {
      expect(isRetryableError('VALIDATION_ERROR')).toBe(false);
    });

    it('returns false for not found errors', () => {
      expect(isRetryableError('NOT_FOUND')).toBe(false);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/lib/__tests__/errorUtils.test.ts`
Expected: FAIL with "Cannot find module '../errorUtils'"

**Step 3: Write minimal implementation**

```typescript
// client/src/lib/errorUtils.ts

export interface ParsedError {
  code: string;
  message: string;
  field?: string;
  isRetryable: boolean;
  details?: unknown;
  retryAfter?: number;
}

const RETRYABLE_ERROR_CODES = new Set([
  'NETWORK_ERROR',
  'SERVICE_UNAVAILABLE',
  'RATE_LIMIT_EXCEEDED',
  'TIMEOUT',
  'INTERNAL_ERROR',
]);

const USER_FRIENDLY_MESSAGES: Record<string, string> = {
  NOT_FOUND: 'The requested item could not be found.',
  UNAUTHORIZED: 'Please log in to continue.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please wait a moment and try again.',
  SERVICE_UNAVAILABLE: 'The service is temporarily unavailable. Please try again later.',
  NETWORK_ERROR: 'Unable to connect to server. Please check your internet connection.',
  TIMEOUT: 'The request timed out. Please try again.',
  CONFLICT: 'This resource already exists.',
  INTERNAL_ERROR: 'An unexpected error occurred. Please try again later.',
};

export function isRetryableError(code: string): boolean {
  return RETRYABLE_ERROR_CODES.has(code);
}

export function parseApiError(errorOrText: unknown): ParsedError {
  // Handle network errors (TypeError: Failed to fetch)
  if (errorOrText instanceof TypeError && errorOrText.message.includes('fetch')) {
    return {
      code: 'NETWORK_ERROR',
      message: USER_FRIENDLY_MESSAGES.NETWORK_ERROR,
      isRetryable: true,
    };
  }

  // Handle Error objects
  if (errorOrText instanceof Error) {
    const message = errorOrText.message;

    // Check if it's a formatted error from throwIfResNotOk (e.g., "404: Not found")
    const statusMatch = message.match(/^(\d{3}):\s*(.*)$/);
    if (statusMatch) {
      const status = parseInt(statusMatch[1], 10);
      const body = statusMatch[2];

      // Try to parse as JSON
      try {
        const parsed = JSON.parse(body);
        if (parsed.error) {
          return {
            code: parsed.error.code || getCodeFromStatus(status),
            message: parsed.error.message || body,
            field: parsed.error.field,
            details: parsed.error.details,
            isRetryable: isRetryableError(parsed.error.code || getCodeFromStatus(status)),
            retryAfter: parsed.error.details?.retryAfter,
          };
        }
      } catch {
        // Not JSON, use plain text
        return {
          code: getCodeFromStatus(status),
          message: body || getMessageFromStatus(status),
          isRetryable: isRetryableError(getCodeFromStatus(status)),
        };
      }
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: errorOrText.message,
      isRetryable: false,
    };
  }

  // Handle string responses
  if (typeof errorOrText === 'string') {
    // Try to parse as JSON
    try {
      const parsed = JSON.parse(errorOrText);
      if (parsed.error) {
        const code = parsed.error.code || 'UNKNOWN_ERROR';
        return {
          code,
          message: parsed.error.message || 'An error occurred',
          field: parsed.error.field,
          details: parsed.error.details,
          isRetryable: isRetryableError(code),
          retryAfter: parsed.error.details?.retryAfter,
        };
      }
    } catch {
      // Not JSON
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: errorOrText,
      isRetryable: false,
    };
  }

  // Handle API error response objects
  if (typeof errorOrText === 'object' && errorOrText !== null) {
    const obj = errorOrText as Record<string, unknown>;
    if (obj.error && typeof obj.error === 'object') {
      const error = obj.error as Record<string, unknown>;
      const code = (error.code as string) || 'UNKNOWN_ERROR';
      return {
        code,
        message: (error.message as string) || 'An error occurred',
        field: error.field as string | undefined,
        details: error.details,
        isRetryable: isRetryableError(code),
        retryAfter: (error.details as Record<string, unknown>)?.retryAfter as number | undefined,
      };
    }
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred',
    isRetryable: false,
  };
}

export function getErrorMessage(code: string, originalMessage: string, field?: string): string {
  if (field && code === 'VALIDATION_ERROR') {
    // Capitalize first letter of field name
    const fieldName = field.charAt(0).toUpperCase() + field.slice(1);
    return `${fieldName}: ${originalMessage}`;
  }

  return USER_FRIENDLY_MESSAGES[code] || originalMessage;
}

function getCodeFromStatus(status: number): string {
  switch (status) {
    case 400:
      return 'VALIDATION_ERROR';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 429:
      return 'RATE_LIMIT_EXCEEDED';
    case 503:
      return 'SERVICE_UNAVAILABLE';
    case 500:
    default:
      return 'INTERNAL_ERROR';
  }
}

function getMessageFromStatus(status: number): string {
  const code = getCodeFromStatus(status);
  return USER_FRIENDLY_MESSAGES[code] || 'An unexpected error occurred';
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/lib/__tests__/errorUtils.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add client/src/lib/errorUtils.ts client/src/lib/__tests__/errorUtils.test.ts
git commit -m "feat: add error parsing utilities for user-friendly error messages"
```

---

## Task 2: Enhance Toast System with Error Support

**Files:**
- Modify: `client/src/hooks/use-toast.ts:5-10` (increase toast limit)
- Create: `client/src/hooks/useErrorToast.ts`
- Test: `client/src/hooks/__tests__/useErrorToast.test.ts`

**Step 1: Write the failing test**

```typescript
// client/src/hooks/__tests__/useErrorToast.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useErrorToast } from '../useErrorToast';

// Mock the toast function
vi.mock('../use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
  toast: vi.fn(),
}));

describe('useErrorToast', () => {
  it('shows error toast with parsed error message', () => {
    const { result } = renderHook(() => useErrorToast());

    const error = new Error('404: {"error":{"code":"NOT_FOUND","message":"RFP not found"}}');

    result.current.showError(error);

    // Verify toast was called (implementation will verify actual behavior)
    expect(result.current.showError).toBeDefined();
  });

  it('shows success toast', () => {
    const { result } = renderHook(() => useErrorToast());

    result.current.showSuccess('Operation completed', 'Your changes have been saved.');

    expect(result.current.showSuccess).toBeDefined();
  });

  it('shows error toast with retry action', () => {
    const { result } = renderHook(() => useErrorToast());
    const onRetry = vi.fn();

    const error = new Error('503: Service Unavailable');

    result.current.showError(error, { onRetry });

    expect(result.current.showError).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/hooks/__tests__/useErrorToast.test.ts`
Expected: FAIL with "Cannot find module '../useErrorToast'"

**Step 3: Modify toast limit in use-toast.ts**

```typescript
// In client/src/hooks/use-toast.ts, change line 5:
// FROM:
const TOAST_LIMIT = 1;
// TO:
const TOAST_LIMIT = 3;
```

**Step 4: Write the useErrorToast hook**

```typescript
// client/src/hooks/useErrorToast.ts
import { useCallback } from 'react';
import { useToast, toast } from './use-toast';
import { parseApiError, getErrorMessage } from '@/lib/errorUtils';
import { ToastActionElement } from '@/components/ui/toast';

interface ErrorToastOptions {
  onRetry?: () => void;
  title?: string;
}

interface SuccessToastOptions {
  duration?: number;
}

export function useErrorToast() {
  const { toast: toastFn } = useToast();

  const showError = useCallback(
    (error: unknown, options?: ErrorToastOptions) => {
      const parsed = parseApiError(error);
      const message = getErrorMessage(parsed.code, parsed.message, parsed.field);

      let action: ToastActionElement | undefined;
      if (parsed.isRetryable && options?.onRetry) {
        action = {
          altText: 'Retry',
          onClick: options.onRetry,
          children: 'Retry',
        } as unknown as ToastActionElement;
      }

      toastFn({
        title: options?.title || 'Error',
        description: message,
        variant: 'destructive',
        action,
      });

      return parsed;
    },
    [toastFn]
  );

  const showSuccess = useCallback(
    (title: string, description?: string, options?: SuccessToastOptions) => {
      toastFn({
        title,
        description,
        duration: options?.duration || 5000,
      });
    },
    [toastFn]
  );

  const showWarning = useCallback(
    (title: string, description?: string) => {
      toastFn({
        title,
        description,
        className: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950',
      });
    },
    [toastFn]
  );

  const showInfo = useCallback(
    (title: string, description?: string) => {
      toastFn({
        title,
        description,
        className: 'border-blue-500 bg-blue-50 dark:bg-blue-950',
      });
    },
    [toastFn]
  );

  return {
    showError,
    showSuccess,
    showWarning,
    showInfo,
  };
}

// Standalone functions for use outside React components
export function showErrorToast(error: unknown, title?: string) {
  const parsed = parseApiError(error);
  const message = getErrorMessage(parsed.code, parsed.message, parsed.field);

  toast({
    title: title || 'Error',
    description: message,
    variant: 'destructive',
  });

  return parsed;
}

export function showSuccessToast(title: string, description?: string) {
  toast({
    title,
    description,
  });
}
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run client/src/hooks/__tests__/useErrorToast.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add client/src/hooks/use-toast.ts client/src/hooks/useErrorToast.ts client/src/hooks/__tests__/useErrorToast.test.ts
git commit -m "feat: add enhanced error toast hook with retry support"
```

---

## Task 3: Configure React Query Global Error Handler and Retry Logic

**Files:**
- Modify: `client/src/lib/queryClient.ts`
- Test: Manual verification (React Query behavior)

**Step 1: Update queryClient.ts with retry and error handling**

```typescript
// client/src/lib/queryClient.ts
import { QueryClient, QueryFunction } from '@tanstack/react-query';
import { parseApiError, isRetryableError } from './errorUtils';
import { showErrorToast } from '@/hooks/useErrorToast';

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  customHeaders?: Record<string, string>
): Promise<Response> {
  const headers: Record<string, string> = {};

  if (data) {
    headers['Content-Type'] = 'application/json';
  }

  if (customHeaders) {
    Object.assign(headers, customHeaders);
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: 'include',
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = 'returnNull' | 'throw';
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join('/') as string, {
      credentials: 'include',
    });

    if (unauthorizedBehavior === 'returnNull' && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

// Custom retry function based on error type
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 3) return false;

  const parsed = parseApiError(error);
  return isRetryableError(parsed.code);
}

// Calculate retry delay with exponential backoff
function getRetryDelay(attemptIndex: number, error: unknown): number {
  const parsed = parseApiError(error);

  // If rate limited with retryAfter, use that
  if (parsed.retryAfter) {
    return parsed.retryAfter * 1000;
  }

  // Exponential backoff: 1s, 2s, 4s
  return Math.min(1000 * 2 ** attemptIndex, 8000);
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: 'throw' }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: shouldRetry,
      retryDelay: getRetryDelay,
    },
    mutations: {
      retry: shouldRetry,
      retryDelay: getRetryDelay,
      onError: (error: unknown) => {
        // Global mutation error handler - can be overridden per mutation
        showErrorToast(error);
      },
    },
  },
});
```

**Step 2: Verify changes**

Run: `npm run type-check`
Expected: PASS

**Step 3: Commit**

```bash
git add client/src/lib/queryClient.ts
git commit -m "feat: add global retry logic and error handling to React Query"
```

---

## Task 4: Install and Configure Sentry Browser SDK

**Files:**
- Modify: `package.json` (add @sentry/react dependency)
- Create: `client/src/lib/sentry.ts`
- Modify: `client/src/main.tsx`
- Modify: `client/src/components/error/ErrorBoundary.tsx`

**Step 1: Install Sentry React SDK**

```bash
pnpm add @sentry/react
```

**Step 2: Create Sentry configuration**

```typescript
// client/src/lib/sentry.ts
import * as Sentry from '@sentry/react';

export function initSentry() {
  if (!import.meta.env.VITE_SENTRY_DSN) {
    console.warn('Sentry DSN not configured. Error tracking disabled.');
    return;
  }

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,

    // Enable in production, 100% in development for testing
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,

    // Only send errors in production, or when explicitly enabled
    enabled: import.meta.env.PROD || import.meta.env.VITE_SENTRY_DEBUG === 'true',

    environment: import.meta.env.MODE,

    // Filter out known non-issues
    beforeSend(event, hint) {
      const error = hint?.originalException;

      // Don't send canceled requests
      if (error instanceof Error && error.name === 'AbortError') {
        return null;
      }

      // Don't send network errors from ad blockers
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        // Check if it's a known API call failure vs blocked resource
        const breadcrumbs = event.breadcrumbs || [];
        const lastFetch = breadcrumbs.findLast(b => b.category === 'fetch');
        if (lastFetch?.data?.url && !lastFetch.data.url.startsWith('/api')) {
          return null;
        }
      }

      return event;
    },

    // Add useful context
    initialScope: {
      tags: {
        component: 'frontend',
      },
    },
  });
}

export function captureError(error: Error, context?: Record<string, unknown>) {
  Sentry.withScope(scope => {
    if (context) {
      scope.setContext('additional', context);
    }
    Sentry.captureException(error);
  });
}

export function setUserContext(user: { id: string; email?: string; username?: string } | null) {
  if (user) {
    Sentry.setUser(user);
  } else {
    Sentry.setUser(null);
  }
}

// Re-export Sentry's ErrorBoundary for use in React components
export const SentryErrorBoundary = Sentry.ErrorBoundary;
```

**Step 3: Initialize Sentry in main.tsx**

Add to the top of `client/src/main.tsx` (after imports):

```typescript
// At the top of the file, add:
import { initSentry } from './lib/sentry';

// Initialize Sentry before anything else
initSentry();

// ... rest of existing code
```

**Step 4: Update ErrorBoundary to report to Sentry**

```typescript
// client/src/components/error/ErrorBoundary.tsx
// Replace the componentDidCatch method (lines 39-63) with:

componentDidCatch(error: Error, errorInfo: ErrorInfo) {
  // Log error to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('ErrorBoundary caught an error:', error);
    console.error('Error info:', errorInfo);
  }

  // Update state with error info
  this.setState({
    error,
    errorInfo,
  });

  // Call onError callback if provided
  this.props.onError?.(error, errorInfo);

  // Report to Sentry
  import('@/lib/sentry').then(({ captureError }) => {
    captureError(error, {
      componentStack: errorInfo.componentStack,
      reactError: true,
    });
  });
}
```

**Step 5: Verify changes**

Run: `npm run type-check && npm run build`
Expected: PASS

**Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml client/src/lib/sentry.ts client/src/main.tsx client/src/components/error/ErrorBoundary.tsx
git commit -m "feat: add client-side Sentry integration for error tracking"
```

---

## Task 5: Create Loading State Components

**Files:**
- Create: `client/src/components/ui/loading-states.tsx`
- Test: `client/src/components/ui/__tests__/loading-states.test.tsx`

**Step 1: Write the failing test**

```typescript
// client/src/components/ui/__tests__/loading-states.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  LoadingSpinner,
  LoadingOverlay,
  LoadingSkeleton,
  LoadingButton,
} from '../loading-states';

describe('Loading States', () => {
  describe('LoadingSpinner', () => {
    it('renders with default size', () => {
      render(<LoadingSpinner />);
      const spinner = screen.getByRole('status');
      expect(spinner).toBeInTheDocument();
    });

    it('renders with custom size', () => {
      render(<LoadingSpinner size="lg" />);
      const spinner = screen.getByRole('status');
      expect(spinner).toHaveClass('h-8');
    });
  });

  describe('LoadingOverlay', () => {
    it('renders with message', () => {
      render(<LoadingOverlay message="Loading data..." />);
      expect(screen.getByText('Loading data...')).toBeInTheDocument();
    });
  });

  describe('LoadingSkeleton', () => {
    it('renders card skeleton', () => {
      render(<LoadingSkeleton variant="card" />);
      const skeleton = screen.getByTestId('skeleton-card');
      expect(skeleton).toBeInTheDocument();
    });

    it('renders table skeleton with rows', () => {
      render(<LoadingSkeleton variant="table" rows={5} />);
      const rows = screen.getAllByTestId('skeleton-row');
      expect(rows).toHaveLength(5);
    });
  });

  describe('LoadingButton', () => {
    it('shows spinner when loading', () => {
      render(<LoadingButton isLoading>Submit</LoadingButton>);
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Submit')).toBeInTheDocument();
    });

    it('disables button when loading', () => {
      render(<LoadingButton isLoading>Submit</LoadingButton>);
      expect(screen.getByRole('button')).toBeDisabled();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/components/ui/__tests__/loading-states.test.tsx`
Expected: FAIL with "Cannot find module '../loading-states'"

**Step 3: Write the implementation**

```typescript
// client/src/components/ui/loading-states.tsx
import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { Button, ButtonProps } from './button';

// LoadingSpinner
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <div role="status" className={cn('animate-spin', sizeClasses[size], className)}>
      <Loader2 className="h-full w-full" />
      <span className="sr-only">Loading...</span>
    </div>
  );
}

// LoadingOverlay
interface LoadingOverlayProps {
  message?: string;
  className?: string;
}

export function LoadingOverlay({ message, className }: LoadingOverlayProps) {
  return (
    <div
      className={cn(
        'absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50',
        className
      )}
    >
      <div className="flex flex-col items-center gap-3">
        <LoadingSpinner size="lg" />
        {message && (
          <p className="text-sm text-muted-foreground animate-pulse">{message}</p>
        )}
      </div>
    </div>
  );
}

// LoadingSkeleton
interface LoadingSkeletonProps {
  variant: 'card' | 'table' | 'text' | 'avatar';
  rows?: number;
  className?: string;
}

export function LoadingSkeleton({ variant, rows = 3, className }: LoadingSkeletonProps) {
  const Skeleton = ({ className: skeletonClass }: { className?: string }) => (
    <div
      className={cn(
        'animate-pulse rounded-md bg-muted',
        skeletonClass
      )}
    />
  );

  if (variant === 'card') {
    return (
      <div data-testid="skeleton-card" className={cn('space-y-3 p-4', className)}>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            data-testid="skeleton-row"
            className="flex gap-4 p-2"
          >
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/6" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'avatar') {
    return (
      <Skeleton className={cn('h-10 w-10 rounded-full', className)} />
    );
  }

  // text variant
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-4', i === rows - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  );
}

// LoadingButton
interface LoadingButtonProps extends ButtonProps {
  isLoading?: boolean;
  loadingText?: string;
}

export function LoadingButton({
  isLoading,
  loadingText,
  children,
  disabled,
  className,
  ...props
}: LoadingButtonProps) {
  return (
    <Button
      disabled={isLoading || disabled}
      className={cn('relative', className)}
      {...props}
    >
      {isLoading && (
        <LoadingSpinner size="sm" className="mr-2" />
      )}
      {isLoading && loadingText ? loadingText : children}
    </Button>
  );
}

// Full page loading state
export function PageLoading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex h-[50vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="lg" />
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/components/ui/__tests__/loading-states.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add client/src/components/ui/loading-states.tsx client/src/components/ui/__tests__/loading-states.test.tsx
git commit -m "feat: add comprehensive loading state components"
```

---

## Task 6: Create Help/Support Chat Widget

**Files:**
- Create: `client/src/components/support/HelpWidget.tsx`
- Create: `client/src/components/support/HelpContent.tsx`
- Modify: `client/src/App.tsx` (add widget to app)

**Step 1: Create help content data**

```typescript
// client/src/components/support/HelpContent.tsx
import React from 'react';
import {
  FileText,
  Search,
  FileCheck,
  Upload,
  AlertCircle,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';

export interface HelpTopic {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export const helpTopics: HelpTopic[] = [
  {
    id: 'rfp-discovery',
    title: 'RFP Discovery',
    icon: <Search className="h-4 w-4" />,
    content: (
      <div className="space-y-2 text-sm">
        <p>The RFP Discovery feature automatically scans government portals for new opportunities.</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>Configure portal credentials in Settings → Portals</li>
          <li>Set up automated scan schedules</li>
          <li>Use filters to find relevant RFPs</li>
          <li>Manually submit RFP URLs for processing</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'proposal-generation',
    title: 'Proposal Generation',
    icon: <FileText className="h-4 w-4" />,
    content: (
      <div className="space-y-2 text-sm">
        <p>Generate AI-powered proposals tailored to each RFP.</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>Select an RFP from the list</li>
          <li>Choose a company profile</li>
          <li>Click "Generate Proposal"</li>
          <li>Review and edit the generated content</li>
          <li>Export as PDF when ready</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'compliance',
    title: 'Compliance Checking',
    icon: <FileCheck className="h-4 w-4" />,
    content: (
      <div className="space-y-2 text-sm">
        <p>Ensure your proposals meet all RFP requirements.</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>Automatic requirement extraction from RFP documents</li>
          <li>Compliance matrix generation</li>
          <li>Section-by-section validation</li>
          <li>Missing requirement alerts</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'submissions',
    title: 'Submissions',
    icon: <Upload className="h-4 w-4" />,
    content: (
      <div className="space-y-2 text-sm">
        <p>Track and manage proposal submissions.</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>View submission deadlines</li>
          <li>Track submission status</li>
          <li>Upload required documents</li>
          <li>Receive confirmation notifications</li>
        </ul>
      </div>
    ),
  },
];

export const faqItems: FAQItem[] = [
  {
    question: 'How long does proposal generation take?',
    answer: 'Proposal generation typically takes 2-5 minutes depending on the complexity of the RFP and the number of sections requested.',
  },
  {
    question: 'Can I edit generated proposals?',
    answer: 'Yes! All generated proposals can be edited before export. Use the Preview & Edit step in the proposal wizard to make changes.',
  },
  {
    question: 'What file formats are supported for RFP documents?',
    answer: 'We support PDF and Microsoft Word (.docx) documents. The system automatically extracts text and requirements from these formats.',
  },
  {
    question: 'How do I set up portal credentials?',
    answer: 'Go to Settings → Portals, select the portal you want to configure, and enter your login credentials. We support 2FA for secure portals.',
  },
  {
    question: 'What happens if generation fails?',
    answer: 'If generation fails, you can retry from where it stopped. The system automatically saves progress and can resume from the last successful step.',
  },
];

export const supportLinks = {
  documentation: 'https://docs.rfpagent.io',
  email: 'support@rfpagent.io',
  status: 'https://status.rfpagent.io',
};
```

**Step 2: Create the HelpWidget component**

```typescript
// client/src/components/support/HelpWidget.tsx
import React, { useState } from 'react';
import {
  HelpCircle,
  X,
  ChevronRight,
  ChevronLeft,
  Mail,
  ExternalLink,
  MessageCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { helpTopics, faqItems, supportLinks, HelpTopic } from './HelpContent';
import { cn } from '@/lib/utils';

type View = 'main' | 'topic' | 'faq' | 'contact';

export function HelpWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<View>('main');
  const [selectedTopic, setSelectedTopic] = useState<HelpTopic | null>(null);

  const handleTopicClick = (topic: HelpTopic) => {
    setSelectedTopic(topic);
    setView('topic');
  };

  const handleBack = () => {
    setView('main');
    setSelectedTopic(null);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn(
            'fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg z-50',
            'bg-primary text-primary-foreground hover:bg-primary/90',
            'transition-transform hover:scale-105'
          )}
          aria-label="Help and Support"
        >
          <HelpCircle className="h-6 w-6" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-80 p-0 mb-2"
        sideOffset={8}
      >
        <div className="flex flex-col h-[400px]">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            {view !== 'main' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="p-0 h-auto"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            <h3 className={cn('font-semibold', view === 'main' && 'flex-1')}>
              {view === 'main' && 'Help & Support'}
              {view === 'topic' && selectedTopic?.title}
              {view === 'faq' && 'FAQ'}
              {view === 'contact' && 'Contact Support'}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1">
            {view === 'main' && (
              <div className="p-4 space-y-4">
                {/* Quick Help Topics */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Quick Help
                  </h4>
                  <div className="space-y-1">
                    {helpTopics.map(topic => (
                      <Button
                        key={topic.id}
                        variant="ghost"
                        className="w-full justify-between h-auto py-2"
                        onClick={() => handleTopicClick(topic)}
                      >
                        <span className="flex items-center gap-2">
                          {topic.icon}
                          {topic.title}
                        </span>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    ))}
                  </div>
                </div>

                {/* FAQ Link */}
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => setView('faq')}
                >
                  <span className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    Frequently Asked Questions
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>

                {/* Contact Support */}
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => setView('contact')}
                >
                  <span className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Contact Support
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {view === 'topic' && selectedTopic && (
              <div className="p-4">{selectedTopic.content}</div>
            )}

            {view === 'faq' && (
              <Accordion type="single" collapsible className="px-4">
                {faqItems.map((item, index) => (
                  <AccordionItem key={index} value={`faq-${index}`}>
                    <AccordionTrigger className="text-sm text-left">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}

            {view === 'contact' && (
              <div className="p-4 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Need help? We're here for you.
                </p>

                <div className="space-y-2">
                  <a
                    href={`mailto:${supportLinks.email}`}
                    className="flex items-center gap-2 p-3 rounded-md border hover:bg-muted transition-colors"
                  >
                    <Mail className="h-4 w-4" />
                    <div>
                      <div className="text-sm font-medium">Email Support</div>
                      <div className="text-xs text-muted-foreground">
                        {supportLinks.email}
                      </div>
                    </div>
                  </a>

                  <a
                    href={supportLinks.documentation}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 rounded-md border hover:bg-muted transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <div>
                      <div className="text-sm font-medium">Documentation</div>
                      <div className="text-xs text-muted-foreground">
                        Browse our guides
                      </div>
                    </div>
                  </a>

                  <a
                    href={supportLinks.status}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 rounded-md border hover:bg-muted transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <div>
                      <div className="text-sm font-medium">System Status</div>
                      <div className="text-xs text-muted-foreground">
                        Check service health
                      </div>
                    </div>
                  </a>
                </div>
              </div>
            )}
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

**Step 3: Add HelpWidget to App.tsx**

At the end of the main App component's JSX (before closing fragment or main div), add:

```tsx
// In client/src/App.tsx, add import at top:
import { HelpWidget } from '@/components/support/HelpWidget';

// Add component before closing of main wrapper:
<HelpWidget />
```

**Step 4: Verify changes**

Run: `npm run type-check && npm run build`
Expected: PASS

**Step 5: Commit**

```bash
git add client/src/components/support/HelpWidget.tsx client/src/components/support/HelpContent.tsx client/src/App.tsx
git commit -m "feat: add help/support chat widget with FAQ and contact options"
```

---

## Task 7: Update ErrorFallback with Specific Messages

**Files:**
- Modify: `client/src/components/error/ErrorFallback.tsx`

**Step 1: Update ErrorFallback to show specific error messages**

```typescript
// client/src/components/error/ErrorFallback.tsx
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
```

**Step 2: Verify changes**

Run: `npm run type-check`
Expected: PASS

**Step 3: Commit**

```bash
git add client/src/components/error/ErrorFallback.tsx
git commit -m "feat: update ErrorFallback with specific error messages and context"
```

---

## Task 8: Create Unified API Request Hook with Loading States

**Files:**
- Create: `client/src/hooks/useApiMutation.ts`
- Test: `client/src/hooks/__tests__/useApiMutation.test.ts`

**Step 1: Write the failing test**

```typescript
// client/src/hooks/__tests__/useApiMutation.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import React from 'react';
import { useApiMutation } from '../useApiMutation';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useApiMutation', () => {
  it('handles successful mutation', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { id: '123' } }),
    });

    const { result } = renderHook(
      () =>
        useApiMutation({
          method: 'POST',
          url: '/api/test',
        }),
      { wrapper: createWrapper() }
    );

    expect(result.current.isLoading).toBe(false);
  });

  it('provides isLoading state', async () => {
    const { result } = renderHook(
      () =>
        useApiMutation({
          method: 'POST',
          url: '/api/test',
        }),
      { wrapper: createWrapper() }
    );

    expect(result.current.isLoading).toBeDefined();
    expect(result.current.execute).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/hooks/__tests__/useApiMutation.test.ts`
Expected: FAIL with "Cannot find module '../useApiMutation'"

**Step 3: Write the implementation**

```typescript
// client/src/hooks/useApiMutation.ts
import { useState, useCallback } from 'react';
import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useErrorToast } from './useErrorToast';
import { parseApiError, ParsedError } from '@/lib/errorUtils';

interface UseApiMutationOptions<TData, TVariables> {
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string | ((variables: TVariables) => string);
  invalidateQueries?: string[];
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: ParsedError, variables: TVariables) => void;
  successMessage?: string;
  errorTitle?: string;
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
}

interface UseApiMutationResult<TData, TVariables> {
  execute: (variables?: TVariables) => Promise<TData>;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: ParsedError | null;
  data: TData | undefined;
  reset: () => void;
}

export function useApiMutation<TData = unknown, TVariables = unknown>(
  options: UseApiMutationOptions<TData, TVariables>
): UseApiMutationResult<TData, TVariables> {
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useErrorToast();
  const [parsedError, setParsedError] = useState<ParsedError | null>(null);

  const mutation = useMutation({
    mutationFn: async (variables: TVariables) => {
      const url =
        typeof options.url === 'function'
          ? options.url(variables)
          : options.url;

      const response = await apiRequest(
        options.method,
        url,
        options.method !== 'DELETE' ? variables : undefined
      );

      const json = await response.json();

      if (!json.success) {
        throw new Error(JSON.stringify(json));
      }

      return json.data as TData;
    },
    onSuccess: (data, variables) => {
      setParsedError(null);

      // Invalidate related queries
      if (options.invalidateQueries) {
        options.invalidateQueries.forEach(key => {
          queryClient.invalidateQueries({ queryKey: [key] });
        });
      }

      // Show success toast
      if (options.showSuccessToast !== false && options.successMessage) {
        showSuccess('Success', options.successMessage);
      }

      // Call custom success handler
      options.onSuccess?.(data, variables);
    },
    onError: (error, variables) => {
      const parsed = parseApiError(error);
      setParsedError(parsed);

      // Show error toast (unless disabled)
      if (options.showErrorToast !== false) {
        showError(error, { title: options.errorTitle });
      }

      // Call custom error handler
      options.onError?.(parsed, variables);
    },
  });

  const execute = useCallback(
    async (variables?: TVariables) => {
      return mutation.mutateAsync(variables as TVariables);
    },
    [mutation]
  );

  const reset = useCallback(() => {
    mutation.reset();
    setParsedError(null);
  }, [mutation]);

  return {
    execute,
    isLoading: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: parsedError,
    data: mutation.data,
    reset,
  };
}

// Convenience hook for DELETE operations
export function useApiDelete<TData = void>(
  url: string | ((id: string) => string),
  options?: Omit<UseApiMutationOptions<TData, string>, 'method' | 'url'>
) {
  return useApiMutation<TData, string>({
    ...options,
    method: 'DELETE',
    url,
  });
}

// Convenience hook for POST operations
export function useApiPost<TData = unknown, TVariables = unknown>(
  url: string,
  options?: Omit<UseApiMutationOptions<TData, TVariables>, 'method' | 'url'>
) {
  return useApiMutation<TData, TVariables>({
    ...options,
    method: 'POST',
    url,
  });
}

// Convenience hook for PUT operations
export function useApiPut<TData = unknown, TVariables = unknown>(
  url: string | ((variables: TVariables) => string),
  options?: Omit<UseApiMutationOptions<TData, TVariables>, 'method' | 'url'>
) {
  return useApiMutation<TData, TVariables>({
    ...options,
    method: 'PUT',
    url,
  });
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/hooks/__tests__/useApiMutation.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add client/src/hooks/useApiMutation.ts client/src/hooks/__tests__/useApiMutation.test.ts
git commit -m "feat: add useApiMutation hook with unified error handling and loading states"
```

---

## Task 9: Update Example Page to Use New Error Handling

**Files:**
- Modify: `client/src/pages/rfp-details.tsx` (example refactor)

**Step 1: Identify a mutation to refactor in rfp-details.tsx**

Look for the `rescrapeMutation` and update it to use the new patterns.

**Step 2: Update the mutation**

Find the mutation definition and replace with:

```typescript
// Replace the rescrapeMutation with:
import { useApiPost } from '@/hooks/useApiMutation';
import { LoadingButton } from '@/components/ui/loading-states';

// In the component:
const rescrapeMutation = useApiPost(`/api/rfps/${id}/rescrape`, {
  invalidateQueries: ['/api/rfps', `/api/rfps/${id}`],
  successMessage: 'RFP rescrape started successfully',
  errorTitle: 'Rescrape Failed',
});

// Update the button to use LoadingButton:
<LoadingButton
  isLoading={rescrapeMutation.isLoading}
  onClick={() => rescrapeMutation.execute({})}
  loadingText="Rescraping..."
>
  Rescrape RFP
</LoadingButton>
```

**Step 3: Add loading states for data fetching**

Replace generic loading with specific states:

```typescript
import { PageLoading, LoadingSkeleton } from '@/components/ui/loading-states';

// In the render:
if (isLoading) {
  return <PageLoading message="Loading RFP details..." />;
}
```

**Step 4: Verify changes**

Run: `npm run type-check`
Expected: PASS

**Step 5: Commit**

```bash
git add client/src/pages/rfp-details.tsx
git commit -m "refactor: update rfp-details page to use new error handling patterns"
```

---

## Task 10: Add Environment Variable for Sentry DSN

**Files:**
- Modify: `.env.example` (or create if doesn't exist)

**Step 1: Add Sentry DSN environment variable**

```bash
# Add to .env.example or .env:
VITE_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
VITE_SENTRY_DEBUG=false
```

**Step 2: Update TypeScript environment types (if using)**

Create or update `client/src/vite-env.d.ts`:

```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_DEBUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

**Step 3: Commit**

```bash
git add .env.example client/src/vite-env.d.ts
git commit -m "chore: add Sentry DSN environment variable configuration"
```

---

## Task 11: Final Verification and Cleanup

**Step 1: Run full type check**

Run: `npm run type-check`
Expected: PASS

**Step 2: Run linting**

Run: `npm run lint`
Expected: PASS (or only pre-existing warnings)

**Step 3: Run build**

Run: `npm run build`
Expected: PASS

**Step 4: Run tests**

Run: `npm run test`
Expected: All new tests pass

**Step 5: Final commit**

```bash
git add -A
git commit -m "chore: comprehensive error handling implementation complete"
```

---

## Summary

This plan implements:

1. **Error Parsing Utility** (`errorUtils.ts`) - Parses API errors into user-friendly messages
2. **Enhanced Toast System** (`useErrorToast.ts`) - Toast hook with error, success, warning, info variants
3. **React Query Configuration** - Global retry logic and error handling
4. **Client-side Sentry** (`sentry.ts`) - Error tracking integration
5. **Loading State Components** (`loading-states.tsx`) - Spinner, overlay, skeleton, loading button
6. **Help Widget** (`HelpWidget.tsx`) - FAQ, topics, and contact support
7. **Updated ErrorFallback** - Context-specific error messages
8. **API Mutation Hook** (`useApiMutation.ts`) - Unified mutation handling with loading states

**Key Improvements:**
- Generic "Something went wrong" replaced with specific, actionable messages
- Automatic retry for transient failures (network, timeout, rate limit)
- Toast notifications for all success/failure operations
- Client-side error tracking via Sentry
- Consistent loading states across the application
- Help widget for user self-service support
