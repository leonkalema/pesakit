/** Error object Pesapal embeds in many responses, even on HTTP 200. */
export interface PesapalErrorBody {
  error_type?: string | null;
  code?: string | null;
  message?: string | null;
  call_back_url?: string | null;
}

export interface ErrorDetails {
  statusCode?: number;
  pesapal?: PesapalErrorBody | null;
  fields?: { field: string; message: string }[];
  cause?: unknown;
  [key: string]: unknown;
}

export type PesakitErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'PAYMENT_ERROR'
  | 'NETWORK_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'CIRCUIT_OPEN';

export class PesakitError extends Error {
  readonly code: PesakitErrorCode;
  readonly statusCode: number;
  readonly details: ErrorDetails;
  readonly timestamp: string;

  constructor(message: string, code: PesakitErrorCode, statusCode: number, details: ErrorDetails = {}) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  /** Pesapal's own error code, when one was returned. */
  get pesapalCode(): string | undefined {
    return this.details.pesapal?.code ?? undefined;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

export class ValidationError extends PesakitError {
  constructor(message = 'Validation failed', details: ErrorDetails = {}) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class AuthenticationError extends PesakitError {
  constructor(message = 'Authentication failed', details: ErrorDetails = {}) {
    super(message, 'AUTHENTICATION_ERROR', 401, details);
  }
}

export class PaymentError extends PesakitError {
  constructor(message = 'Payment request failed', details: ErrorDetails = {}) {
    super(message, 'PAYMENT_ERROR', 422, details);
  }
}

export class NetworkError extends PesakitError {
  constructor(message = 'Network request failed', details: ErrorDetails = {}) {
    super(message, 'NETWORK_ERROR', 503, details);
  }
}

export class RateLimitError extends PesakitError {
  constructor(message = 'Rate limit exceeded', details: ErrorDetails = {}) {
    super(message, 'RATE_LIMIT_ERROR', 429, details);
  }
}

export class CircuitOpenError extends PesakitError {
  constructor(message = 'Circuit breaker is open', details: ErrorDetails = {}) {
    super(message, 'CIRCUIT_OPEN', 503, details);
  }
}

export type AnyPesakitError =
  | ValidationError
  | AuthenticationError
  | PaymentError
  | NetworkError
  | RateLimitError
  | CircuitOpenError;
