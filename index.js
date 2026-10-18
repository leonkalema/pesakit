import axios from 'axios';
import * as axiosRetryModule from 'axios-retry';
import crypto from 'crypto';

import Logger from './lib/logger.js';
import { TokenCache } from './lib/cache.js';
import SecurityUtils from './lib/security.js';
import PesakitCircuitBreaker from './lib/circuit-breaker.js';
import { RateLimiter } from './lib/rate-limiter.js';
import { MetricsCollector, HealthChecker } from './lib/monitoring.js';
import { validators } from './schemas/validation.js';
import {
  PesakitError,
  AuthenticationError,
  ValidationError,
  PaymentError,
  NetworkError,
  RateLimitError,
  SignatureError,
  ConfigurationError
} from './lib/errors.js';

// axios-retry ships different default-export shapes for ESM and CommonJS.
const axiosRetry = typeof axiosRetryModule.default === 'function'
  ? axiosRetryModule.default
  : axiosRetryModule.default.default;
const { isNetworkError, isRetryableError } = axiosRetry;

const USER_AGENT = 'Pesakit/3.0.0';
const TOKEN_TTL_SECONDS = 290; // Pesapal tokens live 5 minutes; refresh a little early

/**
 * Pesapal API 3.0 status codes returned by GetTransactionStatus.
 */
const STATUS_CODES = Object.freeze({
  0: 'INVALID',
  1: 'COMPLETED',
  2: 'FAILED',
  3: 'REVERSED'
});

/**
 * Pesapal API 3.0 client.
 *
 * Covers the full V3 surface: RequestToken, RegisterIPN, GetIpnList,
 * SubmitOrderRequest (one-off and subscription), GetTransactionStatus,
 * RefundRequest and CancelOrder, plus an IPN handler that follows the
 * contract Pesapal actually uses.
 */
class Pesakit {
  constructor(config) {
    this.config = validators.validateConfig(config);

    this.logger = new Logger({
      level: this.config.logLevel,
      service: 'pesakit',
      enabled: this.config.enableLogging
    });
    this.correlationId = this.logger.createCorrelationId();

    this.baseURL = this.config.environment === 'production'
      ? 'https://pay.pesapal.com/v3'
      : 'https://cybqa.pesapal.com/pesapalv3';

    const encryptionKeyString = process.env.PESAKIT_ENCRYPTION_KEY || this.config.consumerSecret;
    const encryptionKey = crypto.createHash('sha256').update(encryptionKeyString).digest();
    this.tokenCache = new TokenCache({ stdTTL: TOKEN_TTL_SECONDS, encryptionKey });

    this.circuitBreaker = new PesakitCircuitBreaker({
      timeout: this.config.timeout,
      errorThresholdPercentage: 50,
      resetTimeout: 60000,
      volumeThreshold: 5,
      enabled: this.config.environment !== 'test'
    });

    this.rateLimiter = new RateLimiter({
      strategy: 'token-bucket',
      requests: 100,
      window: 60000,
      burst: 10
    });

    this.metrics = new MetricsCollector({ flushInterval: 60000 });
    this.healthChecker = new HealthChecker();
    this.registerHealthChecks();

    this.axios = axios.create({
      baseURL: this.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT
      }
    });
    this.setupAxiosRetry();
    this.setupMetricsHandlers();

    this.logger.info('Pesakit client initialized', {
      environment: this.config.environment,
      correlationId: this.correlationId
    });
  }

  setupAxiosRetry() {
    axiosRetry(this.axios, {
      retries: this.config.retries,
      retryDelay: (retryCount) => Math.min(1000 * Math.pow(2, retryCount), 10000),
      retryCondition: (error) => isNetworkError(error)
        || isRetryableError(error)
        || (error.response && error.response.status >= 500),
      onRetry: (retryCount, error, requestConfig) => {
        this.logger.warn('Retrying request', {
          retryCount,
          url: requestConfig.url,
          method: requestConfig.method,
          error: error.message,
          correlationId: this.correlationId
        });
      }
    });
  }

  setupMetricsHandlers() {
    this.metrics.on('flush', (metrics) => {
      this.logger.debug('Metrics flushed', { metrics, correlationId: this.correlationId });
    });
  }

  registerHealthChecks() {
    this.healthChecker.register('cache', () => this.tokenCache.healthCheck());
    this.healthChecker.register('circuit-breaker', () => this.circuitBreaker.healthCheck());
    this.healthChecker.register('rate-limiter', () => this.rateLimiter.healthCheck());
    this.healthChecker.register('metrics', () => this.metrics.healthCheck());
  }

  /* ------------------------------------------------------------------ */
  /* HTTP plumbing                                                        */
  /* ------------------------------------------------------------------ */

  /**
   * Single place for every HTTP call. Adds auth, correlation id and
   * circuit breaker protection.
   */
  async request(name, { method = 'POST', path, data, params, auth = true }) {
    const headers = { 'X-Correlation-ID': this.correlationId };
    if (auth) {
      const token = await this.getOAuthToken();
      headers.Authorization = `Bearer ${token}`;
    }
    const call = () => this.axios.request({ method, url: path, data, params, headers });
    const response = await this.circuitBreaker.protect(name, call);
    this.assertPesapalOk(response.data);
    return response.data;
  }

  /**
   * Pesapal returns HTTP 200 with an `error` object for many failures.
   * Surface those as real errors.
   */
  assertPesapalOk(body) {
    if (!body || typeof body !== 'object') return;
    const errorObject = body.error && typeof body.error === 'object' && (body.error.code || body.error.message);
    const rejected = String(body.status) === '500' || body.error === 500;
    if (errorObject || rejected) {
      const err = new Error((errorObject && body.error.message) || body.message || 'Pesapal rejected the request');
      err.pesapal = errorObject ? body.error : { code: String(body.status || body.error), message: body.message };
      err.response = { status: 200, data: body };
      throw err;
    }
  }

  async checkRateLimit(scope) {
    const key = `${scope}:${SecurityUtils.hashData(this.config.consumerKey)}`;
    await this.rateLimiter.isAllowed(key);
  }

  /**
   * Convert a transport/Pesapal error into a typed Pesakit error.
   */
  toPesakitError(error, fallbackMessage, extra = {}) {
    if (error instanceof PesakitError) return error;
    const status = error.response?.status;
    const details = {
      originalError: error.message,
      pesapal: error.pesapal || error.response?.data?.error || undefined,
      statusCode: status,
      correlationId: this.correlationId,
      ...extra
    };
    if (status === 401 || status === 403) {
      return new AuthenticationError('Authentication failed', details);
    }
    if (status === 404) {
      return new PaymentError('Not found', details);
    }
    if (!error.response || error.code === 'ECONNABORTED' || error.code === 'EOPENBREAKER') {
      return new NetworkError(fallbackMessage, details);
    }
    return new PaymentError(fallbackMessage, details);
  }

  /* ------------------------------------------------------------------ */
  /* Auth                                                                 */
  /* ------------------------------------------------------------------ */

  async getOAuthToken() {
    const timer = this.metrics.startTimer('auth.get_token');
    try {
      await this.checkRateLimit('auth');

      const cached = this.tokenCache.getToken(this.config.consumerKey);
      if (cached) {
        this.metrics.increment('auth.cache_hit');
        timer.end();
        return cached;
      }
      this.metrics.increment('auth.cache_miss');

      const body = await this.request('auth', {
        path: '/api/Auth/RequestToken',
        auth: false,
        data: {
          consumer_key: this.config.consumerKey,
          consumer_secret: this.config.consumerSecret
        }
      });

      if (!body || !body.token) {
        throw new AuthenticationError('Pesapal did not return a token', {
          pesapal: body?.error,
          correlationId: this.correlationId
        });
      }

      let ttl = TOKEN_TTL_SECONDS;
      if (body.expiryDate) {
        const secondsLeft = Math.floor((new Date(body.expiryDate).getTime() - Date.now()) / 1000) - 10;
        if (secondsLeft > 0) ttl = Math.min(secondsLeft, TOKEN_TTL_SECONDS);
      }
      this.tokenCache.setToken(this.config.consumerKey, body.token, ttl);

      this.metrics.increment('auth.success');
      timer.end();
      return body.token;
    } catch (error) {
      timer.end();
      this.metrics.increment('auth.error', 1, { error: error.constructor.name });
      this.logger.error('Failed to obtain OAuth token', error, { correlationId: this.correlationId });

      if (error instanceof PesakitError) throw error;
      const status = error.response?.status;
      if (status === 401 || status === 403 || error.pesapal) {
        throw new AuthenticationError('Invalid credentials', {
          statusCode: status,
          pesapal: error.pesapal,
          correlationId: this.correlationId
        });
      }
      throw new NetworkError('Failed to obtain OAuth token', {
        originalError: error.message,
        correlationId: this.correlationId
      });
    }
  }

  invalidateToken() {
    this.tokenCache.invalidateToken(this.config.consumerKey);
  }

  /* ------------------------------------------------------------------ */
  /* IPN URL setup                                                        */
  /* ------------------------------------------------------------------ */

  /**
   * Register an IPN URL. Returns the full Pesapal record; `ipn_id` is
   * what you pass as `notificationId` when creating payments.
   */
  async registerIpnUrl(ipnUrl, notificationType = 'GET') {
    const timer = this.metrics.startTimer('ipn.register');
    try {
      const { url, type } = validators.validateIpnRegistration({ url: ipnUrl, notificationType });
      const body = await this.request('ipn_register', {
        path: '/api/URLSetup/RegisterIPN',
        data: { url, ipn_notification_type: type }
      });
      timer.end();
      this.metrics.increment('ipn.register.success');
      return {
        ipnId: body.ipn_id,
        url: body.url,
        notificationType: body.ipn_notification_type_description || type,
        status: body.ipn_status_decription || body.ipn_status_description,
        createdDate: body.created_date,
        raw: body
      };
    } catch (error) {
      timer.end();
      this.metrics.increment('ipn.register.error', 1, { error: error.constructor.name });
      this.logger.error('Failed to register IPN URL', error, { correlationId: this.correlationId });
      throw this.toPesakitError(error, 'Failed to register IPN URL');
    }
  }

  /**
   * List IPN URLs registered for this merchant.
   */
  async getIpnList() {
    const timer = this.metrics.startTimer('ipn.list');
    try {
      const body = await this.request('ipn_list', {
        method: 'GET',
        path: '/api/URLSetup/GetIpnList'
      });
      timer.end();
      const list = Array.isArray(body) ? body : [];
      return list.map((item) => ({
        ipnId: item.ipn_id,
        url: item.url,
        notificationType: item.ipn_notification_type_description,
        status: item.ipn_status_decription || item.ipn_status_description,
        createdDate: item.created_date,
        raw: item
      }));
    } catch (error) {
      timer.end();
      this.logger.error('Failed to list IPN URLs', error, { correlationId: this.correlationId });
      throw this.toPesakitError(error, 'Failed to list IPN URLs');
    }
  }

  /**
   * Find an already registered IPN for a URL, or register it.
   */
  async ensureIpnUrl(ipnUrl, notificationType = 'GET') {
    const existing = await this.getIpnList();
    const match = existing.find((item) => item.url === ipnUrl && String(item.status).toLowerCase() === 'active');
    if (match) return match;
    return this.registerIpnUrl(ipnUrl, notificationType);
  }

  /* ------------------------------------------------------------------ */
  /* Payments                                                             */
  /* ------------------------------------------------------------------ */

  /**
   * Submit an order. Returns { orderTrackingId, merchantReference, redirectUrl }.
   * Pass `subscription` for recurring payments.
   */
  async createPayment(paymentData) {
    const timer = this.metrics.startTimer('payment.create');
    try {
      const data = validators.validatePaymentData(paymentData);
      await this.checkRateLimit('payment');

      if (!data.notificationId) {
        const ipnUrl = data.ipnUrl || this.config.ipnUrl;
        if (!ipnUrl) {
          throw new ValidationError('Provide notificationId, ipnUrl, or set ipnUrl in the client config');
        }
        const ipn = await this.ensureIpnUrl(ipnUrl, this.config.ipnNotificationType);
        data.notificationId = ipn.ipnId;
      }

      const body = await this.request('payment', {
        path: '/api/Transactions/SubmitOrderRequest',
        data: Pesakit.toOrderPayload(data)
      });

      const result = {
        orderTrackingId: body.order_tracking_id,
        merchantReference: body.merchant_reference,
        redirectUrl: body.redirect_url,
        raw: body
      };

      this.metrics.increment('payment.create.success');
      this.metrics.histogram('payment.amount', data.amount, { currency: data.currency });
      timer.end();
      return result;
    } catch (error) {
      timer.end();
      this.metrics.increment('payment.create.error', 1, { error: error.constructor.name });
      this.logger.error('Failed to create payment', error, {
        reference: paymentData?.reference,
        correlationId: this.correlationId
      });
      throw this.toPesakitError(error, 'Failed to create payment');
    }
  }

  static toOrderPayload(data) {
    const billing = data.billingAddress || {};
    const payload = {
      id: data.reference,
      currency: data.currency,
      amount: data.amount,
      description: data.description,
      callback_url: data.callbackUrl,
      notification_id: data.notificationId,
      billing_address: {
        email_address: data.email,
        phone_number: data.phoneNumber,
        country_code: billing.countryCode,
        first_name: data.firstName,
        middle_name: data.middleName,
        last_name: data.lastName,
        line_1: billing.line1,
        line_2: billing.line2,
        city: billing.city,
        state: billing.state,
        postal_code: billing.postalCode,
        zip_code: billing.zipCode
      }
    };
    if (data.cancellationUrl) payload.cancellation_url = data.cancellationUrl;
    if (data.redirectMode) payload.redirect_mode = data.redirectMode;
    if (data.branch) payload.branch = data.branch;
    if (data.subscription) {
      payload.account_number = data.subscription.accountNumber;
      payload.subscription_details = {
        start_date: data.subscription.startDate,
        end_date: data.subscription.endDate,
        frequency: data.subscription.frequency
      };
    }
    return payload;
  }

  /**
   * Get transaction status. Always call this from your IPN and callback
   * handlers; never trust the redirect alone.
   */
  async verifyPayment(orderTrackingId) {
    const timer = this.metrics.startTimer('payment.verify');
    try {
      const id = validators.validateOrderTrackingId(orderTrackingId);
      await this.checkRateLimit('verify');

      const body = await this.request('verify', {
        method: 'GET',
        path: '/api/Transactions/GetTransactionStatus',
        params: { orderTrackingId: id }
      });

      const verification = Pesakit.toVerification(body);

      this.metrics.increment('payment.verify.success');
      this.metrics.increment('payment.status', 1, { status: verification.status.toLowerCase() });
      timer.end();
      return verification;
    } catch (error) {
      timer.end();
      this.metrics.increment('payment.verify.error', 1, { error: error.constructor.name });
      this.logger.error('Failed to verify payment', error, { orderTrackingId, correlationId: this.correlationId });
      throw this.toPesakitError(error, 'Failed to verify payment', { orderTrackingId });
    }
  }

  static toVerification(body) {
    const code = typeof body.status_code === 'number' ? body.status_code : Number(body.status_code);
    const status = STATUS_CODES[code] || String(body.payment_status_description || 'INVALID').toUpperCase();
    return {
      status,
      statusCode: Number.isNaN(code) ? null : code,
      isCompleted: status === 'COMPLETED',
      orderTrackingId: body.order_tracking_id,
      merchantReference: body.merchant_reference,
      method: body.payment_method,
      amount: body.amount,
      currency: body.currency,
      paymentAccount: body.payment_account,
      confirmationCode: body.confirmation_code,
      description: body.description,
      message: body.message,
      createdDate: body.created_date,
      callbackUrl: body.call_back_url,
      subscriptionTransactionInfo: body.subscription_transaction_info,
      timestamp: new Date().toISOString(),
      raw: body
    };
  }

  /**
   * Refund a completed transaction. `confirmationCode` comes from verifyPayment().
   */
  async refundPayment({ confirmationCode, amount, username, remarks }) {
    const timer = this.metrics.startTimer('payment.refund');
    try {
      const data = validators.validateRefund({ confirmationCode, amount, username, remarks });
      await this.checkRateLimit('refund');
      const body = await this.request('refund', {
        path: '/api/Transactions/RefundRequest',
        data: {
          confirmation_code: data.confirmationCode,
          amount: data.amount,
          username: data.username,
          remarks: data.remarks
        }
      });
      timer.end();
      this.metrics.increment('payment.refund.success');
      return {
        status: body.status,
        message: body.message,
        raw: body
      };
    } catch (error) {
      timer.end();
      this.metrics.increment('payment.refund.error', 1, { error: error.constructor.name });
      this.logger.error('Failed to refund payment', error, { correlationId: this.correlationId });
      throw this.toPesakitError(error, 'Failed to refund payment');
    }
  }

  /**
   * Cancel an order that has not yet completed.
   */
  async cancelOrder(orderTrackingId) {
    const timer = this.metrics.startTimer('payment.cancel');
    try {
      const id = validators.validateOrderTrackingId(orderTrackingId);
      await this.checkRateLimit('cancel');
      const body = await this.request('cancel', {
        path: '/api/Transactions/CancelOrder',
        data: { order_tracking_id: id }
      });
      timer.end();
      this.metrics.increment('payment.cancel.success');
      return {
        status: body.status,
        message: body.message,
        raw: body
      };
    } catch (error) {
      timer.end();
      this.metrics.increment('payment.cancel.error', 1, { error: error.constructor.name });
      this.logger.error('Failed to cancel order', error, { orderTrackingId, correlationId: this.correlationId });
      throw this.toPesakitError(error, 'Failed to cancel order', { orderTrackingId });
    }
  }

  /* ------------------------------------------------------------------ */
  /* IPN                                                                  */
  /* ------------------------------------------------------------------ */

  /**
   * Parse a Pesapal IPN from an incoming request. Pesapal sends
   * OrderTrackingId, OrderMerchantReference and OrderNotificationType
   * as query params (GET) or a JSON body (POST).
   */
  static parseIpn(req) {
    const source = { ...(req.query || {}), ...(req.body || {}) };
    const pick = (...names) => {
      for (const name of names) {
        if (source[name] !== undefined && source[name] !== null && source[name] !== '') return source[name];
      }
      return undefined;
    };
    return validators.validateIpnData({
      orderTrackingId: pick('OrderTrackingId', 'orderTrackingId', 'order_tracking_id'),
      orderMerchantReference: pick('OrderMerchantReference', 'orderMerchantReference', 'order_merchant_reference'),
      orderNotificationType: pick('OrderNotificationType', 'orderNotificationType', 'order_notification_type') || 'IPNCHANGE'
    });
  }

  /**
   * Express/Connect style IPN handler.
   *
   * Flow: parse the notification, call GetTransactionStatus, hand the
   * verified result to `onNotification`, then reply with the JSON
   * acknowledgement Pesapal expects. Any thrown error replies with
   * status 500 so Pesapal retries.
   */
  createIpnHandler(options = {}) {
    const { onNotification = null, onError = null } = options;

    return async (req, res, next) => {
      const ipnCorrelationId = SecurityUtils.generateCorrelationId();
      const log = this.logger.child({ ipnCorrelationId });
      const timer = this.metrics.startTimer('ipn.process');
      let ipn = null;

      try {
        ipn = Pesakit.parseIpn(req);
        log.info('Processing IPN', ipn);

        const verification = await this.verifyPayment(ipn.orderTrackingId);

        if (onNotification) {
          await onNotification(verification, ipn);
        }

        this.metrics.increment('ipn.success');
        timer.end();
        res.status(200).json({
          orderNotificationType: ipn.orderNotificationType,
          orderTrackingId: ipn.orderTrackingId,
          orderMerchantReference: ipn.orderMerchantReference,
          status: 200
        });
      } catch (error) {
        timer.end();
        this.metrics.increment('ipn.error', 1, { error: error.constructor.name });
        log.error('IPN processing failed', error);

        if (onError) {
          try {
            await onError(error, ipn, req);
          } catch (callbackError) {
            log.error('IPN onError callback threw', callbackError);
          }
        }

        const isBadRequest = error instanceof ValidationError;
        res.status(isBadRequest ? 400 : 500).json({
          orderNotificationType: ipn?.orderNotificationType,
          orderTrackingId: ipn?.orderTrackingId,
          orderMerchantReference: ipn?.orderMerchantReference,
          status: isBadRequest ? 400 : 500
        });

        if (next && !isBadRequest) next(error);
      }
    };
  }

  /* ------------------------------------------------------------------ */
  /* Ops                                                                  */
  /* ------------------------------------------------------------------ */

  async getHealthStatus() {
    return this.healthChecker.check();
  }

  getMetrics() {
    return this.metrics.getMetrics();
  }

  getRateLimitStatus(key) {
    return this.rateLimiter.getStatus(key);
  }

  destroy() {
    this.circuitBreaker.shutdown();
    this.metrics.destroy();
    this.tokenCache.clear();
    this.tokenCache.close();
  }
}

export {
  Pesakit,
  STATUS_CODES,
  PesakitError,
  AuthenticationError,
  ValidationError,
  PaymentError,
  NetworkError,
  RateLimitError,
  SignatureError,
  ConfigurationError
};
export default Pesakit;
