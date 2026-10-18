import {
  AuthenticationError,
  NetworkError,
  PaymentError,
  PesakitError,
  ValidationError,
} from './errors.js';
import type { PesapalErrorBody } from './errors.js';
import {
  CircuitBreaker,
  RateLimiter,
  TokenCache,
  backoffDelay,
  compact,
  createLogger,
  retryPolicy,
  sleep,
} from './internal.js';
import { MemoryIpnStore, ipnDedupeKey, parseIpn } from './ipn.js';
import {
  PaymentStatus,
  type ActionResult,
  type FetchLike,
  type IpnHandlerOptions,
  type IpnInput,
  type IpnNotificationType,
  type IpnOutcome,
  type IpnRecord,
  type IpnStore,
  type Logger,
  type PaymentRequest,
  type PaymentResult,
  type PaymentVerification,
  type PesakitConfig,
  type RefundRequest,
} from './types.js';
import {
  validateConfig,
  validateIpnRegistration,
  validatePaymentRequest,
  validateRefund,
  validateTrackingId,
} from './validate.js';

export const VERSION = '4.0.0';

export const BASE_URLS = {
  sandbox: 'https://cybqa.pesapal.com/pesapalv3',
  production: 'https://pay.pesapal.com/v3',
} as const;

export const STATUS_CODES: Readonly<Record<number, PaymentStatus>> = Object.freeze({
  0: PaymentStatus.Invalid,
  1: PaymentStatus.Completed,
  2: PaymentStatus.Failed,
  3: PaymentStatus.Reversed,
});

/** Pesapal tokens live 5 minutes. Refresh a little early. */
const TOKEN_TTL_MS = 290_000;

interface RequestOptions {
  method?: 'GET' | 'POST';
  path: string;
  body?: unknown;
  query?: Record<string, string>;
  auth?: boolean;
}

type JsonObject = Record<string, unknown>;

export class Pesakit {
  readonly config: Readonly<PesakitConfig>;
  readonly baseUrl: string;
  readonly logger: Logger;

  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly retry;
  private readonly breaker: CircuitBreaker;
  private readonly limiter: RateLimiter;
  private readonly tokens = new TokenCache();
  private tokenInFlight: Promise<string> | null = null;
  private readonly ipnCache = new Map<string, IpnRecord>();
  private readonly userAgent: string;

  constructor(config: PesakitConfig) {
    this.config = Object.freeze({ ...validateConfig(config) });
    this.baseUrl = (config.baseUrl ?? BASE_URLS[config.environment ?? 'sandbox']).replace(/\/+$/, '');
    this.logger = createLogger(config.logLevel ?? 'warn', config.logger);
    const f = config.fetch ?? (globalThis.fetch as FetchLike | undefined);
    if (!f) throw new ValidationError('No fetch available. Pass config.fetch or use Node 18+.');
    this.fetchImpl = f;
    this.timeoutMs = config.timeoutMs ?? 30_000;
    this.retry = retryPolicy(config.retry);
    this.breaker = new CircuitBreaker(config.circuitBreaker);
    this.limiter = new RateLimiter(config.rateLimit);
    this.userAgent = `pesakit/${VERSION}${config.userAgentSuffix ? ` ${config.userAgentSuffix}` : ''}`;
  }

  /* ---------------------------------------------------------------- */
  /* HTTP                                                               */
  /* ---------------------------------------------------------------- */

  private async request<T extends JsonObject | JsonObject[]>(name: string, opts: RequestOptions): Promise<T> {
    this.limiter.take();
    this.breaker.assertClosed(name);

    const url = new URL(this.baseUrl + opts.path);
    if (opts.query) for (const [k, v] of Object.entries(opts.query)) url.searchParams.set(k, v);

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': this.userAgent,
    };
    if (opts.auth !== false) headers.Authorization = `Bearer ${await this.getToken()}`;

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retry.retries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await this.fetchImpl(url.toString(), {
          method: opts.method ?? 'POST',
          headers,
          body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
          signal: controller.signal,
        });
        clearTimeout(timer);

        const text = await res.text();
        let data: unknown = null;
        if (text) {
          try {
            data = JSON.parse(text);
          } catch {
            data = { message: text };
          }
        }

        if (res.status >= 500 && attempt < this.retry.retries) {
          lastError = new NetworkError(`Pesapal responded ${res.status}`, { statusCode: res.status });
          this.logger.warn('Retrying after server error', { name, status: res.status, attempt });
          await sleep(backoffDelay(attempt, this.retry));
          continue;
        }

        this.breaker.onSuccess();
        this.assertOk(res.status, data);
        return data as T;
      } catch (error) {
        clearTimeout(timer);
        if (error instanceof PesakitError) {
          if (error instanceof NetworkError) this.breaker.onFailure();
          throw error;
        }
        lastError = error;
        this.breaker.onFailure();
        if (attempt < this.retry.retries) {
          this.logger.warn('Retrying after network error', { name, attempt, error: String(error) });
          await sleep(backoffDelay(attempt, this.retry));
          continue;
        }
      }
    }
    const message = (lastError as Error)?.name === 'AbortError' ? `Request to ${name} timed out` : `Request to ${name} failed`;
    throw new NetworkError(message, { cause: lastError, endpoint: name });
  }

  /** Pesapal signals many failures with HTTP 200 and an `error` object or `status: "500"`. */
  private assertOk(httpStatus: number, data: unknown) {
    const body = (data && typeof data === 'object' ? data : {}) as JsonObject;
    const errObj = body.error && typeof body.error === 'object' ? (body.error as PesapalErrorBody) : null;
    const hasError = !!(errObj && (errObj.code || errObj.message));
    const rejected = String(body.status) === '500' || body.error === 500;

    if (httpStatus === 401 || httpStatus === 403) {
      throw new AuthenticationError('Pesapal rejected the credentials or token', { statusCode: httpStatus, pesapal: errObj });
    }
    if (httpStatus === 404) {
      throw new PaymentError('Not found', { statusCode: httpStatus, pesapal: errObj });
    }
    if (httpStatus >= 400 || hasError || rejected) {
      const pesapal = errObj ?? { code: String(body.status ?? body.error ?? httpStatus), message: String(body.message ?? '') };
      const message = pesapal.message || `Pesapal rejected the request (${httpStatus})`;
      if (/consumer_key|consumer_secret|invalid_access|token/i.test(String(pesapal.code ?? ''))) {
        throw new AuthenticationError(message, { statusCode: httpStatus, pesapal });
      }
      throw new PaymentError(message, { statusCode: httpStatus, pesapal });
    }
  }

  /* ---------------------------------------------------------------- */
  /* Auth                                                               */
  /* ---------------------------------------------------------------- */

  /** Get a bearer token. Cached in memory; one RequestToken call per 5 minutes. */
  async getToken(): Promise<string> {
    const cached = this.tokens.get();
    if (cached) return cached;
    if (this.tokenInFlight) return this.tokenInFlight;

    this.tokenInFlight = (async () => {
      try {
        const body = await this.request<JsonObject>('auth', {
          path: '/api/Auth/RequestToken',
          auth: false,
          body: { consumer_key: this.config.consumerKey, consumer_secret: this.config.consumerSecret },
        });
        const token = body.token;
        if (typeof token !== 'string' || !token) {
          throw new AuthenticationError('Pesapal did not return a token', { pesapal: (body.error as PesapalErrorBody) ?? null });
        }
        let ttl = TOKEN_TTL_MS;
        if (typeof body.expiryDate === 'string') {
          const left = new Date(body.expiryDate).getTime() - Date.now() - 10_000;
          if (left > 0) ttl = Math.min(left, TOKEN_TTL_MS);
        }
        this.tokens.set(token, ttl);
        return token;
      } finally {
        this.tokenInFlight = null;
      }
    })();
    return this.tokenInFlight;
  }

  invalidateToken() {
    this.tokens.clear();
  }

  /* ---------------------------------------------------------------- */
  /* IPN URLs                                                           */
  /* ---------------------------------------------------------------- */

  async registerIpnUrl(url: string, notificationType: IpnNotificationType = this.config.ipnNotificationType ?? 'GET'): Promise<IpnRecord> {
    const v = validateIpnRegistration(url, notificationType);
    const body = await this.request<JsonObject>('registerIpn', {
      path: '/api/URLSetup/RegisterIPN',
      body: { url: v.url, ipn_notification_type: v.type },
    });
    const record = toIpnRecord(body);
    this.ipnCache.set(record.url, record);
    return record;
  }

  async getIpnList(): Promise<IpnRecord[]> {
    const body = await this.request<JsonObject[] | JsonObject>('ipnList', { method: 'GET', path: '/api/URLSetup/GetIpnList' });
    return (Array.isArray(body) ? body : []).map(toIpnRecord);
  }

  /** Reuse an active registration for `url`, or register it. Result cached per client. */
  async ensureIpnUrl(url: string, notificationType?: IpnNotificationType): Promise<IpnRecord> {
    const cached = this.ipnCache.get(url);
    if (cached) return cached;
    const list = await this.getIpnList();
    const match = list.find((i) => i.url === url && String(i.status ?? 'active').toLowerCase() === 'active');
    if (match) {
      this.ipnCache.set(url, match);
      return match;
    }
    return this.registerIpnUrl(url, notificationType);
  }

  /* ---------------------------------------------------------------- */
  /* Payments                                                           */
  /* ---------------------------------------------------------------- */

  /** SubmitOrderRequest. Send the customer to `redirectUrl`. */
  async createPayment(input: PaymentRequest): Promise<PaymentResult> {
    const data = validatePaymentRequest(input);

    let notificationId = data.notificationId;
    if (!notificationId) {
      const ipnUrl = data.ipnUrl ?? this.config.ipnUrl;
      if (!ipnUrl) {
        throw new ValidationError('Provide notificationId, ipnUrl, or set ipnUrl in the client config', {
          fields: [{ field: 'notificationId', message: 'required' }],
        });
      }
      notificationId = (await this.ensureIpnUrl(ipnUrl)).ipnId;
    }

    const body = await this.request<JsonObject>('submitOrder', {
      path: '/api/Transactions/SubmitOrderRequest',
      body: toOrderPayload(data, notificationId),
    });

    return {
      orderTrackingId: String(body.order_tracking_id ?? ''),
      merchantReference: String(body.merchant_reference ?? data.reference),
      redirectUrl: String(body.redirect_url ?? ''),
      raw: body,
    };
  }

  /** GetTransactionStatus. Call this from IPN and callback handlers. */
  async verifyPayment(orderTrackingId: string): Promise<PaymentVerification> {
    const id = validateTrackingId(orderTrackingId);
    const body = await this.request<JsonObject>('transactionStatus', {
      method: 'GET',
      path: '/api/Transactions/GetTransactionStatus',
      query: { orderTrackingId: id },
    });
    return toVerification(body);
  }

  /** RefundRequest. Only COMPLETED payments, one refund per payment. */
  async refundPayment(input: RefundRequest): Promise<ActionResult> {
    const data = validateRefund(input);
    const body = await this.request<JsonObject>('refund', {
      path: '/api/Transactions/RefundRequest',
      body: {
        confirmation_code: data.confirmationCode,
        amount: data.amount,
        username: data.username,
        remarks: data.remarks,
      },
    });
    return { status: String(body.status ?? ''), message: body.message as string | undefined, raw: body };
  }

  /** CancelOrder. Only pending or failed orders. */
  async cancelOrder(orderTrackingId: string): Promise<ActionResult> {
    const id = validateTrackingId(orderTrackingId);
    const body = await this.request<JsonObject>('cancelOrder', {
      path: '/api/Transactions/CancelOrder',
      body: { order_tracking_id: id },
    });
    return { status: String(body.status ?? ''), message: body.message as string | undefined, raw: body };
  }

  /* ---------------------------------------------------------------- */
  /* IPN                                                                */
  /* ---------------------------------------------------------------- */

  static parseIpn = parseIpn;

  /**
   * Framework neutral IPN processing. Parse, verify with Pesapal, dedupe,
   * run your callback, and return the status and JSON body to reply with.
   */
  async handleIpn(input: IpnInput, options: IpnHandlerOptions = {}): Promise<IpnOutcome> {
    const store: IpnStore | null = options.store === false ? null : (options.store ?? this.defaultIpnStore());
    let ipn = null as IpnOutcome['ipn'];
    try {
      ipn = parseIpn(input);
      const verification = await this.verifyPayment(ipn.orderTrackingId);
      const key = ipnDedupeKey(ipn.orderTrackingId, verification.status, ipn.orderNotificationType);
      const duplicate = store ? await store.has(key) : false;

      if (!duplicate && options.onNotification) {
        await options.onNotification(verification, ipn);
      }
      if (!duplicate && store) await store.add(key);

      return { status: 200, body: ack(ipn, 200), ipn, verification, duplicate };
    } catch (error) {
      this.logger.error('IPN processing failed', { error: String(error), ipn });
      if (options.onError) {
        try {
          await options.onError(error, ipn);
        } catch (callbackError) {
          this.logger.error('IPN onError threw', { error: String(callbackError) });
        }
      }
      const status = error instanceof ValidationError ? 400 : 500;
      return { status, body: ack(ipn, status), ipn, verification: null, duplicate: false, error };
    }
  }

  private memoryIpnStore: MemoryIpnStore | null = null;
  private defaultIpnStore(): IpnStore {
    if (!this.memoryIpnStore) this.memoryIpnStore = new MemoryIpnStore();
    return this.memoryIpnStore;
  }

  /* ---------------------------------------------------------------- */
  /* Ops                                                                */
  /* ---------------------------------------------------------------- */

  status() {
    return {
      environment: this.config.environment ?? 'sandbox',
      baseUrl: this.baseUrl,
      circuitBreaker: this.breaker.snapshot(),
      rateLimit: this.limiter.snapshot(),
      tokenCached: this.tokens.get() !== null,
    };
  }

  resetCircuitBreaker() {
    this.breaker.reset();
  }
}

/* ------------------------------------------------------------------ */
/* Mappers                                                             */
/* ------------------------------------------------------------------ */

function ack(ipn: IpnOutcome['ipn'], status: 200 | 400 | 500) {
  return {
    orderNotificationType: ipn?.orderNotificationType,
    orderTrackingId: ipn?.orderTrackingId,
    orderMerchantReference: ipn?.orderMerchantReference,
    status,
  };
}

export function toOrderPayload(data: PaymentRequest, notificationId: string): JsonObject {
  const b = data.billingAddress ?? {};
  const payload: JsonObject = {
    id: data.reference,
    currency: data.currency ?? 'KES',
    amount: data.amount,
    description: data.description,
    callback_url: data.callbackUrl,
    notification_id: notificationId,
    ...compact({
      cancellation_url: data.cancellationUrl,
      redirect_mode: data.redirectMode,
      branch: data.branch,
    }),
    billing_address: compact({
      email_address: data.email,
      phone_number: data.phoneNumber,
      country_code: b.countryCode,
      first_name: data.firstName,
      middle_name: data.middleName,
      last_name: data.lastName,
      line_1: b.line1,
      line_2: b.line2,
      city: b.city,
      state: b.state,
      postal_code: b.postalCode,
      zip_code: b.zipCode,
    }),
  };
  if (data.subscription) {
    payload.account_number = data.subscription.accountNumber;
    payload.subscription_details = {
      start_date: data.subscription.startDate,
      end_date: data.subscription.endDate,
      frequency: data.subscription.frequency,
    };
  }
  return payload;
}

export function toVerification(body: JsonObject): PaymentVerification {
  const rawCode = body.status_code;
  const code = typeof rawCode === 'number' ? rawCode : rawCode === undefined || rawCode === null ? NaN : Number(rawCode);
  const fromCode = STATUS_CODES[code];
  const fromText = String(body.payment_status_description ?? '').toUpperCase();
  const status = fromCode ?? ((Object.values(PaymentStatus) as string[]).includes(fromText) ? (fromText as PaymentStatus) : PaymentStatus.Invalid);
  return {
    status,
    statusCode: Number.isNaN(code) ? null : code,
    isCompleted: status === PaymentStatus.Completed,
    orderTrackingId: str(body.order_tracking_id),
    merchantReference: str(body.merchant_reference),
    method: str(body.payment_method),
    amount: typeof body.amount === 'number' ? body.amount : undefined,
    currency: str(body.currency),
    paymentAccount: str(body.payment_account),
    confirmationCode: str(body.confirmation_code),
    description: str(body.description),
    message: str(body.message),
    createdDate: str(body.created_date),
    callbackUrl: str(body.call_back_url),
    subscriptionTransactionInfo: (body.subscription_transaction_info as PaymentVerification['subscriptionTransactionInfo']) ?? undefined,
    raw: body,
  };
}

function toIpnRecord(item: JsonObject): IpnRecord {
  return {
    ipnId: String(item.ipn_id ?? ''),
    url: String(item.url ?? ''),
    notificationType: str(item.ipn_notification_type_description) ?? str(item.ipn_notification_type),
    status: str(item.ipn_status_decription) ?? str(item.ipn_status_description),
    createdDate: str(item.created_date),
    raw: item,
  };
}

const str = (v: unknown): string | undefined => (v === undefined || v === null ? undefined : String(v));
