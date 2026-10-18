/**
 * Live sandbox test. Runs only when PESAPAL_CONSUMER_KEY and
 * PESAPAL_CONSUMER_SECRET are set. Uses Pesapal's sandbox.
 */
import Pesakit from '../../index.js';

const key = process.env.PESAPAL_CONSUMER_KEY;
const secret = process.env.PESAPAL_CONSUMER_SECRET;
const describeLive = key && secret ? describe : describe.skip;

describeLive('Pesapal sandbox (live)', () => {
  let client;
  beforeAll(() => {
    client = new Pesakit({ consumerKey: key, consumerSecret: secret, environment: 'sandbox', enableLogging: false });
  });
  afterAll(() => client.destroy());

  test('gets a token', async () => {
    const token = await client.getOAuthToken();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);
  });

  test('registers and lists an IPN URL', async () => {
    const ipn = await client.registerIpnUrl('https://example.com/pesapal/ipn');
    expect(ipn.ipnId).toBeTruthy();
    const list = await client.getIpnList();
    expect(list.some((i) => i.ipnId === ipn.ipnId)).toBe(true);
  });

  test('submits an order and reads its status', async () => {
    const result = await client.createPayment({
      amount: 10,
      description: 'pesakit integration test',
      reference: `PESAKIT-${Date.now()}`,
      email: 'test@example.com',
      callbackUrl: 'https://example.com/pesapal/callback',
      ipnUrl: 'https://example.com/pesapal/ipn',
      currency: 'KES'
    });
    expect(result.redirectUrl).toContain('pesapal');
    const status = await client.verifyPayment(result.orderTrackingId);
    expect(status.statusCode).toBe(0);
  }, 30000);
});
