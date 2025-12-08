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
