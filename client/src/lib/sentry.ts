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
