import { RateLimitError } from './errors.js';

/**
 * Token bucket rate limiter implementation
 */
class TokenBucket {
  constructor(capacity, refillRate, refillPeriod = 1000) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRate = refillRate;
    this.refillPeriod = refillPeriod;
    this.lastRefill = Date.now();
  }

  consume(tokens = 1) {
    this.refill();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    
    return false;
  }

  refill() {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const tokensToAdd = Math.floor((timePassed / this.refillPeriod) * this.refillRate);
    
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  getAvailableTokens() {
    this.refill();
    return this.tokens;
  }

  getTimeUntilRefill() {
    const now = Date.now();
    const timeSinceLastRefill = now - this.lastRefill;
    return Math.max(0, this.refillPeriod - timeSinceLastRefill);
  }
}

/**
 * Rate limiter with multiple strategies
 */
class RateLimiter {
  constructor(options = {}) {
    const {
      strategy = 'token-bucket',
      requests = 100,
      window = 60000, // 1 minute
      burst = 10,
      skipSuccessfulRequests = false,
      skipFailedRequests = false
    } = options;

    this.strategy = strategy;
    this.requests = requests;
    this.window = window;
    this.burst = burst;
    this.skipSuccessfulRequests = skipSuccessfulRequests;
    this.skipFailedRequests = skipFailedRequests;

    // Storage for different rate limiting strategies
    this.buckets = new Map();
    this.slidingWindows = new Map();
    this.fixedWindows = new Map();
  }

  /**
   * Check if request should be allowed
   */
  async isAllowed(key, tokens = 1) {
    switch (this.strategy) {
    case 'token-bucket':
      return this.tokenBucketCheck(key, tokens);
    case 'sliding-window':
      return this.slidingWindowCheck(key);
    case 'fixed-window':
      return this.fixedWindowCheck(key);
    default:
      throw new RateLimitError(`Unknown rate limiting strategy: ${this.strategy}`);
    }
  }

  /**
   * Token bucket rate limiting
   */
  tokenBucketCheck(key, tokens) {
    if (!this.buckets.has(key)) {
      this.buckets.set(key, new TokenBucket(this.burst, this.requests / (this.window / 1000)));
    }

    const bucket = this.buckets.get(key);
    const allowed = bucket.consume(tokens);

    if (!allowed) {
      const timeUntilRefill = bucket.getTimeUntilRefill();
      throw new RateLimitError('Rate limit exceeded', {
        strategy: 'token-bucket',
        key,
        availableTokens: bucket.getAvailableTokens(),
        timeUntilRefill,
        retryAfter: Math.ceil(timeUntilRefill / 1000)
      });
    }

    return {
      allowed: true,
      remainingTokens: bucket.getAvailableTokens(),
      resetTime: Date.now() + bucket.getTimeUntilRefill()
    };
  }

  /**
   * Sliding window rate limiting
   */
  slidingWindowCheck(key) {
    const now = Date.now();
    
    if (!this.slidingWindows.has(key)) {
      this.slidingWindows.set(key, []);
    }

    const requests = this.slidingWindows.get(key);
    
    // Remove expired requests
    const cutoff = now - this.window;
    while (requests.length > 0 && requests[0] < cutoff) {
      requests.shift();
    }

    if (requests.length >= this.requests) {
      const oldestRequest = requests[0];
      const resetTime = oldestRequest + this.window;
      const retryAfter = Math.ceil((resetTime - now) / 1000);

      throw new RateLimitError('Rate limit exceeded', {
        strategy: 'sliding-window',
        key,
        requestCount: requests.length,
        limit: this.requests,
        windowMs: this.window,
        resetTime,
        retryAfter
      });
    }

    requests.push(now);
    
    return {
      allowed: true,
      remainingRequests: this.requests - requests.length,
      resetTime: requests[0] + this.window
    };
  }

  /**
   * Fixed window rate limiting
   */
  fixedWindowCheck(key) {
    const now = Date.now();
    const windowStart = Math.floor(now / this.window) * this.window;
    const windowKey = `${key}:${windowStart}`;

    if (!this.fixedWindows.has(windowKey)) {
      this.fixedWindows.set(windowKey, {
        count: 0,
        resetTime: windowStart + this.window
      });

      // Clean up old windows
      this.cleanupFixedWindows(now);
    }

    const windowData = this.fixedWindows.get(windowKey);

    if (windowData.count >= this.requests) {
      const retryAfter = Math.ceil((windowData.resetTime - now) / 1000);

      throw new RateLimitError('Rate limit exceeded', {
        strategy: 'fixed-window',
        key,
        requestCount: windowData.count,
        limit: this.requests,
        resetTime: windowData.resetTime,
        retryAfter
      });
    }

    windowData.count++;

    return {
      allowed: true,
      remainingRequests: this.requests - windowData.count,
      resetTime: windowData.resetTime
    };
  }

  /**
   * Clean up expired fixed windows
   */
  cleanupFixedWindows(now) {
    for (const [key, data] of this.fixedWindows) {
      if (data.resetTime <= now) {
        this.fixedWindows.delete(key);
      }
    }
  }

  /**
   * Reset rate limit for a key
   */
  reset(key) {
    this.buckets.delete(key);
    this.slidingWindows.delete(key);
    
    // Clean up fixed windows for this key
    for (const windowKey of this.fixedWindows.keys()) {
      if (windowKey.startsWith(`${key}:`)) {
        this.fixedWindows.delete(windowKey);
      }
    }
  }

  /**
   * Get rate limit status for a key
   */
  getStatus(key) {
    switch (this.strategy) {
    case 'token-bucket': {
      const bucket = this.buckets.get(key);
      if (!bucket) return {
        strategy: 'token-bucket',
        availableTokens: 0,
        capacity: this.burst,
        timeUntilRefill: 0
      };
        
      return {
        strategy: 'token-bucket',
        availableTokens: bucket.getAvailableTokens(),
        capacity: bucket.capacity,
        timeUntilRefill: bucket.getTimeUntilRefill()
      };
    }
      
    case 'sliding-window': {
      const requests = this.slidingWindows.get(key);
      if (!requests) return null;
        
      const now = Date.now();
      const cutoff = now - this.window;
      const activeRequests = requests.filter(time => time > cutoff);
        
      return {
        strategy: 'sliding-window',
        requestCount: activeRequests.length,
        limit: this.requests,
        remainingRequests: this.requests - activeRequests.length,
        resetTime: activeRequests.length > 0 ? activeRequests[0] + this.window : null
      };
    }
      
    case 'fixed-window': {
      const now = Date.now();
      const windowStart = Math.floor(now / this.window) * this.window;
      const windowKey = `${key}:${windowStart}`;
      const windowData = this.fixedWindows.get(windowKey);
        
      if (!windowData) {
        return {
          strategy: 'fixed-window',
          requestCount: 0,
          limit: this.requests,
          remainingRequests: this.requests,
          resetTime: windowStart + this.window
        };
      }
        
      return {
        strategy: 'fixed-window',
        requestCount: windowData.count,
        limit: this.requests,
        remainingRequests: this.requests - windowData.count,
        resetTime: windowData.resetTime
      };
    }
      
    default:
      return null;
    }
  }

  /**
   * Health check
   */
  healthCheck() {
    return {
      strategy: this.strategy,
      activeKeys: {
        tokenBuckets: this.buckets.size,
        slidingWindows: this.slidingWindows.size,
        fixedWindows: this.fixedWindows.size
      },
      configuration: {
        requests: this.requests,
        window: this.window,
        burst: this.burst
      }
    };
  }
}

export {
  RateLimiter,
  TokenBucket
};
