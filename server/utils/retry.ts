import { logger } from './logger';

/**
 * Retry Utility with Exponential Backoff and Jitter
 * Provides resilient retry logic for operations that may fail transiently
 */

export interface RetryOptions {
  maxAttempts?: number; // Maximum number of retry attempts
  initialDelay?: number; // Initial delay in ms
  maxDelay?: number; // Maximum delay in ms
  backoffMultiplier?: number; // Exponential backoff multiplier
  jitter?: boolean; // Add random jitter to delay
  shouldRetry?: (error: any, attempt: number) => boolean; // Custom retry predicate
  onRetry?: (error: any, attempt: number, delay: number) => void; // Callback on retry
}

export interface RetryStats {
  attempts: number;
  totalDelay: number;
  success: boolean;
  error?: any;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
  shouldRetry: () => true,
  onRetry: () => {},
};

/**
 * Retry an async operation with exponential backoff
 */
export async function retry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const stats: RetryStats = {
    attempts: 0,
    totalDelay: 0,
    success: false,
  };

  let lastError: any;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    stats.attempts = attempt;

    try {
      const result = await operation();
      stats.success = true;

      if (attempt > 1) {
        logger.info(`Operation succeeded after ${attempt} attempts`, {
          attempts: attempt,
          totalDelay: stats.totalDelay,
        });
      }

      return result;
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (
        attempt === config.maxAttempts ||
        !config.shouldRetry(error, attempt)
      ) {
        stats.error = error;
        logger.error(
          `Operation failed after ${attempt} attempts`,
          error instanceof Error ? error : new Error(String(error)),
          {
            attempts: attempt,
            totalDelay: stats.totalDelay,
          }
        );
        throw error;
      }

      // Calculate delay with exponential backoff
      const baseDelay = Math.min(
        config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1),
        config.maxDelay
      );

      // Add jitter if enabled (random value between 0 and baseDelay/2)
      const jitterDelay = config.jitter ? Math.random() * baseDelay * 0.5 : 0;
      const delay = Math.floor(baseDelay + jitterDelay);

      stats.totalDelay += delay;

      // Call retry callback
      config.onRetry(error, attempt, delay);

      logger.warn(`Operation failed, retrying in ${delay}ms`, {
        attempt,
        maxAttempts: config.maxAttempts,
        delay,
        error: error instanceof Error ? error.message : String(error),
      });

      // Wait before next attempt
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Retry with custom predicate for specific error types
 */
export async function retryOnError<T>(
  operation: () => Promise<T>,
  errorPredicate: (error: any) => boolean,
  options: RetryOptions = {}
): Promise<T> {
  return retry(operation, {
    ...options,
    shouldRetry: (error, attempt) => {
      const shouldRetry = errorPredicate(error);
      if (!shouldRetry) {
        logger.debug(`Not retrying due to error type`, {
          attempt,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return shouldRetry;
    },
  });
}

/**
 * Retry HTTP operations (retry on 5xx and specific 4xx errors)
 */
export async function retryHttp<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  return retryOnError(
    operation,
    error => {
      // Retry on network errors
      if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
        return true;
      }

      // Retry on 5xx errors
      if (error.statusCode >= 500 && error.statusCode < 600) {
        return true;
      }

      // Retry on specific 4xx errors (rate limiting, too many requests)
      if (error.statusCode === 429 || error.statusCode === 408) {
        return true;
      }

      return false;
    },
    options
  );
}

/**
 * Retry database operations
 */
export async function retryDatabase<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  return retryOnError(
    operation,
    error => {
      // Retry on connection errors
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        return true;
      }

      // Retry on deadlocks
      if (error.code === '40P01') {
        // PostgreSQL deadlock
        return true;
      }

      // Retry on connection pool exhaustion
      if (error.message?.includes('pool exhausted')) {
        return true;
      }

      return false;
    },
    options
  );
}

/**
 * Bulk retry - retry multiple operations with individual retry logic
 */
export async function retryBulk<T>(
  operations: Array<() => Promise<T>>,
  options: RetryOptions = {}
): Promise<Array<{ success: boolean; result?: T; error?: any }>> {
  const results = await Promise.allSettled(
    operations.map(op => retry(op, options))
  );

  return results.map(result => {
    if (result.status === 'fulfilled') {
      return { success: true, result: result.value };
    } else {
      return { success: false, error: result.reason };
    }
  });
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a retryable function wrapper
 */
export function makeRetryable<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: RetryOptions = {}
): T {
  return ((...args: any[]) => retry(() => fn(...args), options)) as T;
}

/**
 * Retry with timeout
 */
export async function retryWithTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  retryOptions: RetryOptions = {}
): Promise<T> {
  return Promise.race([
    retry(operation, retryOptions),
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Operation timeout after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
}
