import { describe, expect, test, beforeEach } from 'vitest';
import Pesakit, {
  AuthenticationError,
  NetworkError,
  PaymentError,
  PaymentStatus,
  ValidationError,
  CircuitOpenError,
  RateLimitError,
} from '../src/index.js';
import { createMockPesapal } from '../src/testing/index.js';

const order = {
  amount: 1500,
  currency: 'KES',
  description: 'Order 1042',
  reference: 'ORDER-1042',
  email: 'jane@example.com',
  callbackUrl: 'https://shop.example.com/callback',
};

describe('Pesakit client', () => {
  let mock = createMockPesapal();
  let client: Pesakit;

  beforeEach(() => {
    mock = createMockPesapal();
    client = new Pesakit({ ...mock.clientConfig, ipnUrl: 'https://shop.example.com/ipn' });
  });

  describe('config', () => {
    test('defaults to sandbox', () => {
      const c = new Pesakit({ consumerKey: 'abcdefghij', consumerSecret: 'abcdefghij', logger: false });
      expect(c.baseUrl).toBe('https://cybqa.pesapal.com/pesapalv3');
    });
    test('production URL', () => {
      const c = new Pesakit({ consumerKey: 'abcdefghij', consumerSecret: 'abcdefghij', environment: 'production', logger: false });
      expect(c.baseUrl).toBe('https://pay.pesapal.com/v3');
    });
    test('rejects bad config', () => {
      expect(() => new Pesakit({} as never)).toThrow(ValidationError);
      expect(() => new Pesakit({ consumerKey: 'x', consumerSecret: 'y' })).toThrow(/consumerKey/);
    });
  });

  describe('token', () => {
    test('fetches once and caches', async () => {
      const a = await client.getToken();
      const b = await client.getToken();
      expect(a).toBe(b);
      expect(mock.calls.filter((c) => c.path.endsWith('RequestToken'))).toHaveLength(1);
    });
    test('concurrent callers share one request', async () => {
      await Promise.all([client.getToken(), client.getToken(), client.getToken()]);
      expect(mock.calls).toHaveLength(1);
    });
    test('refetches after invalidate', async () => {
      await client.getToken();
      client.invalidateToken();
      await client.getToken();
      expect(mock.calls).toHaveLength(2);
    });
    test('wrong credentials -> AuthenticationError with Pesapal code', async () => {
      const bad = new Pesakit({ ...mock.clientConfig, consumerSecret: 'wrong_secret_000' });
      const err = await bad.getToken().catch((e) => e);
      expect(err).toBeInstanceOf(AuthenticationError);
      expect(err.pesapalCode).toBe('invalid_consumer_key_or_secret_provided');
    });
    test('401 -> AuthenticationError', async () => {
      mock.failNextWith(401);
      await expect(client.getToken()).rejects.toBeInstanceOf(AuthenticationError);
    });
  });

  describe('IPN URLs', () => {
    test('register then list', async () => {
      const r = await client.registerIpnUrl('https://shop.example.com/ipn');
      expect(r.ipnId).toMatch(/[0-9a-f-]{36}/);
      expect(r.status).toBe('Active');
      const list = await client.getIpnList();
      expect(list.map((i) => i.ipnId)).toContain(r.ipnId);
    });
    test('ensureIpnUrl reuses and caches', async () => {
      const a = await client.ensureIpnUrl('https://shop.example.com/ipn');
      const b = await client.ensureIpnUrl('https://shop.example.com/ipn');
      expect(a.ipnId).toBe(b.ipnId);
      expect(mock.calls.filter((c) => /RegisterIPN/i.test(c.path))).toHaveLength(1);
      expect(mock.calls.filter((c) => /GetIpnList/i.test(c.path))).toHaveLength(1);
    });
    test('bad URL rejected before any call', async () => {
      await expect(client.registerIpnUrl('nope')).rejects.toBeInstanceOf(ValidationError);
      expect(mock.calls).toHaveLength(0);
    });
  });

  describe('createPayment', () => {
    test('submits and returns redirect', async () => {
      const r = await client.createPayment(order);
      expect(r.orderTrackingId).toBeTruthy();
      expect(r.merchantReference).toBe('ORDER-1042');
      expect(r.redirectUrl).toContain('pesapaliframe');
      const sent = mock.calls.find((c) => /SubmitOrderRequest/i.test(c.path))!.body as Record<string, unknown>;
      expect(sent.id).toBe('ORDER-1042');
      expect(sent.notification_id).toBe(mock.orders.get(r.orderTrackingId)!.notificationId);
      expect((sent.billing_address as Record<string, unknown>).country_code).toBeUndefined();
    });
    test('sends optional fields and subscription', async () => {
      await client.createPayment({
        ...order,
        reference: 'SUB-1',
        cancellationUrl: 'https://shop.example.com/cancel',
        redirectMode: 'PARENT_WINDOW',
        branch: 'Nairobi',
        billingAddress: { countryCode: 'KE', city: 'Nairobi', state: 'NBI' },
        subscription: { accountNumber: 'ACC-9', startDate: '01-01-2026', endDate: '31-12-2026', frequency: 'MONTHLY' },
      });
      const sent = mock.calls.find((c) => /SubmitOrderRequest/i.test(c.path))!.body as Record<string, unknown>;
      expect(sent.redirect_mode).toBe('PARENT_WINDOW');
      expect(sent.cancellation_url).toBe('https://shop.example.com/cancel');
      expect(sent.account_number).toBe('ACC-9');
      expect(sent.subscription_details).toEqual({ start_date: '01-01-2026', end_date: '31-12-2026', frequency: 'MONTHLY' });
      expect((sent.billing_address as Record<string, unknown>).country_code).toBe('KE');
    });
    test('uses explicit notificationId without touching IPN endpoints', async () => {
      const ipn = await client.registerIpnUrl('https://other.example.com/ipn');
      mock.calls.length = 0;
      await client.createPayment({ ...order, notificationId: ipn.ipnId });
      expect(mock.calls.some((c) => /URLSetup/i.test(c.path))).toBe(false);
    });
    test('no IPN info -> ValidationError', async () => {
      const c = new Pesakit(mock.clientConfig);
      await expect(c.createPayment(order)).rejects.toBeInstanceOf(ValidationError);
    });
    test('validation', async () => {
      await expect(client.createPayment({ ...order, amount: 0 })).rejects.toThrow(/amount/);
      await expect(client.createPayment({ ...order, email: undefined })).rejects.toThrow(/email or phoneNumber/);
      await expect(client.createPayment({ ...order, reference: 'has space' })).rejects.toThrow(/reference/);
      await expect(client.createPayment({ ...order, reference: 'shop:1042.a' })).resolves.toBeTruthy();
      await expect(client.createPayment({ ...order, reference: 'x', subscription: { accountNumber: 'a', startDate: '2026-01-01', endDate: '01-01-2027', frequency: 'MONTHLY' } })).rejects.toThrow(/startDate/);
    });
    test('duplicate reference -> PaymentError with Pesapal code', async () => {
      await client.createPayment(order);
      const err = await client.createPayment(order).catch((e) => e);
      expect(err).toBeInstanceOf(PaymentError);
      expect(err.pesapalCode).toBe('duplicate_reference');
    });
  });

  describe('verifyPayment', () => {
    test('pending reads as INVALID / 0', async () => {
      const r = await client.createPayment(order);
      const v = await client.verifyPayment(r.orderTrackingId);
      expect(v.status).toBe(PaymentStatus.Invalid);
      expect(v.statusCode).toBe(0);
      expect(v.isCompleted).toBe(false);
    });
    test('completed exposes confirmation code', async () => {
      const r = await client.createPayment(order);
      mock.settle(r.orderTrackingId, 'COMPLETED');
      const v = await client.verifyPayment(r.orderTrackingId);
      expect(v.status).toBe('COMPLETED');
      expect(v.isCompleted).toBe(true);
      expect(v.confirmationCode).toMatch(/^CONF/);
      expect(v.merchantReference).toBe('ORDER-1042');
      expect(v.raw.status_code).toBe(1);
    });
    test('failed and reversed', async () => {
      const r = await client.createPayment(order);
      mock.settle(r.orderTrackingId, 'FAILED');
      expect((await client.verifyPayment(r.orderTrackingId)).status).toBe('FAILED');
      mock.settle(r.orderTrackingId, 'REVERSED');
      expect((await client.verifyPayment(r.orderTrackingId)).status).toBe('REVERSED');
    });
    test('unknown order -> PaymentError', async () => {
      await expect(client.verifyPayment('nope-123')).rejects.toBeInstanceOf(PaymentError);
    });
    test('bad id -> ValidationError', async () => {
      await expect(client.verifyPayment('bad id!')).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('refund and cancel', () => {
    test('refund a completed order', async () => {
      const r = await client.createPayment(order);
      mock.settle(r.orderTrackingId);
      const v = await client.verifyPayment(r.orderTrackingId);
      const res = await client.refundPayment({ confirmationCode: v.confirmationCode!, amount: 500, username: 'ops', remarks: 'Customer request' });
      expect(res.status).toBe('200');
      expect(mock.refunds).toHaveLength(1);
    });
    test('refund of pending order -> PaymentError', async () => {
      await expect(client.refundPayment({ confirmationCode: 'nope', amount: 1, username: 'u', remarks: 'r' })).rejects.toBeInstanceOf(PaymentError);
    });
    test('refund validation', async () => {
      await expect(client.refundPayment({ confirmationCode: '', amount: 1, username: 'u', remarks: 'r' })).rejects.toBeInstanceOf(ValidationError);
    });
    test('cancel pending, reject completed', async () => {
      const r = await client.createPayment(order);
      expect((await client.cancelOrder(r.orderTrackingId)).status).toBe('200');
      const r2 = await client.createPayment({ ...order, reference: 'ORDER-2' });
      mock.settle(r2.orderTrackingId);
      await expect(client.cancelOrder(r2.orderTrackingId)).rejects.toBeInstanceOf(PaymentError);
    });
  });

  describe('resilience', () => {
    test('retries 5xx then succeeds', async () => {
      const c = new Pesakit({ ...mock.clientConfig, retry: { retries: 2, baseDelayMs: 1, maxDelayMs: 2 } });
      mock.failNextWith(503);
      await expect(c.getToken()).resolves.toBeTruthy();
      expect(mock.calls).toHaveLength(2);
    });
    test('network failure -> NetworkError after retries', async () => {
      let n = 0;
      const c = new Pesakit({
        consumerKey: 'abcdefghij', consumerSecret: 'abcdefghij', logger: false,
        retry: { retries: 2, baseDelayMs: 1, maxDelayMs: 2 },
        fetch: async () => { n += 1; throw new TypeError('fetch failed'); },
      });
      await expect(c.getToken()).rejects.toBeInstanceOf(NetworkError);
      expect(n).toBe(3);
    });
    test('timeout -> NetworkError', async () => {
      const c = new Pesakit({
        consumerKey: 'abcdefghij', consumerSecret: 'abcdefghij', logger: false, retry: false, timeoutMs: 100,
        fetch: (_u, init) => new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))),
      });
      const err = await c.getToken().catch((e) => e);
      expect(err).toBeInstanceOf(NetworkError);
      expect(err.message).toMatch(/timed out/);
    });
    test('circuit opens after repeated failures', async () => {
      const c = new Pesakit({
        consumerKey: 'abcdefghij', consumerSecret: 'abcdefghij', logger: false, retry: false,
        circuitBreaker: { failureThreshold: 2, resetTimeoutMs: 60_000 },
        fetch: async () => { throw new TypeError('down'); },
      });
      await expect(c.getToken()).rejects.toBeInstanceOf(NetworkError);
      await expect(c.getToken()).rejects.toBeInstanceOf(NetworkError);
      await expect(c.getToken()).rejects.toBeInstanceOf(CircuitOpenError);
      expect(c.status().circuitBreaker.state).toBe('open');
      c.resetCircuitBreaker();
      await expect(c.getToken()).rejects.toBeInstanceOf(NetworkError);
    });
    test('rate limiter', async () => {
      const c = new Pesakit({ ...mock.clientConfig, rateLimit: { limit: 2, windowMs: 60_000 } });
      await c.getToken();
      await c.getIpnList();
      await expect(c.getIpnList()).rejects.toBeInstanceOf(RateLimitError);
    });
    test('sends User-Agent and bearer', async () => {
      await client.getIpnList();
      const call = mock.calls.find((c) => /GetIpnList/i.test(c.path))!;
      expect(call.headers['user-agent']).toMatch(/^pesakit\/4/);
      expect(call.headers.authorization).toMatch(/^Bearer mock_/);
    });
  });
});
