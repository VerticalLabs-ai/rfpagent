/**
 * Circuit Breaker Pattern Implementation for AI Services
 *
 * Prevents cascading failures by:
 * - Tracking failure rates
 * - Opening circuit when threshold exceeded
 * - Automatically testing recovery
 * - Providing fallback responses
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Too many failures, reject requests immediately
 * - HALF_OPEN: Testing if service recovered
 */

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  /** Failure threshold before opening circuit (default: 5) */
  failureThreshold: number;
  /** Success threshold to close circuit from half-open (default: 2) */
  successThreshold: number;
  /** Timeout in ms before attempting recovery (default: 60000 = 1 min) */
  timeout: number;
  /** Request timeout in ms (default: 30000 = 30 sec) */
  requestTimeout: number;
  /** Enable fallback responses (default: true) */
  enableFallback: boolean;
}

export interface CircuitBreakerMetrics {
  state: CircuitState;
  failures: number;
  successes: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
  circuitOpenCount: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private nextAttempt: number = Date.now();
  private totalRequests = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private circuitOpenCount = 0;

  constructor(
    private name: string,
    private config: CircuitBreakerConfig = {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000, // 1 minute
      requestTimeout: 30000, // 30 seconds
      enableFallback: true,
    }
  ) {}

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    fn: () => Promise<T>,
    fallback?: () => T | Promise<T>
  ): Promise<T> {
    this.totalRequests++;

    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        console.warn(
          `[Circuit Breaker ${this.name}] Circuit OPEN - rejecting request (${this.consecutiveFailures} failures)`
        );

        if (fallback && this.config.enableFallback) {
          return await fallback();
        }

        throw new Error(
          `Circuit breaker ${this.name} is OPEN. Service temporarily unavailable.`
        );
      }

      // Transition to half-open to test recovery
      this.state = CircuitState.HALF_OPEN;
      this.consecutiveSuccesses = 0;
      console.log(
        `[Circuit Breaker ${this.name}] Transitioning to HALF_OPEN - testing recovery`
      );
    }

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(fn);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);

      if (fallback && this.config.enableFallback) {
        console.log(`[Circuit Breaker ${this.name}] Using fallback response`);
        return await fallback();
      }

      throw error;
    }
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error('Request timeout')),
          this.config.requestTimeout
        )
      ),
    ]);
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.failures = 0;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses++;
    this.successes++;
    this.totalSuccesses++;
    this.lastSuccessTime = Date.now();

    // Transition from HALF_OPEN to CLOSED if enough successes
    if (
      this.state === CircuitState.HALF_OPEN &&
      this.consecutiveSuccesses >= this.config.successThreshold
    ) {
      console.log(
        `[Circuit Breaker ${this.name}] HALF_OPEN → CLOSED (${this.consecutiveSuccesses} consecutive successes)`
      );
      this.state = CircuitState.CLOSED;
      this.consecutiveSuccesses = 0;
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: any): void {
    this.failures++;
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;
    this.totalFailures++;
    this.lastFailureTime = Date.now();

    const errorType = this.classifyError(error);
    console.error(
      `[Circuit Breaker ${this.name}] Request failed (${errorType}): ${error.message}`,
      {
        consecutiveFailures: this.consecutiveFailures,
        state: this.state,
      }
    );

    // Determine if we should open the circuit
    const shouldOpen =
      this.consecutiveFailures >= this.config.failureThreshold ||
      (this.state === CircuitState.HALF_OPEN && this.consecutiveFailures > 0);

    if (shouldOpen && this.state !== CircuitState.OPEN) {
      this.openCircuit();
    }
  }

  /**
   * Open the circuit
   */
  private openCircuit(): void {
    this.state = CircuitState.OPEN;
    this.nextAttempt = Date.now() + this.config.timeout;
    this.circuitOpenCount++;

    console.error(
      `[Circuit Breaker ${this.name}] Circuit OPENED - too many failures (${this.consecutiveFailures}/${this.config.failureThreshold}). Will retry in ${this.config.timeout}ms`
    );
  }

  /**
   * Classify error type for metrics
   */
  private classifyError(error: any): string {
    if (error.message === 'Request timeout') {
      return 'TIMEOUT';
    }

    if (error.response?.status === 429) {
      return 'RATE_LIMIT';
    }

    if (error.response?.status === 503) {
      return 'SERVICE_UNAVAILABLE';
    }

    if (error.response?.status === 401 || error.response?.status === 403) {
      return 'AUTH_ERROR';
    }

    if (error.response?.status >= 500) {
      return 'SERVER_ERROR';
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return 'NETWORK_ERROR';
    }

    return 'UNKNOWN';
  }

  /**
   * Get current circuit breaker metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      circuitOpenCount: this.circuitOpenCount,
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get failure rate (0.0 to 1.0)
   */
  getFailureRate(): number {
    if (this.totalRequests === 0) return 0;
    return this.totalFailures / this.totalRequests;
  }

  /**
   * Check if circuit is healthy
   */
  isHealthy(): boolean {
    return this.state === CircuitState.CLOSED && this.consecutiveFailures === 0;
  }

  /**
   * Manually reset circuit breaker
   */
  reset(): void {
    console.log(`[Circuit Breaker ${this.name}] Manual reset`);
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.nextAttempt = Date.now();
  }

  /**
   * Force circuit open (for testing or manual intervention)
   */
  forceOpen(): void {
    console.log(`[Circuit Breaker ${this.name}] Forced OPEN`);
    this.openCircuit();
  }
}

/**
 * Circuit Breaker Manager
 * Manages multiple circuit breakers for different services
 */
export class CircuitBreakerManager {
  private breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Get or create circuit breaker
   */
  getBreaker(
    name: string,
    config?: Partial<CircuitBreakerConfig>
  ): CircuitBreaker {
    if (!this.breakers.has(name)) {
      const defaultConfig: CircuitBreakerConfig = {
        failureThreshold: 5,
        successThreshold: 2,
        timeout: 60000,
        requestTimeout: 30000,
        enableFallback: true,
      };

      this.breakers.set(
        name,
        new CircuitBreaker(name, { ...defaultConfig, ...config })
      );
    }

    return this.breakers.get(name)!;
  }

  /**
   * Get all circuit breaker metrics
   */
  getAllMetrics(): Record<string, CircuitBreakerMetrics> {
    const metrics: Record<string, CircuitBreakerMetrics> = {};

    for (const [name, breaker] of this.breakers.entries()) {
      metrics[name] = breaker.getMetrics();
    }

    return metrics;
  }

  /**
   * Check if any circuit is open
   */
  hasOpenCircuits(): boolean {
    return Array.from(this.breakers.values()).some(
      breaker => breaker.getState() === CircuitState.OPEN
    );
  }

  /**
   * Get health status of all circuits
   */
  getHealthStatus(): {
    healthy: string[];
    degraded: string[];
    unhealthy: string[];
  } {
    const status = {
      healthy: [] as string[],
      degraded: [] as string[],
      unhealthy: [] as string[],
    };

    for (const [name, breaker] of this.breakers.entries()) {
      const state = breaker.getState();
      const failureRate = breaker.getFailureRate();

      if (state === CircuitState.OPEN) {
        status.unhealthy.push(name);
      } else if (state === CircuitState.HALF_OPEN || failureRate > 0.1) {
        status.degraded.push(name);
      } else {
        status.healthy.push(name);
      }
    }

    return status;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    console.log('[Circuit Breaker Manager] Resetting all circuits');
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}

// Export singleton instance
export const circuitBreakerManager = new CircuitBreakerManager();
