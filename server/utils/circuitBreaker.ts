import { logger } from './logger';

/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures by failing fast when a service is unavailable
 */

export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  failureThreshold: number; // Number of failures before opening circuit
  successThreshold: number; // Number of successes needed to close circuit from half-open
  timeout: number; // Time in ms before attempting to close circuit
  resetTimeout?: number; // Time to reset failure count if circuit stays closed
}

export interface CircuitBreakerStats {
  state: CircuitBreakerState;
  failures: number;
  successes: number;
  totalCalls: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
}

export class CircuitBreaker {
  private state: CircuitBreakerState = 'closed';
  private failures = 0;
  private successes = 0;
  private totalCalls = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private nextAttempt?: number;
  private resetTimer?: NodeJS.Timeout;
  public lastExecutionTime?: number; // Track last execution for cleanup

  constructor(
    private name: string,
    private options: CircuitBreakerOptions
  ) {
    logger.debug(`Circuit breaker created: ${name}`, { options });
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalCalls++;
    this.lastExecutionTime = Date.now(); // Track execution time for cleanup

    // Check if circuit is open
    if (this.state === 'open') {
      if (this.nextAttempt && Date.now() < this.nextAttempt) {
        const error = new Error(
          `Circuit breaker is open for ${this.name}. Next attempt in ${Math.ceil((this.nextAttempt - Date.now()) / 1000)}s`
        );
        logger.warn(`Circuit breaker preventing call`, {
          service: this.name,
          state: this.state,
          failures: this.failures,
        });
        throw error;
      }

      // Try half-open
      this.state = 'half-open';
      this.successes = 0;
      logger.info(`Circuit breaker transitioning to half-open`, {
        service: this.name,
      });
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.lastSuccessTime = Date.now();
    this.successes++;

    if (this.state === 'half-open') {
      if (this.successes >= this.options.successThreshold) {
        this.close();
      }
    } else if (this.state === 'closed') {
      // Reset failure count after successful calls
      this.failures = 0;
      this.scheduleReset();
    }

    logger.debug(`Circuit breaker success`, {
      service: this.name,
      state: this.state,
      successes: this.successes,
    });
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.lastFailureTime = Date.now();
    this.failures++;

    logger.warn(`Circuit breaker failure`, {
      service: this.name,
      state: this.state,
      failures: this.failures,
      threshold: this.options.failureThreshold,
    });

    if (this.state === 'half-open') {
      // Immediately open on failure in half-open state
      this.open();
    } else if (this.failures >= this.options.failureThreshold) {
      this.open();
    }
  }

  /**
   * Open the circuit
   */
  private open(): void {
    this.state = 'open';
    this.nextAttempt = Date.now() + this.options.timeout;
    this.successes = 0;

    const error = new Error(`Circuit breaker opened`);
    (error as any).service = this.name;
    (error as any).failures = this.failures;
    (error as any).timeout = this.options.timeout;
    logger.error(error.message, error);
  }

  /**
   * Close the circuit
   */
  private close(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.nextAttempt = undefined;

    logger.info(`Circuit breaker closed`, {
      service: this.name,
    });

    this.scheduleReset();
  }

  /**
   * Schedule reset timer
   */
  private scheduleReset(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }

    if (this.options.resetTimeout) {
      this.resetTimer = setTimeout(() => {
        this.failures = 0;
        this.successes = 0;
        logger.debug(`Circuit breaker stats reset`, {
          service: this.name,
        });
      }, this.options.resetTimeout);
    }
  }

  /**
   * Get current statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      totalCalls: this.totalCalls,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.totalCalls = 0;
    this.nextAttempt = undefined;

    logger.info(`Circuit breaker manually reset`, {
      service: this.name,
    });
  }

  /**
   * Force open the circuit
   */
  forceOpen(): void {
    this.open();
    logger.warn(`Circuit breaker forcefully opened`, {
      service: this.name,
    });
  }
}

/**
 * Circuit Breaker Manager
 * Manages multiple circuit breakers for different services
 */
export class CircuitBreakerManager {
  private breakers = new Map<string, CircuitBreaker>();

  // Memory leak protection
  private readonly MAX_BREAKERS = 1000;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start periodic cleanup of unused breakers
    this.startCleanup();
  }

  /**
   * Start automatic cleanup of unused circuit breakers
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(
      () => {
        this.pruneUnusedBreakers();
      },
      30 * 60 * 1000
    ); // Every 30 minutes
  }

  /**
   * Remove circuit breakers that haven't been used recently
   */
  private pruneUnusedBreakers(): void {
    const cutoffTime = Date.now() - 60 * 60 * 1000; // 1 hour ago
    let pruned = 0;

    for (const [name, breaker] of this.breakers.entries()) {
      // Remove if breaker is closed and hasn't been used in the last hour
      if (
        breaker.getStats().state === 'closed' &&
        breaker.lastExecutionTime &&
        breaker.lastExecutionTime < cutoffTime
      ) {
        this.breakers.delete(name);
        pruned++;
      }
    }

    if (pruned > 0) {
      console.log(`🧹 CircuitBreaker: Pruned ${pruned} unused breakers`);
    }
  }

  /**
   * Shutdown and cleanup
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.breakers.clear();
    console.log('✅ CircuitBreakerManager shutdown complete');
  }

  /**
   * Get or create circuit breaker for a service
   */
  getBreaker(
    serviceName: string,
    options: CircuitBreakerOptions = {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000, // 1 minute
      resetTimeout: 300000, // 5 minutes
    }
  ): CircuitBreaker {
    if (!this.breakers.has(serviceName)) {
      this.breakers.set(serviceName, new CircuitBreaker(serviceName, options));
    }
    return this.breakers.get(serviceName)!;
  }

  /**
   * Get all circuit breaker stats
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
    logger.info('All circuit breakers reset');
  }
}

// Export singleton instance
export const circuitBreakerManager = new CircuitBreakerManager();

// Convenience function to wrap async operations
export async function withCircuitBreaker<T>(
  serviceName: string,
  fn: () => Promise<T>,
  options?: CircuitBreakerOptions
): Promise<T> {
  const breaker = circuitBreakerManager.getBreaker(serviceName, options);
  return breaker.execute(fn);
}
