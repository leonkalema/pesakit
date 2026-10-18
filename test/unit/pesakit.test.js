import { jest } from '@jest/globals';
import nock from 'nock';
import Pesakit, { ValidationError } from '../../index.js';

const SANDBOX = 'https://cybqa.pesapal.com';
const BASE = '/pesapalv3';

const config = {
  consumerKey: 'test_consumer_key_123',
  consumerSecret: 'test_consumer_secret_123',
  environment: 'test',
  enableLogging: false,
  retries: 0
};

const makeRes = () => {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
};

const mockStatus = (statusCode) => {
  nock(SANDBOX).post(`${BASE}/api/Auth/RequestToken`).reply(200, { token: 'tok' });
  nock(SANDBOX)
    .get(`${BASE}/api/Transactions/GetTransactionStatus`)
    .query({ orderTrackingId: 'otid-1' })
    .reply(200, { status_code: statusCode, merchant_reference: 'ORDER-1', confirmation_code: 'C1', amount: 10, currency: 'KES' });
};

describe('IPN handling', () => {
  let client;
  beforeAll(() => nock.disableNetConnect());
  afterAll(() => nock.enableNetConnect());
  beforeEach(() => { client = new Pesakit(config); });
  afterEach(() => { nock.cleanAll(); client.destroy(); });

  describe('Pesakit.parseIpn', () => {
    test('reads GET query params', () => {
      const ipn = Pesakit.parseIpn({ query: { OrderTrackingId: 'otid-1', OrderMerchantReference: 'ORDER-1', OrderNotificationType: 'IPNCHANGE' } });
      expect(ipn).toEqual({ orderTrackingId: 'otid-1', orderMerchantReference: 'ORDER-1', orderNotificationType: 'IPNCHANGE' });
    });

    test('reads POST JSON body', () => {
      const ipn = Pesakit.parseIpn({ body: { OrderTrackingId: 'otid-1', OrderMerchantReference: 'ORDER-1', OrderNotificationType: 'IPNCHANGE' } });
      expect(ipn.orderTrackingId).toBe('otid-1');
    });

    test('accepts camelCase keys', () => {
      const ipn = Pesakit.parseIpn({ body: { orderTrackingId: 'otid-1' } });
      expect(ipn.orderNotificationType).toBe('IPNCHANGE');
    });

    test('rejects a request with no tracking id', () => {
      expect(() => Pesakit.parseIpn({ query: {} })).toThrow(ValidationError);
    });
  });

  describe('createIpnHandler', () => {
    test('verifies with Pesapal, calls onNotification, acknowledges', async () => {
      mockStatus(1);
      const onNotification = jest.fn();
      const handler = client.createIpnHandler({ onNotification });
      const res = makeRes();
      const req = { query: { OrderTrackingId: 'otid-1', OrderMerchantReference: 'ORDER-1', OrderNotificationType: 'IPNCHANGE' } };

      await handler(req, res);

      expect(onNotification).toHaveBeenCalledTimes(1);
      const [verification, ipn] = onNotification.mock.calls[0];
      expect(verification.status).toBe('COMPLETED');
      expect(ipn.orderMerchantReference).toBe('ORDER-1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        orderNotificationType: 'IPNCHANGE',
        orderTrackingId: 'otid-1',
        orderMerchantReference: 'ORDER-1',
        status: 200
      });
    });

    test('passes FAILED status through to onNotification', async () => {
      mockStatus(2);
      const onNotification = jest.fn();
      await client.createIpnHandler({ onNotification })({ body: { OrderTrackingId: 'otid-1' } }, makeRes());
      expect(onNotification.mock.calls[0][0].status).toBe('FAILED');
    });

    test('replies 400 on a malformed notification and does not call Pesapal', async () => {
      const res = makeRes();
      const next = jest.fn();
      await client.createIpnHandler()({ query: {} }, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    test('replies 500 when onNotification throws so Pesapal retries', async () => {
      mockStatus(1);
      const onError = jest.fn();
      const next = jest.fn();
      const res = makeRes();
      const handler = client.createIpnHandler({
        onNotification: async () => { throw new Error('db down'); },
        onError
      });
      await handler({ query: { OrderTrackingId: 'otid-1' } }, res, next);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(onError).toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    test('replies 500 when Pesapal status lookup fails', async () => {
      nock(SANDBOX).post(`${BASE}/api/Auth/RequestToken`).reply(200, { token: 'tok' });
      nock(SANDBOX).get(`${BASE}/api/Transactions/GetTransactionStatus`).query(true).reply(503, {});
      const res = makeRes();
      await client.createIpnHandler()({ query: { OrderTrackingId: 'otid-1' } }, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
