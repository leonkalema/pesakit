export type Environment = 'sandbox' | 'production' | 'test';
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';
export type IpnNotificationType = 'GET' | 'POST';
export type PaymentStatus = 'INVALID' | 'COMPLETED' | 'FAILED' | 'REVERSED' | string;
export type SubscriptionFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface PesakitConfig {
  consumerKey: string;
  consumerSecret: string;
  environment?: Environment;
  timeout?: number;
  retries?: number;
  enableLogging?: boolean;
  logLevel?: LogLevel;
  /** Default IPN URL, registered on first use when a payment has no notificationId. */
  ipnUrl?: string;
  ipnNotificationType?: IpnNotificationType;
}

export interface BillingAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  zipCode?: string;
  /** ISO 3166-1 alpha-2, e.g. KE, UG, TZ. */
  countryCode?: string;
}

export interface SubscriptionDetails {
  accountNumber: string;
  /** DD-MM-YYYY */
  startDate: string;
  /** DD-MM-YYYY */
  endDate: string;
  frequency: SubscriptionFrequency;
}

export interface PaymentData {
  amount: number;
  description: string;
  /** Your unique order id. Max 50 chars. */
  reference: string;
  email?: string;
  phoneNumber?: string;
  callbackUrl: string;
  cancellationUrl?: string;
  redirectMode?: 'TOP_WINDOW' | 'PARENT_WINDOW';
  branch?: string;
  /** ISO 4217, default KES. */
  currency?: string;
  /** ipn_id from registerIpnUrl(). If omitted, ipnUrl (here or in config) is registered. */
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

export interface PaymentVerification {
  status: PaymentStatus;
  /** 0 INVALID, 1 COMPLETED, 2 FAILED, 3 REVERSED */
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
  subscriptionTransactionInfo?: Record<string, unknown>;
  timestamp: string;
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
  orderNotificationType: string;
}

export interface RefundRequest {
  /** confirmationCode from verifyPayment(). */
  confirmationCode: string;
  amount: number;
  /** Name or id of the person issuing the refund. */
  username: string;
  remarks: string;
}

export interface ActionResult {
  status: string;
  message?: string;
  raw: Record<string, unknown>;
}

export interface IpnRequestLike {
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  headers?: Record<string, unknown>;
}

export interface IpnResponseLike {
  status(code: number): IpnResponseLike;
  json(data: unknown): unknown;
}

export type IpnNextFunction = (error?: unknown) => void;
export type IpnHandler = (req: IpnRequestLike, res: IpnResponseLike, next?: IpnNextFunction) => Promise<void>;

export interface IpnHandlerOptions {
  /** Called after GetTransactionStatus succeeds. Throw to make Pesapal retry. */
  onNotification?: (verification: PaymentVerification, ipn: IpnNotification) => void | Promise<void>;
  onError?: (error: Error, ipn: IpnNotification | null, req: IpnRequestLike) => void | Promise<void>;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'critical';
  timestamp: string;
  checks: Record<string, unknown>;
  summary: { total: number; healthy: number; unhealthy: number; critical: number };
}

export interface PesakitErrorDetails {
  name: string;
  message: string;
  code: string;
  statusCode: number;
  details: Record<string, unknown>;
  timestamp: string;
}

export class PesakitError extends Error {
  code: string;
  statusCode: number;
  details: Record<string, unknown>;
  timestamp: string;
  constructor(message: string, code: string, statusCode?: number, details?: Record<string, unknown>);
  toJSON(): PesakitErrorDetails;
}
export class AuthenticationError extends PesakitError { constructor(message?: string, details?: Record<string, unknown>); }
export class ValidationError extends PesakitError { constructor(message?: string, details?: Record<string, unknown>); }
export class PaymentError extends PesakitError { constructor(message?: string, details?: Record<string, unknown>); }
export class NetworkError extends PesakitError { constructor(message?: string, details?: Record<string, unknown>); }
export class RateLimitError extends PesakitError { constructor(message?: string, details?: Record<string, unknown>); }
export class SignatureError extends PesakitError { constructor(message?: string, details?: Record<string, unknown>); }
export class ConfigurationError extends PesakitError { constructor(message?: string, details?: Record<string, unknown>); }

export const STATUS_CODES: Readonly<Record<number, PaymentStatus>>;

export class Pesakit {
  readonly config: Required<Omit<PesakitConfig, 'ipnUrl'>> & { ipnUrl?: string };
  readonly correlationId: string;
  readonly baseURL: string;

  constructor(config: PesakitConfig);

  getOAuthToken(): Promise<string>;
  invalidateToken(): void;

  registerIpnUrl(ipnUrl: string, notificationType?: IpnNotificationType): Promise<IpnRecord>;
  getIpnList(): Promise<IpnRecord[]>;
  ensureIpnUrl(ipnUrl: string, notificationType?: IpnNotificationType): Promise<IpnRecord>;

  createPayment(paymentData: PaymentData): Promise<PaymentResult>;
  verifyPayment(orderTrackingId: string): Promise<PaymentVerification>;
  refundPayment(request: RefundRequest): Promise<ActionResult>;
  cancelOrder(orderTrackingId: string): Promise<ActionResult>;

  static parseIpn(req: IpnRequestLike): IpnNotification;
  createIpnHandler(options?: IpnHandlerOptions): IpnHandler;

  getHealthStatus(): Promise<HealthStatus>;
  getMetrics(): Record<string, unknown>;
  getRateLimitStatus(key: string): Record<string, unknown> | null;
  destroy(): void;
}

export default Pesakit;
