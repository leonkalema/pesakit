# Types

All types are exported from `pesakit`. The main ones:

```ts
interface PesakitConfig {
  consumerKey: string;
  consumerSecret: string;
  environment?: 'sandbox' | 'production';
  baseUrl?: string;
  ipnUrl?: string;
  ipnNotificationType?: 'GET' | 'POST';
  timeoutMs?: number;
  retry?: { retries?: number; baseDelayMs?: number; maxDelayMs?: number } | false;
  circuitBreaker?: { failureThreshold?: number; resetTimeoutMs?: number } | false;
  rateLimit?: { limit?: number; windowMs?: number } | false;
  fetch?: (input: string, init?: RequestInit) => Promise<Response>;
  logger?: Logger | false;
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'silent';
}

enum PaymentStatus { Invalid = 'INVALID', Completed = 'COMPLETED', Failed = 'FAILED', Reversed = 'REVERSED' }

interface PaymentVerification {
  status: PaymentStatus;
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

interface IpnStore {
  has(key: string): Promise<boolean> | boolean;
  add(key: string): Promise<void> | void;
}

interface IpnHandlerOptions {
  onNotification?: (verification: PaymentVerification, ipn: IpnNotification) => void | Promise<void>;
  onError?: (error: unknown, ipn: IpnNotification | null) => void | Promise<void>;
  store?: IpnStore | false;
}
```

The full set is in `dist/index.d.ts` and shows up in your editor.
