export type Environment = 'sandbox' | 'production';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';
export type IpnNotificationType = 'GET' | 'POST';
export type SubscriptionFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type RedirectMode = 'TOP_WINDOW' | 'PARENT_WINDOW';

/** Pesapal `status_code` on GetTransactionStatus. */
export enum PaymentStatus {
  Invalid = 'INVALID',
  Completed = 'COMPLETED',
  Failed = 'FAILED',
  Reversed = 'REVERSED',
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface RetryOptions {
  /** Attempts after the first. Default 3. */
  retries?: number;
  /** Base delay in ms, doubled per attempt with jitter. Default 300. */
  baseDelayMs?: number;
  /** Cap per delay in ms. Default 5000. */
  maxDelayMs?: number;
}

export interface CircuitBreakerOptions {
  /** Consecutive failures before opening. Default 5. 0 disables. */
  failureThreshold?: number;
  /** Ms to stay open before a trial request. Default 30000. */
  resetTimeoutMs?: number;
}

export interface RateLimitOptions {
  /** Requests per window. Default 100. 0 disables. */
  limit?: number;
  /** Window in ms. Default 60000. */
  windowMs?: number;
}

export interface PesakitConfig {
  consumerKey: string;
  consumerSecret: string;
  /** Default 'sandbox'. */
  environment?: Environment;
  /** Override the API base URL. Used by the testing kit. */
  baseUrl?: string;
  /** Default IPN URL, registered once and reused when a payment has no notificationId. */
  ipnUrl?: string;
  /** Default 'GET'. */
  ipnNotificationType?: IpnNotificationType;
  /** Per request, ms. Default 30000. */
  timeoutMs?: number;
  retry?: RetryOptions | false;
  circuitBreaker?: CircuitBreakerOptions | false;
  rateLimit?: RateLimitOptions | false;
  /** Custom fetch, for tests, proxies or runtimes with their own. Default globalThis.fetch. */
  fetch?: FetchLike;
  logger?: Logger | false;
  /** Default 'warn'. */
  logLevel?: LogLevel;
  /** Extra value appended to the User-Agent. */
  userAgentSuffix?: string;
}

export interface BillingAddress {
  line1?: string;
  line2?: string;
  city?: string;
  /** Max 3 chars at Pesapal. */
  state?: string;
  postalCode?: string;
  zipCode?: string;
  /** ISO 3166-1 alpha-2. */
  countryCode?: string;
}

export interface SubscriptionDetails {
  /** Your id for the customer or invoice. */
  accountNumber: string;
  /** DD-MM-YYYY */
  startDate: string;
  /** DD-MM-YYYY */
  endDate: string;
  frequency: SubscriptionFrequency;
}

export interface PaymentRequest {
  amount: number;
  /** ISO 4217. Default KES. */
  currency?: string;
  /** Max 100 chars. */
  description: string;
  /** Your unique order id. Max 50 chars. Letters, digits, - _ . : */
  reference: string;
  email?: string;
  phoneNumber?: string;
  callbackUrl: string;
  cancellationUrl?: string;
  redirectMode?: RedirectMode;
  branch?: string;
  /** ipn_id from registerIpnUrl(). Falls back to ipnUrl here, then config.ipnUrl. */
  notificationId?: string;
  ipnUrl?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  billingAddress?: BillingAddress;
  subscription?: SubscriptionDetails;
}

export interface PaymentResult {
  orderTrackingId: string;
  merchantReference: string;
  redirectUrl: string;
  raw: Record<string, unknown>;
}

export interface SubscriptionTransactionInfo {
  account_reference?: string;
  amount?: number;
  first_name?: string;
  last_name?: string;
  correlation_id?: number | string;
  [key: string]: unknown;
}

export interface PaymentVerification {
  status: PaymentStatus;
  /** 0 INVALID, 1 COMPLETED, 2 FAILED, 3 REVERSED. null when Pesapal sent none. */
  statusCode: number | null;
  isCompleted: boolean;
  orderTrackingId?: string;
  merchantReference?: string;
  method?: string;
  amount?: number;
  currency?: string;
  paymentAccount?: string;
  confirmationCode?: string;
  description?: string;
  message?: string;
  createdDate?: string;
  callbackUrl?: string;
  subscriptionTransactionInfo?: SubscriptionTransactionInfo;
  raw: Record<string, unknown>;
}

export interface IpnRecord {
  ipnId: string;
  url: string;
  notificationType?: string;
  status?: string;
  createdDate?: string;
  raw: Record<string, unknown>;
}

export interface IpnNotification {
  orderTrackingId: string;
  orderMerchantReference?: string;
  /** IPNCHANGE for ordinary orders, RECURRING for subscription charges. */
  orderNotificationType: string;
}

export interface IpnAck {
  orderNotificationType?: string;
  orderTrackingId?: string;
  orderMerchantReference?: string;
  status: 200 | 400 | 500;
}

export interface RefundRequest {
  /** confirmationCode from verifyPayment(). */
  confirmationCode: string;
  amount: number;
  /** Who is issuing the refund. */
  username: string;
  remarks: string;
}

export interface ActionResult {
  status: string;
  message?: string;
  raw: Record<string, unknown>;
}

/** Keeps track of IPNs already handled so retries from Pesapal run your code once. */
export interface IpnStore {
  /** Return true if this key was already processed. */
  has(key: string): Promise<boolean> | boolean;
  /** Mark the key as processed. */
  add(key: string): Promise<void> | void;
}

export interface IpnHandlerOptions {
  /**
   * Called after Pesapal confirms the transaction. Throw to answer 500 so Pesapal retries.
   * Called once per (orderTrackingId, status) when a store is set.
   */
  onNotification?: (verification: PaymentVerification, ipn: IpnNotification) => void | Promise<void>;
  onError?: (error: unknown, ipn: IpnNotification | null) => void | Promise<void>;
  /** Dedupe store. Default: in-memory, 10 000 keys. Pass false to disable. */
  store?: IpnStore | false;
}

/** Framework neutral request shape for IPNs. */
export interface IpnInput {
  query?: Record<string, unknown> | URLSearchParams;
  body?: unknown;
}

export interface IpnOutcome {
  status: 200 | 400 | 500;
  body: IpnAck;
  ipn: IpnNotification | null;
  verification: PaymentVerification | null;
  /** True when the store said this IPN was already handled. */
  duplicate: boolean;
  error?: unknown;
}
