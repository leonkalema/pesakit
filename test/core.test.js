import { jest } from '@jest/globals';
import nock from 'nock';
import Pesakit, {
  AuthenticationError,
  ValidationError,
  PaymentError,
  NetworkError
} from '../index.js';

const SANDBOX = 'https://cybqa.pesapal.com';
const BASE = '/pesapalv3';
const IPN_ID = '550e8400-e29b-41d4-a716-446655440000';

const config = {
  consumerKey: 'test_consumer_key_123',
  consumerSecret: 'test_consumer_secret_123',
  environment: 'test',
  enableLogging: false,
  retries: 0
};

const mockToken = () => nock(SANDBOX)
  .post(`${BASE}/api/Auth/RequestToken`)
  .reply(200, { token: 'tok_123', expiryDate: new Date(Date.now() + 300000).toISOString(), error: null, status: '200', message: 'Request processed successfully' });

const paymentData = {
  amount: 1000,
  description: 'Order 1',
  reference: 'ORDER-1',
  email: 'buyer@example.com',
  callbackUrl: 'https://shop.example.com/callback',
  currency: 'KES',
  notificationId: IPN_ID
};

describe('Pesakit', () => {
  let client;

  beforeAll(() => nock.disableNetConnect());
  afterAll(() => nock.enableNetConnect());

  beforeEach(() => {
    client = new Pesakit(config);
  });

  afterEach(() => {
    nock.cleanAll();
    client.destroy();
  });

  describe('constructor', () => {
    test('uses sandbox URL by default', () => {
      const c = new Pesakit({ consumerKey: 'abcdefghijklmnop', consumerSecret: 'abcdefghijklmnop', enableLogging: false });
      expect(c.baseURL).toBe('https://cybqa.pesapal.com/pesapalv3');
      c.destroy();
    });

    test('uses production URL when asked', () => {
      const c = new Pesakit({ ...config, environment: 'production' });
      expect(c.baseURL).toBe('https://pay.pesapal.com/v3');
      c.destroy();
    });

    test('rejects missing credentials', () => {
      expect(() => new Pesakit({})).toThrow(ValidationError);
    });
  });

  describe('getOAuthToken', () => {
    test('fetches and caches the token', async () => {
      const scope = mockToken();
      expect(await client.getOAuthToken()).toBe('tok_123');
      expect(await client.getOAuthToken()).toBe('tok_123');
      expect(scope.isDone()).toBe(true);
      expect(nock.pendingMocks()).toHaveLength(0);
    });

    test('refetches after invalidateToken', async () => {
      mockToken();
      await client.getOAuthToken();
      client.invalidateToken();
      const second = nock(SANDBOX).post(`${BASE}/api/Auth/RequestToken`).reply(200, { token: 'tok_456' });
      expect(await client.getOAuthToken()).toBe('tok_456');
      expect(second.isDone()).toBe(true);
    });

    test('throws AuthenticationError on Pesapal error body', async () => {
      nock(SANDBOX).post(`${BASE}/api/Auth/RequestToken`).reply(200, {
        token: null,
        error: { type: 'api_error', code: 'invalid_consumer_key_or_secret_provided', message: 'Invalid Access Information' },
        status: '500'
      });
      await expect(client.getOAuthToken()).rejects.toThrow(AuthenticationError);
    });

    test('throws AuthenticationError on 401', async () => {
      nock(SANDBOX).post(`${BASE}/api/Auth/RequestToken`).reply(401, {});
      await expect(client.getOAuthToken()).rejects.toThrow(AuthenticationError);
    });

    test('throws NetworkError when unreachable', async () => {
      nock(SANDBOX).post(`${BASE}/api/Auth/RequestToken`).replyWithError('ECONNRESET');
      await expect(client.getOAuthToken()).rejects.toThrow(NetworkError);
    });
  });

  describe('registerIpnUrl / getIpnList', () => {
    test('registers an IPN URL', async () => {
      mockToken();
      nock(SANDBOX)
        .post(`${BASE}/api/URLSetup/RegisterIPN`, { url: 'https://shop.example.com/ipn', ipn_notification_type: 'GET' })
        .reply(200, { url: 'https://shop.example.com/ipn', created_date: '2024-01-01', ipn_id: IPN_ID, ipn_notification_type_description: 'GET', ipn_status_decription: 'Active', error: null, status: '200' });

      const ipn = await client.registerIpnUrl('https://shop.example.com/ipn');
      expect(ipn.ipnId).toBe(IPN_ID);
      expect(ipn.status).toBe('Active');
    });

    test('rejects a bad URL without calling the API', async () => {
      await expect(client.registerIpnUrl('not-a-url')).rejects.toThrow(ValidationError);
    });

    test('lists IPN URLs', async () => {
      mockToken();
      nock(SANDBOX).get(`${BASE}/api/URLSetup/GetIpnList`).reply(200, [
        { url: 'https://a.example.com/ipn', ipn_id: IPN_ID, ipn_status_decription: 'Active', ipn_notification_type_description: 'GET' }
      ]);
      const list = await client.getIpnList();
      expect(list).toHaveLength(1);
      expect(list[0].url).toBe('https://a.example.com/ipn');
    });
  });

  describe('createPayment', () => {
    test('submits an order and returns the redirect', async () => {
      mockToken();
      let sent;
      nock(SANDBOX)
        .post(`${BASE}/api/Transactions/SubmitOrderRequest`, (body) => { sent = body; return true; })
        .reply(200, { order_tracking_id: 'otid-1', merchant_reference: 'ORDER-1', redirect_url: 'https://cybqa.pesapal.com/pesapaliframe/x', error: null, status: '200' });

      const result = await client.createPayment(paymentData);
      expect(result.redirectUrl).toContain('pesapaliframe');
      expect(result.orderTrackingId).toBe('otid-1');
      expect(sent.id).toBe('ORDER-1');
      expect(sent.notification_id).toBe(IPN_ID);
      expect(sent.billing_address.email_address).toBe('buyer@example.com');
      expect(sent.billing_address.country_code).toBeUndefined();
    });

    test('sends subscription details', async () => {
      mockToken();
      let sent;
      nock(SANDBOX)
        .post(`${BASE}/api/Transactions/SubmitOrderRequest`, (body) => { sent = body; return true; })
        .reply(200, { order_tracking_id: 'otid-2', merchant_reference: 'SUB-1', redirect_url: 'https://x' });

      await client.createPayment({
        ...paymentData,
        reference: 'SUB-1',
        subscription: { accountNumber: 'ACC-9', startDate: '01-01-2025', endDate: '31-12-2025', frequency: 'MONTHLY' }
      });
      expect(sent.account_number).toBe('ACC-9');
      expect(sent.subscription_details).toEqual({ start_date: '01-01-2025', end_date: '31-12-2025', frequency: 'MONTHLY' });
    });

    test('registers the IPN URL when only ipnUrl is given', async () => {
      mockToken();
      nock(SANDBOX).get(`${BASE}/api/URLSetup/GetIpnList`).reply(200, []);
      nock(SANDBOX).post(`${BASE}/api/URLSetup/RegisterIPN`).reply(200, { ipn_id: IPN_ID, url: 'https://shop.example.com/ipn', ipn_status_decription: 'Active' });
      let sent;
      nock(SANDBOX)
        .post(`${BASE}/api/Transactions/SubmitOrderRequest`, (body) => { sent = body; return true; })
        .reply(200, { order_tracking_id: 'otid-3', merchant_reference: 'ORDER-1', redirect_url: 'https://x' });

      const rest = { ...paymentData }; delete rest.notificationId;
      await client.createPayment({ ...rest, ipnUrl: 'https://shop.example.com/ipn' });
      expect(sent.notification_id).toBe(IPN_ID);
    });

    test('reuses an active IPN from the list', async () => {
      mockToken();
      nock(SANDBOX).get(`${BASE}/api/URLSetup/GetIpnList`).reply(200, [
        { ipn_id: IPN_ID, url: 'https://shop.example.com/ipn', ipn_status_decription: 'Active' }
      ]);
      nock(SANDBOX).post(`${BASE}/api/Transactions/SubmitOrderRequest`).reply(200, { order_tracking_id: 'otid-4', redirect_url: 'https://x' });

      const rest = { ...paymentData }; delete rest.notificationId;
      const c = new Pesakit({ ...config, ipnUrl: 'https://shop.example.com/ipn' });
      const result = await c.createPayment(rest);
      expect(result.orderTrackingId).toBe('otid-4');
      expect(nock.pendingMocks()).toHaveLength(0);
      c.destroy();
    });

    test('fails fast without any IPN info', async () => {
      const rest = { ...paymentData }; delete rest.notificationId;
      await expect(client.createPayment(rest)).rejects.toThrow(ValidationError);
    });

    test('rejects invalid payment data', async () => {
      await expect(client.createPayment({ ...paymentData, amount: -5 })).rejects.toThrow(ValidationError);
      await expect(client.createPayment({ ...paymentData, email: undefined })).rejects.toThrow(ValidationError);
    });

    test('surfaces Pesapal error bodies as PaymentError', async () => {
      mockToken();
      nock(SANDBOX).post(`${BASE}/api/Transactions/SubmitOrderRequest`).reply(200, {
        order_tracking_id: null,
        error: { error_type: 'api_error', code: 'duplicate_reference', message: 'Reference already used' },
        status: '500'
      });
      const err = await client.createPayment(paymentData).catch((e) => e);
      expect(err).toBeInstanceOf(PaymentError);
      expect(err.details.pesapal.code).toBe('duplicate_reference');
    });
  });

  describe('verifyPayment', () => {
    test('maps status_code to a status', async () => {
      mockToken();
      nock(SANDBOX)
        .get(`${BASE}/api/Transactions/GetTransactionStatus`)
        .query({ orderTrackingId: 'otid-1' })
        .reply(200, {
          payment_method: 'MPESA', amount: 1000, created_date: '2024-01-01T00:00:00',
          confirmation_code: 'ABC123', payment_status_description: 'Completed',
          merchant_reference: 'ORDER-1', payment_account: '2547xxxx', currency: 'KES',
          status_code: 1, order_tracking_id: 'otid-1', error: { error_type: null, code: null, message: null }, status: '200'
        });

      const v = await client.verifyPayment('otid-1');
      expect(v.status).toBe('COMPLETED');
      expect(v.isCompleted).toBe(true);
      expect(v.confirmationCode).toBe('ABC123');
      expect(v.method).toBe('MPESA');
    });

    test('reports FAILED and REVERSED', async () => {
      mockToken();
      nock(SANDBOX).get(`${BASE}/api/Transactions/GetTransactionStatus`).query(true).reply(200, { status_code: 2 });
      nock(SANDBOX).get(`${BASE}/api/Transactions/GetTransactionStatus`).query(true).reply(200, { status_code: 3 });
      expect((await client.verifyPayment('a')).status).toBe('FAILED');
      expect((await client.verifyPayment('b')).status).toBe('REVERSED');
    });

    test('rejects bad tracking ids', async () => {
      await expect(client.verifyPayment('')).rejects.toThrow(ValidationError);
      await expect(client.verifyPayment('bad id!')).rejects.toThrow(ValidationError);
    });
  });

  describe('refundPayment / cancelOrder', () => {
    test('submits a refund', async () => {
      mockToken();
      nock(SANDBOX)
        .post(`${BASE}/api/Transactions/RefundRequest`, { confirmation_code: 'ABC123', amount: 500, username: 'ops', remarks: 'Customer request' })
        .reply(200, { status: '200', message: 'Refund request submitted' });
      const r = await client.refundPayment({ confirmationCode: 'ABC123', amount: 500, username: 'ops', remarks: 'Customer request' });
      expect(r.status).toBe('200');
    });

    test('validates refund input', async () => {
      await expect(client.refundPayment({ confirmationCode: 'x' })).rejects.toThrow(ValidationError);
    });

    test('cancels an order', async () => {
      mockToken();
      nock(SANDBOX)
        .post(`${BASE}/api/Transactions/CancelOrder`, { order_tracking_id: 'otid-1' })
        .reply(200, { status: '200', message: 'Order cancelled' });
      const r = await client.cancelOrder('otid-1');
      expect(r.message).toBe('Order cancelled');
    });
  });

  describe('metrics and health', () => {
    test('exposes health and metrics', async () => {
      const health = await client.getHealthStatus();
      expect(health).toHaveProperty('status');
      expect(client.getMetrics()).toHaveProperty('counters');
    });

    test('destroy releases resources', () => {
      const spy = jest.spyOn(client.metrics, 'destroy');
      client.destroy();
      expect(spy).toHaveBeenCalled();
    });
  });
});

describe('Pesapal status 500 bodies', () => {
  let client;
  beforeAll(() => nock.disableNetConnect());
  afterAll(() => nock.enableNetConnect());
  beforeEach(() => { client = new Pesakit(config); });
  afterEach(() => { nock.cleanAll(); client.destroy(); });

  test('cancelOrder throws PaymentError when Pesapal answers status 500', async () => {
    mockToken();
    nock(SANDBOX).post(`${BASE}/api/Transactions/CancelOrder`).reply(200, { status: '500', message: 'Order already completed' });
    const err = await client.cancelOrder('otid-1').catch((e) => e);
    expect(err).toBeInstanceOf(PaymentError);
    expect(err.details.pesapal.message).toBe('Order already completed');
  });

  test('accepts colons in references', async () => {
    mockToken();
    nock(SANDBOX).post(`${BASE}/api/Transactions/SubmitOrderRequest`).reply(200, { order_tracking_id: 'x', redirect_url: 'https://x' });
    await expect(client.createPayment({ ...paymentData, reference: 'shop:1042' })).resolves.toBeTruthy();
  });
});
