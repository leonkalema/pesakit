/**
 * pesakit/testing: a fake Pesapal API 3.0 for tests.
 *
 * Use `fetch` with `new Pesakit({ fetch: mock.fetch })` for zero-network tests,
 * or `listen()` to run it as a real HTTP server for integration tests.
 */
import type { FetchLike } from '../types.js';

export interface MockOrder {
  orderTrackingId: string;
  merchantReference: string;
  amount: number;
  currency: string;
  statusCode: 0 | 1 | 2 | 3;
  paymentMethod: string;
  confirmationCode: string;
  notificationId: string;
  callbackUrl: string;
  payload: Record<string, unknown>;
  createdDate: string;
}

export interface MockIpn {
  ipnId: string;
  url: string;
  type: 'GET' | 'POST';
  status: 'Active' | 'Inactive';
  createdDate: string;
}

export interface MockPesapalOptions {
  consumerKey?: string;
  consumerSecret?: string;
  /** Base URL the mock answers on. Default https://mock.pesapal.test */
  baseUrl?: string;
  /** Token lifetime in ms. Default 300000. */
  tokenTtlMs?: number;
}

export interface RecordedCall {
  method: string;
  path: string;
  query: Record<string, string>;
  body: unknown;
  headers: Record<string, string>;
}

let counter = 0;
const uuid = () =>
  (globalThis.crypto?.randomUUID?.() ??
    `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`) as string;

export class MockPesapal {
  readonly baseUrl: string;
  readonly consumerKey: string;
  readonly consumerSecret: string;
  readonly orders = new Map<string, MockOrder>();
  readonly ipns = new Map<string, MockIpn>();
  readonly calls: RecordedCall[] = [];
  readonly tokens = new Map<string, number>();
  readonly refunds: Record<string, unknown>[] = [];
  readonly cancellations: string[] = [];
  private readonly tokenTtlMs: number;
  private failNext: { status: number; body?: unknown } | null = null;

  constructor(opts: MockPesapalOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? 'https://mock.pesapal.test').replace(/\/+$/, '');
    this.consumerKey = opts.consumerKey ?? 'mock_consumer_key_0000';
    this.consumerSecret = opts.consumerSecret ?? 'mock_consumer_secret_0000';
    this.tokenTtlMs = opts.tokenTtlMs ?? 300_000;
  }

  /** Config to spread into `new Pesakit({...})`. */
  get clientConfig() {
    return {
      consumerKey: this.consumerKey,
      consumerSecret: this.consumerSecret,
      baseUrl: this.baseUrl,
      fetch: this.fetch,
      retry: false as const,
      logger: false as const,
    };
  }

  /** Make the next request fail with this HTTP status. */
  failNextWith(status: number, body?: unknown) {
    this.failNext = { status, body };
  }

  /** Simulate the customer paying (or failing) an order. */
  settle(orderTrackingId: string, outcome: 'COMPLETED' | 'FAILED' | 'REVERSED' | 'INVALID' = 'COMPLETED') {
    const order = this.orders.get(orderTrackingId);
    if (!order) throw new Error(`Unknown order ${orderTrackingId}`);
    order.statusCode = ({ INVALID: 0, COMPLETED: 1, FAILED: 2, REVERSED: 3 } as const)[outcome];
    return order;
  }

  /** The IPN Pesapal would send for an order, as query params. */
  ipnFor(orderTrackingId: string, type: 'IPNCHANGE' | 'RECURRING' = 'IPNCHANGE') {
    const order = this.orders.get(orderTrackingId);
    if (!order) throw new Error(`Unknown order ${orderTrackingId}`);
    return {
      OrderTrackingId: order.orderTrackingId,
      OrderMerchantReference: order.merchantReference,
      OrderNotificationType: type,
    };
  }

  reset() {
    this.orders.clear();
    this.ipns.clear();
    this.calls.length = 0;
    this.tokens.clear();
    this.refunds.length = 0;
    this.cancellations.length = 0;
    this.failNext = null;
  }

  /** fetch-compatible function. */
  readonly fetch: FetchLike = async (input, init) => {
    const url = new URL(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    const headers = normalizeHeaders(init?.headers);
    const rawBody = init?.body;
    const body = typeof rawBody === 'string' && rawBody ? safeJson(rawBody) : undefined;
    const call: RecordedCall = { method, path: url.pathname, query: Object.fromEntries(url.searchParams), body, headers };
    this.calls.push(call);
    const { status, json } = this.route(call);
    return new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } });
  };

  /** Start as a real HTTP server (Node only). Returns the base URL. */
  async listen(port = 0): Promise<{ url: string; close: () => Promise<void> }> {
    const http = await import('node:http');
    const server = http.createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const text = Buffer.concat(chunks).toString('utf8');
      const r = await this.fetch(`http://localhost${req.url ?? '/'}`, {
        method: req.method,
        headers: req.headers as Record<string, string>,
        body: text || undefined,
      });
      res.statusCode = r.status;
      res.setHeader('Content-Type', 'application/json');
      res.end(await r.text());
    });
    await new Promise<void>((resolve) => server.listen(port, resolve));
    const addr = server.address();
    const actualPort = typeof addr === 'object' && addr ? addr.port : port;
    return {
      url: `http://127.0.0.1:${actualPort}`,
      close: () => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))),
    };
  }

  /* ---------------------------------------------------------------- */

  private route(call: RecordedCall): { status: number; json: unknown } {
    if (this.failNext) {
      const f = this.failNext;
      this.failNext = null;
      return { status: f.status, json: f.body ?? { error: { error_type: 'api_error', code: 'mock_failure', message: 'Mock failure' }, status: String(f.status) } };
    }

    const path = call.path.replace(/^\/pesapalv3|^\/v3/, '').toLowerCase();

    if (path === '/api/auth/requesttoken') return this.auth(call);

    const authed = this.checkToken(call.headers.authorization);
    if (!authed) {
      return { status: 401, json: { error: { error_type: 'api_error', code: 'invalid_token', message: 'Invalid or expired token' }, status: '401' } };
    }

    switch (path) {
      case '/api/urlsetup/registeripn':
        return this.registerIpn(call);
      case '/api/urlsetup/getipnlist':
        return { status: 200, json: [...this.ipns.values()].map(ipnJson) };
      case '/api/transactions/submitorderrequest':
        return this.submitOrder(call);
      case '/api/transactions/gettransactionstatus':
        return this.transactionStatus(call);
      case '/api/transactions/refundrequest':
        return this.refund(call);
      case '/api/transactions/cancelorder':
        return this.cancel(call);
      default:
        return { status: 404, json: { error: { error_type: 'api_error', code: 'not_found', message: `No route ${call.path}` }, status: '404' } };
    }
  }

  private auth(call: RecordedCall) {
    const b = (call.body ?? {}) as Record<string, unknown>;
    if (b.consumer_key !== this.consumerKey || b.consumer_secret !== this.consumerSecret) {
      return {
        status: 200,
        json: { token: null, expiryDate: null, error: { error_type: 'api_error', code: 'invalid_consumer_key_or_secret_provided', message: 'Invalid Access Information' }, status: '500', message: 'Invalid Access Information' },
      };
    }
    const token = `mock_${uuid()}`;
    const expires = Date.now() + this.tokenTtlMs;
    this.tokens.set(token, expires);
    return { status: 200, json: { token, expiryDate: new Date(expires).toISOString(), error: null, status: '200', message: 'Request processed successfully' } };
  }

  private checkToken(header?: string) {
    const token = header?.replace(/^Bearer\s+/i, '');
    if (!token) return false;
    const exp = this.tokens.get(token);
    return !!exp && exp > Date.now();
  }

  private registerIpn(call: RecordedCall) {
    const b = (call.body ?? {}) as Record<string, unknown>;
    const url = String(b.url ?? '');
    if (!/^https?:\/\//.test(url)) {
      return { status: 200, json: { error: { error_type: 'api_error', code: 'invalid_url', message: 'Invalid IPN URL' }, status: '500' } };
    }
    const existing = [...this.ipns.values()].find((i) => i.url === url);
    const ipn: MockIpn = existing ?? {
      ipnId: uuid(),
      url,
      type: b.ipn_notification_type === 'POST' ? 'POST' : 'GET',
      status: 'Active',
      createdDate: new Date().toISOString(),
    };
    this.ipns.set(ipn.ipnId, ipn);
    return { status: 200, json: { ...ipnJson(ipn), error: null, status: '200' } };
  }

  private submitOrder(call: RecordedCall) {
    const b = (call.body ?? {}) as Record<string, unknown>;
    const reference = String(b.id ?? '');
    const err = (code: string, message: string) => ({ status: 200, json: { order_tracking_id: null, merchant_reference: reference, redirect_url: null, error: { error_type: 'api_error', code, message }, status: '500' } });
    if (!reference) return err('invalid_reference', 'id is required');
    if ([...this.orders.values()].some((o) => o.merchantReference === reference)) return err('duplicate_reference', 'Reference already used');
    if (!this.ipns.has(String(b.notification_id))) return err('invalid_notification_id', 'notification_id is not registered');
    const billing = (b.billing_address ?? {}) as Record<string, unknown>;
    if (!billing.email_address && !billing.phone_number) return err('invalid_billing_address', 'email_address or phone_number is required');
    const amount = Number(b.amount);
    if (!(amount > 0)) return err('invalid_amount', 'amount must be positive');

    const order: MockOrder = {
      orderTrackingId: uuid(),
      merchantReference: reference,
      amount,
      currency: String(b.currency ?? 'KES'),
      statusCode: 0,
      paymentMethod: '',
      confirmationCode: `CONF${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      notificationId: String(b.notification_id),
      callbackUrl: String(b.callback_url ?? ''),
      payload: b,
      createdDate: new Date().toISOString(),
    };
    this.orders.set(order.orderTrackingId, order);
    return {
      status: 200,
      json: {
        order_tracking_id: order.orderTrackingId,
        merchant_reference: order.merchantReference,
        redirect_url: `${this.baseUrl}/pesapaliframe/PesapalIframe3/Index?OrderTrackingId=${order.orderTrackingId}`,
        error: null,
        status: '200',
      },
    };
  }

  private transactionStatus(call: RecordedCall) {
    const order = this.orders.get(call.query.orderTrackingId ?? call.query.OrderTrackingId ?? '');
    if (!order) {
      return { status: 200, json: { error: { error_type: 'api_error', code: 'order_not_found', message: 'Order not found' }, status: '500' } };
    }
    const desc = ['Invalid', 'Completed', 'Failed', 'Reversed'][order.statusCode];
    return {
      status: 200,
      json: {
        payment_method: order.statusCode === 0 ? '' : order.paymentMethod || 'MpesaKE',
        amount: order.amount,
        created_date: order.createdDate,
        confirmation_code: order.statusCode === 1 ? order.confirmationCode : '',
        payment_status_description: desc,
        description: order.statusCode === 0 ? 'Payment not yet made' : desc,
        message: 'Request processed successfully',
        payment_account: order.statusCode === 0 ? '' : '2547XXXX123',
        call_back_url: `${order.callbackUrl}?OrderTrackingId=${order.orderTrackingId}&OrderMerchantReference=${order.merchantReference}`,
        status_code: order.statusCode,
        merchant_reference: order.merchantReference,
        order_tracking_id: order.orderTrackingId,
        payment_status_code: '',
        currency: order.currency,
        subscription_transaction_info: order.payload.subscription_details
          ? { account_reference: order.payload.account_number, amount: order.amount, first_name: '', last_name: '', correlation_id: 0 }
          : undefined,
        error: { error_type: null, code: null, message: null, call_back_url: null },
        status: '200',
      },
    };
  }

  private refund(call: RecordedCall) {
    const b = (call.body ?? {}) as Record<string, unknown>;
    const order = [...this.orders.values()].find((o) => o.confirmationCode === b.confirmation_code);
    if (!order || order.statusCode !== 1) return { status: 200, json: { status: '500', message: 'Only completed payments can be refunded' } };
    if (Number(b.amount) > order.amount) return { status: 200, json: { status: '500', message: 'Refund exceeds amount collected' } };
    if (this.refunds.some((r) => r.confirmation_code === b.confirmation_code)) return { status: 200, json: { status: '500', message: 'Only one refund per payment' } };
    this.refunds.push(b);
    return { status: 200, json: { status: '200', message: 'Refund request received. Awaiting merchant approval.' } };
  }

  private cancel(call: RecordedCall) {
    const b = (call.body ?? {}) as Record<string, unknown>;
    const order = this.orders.get(String(b.order_tracking_id ?? ''));
    if (!order) return { status: 200, json: { status: '500', message: 'Order not found' } };
    if (order.statusCode === 1) return { status: 200, json: { status: '500', message: 'Completed orders cannot be cancelled' } };
    if (this.cancellations.includes(order.orderTrackingId)) return { status: 200, json: { status: '500', message: 'Order already cancelled' } };
    this.cancellations.push(order.orderTrackingId);
    return { status: 200, json: { status: '200', message: 'Order successfully cancelled.' } };
  }
}

function ipnJson(i: MockIpn) {
  return {
    url: i.url,
    created_date: i.createdDate,
    ipn_id: i.ipnId,
    notification_type: i.type === 'GET' ? 0 : 1,
    ipn_notification_type_description: i.type,
    ipn_status: i.status === 'Active' ? 1 : 0,
    ipn_status_decription: i.status,
  };
}

function normalizeHeaders(h: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!h) return out;
  if (h instanceof Headers) h.forEach((v, k) => (out[k.toLowerCase()] = v));
  else if (Array.isArray(h)) for (const [k, v] of h) out[k.toLowerCase()] = v;
  else for (const [k, v] of Object.entries(h)) out[k.toLowerCase()] = String(v);
  return out;
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

/** Shorthand: `const mock = createMockPesapal(); new Pesakit(mock.clientConfig)` */
export function createMockPesapal(opts?: MockPesapalOptions) {
  return new MockPesapal(opts);
}

/** Sample Pesapal responses, handy for snapshot tests or stubbing by hand. */
export const fixtures = {
  token: { token: 'eyJhbGciOiJIUzI1NiJ9.sample', expiryDate: '2030-01-01T00:05:00.000Z', error: null, status: '200', message: 'Request processed successfully' },
  registerIpn: { url: 'https://example.com/ipn', created_date: '2026-01-01T00:00:00.000Z', ipn_id: '2f46b6c4-9b8e-4f0a-9d9a-2d7c7c5f1a11', notification_type: 0, ipn_notification_type_description: 'GET', ipn_status: 1, ipn_status_decription: 'Active', error: null, status: '200' },
  submitOrder: { order_tracking_id: 'b945e4af-80a5-4ec1-8706-e03f8332fb04', merchant_reference: 'ORDER-1042', redirect_url: 'https://cybqa.pesapal.com/pesapaliframe/PesapalIframe3/Index?OrderTrackingId=b945e4af-80a5-4ec1-8706-e03f8332fb04', error: null, status: '200' },
  statusCompleted: { payment_method: 'MpesaKE', amount: 1500, created_date: '2026-01-01T10:12:44.123', confirmation_code: 'QCD4ABCDEF', payment_status_description: 'Completed', description: 'Payment completed', message: 'Request processed successfully', payment_account: '2547XXXX123', call_back_url: 'https://example.com/callback?OrderTrackingId=b945e4af-80a5-4ec1-8706-e03f8332fb04', status_code: 1, merchant_reference: 'ORDER-1042', order_tracking_id: 'b945e4af-80a5-4ec1-8706-e03f8332fb04', payment_status_code: '', currency: 'KES', error: { error_type: null, code: null, message: null, call_back_url: null }, status: '200' },
  statusPending: { payment_method: '', amount: 1500, created_date: '2026-01-01T10:12:44.123', confirmation_code: '', payment_status_description: 'Invalid', description: 'Payment not yet made', message: 'Request processed successfully', payment_account: '', call_back_url: '', status_code: 0, merchant_reference: 'ORDER-1042', order_tracking_id: 'b945e4af-80a5-4ec1-8706-e03f8332fb04', currency: 'KES', error: { error_type: null, code: null, message: null }, status: '200' },
  statusFailed: { payment_method: 'Visa', amount: 100, created_date: '2026-01-01T10:12:44.123', confirmation_code: '', payment_status_description: 'Failed', description: 'Unable to Authorize Transaction', message: 'Request processed successfully', payment_account: '476173**0010', status_code: 2, merchant_reference: 'ORDER-1043', order_tracking_id: '1c3d1a9b-7f7e-4a1c-9c2f-3b6a0f0f1d2e', currency: 'KES', error: { error_type: null, code: null, message: null }, status: '200' },
  authFailed: { token: null, expiryDate: null, error: { error_type: 'api_error', code: 'invalid_consumer_key_or_secret_provided', message: 'Invalid Access Information' }, status: '500', message: 'Invalid Access Information' },
  refund: { status: '200', message: 'Refund request received' },
  cancel: { status: '200', message: 'Order successfully cancelled.' },
  ipnQuery: { OrderTrackingId: 'b945e4af-80a5-4ec1-8706-e03f8332fb04', OrderMerchantReference: 'ORDER-1042', OrderNotificationType: 'IPNCHANGE' },
} as const;
