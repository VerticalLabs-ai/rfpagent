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
  SERVICE_UNAVAILABLE:
    'The service is temporarily unavailable. Please try again later.',
  NETWORK_ERROR:
    'Unable to connect to server. Please check your internet connection.',
  TIMEOUT: 'The request timed out. Please try again.',
  CONFLICT: 'This resource already exists.',
  INTERNAL_ERROR: 'An unexpected error occurred. Please try again later.',
};

export function isRetryableError(code: string): boolean {
  return RETRYABLE_ERROR_CODES.has(code);
}

export function parseApiError(errorOrText: unknown): ParsedError {
  // Handle network errors (TypeError: Failed to fetch)
  if (
    errorOrText instanceof TypeError &&
    errorOrText.message.includes('fetch')
  ) {
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
            isRetryable: isRetryableError(
              parsed.error.code || getCodeFromStatus(status)
            ),
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
        retryAfter: (error.details as Record<string, unknown>)?.retryAfter as
          | number
          | undefined,
      };
    }
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred',
    isRetryable: false,
  };
}

export function getErrorMessage(
  code: string,
  originalMessage: string,
  field?: string
): string {
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
