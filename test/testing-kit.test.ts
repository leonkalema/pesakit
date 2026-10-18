import { describe, expect, test } from 'vitest';
import Pesakit from '../src/index.js';
import { createMockPesapal, fixtures } from '../src/testing/index.js';
import { toVerification } from '../src/client.js';

describe('pesakit/testing', () => {
  test('runs as a real HTTP server', async () => {
    const mock = createMockPesapal();
    const server = await mock.listen();
    try {
      const client = new Pesakit({ consumerKey: mock.consumerKey, consumerSecret: mock.consumerSecret, baseUrl: server.url, ipnUrl: 'https://s.example.com/ipn', logger: false, retry: false });
      const r = await client.createPayment({ amount: 5, description: 'd', reference: 'HTTP-1', phoneNumber: '254700000000', callbackUrl: 'https://s.example.com/cb' });
      mock.settle(r.orderTrackingId);
      expect((await client.verifyPayment(r.orderTrackingId)).isCompleted).toBe(true);
    } finally {
      await server.close();
    }
  });

  test('fixtures map through toVerification', () => {
    expect(toVerification({ ...fixtures.statusCompleted }).status).toBe('COMPLETED');
    expect(toVerification({ ...fixtures.statusPending }).statusCode).toBe(0);
    expect(toVerification({ ...fixtures.statusFailed }).status).toBe('FAILED');
    expect(toVerification({ payment_status_description: 'Reversed' }).status).toBe('REVERSED');
    expect(toVerification({}).status).toBe('INVALID');
  });

  test('reset clears state', async () => {
    const mock = createMockPesapal();
    const client = new Pesakit({ ...mock.clientConfig, ipnUrl: 'https://s.example.com/ipn' });
    await client.createPayment({ amount: 5, description: 'd', reference: 'X', email: 'a@b.co', callbackUrl: 'https://s.example.com/cb' });
    expect(mock.orders.size).toBe(1);
    mock.reset();
    expect(mock.orders.size).toBe(0);
    expect(mock.calls).toHaveLength(0);
  });
});
