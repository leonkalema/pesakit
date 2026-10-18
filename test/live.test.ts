/**
 * Live sandbox test. Run with:
 *   PESAPAL_CONSUMER_KEY=... PESAPAL_CONSUMER_SECRET=... npm run test:integration
 */
import { describe, expect, test } from 'vitest';
import Pesakit from '../src/index.js';

const key = process.env.PESAPAL_CONSUMER_KEY;
const secret = process.env.PESAPAL_CONSUMER_SECRET;
const run = key && secret ? describe : describe.skip;

run('Pesapal sandbox (live)', () => {
  const client = new Pesakit({ consumerKey: key!, consumerSecret: secret!, environment: 'sandbox', ipnUrl: 'https://example.com/pesapal/ipn', logger: false });

  test('token', async () => {
    expect((await client.getToken()).length).toBeGreaterThan(20);
  });

  test('order round trip', async () => {
    const r = await client.createPayment({
      amount: 10, currency: 'KES', description: 'pesakit live test', reference: `PESAKIT-${Date.now()}`,
      email: 'test@example.com', callbackUrl: 'https://example.com/pesapal/callback',
    });
    expect(r.redirectUrl).toContain('pesapal');
    const v = await client.verifyPayment(r.orderTrackingId);
    expect(v.statusCode).toBe(0);
    expect((await client.getIpnList()).length).toBeGreaterThan(0);
  }, 30_000);
});
