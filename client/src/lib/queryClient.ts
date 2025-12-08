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

  // Add content-type header if we have data
  if (data) {
    headers['Content-Type'] = 'application/json';
  }

  // Add any custom headers
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
