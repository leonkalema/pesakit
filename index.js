import axios from 'axios';
import axiosRetry from 'axios-retry';
import crypto from 'crypto';

// Import production-ready modules
import Logger from './lib/logger.js';
import { TokenCache } from './lib/cache.js';
import SecurityUtils from './lib/security.js';
import PesakitCircuitBreaker from './lib/circuit-breaker.js';
import { RateLimiter } from './lib/rate-limiter.js';
import { MetricsCollector, HealthChecker } from './lib/monitoring.js';
import { validators } from './schemas/validation.js';
import {
  AuthenticationError,
  ValidationError,
  PaymentError,
  NetworkError,
  SignatureError
} from './lib/errors.js';

/**
 * Production-ready Pesapal API client with enterprise features
 */
class Pesakit {
  constructor(config) {
    // Validate and sanitize configuration
    this.config = validators.validateConfig(config);
    
    // Initialize logger with correlation ID
    this.logger = new Logger({
      level: this.config.logLevel,
      service: 'pesakit'
    });
    
    // Create correlation ID for this instance
    this.correlationId = this.logger.createCorrelationId();
    this.logger.info('Initializing Pesakit client', {
      environment: this.config.environment,
      correlationId: this.correlationId
    });

    // Set base URL based on environment
    this.baseURL = this.config.environment === 'production' 
      ? 'https://pay.pesapal.com/v3'
      : 'https://cybqa.pesapal.com/pesapalv3';

    // Initialize secure token cache
    const encryptionKeyString = process.env.PESAKIT_ENCRYPTION_KEY || 'pesakit-default-key';
    const encryptionKey = crypto.createHash('sha256').update(encryptionKeyString).digest();
    this.tokenCache = new TokenCache({
      stdTTL: 3300, // 55 minutes
      encryptionKey
    });

    // Initialize circuit breaker for resilience
    this.circuitBreaker = new PesakitCircuitBreaker({
      timeout: this.config.timeout,
      errorThresholdPercentage: 50,
      resetTimeout: 60000,
      volumeThreshold: 5,
      enabled: this.config.environment !== 'test'
    });

    this.rateLimiter = new RateLimiter({
      strategy: 'token-bucket',
      requests: 100, // 100 requests per minute
      window: 60000,
      burst: 10
    });

    // Initialize metrics collector
    this.metrics = new MetricsCollector({
      flushInterval: 60000 // 1 minute
    });

    // Initialize health checker
    this.healthChecker = new HealthChecker();
    this.registerHealthChecks();

    // Create axios instance
    this.axios = axios.create({
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Pesakit-Node/2.0.0'
      }
    });

    // Configure axios with retry logic
    this.setupAxiosRetry();

    // Setup metrics event handlers
    this.setupMetricsHandlers();

    this.logger.info('Pesakit client initialized successfully', {
      correlationId: this.correlationId
    });
  }

  /**
   * Setup axios retry configuration with exponential backoff
   */
  setupAxiosRetry() {
    axiosRetry(this.axios, {
      retries: this.config.retries,
      retryDelay: (retryCount) => Math.min(1000 * Math.pow(2, retryCount), 10000),
      retryCondition: (error) => {
        return axiosRetry.isNetworkError(error) || 
               axiosRetry.isRetryableError(error) ||
               (error.response && error.response.status >= 500);
      },
      onRetry: (retryCount, error, requestConfig) => {
        this.logger.warn('Retrying request', {
          retryCount,
          url: requestConfig.url,
          method: requestConfig.method,
          error: error.message,
          correlationId: this.correlationId,
          attempt: retryCount
        });
      }
    });
  }

  /**
   * Setup metrics event handlers
   */
  setupMetricsHandlers() {
    this.metrics.on('flush', (metrics) => {
      this.logger.debug('Metrics flushed', { metrics, correlationId: this.correlationId });
    });
  }

  /**
   * Register health checks
   */
  registerHealthChecks() {
    this.healthChecker.register('cache', () => this.tokenCache.healthCheck());
    this.healthChecker.register('circuit-breaker', () => this.circuitBreaker.healthCheck());
    this.healthChecker.register('rate-limiter', () => this.rateLimiter.healthCheck());
    this.healthChecker.register('metrics', () => this.metrics.healthCheck());
  }

  /**
   * Get OAuth token with caching and security
   */
  async getOAuthToken() {
    const timer = this.metrics.startTimer('auth.get_token');
    
    try {
      // Check rate limiting
      const rateLimitKey = `auth:${SecurityUtils.hashData(this.config.consumerKey)}`;
      await this.rateLimiter.isAllowed(rateLimitKey);

      // Check cache first
      const cachedToken = this.tokenCache.getToken(this.config.consumerKey);
      if (cachedToken) {
        this.logger.debug('Using cached OAuth token', { correlationId: this.correlationId });
        this.metrics.increment('auth.cache_hit');
        timer.end();
        return cachedToken;
      }

      this.metrics.increment('auth.cache_miss');
      this.logger.info('Requesting new OAuth token', { correlationId: this.correlationId });

      // Make authenticated request through circuit breaker
      const response = await this.circuitBreaker.protect(
        'auth',
        this.makeAuthRequest.bind(this)
      );

      const token = response.data.token;
      const expiresIn = 300; // PesaPal API 3.0 tokens expire in 5 minutes

      // Cache the token securely
      this.tokenCache.setToken(this.config.consumerKey, token, expiresIn);

      this.logger.info('OAuth token obtained successfully', {
        expiresIn,
        correlationId: this.correlationId
      });

      this.metrics.increment('auth.success');
      timer.end();
      return token;

    } catch (error) {
      timer.end();
      this.metrics.increment('auth.error', 1, { error: error.constructor.name });
      
      this.logger.error('Failed to obtain OAuth token', error, {
        correlationId: this.correlationId
      });

      if (error.response && error.response.status === 401) {
        throw new AuthenticationError('Invalid credentials', {
          statusCode: error.response.status,
          correlationId: this.correlationId
        });
      }

      throw new NetworkError('Failed to obtain OAuth token', {
        originalError: error.message,
        correlationId: this.correlationId
      });
    }
  }

  /**
   * Make authentication request using PesaPal API 3.0
   */
  async makeAuthRequest() {
    return axios.post(
      `${this.baseURL}/api/Auth/RequestToken`,
      {
        consumer_key: this.config.consumerKey,
        consumer_secret: this.config.consumerSecret
      },
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Pesakit/2.0.0',
          'X-Correlation-ID': this.correlationId
        },
        timeout: this.config.timeout
      }
    );
  }

  /**
   * Create payment with comprehensive validation and monitoring
   */
  async createPayment(paymentData) {
    const timer = this.metrics.startTimer('payment.create');
    
    try {
      // Validate payment data
      const validatedData = validators.validatePaymentData(paymentData);
      
      this.logger.info('Creating payment', {
        reference: validatedData.reference,
        amount: validatedData.amount,
        currency: validatedData.currency,
        correlationId: this.correlationId
      });

      // Check rate limiting
      const rateLimitKey = `payment:${SecurityUtils.hashData(this.config.consumerKey)}`;
      await this.rateLimiter.isAllowed(rateLimitKey);

      // Register IPN URL if not provided
      if (!validatedData.notificationId) {
        const ipnUrl = validatedData.ipnUrl || validatedData.callbackUrl.replace('/callback', '/ipn');
        validatedData.notificationId = await this.registerIpnUrl(ipnUrl, 'GET');
      }

      // Get OAuth token
      const token = await this.getOAuthToken();

      // Make payment request through circuit breaker
      const response = await this.circuitBreaker.protect(
        'payment',
        this.makePaymentRequest.bind(this),
        token,
        validatedData
      );

      const result = {
        orderTrackingId: response.data.order_tracking_id,
        merchantReference: response.data.merchant_reference,
        redirectUrl: response.data.redirect_url
      };
      
      this.logger.info('Payment created successfully', {
        reference: validatedData.reference,
        orderTrackingId: result.orderTrackingId,
        correlationId: this.correlationId
      });

      this.metrics.increment('payment.create.success');
      this.metrics.histogram('payment.amount', validatedData.amount, {
        currency: validatedData.currency
      });

      timer.end();
      return result;

    } catch (error) {
      timer.end();
      this.metrics.increment('payment.create.error', 1, { 
        error: error.constructor.name 
      });

      this.logger.error('Failed to create payment', error, {
        reference: paymentData?.reference,
        correlationId: this.correlationId
      });

      if (error instanceof ValidationError) {
        throw error;
      }
      if (error.message && error.message.includes('validation failed')) {
        throw new ValidationError(error.message, { originalError: error });
      }

      if (error.response?.status === 422) {
        throw new PaymentError('Payment validation failed', {
          statusCode: error.response.status,
          details: error.response.data,
          correlationId: this.correlationId
        });
      }

      throw new PaymentError('Failed to create payment', {
        originalError: error.message,
        correlationId: this.correlationId
      });
    }
  }

  /**
   * Register IPN URL with PesaPal API 3.0
   */
  async registerIpnUrl(ipnUrl, notificationType = 'GET') {
    const timer = this.metrics.startTimer('ipn.register');
    
    try {
      this.logger.info('Registering IPN URL', {
        url: ipnUrl,
        notificationType,
        correlationId: this.correlationId
      });

      const token = await this.getOAuthToken();

      const response = await this.circuitBreaker.protect(
        'ipn_register',
        this.makeIpnRegistrationRequest.bind(this),
        token,
        ipnUrl,
        notificationType
      );

      const ipnId = response.data.ipn_id;
      
      this.logger.info('IPN URL registered successfully', {
        ipnId,
        correlationId: this.correlationId
      });

      timer.end();
      return ipnId;

    } catch (error) {
      timer.end();
      this.logger.error('Failed to register IPN URL', error, {
        correlationId: this.correlationId
      });
      throw error;
    }
  }

  /**
   * Make IPN registration request
   */
  async makeIpnRegistrationRequest(token, ipnUrl, notificationType) {
    return axios.post(
      `${this.baseURL}/api/URLSetup/RegisterIPN`,
      {
        url: ipnUrl,
        ipn_notification_type: notificationType
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Pesakit/2.0.0',
          'X-Correlation-ID': this.correlationId
        },
        timeout: this.config.timeout
      }
    );
  }

  /**
   * Make payment request using PesaPal API 3.0
   */
  async makePaymentRequest(token, paymentData) {
    // Transform data to PesaPal API 3.0 format
    const pesapalPayload = {
      id: paymentData.reference,
      currency: paymentData.currency,
      amount: paymentData.amount,
      description: paymentData.description,
      callback_url: paymentData.callbackUrl,
      notification_id: paymentData.notificationId,
      billing_address: {
        email_address: paymentData.email,
        phone_number: paymentData.phoneNumber,
        first_name: paymentData.firstName,
        last_name: paymentData.lastName,
        country_code: 'KE'
      }
    };

    return axios.post(
      `${this.baseURL}/api/Transactions/SubmitOrderRequest`,
      pesapalPayload,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Pesakit/2.0.0',
          'X-Correlation-ID': this.correlationId
        },
        timeout: this.config.timeout
      }
    );
  }

  /**
   * Verify payment status with comprehensive error handling
   */
  async verifyPayment(orderTrackingId) {
    const timer = this.metrics.startTimer('payment.verify');
    
    try {
      // Validate order tracking ID
      const validatedId = validators.validateOrderTrackingId(orderTrackingId);
      
      this.logger.info('Verifying payment', {
        orderTrackingId: validatedId,
        correlationId: this.correlationId
      });

      // Check rate limiting
      const rateLimitKey = `verify:${SecurityUtils.hashData(this.config.consumerKey)}`;
      await this.rateLimiter.isAllowed(rateLimitKey);

      // Get OAuth token
      const token = await this.getOAuthToken();

      // Make verification request through circuit breaker
      const response = await this.circuitBreaker.protect(
        'verify',
        this.makeVerificationRequest.bind(this),
        token,
        validatedId
      );

      const verification = {
        status: response.data.payment_status_description,
        method: response.data.payment_method,
        amount: response.data.amount,
        currency: response.data.currency,
        merchantReference: response.data.merchant_reference,
        timestamp: new Date().toISOString()
      };

      this.logger.info('Payment verification completed', {
        orderTrackingId: validatedId,
        status: verification.status,
        correlationId: this.correlationId
      });

      this.metrics.increment('payment.verify.success');
      this.metrics.increment('payment.status', 1, { 
        status: verification.status.toLowerCase() 
      });

      timer.end();
      return verification;

    } catch (error) {
      timer.end();
      this.metrics.increment('payment.verify.error', 1, { 
        error: error.constructor.name 
      });

      this.logger.error('Failed to verify payment', error, {
        orderTrackingId,
        correlationId: this.correlationId
      });

      if (error instanceof ValidationError) {
        throw error;
      }
      if (error.message && error.message.includes('validation failed')) {
        throw new ValidationError(error.message, { originalError: error });
      }

      if (error.response?.status === 404) {
        throw new PaymentError('Payment not found', {
          statusCode: 404,
          orderTrackingId,
          correlationId: this.correlationId
        });
      }

      throw new PaymentError('Failed to verify payment', {
        originalError: error.message,
        orderTrackingId,
        correlationId: this.correlationId
      });
    }
  }

  /**
   * Make verification request using PesaPal API 3.0
   */
  async makeVerificationRequest(token, orderTrackingId) {
    return axios.get(
      `${this.baseURL}/api/Transactions/GetTransactionStatus`,
      {
        params: { orderTrackingId },
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Pesakit/2.0.0',
          'X-Correlation-ID': this.correlationId
        },
        timeout: this.config.timeout
      }
    );
  }

  /**
   * Create secure IPN handler with timing-safe signature validation
   */
  createIpnHandler(options = {}) {
    const {
      onSuccess = null,
      onFailure = null,
      validateSignature = true
    } = options;

    return async (req, res, next) => {
      const ipnCorrelationId = SecurityUtils.generateCorrelationId();
      const ipnLogger = this.logger.child({ ipnCorrelationId });
      const timer = this.metrics.startTimer('ipn.process');

      try {
        ipnLogger.info('Processing IPN notification', {
          headers: SecurityUtils.sanitizeForLogging(req.headers),
          body: SecurityUtils.sanitizeForLogging(req.body)
        });

        // Validate IPN data structure
        const validatedData = validators.validateIpnData(req.body);

        if (validateSignature) {
          // Validate HMAC signature using timing-safe comparison
          const signature = req.headers['x-pesapal-signature'];
          if (!signature) {
            throw new SignatureError('Missing signature header');
          }

          const payload = JSON.stringify(req.body);
          const isValid = SecurityUtils.verifyHmacSignature(
            payload,
            signature,
            this.config.consumerSecret
          );

          if (!isValid) {
            this.metrics.increment('ipn.signature_invalid');
            ipnLogger.security('Invalid IPN signature detected', {
              signature: '[REDACTED]',
              sourceIP: req.ip
            });
            
            throw new SignatureError('Invalid signature');
          }

          this.metrics.increment('ipn.signature_valid');
        }

        // Verify payment status
        const verification = await this.verifyPayment(validatedData.orderTrackingId);

        if (verification.status === validatedData.status) {
          ipnLogger.info('IPN verification successful', {
            orderTrackingId: validatedData.orderTrackingId,
            status: validatedData.status
          });

          this.metrics.increment('ipn.success');
          
          // Call success callback if provided
          if (onSuccess) {
            await onSuccess(validatedData, verification);
          }

          timer.end();
          res.status(200).json({ 
            status: 'success',
            correlationId: ipnCorrelationId 
          });
        } else {
          ipnLogger.warn('IPN status mismatch', {
            orderTrackingId: validatedData.orderTrackingId,
            ipnStatus: validatedData.status,
            verifiedStatus: verification.status
          });

          this.metrics.increment('ipn.status_mismatch');
          
          // Call failure callback if provided
          if (onFailure) {
            await onFailure(validatedData, verification, 'status_mismatch');
          }

          timer.end();
          res.status(400).json({ 
            error: 'Status mismatch',
            correlationId: ipnCorrelationId 
          });
        }

      } catch (error) {
        timer.end();
        this.metrics.increment('ipn.error', 1, { error: error.constructor.name });

        ipnLogger.error('IPN processing failed', error);

        if (error instanceof SignatureError) {
          res.status(401).json({ 
            error: 'Invalid signature',
            correlationId: ipnCorrelationId 
          });
        } else if (error instanceof ValidationError) {
          res.status(400).json({ 
            error: 'Invalid IPN data',
            correlationId: ipnCorrelationId 
          });
        } else {
          res.status(500).json({ 
            error: 'Internal server error',
            correlationId: ipnCorrelationId 
          });
        }

        // Call failure callback if provided
        if (onFailure) {
          try {
            await onFailure(req.body, null, error.message);
          } catch (callbackError) {
            ipnLogger.error('IPN failure callback error', callbackError);
          }
        }

        if (next) {
          next(error);
        }
      }
    };
  }

  /**
   * Get comprehensive health status
   */
  async getHealthStatus() {
    return this.healthChecker.check();
  }

  /**
   * Get metrics snapshot
   */
  getMetrics() {
    return this.metrics.getMetrics();
  }

  /**
   * Get rate limit status
   */
  getRateLimitStatus(key) {
    return this.rateLimiter.getStatus(key);
  }

  /**
   * Invalidate cached token
   */
  invalidateToken() {
    this.tokenCache.invalidateToken(this.config.consumerKey);
    this.logger.info('OAuth token invalidated', { correlationId: this.correlationId });
  }

  /**
   * Get endpoint from error for metrics
   */
  getEndpointFromError(error) {
    const url = error.config?.url || '';
    if (url.includes('/auth/')) return 'auth';
    if (url.includes('/payments/')) return 'payment';
    if (url.includes('/transactions/')) return 'verify';
    return 'unknown';
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.logger.info('Destroying Pesakit client', { correlationId: this.correlationId });
    
    this.circuitBreaker.shutdown();
    this.metrics.destroy();
    this.tokenCache.clear();
    
    this.logger.info('Pesakit client destroyed', { correlationId: this.correlationId });
  }
}

export default Pesakit;
