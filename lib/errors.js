/**
 * Custom error classes for Pesakit
 */

class PesakitError extends Error {
  constructor(message, code, statusCode = 500, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

class AuthenticationError extends PesakitError {
  constructor(message = 'Authentication failed', details = {}) {
    super(message, 'AUTHENTICATION_ERROR', 401, details);
  }
}

class ValidationError extends PesakitError {
  constructor(message = 'Validation failed', details = {}) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

class PaymentError extends PesakitError {
  constructor(message = 'Payment processing failed', details = {}) {
    super(message, 'PAYMENT_ERROR', 422, details);
  }
}

class NetworkError extends PesakitError {
  constructor(message = 'Network request failed', details = {}) {
    super(message, 'NETWORK_ERROR', 503, details);
  }
}

class RateLimitError extends PesakitError {
  constructor(message = 'Rate limit exceeded', details = {}) {
    super(message, 'RATE_LIMIT_ERROR', 429, details);
  }
}

class SignatureError extends PesakitError {
  constructor(message = 'Invalid signature', details = {}) {
    super(message, 'SIGNATURE_ERROR', 401, details);
  }
}

class ConfigurationError extends PesakitError {
  constructor(message = 'Configuration error', details = {}) {
    super(message, 'CONFIGURATION_ERROR', 500, details);
  }
}

export {
  PesakitError,
  AuthenticationError,
  ValidationError,
  PaymentError,
  NetworkError,
  RateLimitError,
  SignatureError,
  ConfigurationError
};
