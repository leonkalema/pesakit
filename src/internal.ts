import { CircuitOpenError, RateLimitError } from './errors.js';
import type { CircuitBreakerOptions, LogLevel, Logger, RateLimitOptions, RetryOptions } from './types.js';

/* ---------------------------------------------------------------- */
/* Logger                                                            */
/* ---------------------------------------------------------------- */

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 };

export function createLogger(level: LogLevel, sink: Logger | false | undefined): Logger {
  if (sink === false) return SILENT;
  const min = LEVELS[level] ?? LEVELS.warn;
  const target = sink ?? consoleLogger;
  const gate = (l: LogLevel) => (message: string, meta?: Record<string, unknown>) => {
    if (LEVELS[l] >= min) target[l === 'silent' ? 'error' : l](message, meta);
  };
  return { debug: gate('debug'), info: gate('info'), warn: gate('warn'), error: gate('error') };
}

const SILENT: Logger = { debug() {}, info() {}, warn() {}, error() {} };

const consoleLogger: Logger = {
  debug: (m, meta) => console.debug(JSON.stringify({ level: 'debug', service: 'pesakit', message: m, ...meta })),
  info: (m, meta) => console.info(JSON.stringify({ level: 'info', service: 'pesakit', message: m, ...meta })),
  warn: (m, meta) => console.warn(JSON.stringify({ level: 'warn', service: 'pesakit', message: m, ...meta })),
  error: (m, meta) => console.error(JSON.stringify({ level: 'error', service: 'pesakit', message: m, ...meta })),
};

/* ---------------------------------------------------------------- */
/* Retry                                                             */
/* ---------------------------------------------------------------- */

export interface RetryPolicy {
  retries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export function retryPolicy(opts: RetryOptions | false | undefined): RetryPolicy {
  if (opts === false) return { retries: 0, baseDelayMs: 0, maxDelayMs: 0 };
  return {
    retries: opts?.retries ?? 3,
    baseDelayMs: opts?.baseDelayMs ?? 300,
    maxDelayMs: opts?.maxDelayMs ?? 5000,
  };
}

export function backoffDelay(attempt: number, policy: RetryPolicy): number {
  const exp = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** attempt);
  return Math.round(exp / 2 + Math.random() * (exp / 2));
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/* ---------------------------------------------------------------- */
/* Circuit breaker                                                   */
/* ---------------------------------------------------------------- */

type BreakerState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private failures = 0;
  private state: BreakerState = 'closed';
  private openedAt = 0;
  private readonly threshold: number;
  private readonly resetTimeoutMs: number;

  constructor(opts: CircuitBreakerOptions | false | undefined) {
    this.threshold = opts === false ? 0 : (opts?.failureThreshold ?? 5);
    this.resetTimeoutMs = opts === false ? 0 : (opts?.resetTimeoutMs ?? 30000);
  }

  get enabled() {
    return this.threshold > 0;
  }

  snapshot() {
    return { state: this.state, failures: this.failures };
  }

  assertClosed(endpoint: string) {
    if (!this.enabled) return;
    if (this.state === 'open') {
      if (Date.now() - this.openedAt >= this.resetTimeoutMs) {
        this.state = 'half-open';
        return;
      }
      throw new CircuitOpenError(`Circuit open for ${endpoint}`, {
        endpoint,
        retryAfterMs: this.resetTimeoutMs - (Date.now() - this.openedAt),
      });
    }
  }

  onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  onFailure() {
    if (!this.enabled) return;
    this.failures += 1;
    if (this.state === 'half-open' || this.failures >= this.threshold) {
      this.state = 'open';
      this.openedAt = Date.now();
    }
  }

  reset() {
    this.onSuccess();
  }
}

/* ---------------------------------------------------------------- */
/* Rate limiter (sliding window)                                     */
/* ---------------------------------------------------------------- */

export class RateLimiter {
  private hits: number[] = [];
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(opts: RateLimitOptions | false | undefined) {
    this.limit = opts === false ? 0 : (opts?.limit ?? 100);
    this.windowMs = opts === false ? 0 : (opts?.windowMs ?? 60000);
  }

  take() {
    if (this.limit <= 0) return;
    const now = Date.now();
    const floor = now - this.windowMs;
    while (this.hits.length && this.hits[0] <= floor) this.hits.shift();
    if (this.hits.length >= this.limit) {
      throw new RateLimitError(`Rate limit of ${this.limit} per ${this.windowMs}ms reached`, {
        retryAfterMs: this.hits[0] + this.windowMs - now,
      });
    }
    this.hits.push(now);
  }

  snapshot() {
    const floor = Date.now() - this.windowMs;
    const used = this.hits.filter((t) => t > floor).length;
    return { limit: this.limit, windowMs: this.windowMs, used, remaining: Math.max(0, this.limit - used) };
  }
}

/* ---------------------------------------------------------------- */
/* Token cache                                                       */
/* ---------------------------------------------------------------- */

export class TokenCache {
  private token: string | null = null;
  private expiresAt = 0;

  get(): string | null {
    if (this.token && Date.now() < this.expiresAt) return this.token;
    this.token = null;
    return null;
  }

  set(token: string, ttlMs: number) {
    this.token = token;
    this.expiresAt = Date.now() + ttlMs;
  }

  clear() {
    this.token = null;
    this.expiresAt = 0;
  }
}

/* ---------------------------------------------------------------- */
/* Small helpers                                                     */
/* ---------------------------------------------------------------- */

export function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== null && v !== '') out[k] = v;
  return out as Partial<T>;
}
