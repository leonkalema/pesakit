const crypto = require('crypto');
const { SignatureError } = require('./errors');

/**
 * Security utilities for cryptographic operations
 */
class SecurityUtils {
  /**
   * Timing-safe string comparison to prevent timing attacks
   * @param {string} a - First string
   * @param {string} b - Second string
   * @returns {boolean} - True if strings are equal
   */
  static timingSafeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') {
      throw new SignatureError('Both values must be strings for comparison');
    }

    if (a.length !== b.length) {
      return false;
    }

    const bufferA = Buffer.from(a, 'utf8');
    const bufferB = Buffer.from(b, 'utf8');

    try {
      return crypto.timingSafeEqual(bufferA, bufferB);
    } catch (error) {
      throw new SignatureError('Failed to perform timing-safe comparison', { 
        error: error.message 
      });
    }
  }

  /**
   * Generate HMAC-SHA256 signature
   * @param {string} payload - Data to sign
   * @param {string} secret - Secret key
   * @returns {string} - Hex-encoded signature
   */
  static generateHmacSignature(payload, secret) {
    if (!payload || !secret) {
      throw new SignatureError('Payload and secret are required for signature generation');
    }

    try {
      return crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('hex');
    } catch (error) {
      throw new SignatureError('Failed to generate HMAC signature', { 
        error: error.message 
      });
    }
  }

  /**
   * Verify HMAC-SHA256 signature using timing-safe comparison
   * @param {string} payload - Original data
   * @param {string} signature - Signature to verify
   * @param {string} secret - Secret key
   * @returns {boolean} - True if signature is valid
   */
  static verifyHmacSignature(payload, signature, secret) {
    if (!payload || !signature || !secret) {
      throw new SignatureError('Payload, signature, and secret are required for verification');
    }

    try {
      const expectedSignature = this.generateHmacSignature(payload, secret);
      return this.timingSafeEqual(signature, expectedSignature);
    } catch (error) {
      if (error instanceof SignatureError) {
        throw error;
      }
      throw new SignatureError('Failed to verify HMAC signature', { 
        error: error.message 
      });
    }
  }

  /**
   * Generate secure random string
   * @param {number} length - Length of random string
   * @returns {string} - Hex-encoded random string
   */
  static generateSecureRandom(length = 32) {
    try {
      return crypto.randomBytes(length).toString('hex');
    } catch (error) {
      throw new SignatureError('Failed to generate secure random string', { 
        error: error.message 
      });
    }
  }

  /**
   * Hash sensitive data using SHA-256
   * @param {string} data - Data to hash
   * @param {string} salt - Optional salt
   * @returns {string} - Hex-encoded hash
   */
  static hashData(data, salt = '') {
    if (!data) {
      throw new SignatureError('Data is required for hashing');
    }

    try {
      return crypto
        .createHash('sha256')
        .update(data + salt, 'utf8')
        .digest('hex');
    } catch (error) {
      throw new SignatureError('Failed to hash data', { 
        error: error.message 
      });
    }
  }

  /**
   * Validate webhook signature with multiple format support
   * @param {Object} options - Validation options
   * @param {string} options.payload - Request payload
   * @param {string} options.signature - Received signature
   * @param {string} options.secret - Webhook secret
   * @param {string} options.algorithm - Hash algorithm (default: sha256)
   * @param {string} options.encoding - Signature encoding (default: hex)
   * @returns {boolean} - True if signature is valid
   */
  static validateWebhookSignature(options) {
    const {
      payload,
      signature,
      secret,
      algorithm = 'sha256',
      encoding = 'hex'
    } = options;

    if (!payload || !signature || !secret) {
      throw new SignatureError('Payload, signature, and secret are required');
    }

    try {
      // Handle different signature formats (e.g., "sha256=abc123")
      let cleanSignature = signature;
      if (signature.includes('=')) {
        const [alg, sig] = signature.split('=');
        if (alg !== algorithm) {
          throw new SignatureError(`Algorithm mismatch: expected ${algorithm}, got ${alg}`);
        }
        cleanSignature = sig;
      }

      const expectedSignature = crypto
        .createHmac(algorithm, secret)
        .update(payload, 'utf8')
        .digest(encoding);

      return this.timingSafeEqual(cleanSignature, expectedSignature);
    } catch (error) {
      if (error instanceof SignatureError) {
        throw error;
      }
      throw new SignatureError('Failed to validate webhook signature', { 
        error: error.message 
      });
    }
  }

  /**
   * Sanitize sensitive data for logging
   * @param {Object} data - Data to sanitize
   * @param {Array} sensitiveFields - Fields to redact
   * @returns {Object} - Sanitized data
   */
  static sanitizeForLogging(data, sensitiveFields = []) {
    const defaultSensitiveFields = [
      'password',
      'secret',
      'token',
      'key',
      'authorization',
      'consumerKey',
      'consumerSecret',
      'signature'
    ];

    const fieldsToRedact = [...defaultSensitiveFields, ...sensitiveFields];
    
    const sanitize = (obj) => {
      if (typeof obj !== 'object' || obj === null) {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(sanitize);
      }

      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        const shouldRedact = fieldsToRedact.some(field => 
          lowerKey.includes(field.toLowerCase())
        );

        if (shouldRedact) {
          sanitized[key] = '[REDACTED]';
        } else if (typeof value === 'object') {
          sanitized[key] = sanitize(value);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    };

    return sanitize(data);
  }

  /**
   * Generate correlation ID for request tracking
   * @returns {string} - Unique correlation ID
   */
  static generateCorrelationId() {
    const timestamp = Date.now().toString(36);
    const random = this.generateSecureRandom(8);
    return `${timestamp}-${random}`;
  }
}

module.exports = SecurityUtils;
