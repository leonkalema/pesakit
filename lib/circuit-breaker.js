import CircuitBreaker from 'opossum';
import { NetworkError } from './errors.js';

/**
 * Circuit breaker configuration for API resilience
 */
class PesakitCircuitBreaker {
  constructor(options = {}) {
    const {
      timeout = 30000,
      errorThresholdPercentage = 50,
      resetTimeout = 60000,
      volumeThreshold = 10,
      monitoringPeriod = 10000,
      enabled = true
    } = options;

    this.options = {
      timeout,
      errorThresholdPercentage,
      resetTimeout,
      volumeThreshold,
      monitoringPeriod,
      enabled
    };

    // Store circuit breakers for different endpoints
    this.breakers = new Map();
  }

  /**
   * Get or create circuit breaker for specific endpoint
   */
  getBreaker(endpoint, customOptions = {}) {
    // If circuit breaker is disabled, return null
    if (!this.options.enabled) {
      return null;
    }

    if (!this.breakers.has(endpoint)) {
      const breakerOptions = {
        ...this.options,
        ...customOptions,
        name: `${this.options.name}-${endpoint}`
      };

      const breaker = new CircuitBreaker(this.executeRequest.bind(this), breakerOptions);
      
      // Event handlers
      breaker.on('open', () => this.handleOpen(endpoint));
      breaker.on('halfOpen', () => this.handleHalfOpen(endpoint));
      breaker.on('close', () => this.handleClose(endpoint));
      breaker.on('fallback', (result) => this.handleFallback(endpoint, result));

      this.breakers.set(endpoint, breaker);
    }

    return this.breakers.get(endpoint);
  }

  /**
   * Execute request through circuit breaker
   */
  async executeRequest(requestFn, ...args) {
    try {
      return await requestFn(...args);
    } catch (error) {
      if (this.isRetryableError(error)) {
        throw new NetworkError('Circuit breaker detected retryable error', {
          originalError: error.message,
          code: error.code,
          statusCode: error.response?.status
        });
      }
      throw error;
    }
  }

  /**
   * Determine if error should trigger circuit breaker
   */
  isRetryableError(error) {
    // Network errors
    if (error.code === 'ECONNRESET' || 
        error.code === 'ENOTFOUND' || 
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT') {
      return true;
    }

    // HTTP status codes that should trigger circuit breaker
    const status = error.response?.status;
    if (status >= 500 || status === 429 || status === 408) {
      return true;
    }

    // Rate limiting
    if (error.code === 'RATE_LIMIT_ERROR') {
      return true;
    }

    return false;
  }

  /**
   * Wrap API call with circuit breaker
   */
  async protect(endpoint, requestFn, ...args) {
    // If circuit breaker is disabled (e.g., for tests), just execute the function
    if (!this.options.enabled) {
      return await requestFn(...args);
    }

    const breaker = this.getBreaker(endpoint);
    
    // If breaker is null (disabled), just execute the function
    if (!breaker) {
      return await requestFn(...args);
    }
    
    try {
      return await breaker.fire(requestFn, ...args);
    } catch (error) {
      if (breaker.opened) {
        throw new NetworkError(`Circuit breaker is OPEN for ${endpoint}`, {
          endpoint,
          state: 'OPEN',
          nextAttempt: new Date(Date.now() + this.options.resetTimeout).toISOString()
        });
      }
      // For authentication errors (401), preserve the original error to be handled upstream
      if (error.response && error.response.status === 401) {
        throw error;
      }
      throw error;
    }
  }

  /**
   * Event handlers
   */
  handleOpen(endpoint) {
    console.warn(`Circuit breaker OPENED for endpoint: ${endpoint}`);
  }

  handleHalfOpen(endpoint) {
    console.info(`Circuit breaker HALF-OPEN for endpoint: ${endpoint}`);
  }

  handleClose(endpoint) {
    console.info(`Circuit breaker CLOSED for endpoint: ${endpoint}`);
  }

  handleFallback(endpoint, _result) {
    console.warn(`Circuit breaker fallback triggered for endpoint: ${endpoint}`);
  }

  /**
   * Get circuit breaker stats
   */
  getStats(endpoint = null) {
    if (endpoint) {
      const breaker = this.breakers.get(endpoint);
      return breaker ? breaker.stats : null;
    }

    const stats = {};
    for (const [endpoint, breaker] of this.breakers) {
      stats[endpoint] = breaker.stats;
    }
    return stats;
  }

  /**
   * Reset all circuit breakers to closed state
   */
  resetAll() {
    for (const [, breaker] of this.breakers) {
      breaker.close();
    }
  }

  /**
   * Health check for all circuit breakers
   */
  healthCheck() {
    const health = {
      healthy: true,
      breakers: {}
    };

    for (const [endpoint, breaker] of this.breakers) {
      const isHealthy = !breaker.opened;
      health.breakers[endpoint] = {
        state: breaker.opened ? 'OPEN' : breaker.halfOpen ? 'HALF_OPEN' : 'CLOSED',
        healthy: isHealthy,
        stats: breaker.stats
      };

      if (!isHealthy) {
        health.healthy = false;
      }
    }

    return health;
  }

  /**
   * Reset all circuit breakers
   */
  reset(endpoint = null) {
    // If circuit breaker is disabled, nothing to reset
    if (!this.options.enabled) {
      return;
    }

    if (endpoint) {
      const breaker = this.breakers.get(endpoint);
      if (breaker) {
        breaker.close();
      }
      return;
    }

    for (const breaker of this.breakers.values()) {
      breaker.close();
    }
  }

  /**
   * Shutdown all circuit breakers
   */
  shutdown() {
    for (const breaker of this.breakers.values()) {
      breaker.shutdown();
    }
    this.breakers.clear();
  }
}

export default PesakitCircuitBreaker;
