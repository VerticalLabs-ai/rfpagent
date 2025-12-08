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
