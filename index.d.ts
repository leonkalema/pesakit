declare module 'pesakit' {
  // Configuration interfaces
  interface PesakitConfig {
    consumerKey: string;
    consumerSecret: string;
    environment?: 'sandbox' | 'production';
    timeout?: number;
    retries?: number;
    enableLogging?: boolean;
    logLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  }

  // Payment data interface with comprehensive validation
  interface PaymentData {
    amount: number;
    description: string;
    reference: string;
    email: string;
    callbackUrl: string;
    currency?: 'KES' | 'UGX' | 'TZS' | 'RWF' | 'MWK' | 'ZMW' | 'ZWL' | 'USD';
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    billingAddress?: BillingAddress;
  }

  interface BillingAddress {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    countryCode?: string;
  }

  // Enhanced payment verification response
  interface PaymentVerification {
    status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'INVALID' | 'REVERSED';
    method: string;
    amount: number;
    currency: string;
    merchantReference?: string;
    timestamp: string;
  }

  // IPN data interface
  interface IpnData {
    orderTrackingId: string;
    status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'INVALID' | 'REVERSED';
    merchantReference?: string;
    amount?: number;
    currency?: string;
    paymentMethod?: string;
    paymentAccount?: string;
    timestamp?: string;
  }

  // IPN handler options
  interface IpnHandlerOptions {
    onSuccess?: (ipnData: IpnData, verification: PaymentVerification) => Promise<void>;
    onFailure?: (ipnData: IpnData, verification: PaymentVerification | null, error: string) => Promise<void>;
    validateSignature?: boolean;
  }

  // Health check interfaces
  interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy' | 'critical';
    timestamp: string;
    checks: Record<string, HealthCheck>;
    summary: HealthSummary;
  }

  interface HealthCheck {
    status: 'healthy' | 'unhealthy';
    result?: any;
    error?: string;
    critical: boolean;
    duration: number;
  }

  interface HealthSummary {
    total: number;
    healthy: number;
    unhealthy: number;
    critical: number;
  }

  // Metrics interfaces
  interface MetricsSnapshot {
    timestamp: number;
    uptime: number;
    counters: Record<string, MetricValue[]>;
    gauges: Record<string, MetricValue[]>;
    histograms: Record<string, HistogramValue[]>;
  }

  interface MetricValue {
    value: number;
    tags: Record<string, string>;
    timestamp?: number;
  }

  interface HistogramValue {
    count: number;
    sum: number;
    min: number;
    max: number;
    mean: number;
    percentiles: Record<string, number>;
    tags: Record<string, string>;
  }

  // Rate limit status interface
  interface RateLimitStatus {
    strategy: 'token-bucket' | 'sliding-window' | 'fixed-window';
    availableTokens?: number;
    capacity?: number;
    timeUntilRefill?: number;
    requestCount?: number;
    limit?: number;
    remainingRequests?: number;
    resetTime?: number;
  }

  // Error interfaces
  interface PesakitErrorDetails {
    code: string;
    statusCode: number;
    details: Record<string, any>;
    timestamp: string;
    correlationId?: string;
  }

  // Custom error classes
  class PesakitError extends Error {
    code: string;
    statusCode: number;
    details: Record<string, any>;
    timestamp: string;
    
    constructor(message: string, code: string, statusCode?: number, details?: Record<string, any>);
    toJSON(): PesakitErrorDetails;
  }

  class AuthenticationError extends PesakitError {
    constructor(message?: string, details?: Record<string, any>);
  }

  class ValidationError extends PesakitError {
    constructor(message?: string, details?: Record<string, any>);
  }

  class PaymentError extends PesakitError {
    constructor(message?: string, details?: Record<string, any>);
  }

  class NetworkError extends PesakitError {
    constructor(message?: string, details?: Record<string, any>);
  }

  class RateLimitError extends PesakitError {
    constructor(message?: string, details?: Record<string, any>);
  }

  class SignatureError extends PesakitError {
    constructor(message?: string, details?: Record<string, any>);
  }

  class ConfigurationError extends PesakitError {
    constructor(message?: string, details?: Record<string, any>);
  }

  // Express.js request/response types for IPN handler
  interface Request {
    body: any;
    headers: Record<string, string>;
    ip?: string;
  }

  interface Response {
    status(code: number): Response;
    json(data: any): Response;
    send(data: any): Response;
  }

  type NextFunction = (error?: any) => void;
  type IpnHandler = (req: Request, res: Response, next?: NextFunction) => Promise<void>;

  // Main Pesakit class with comprehensive typing
  class Pesakit {
    readonly config: Required<PesakitConfig>;
    readonly correlationId: string;

    constructor(config: PesakitConfig);

    // Core payment methods
    getOAuthToken(): Promise<string>;
    createPayment(paymentData: PaymentData): Promise<string>;
    verifyPayment(orderTrackingId: string): Promise<PaymentVerification>;
    createIpnHandler(options?: IpnHandlerOptions): IpnHandler;

    // Monitoring and health methods
    getHealthStatus(): Promise<HealthStatus>;
    getMetrics(): MetricsSnapshot;
    getRateLimitStatus(key: string): RateLimitStatus | null;

    // Utility methods
    invalidateToken(): void;
    destroy(): void;
  }

  // Export error classes
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

  // Export interfaces
  export {
    PesakitConfig,
    PaymentData,
    BillingAddress,
    PaymentVerification,
    IpnData,
    IpnHandlerOptions,
    HealthStatus,
    HealthCheck,
    HealthSummary,
    MetricsSnapshot,
    MetricValue,
    HistogramValue,
    RateLimitStatus,
    PesakitErrorDetails
  };

  export = Pesakit;
}
