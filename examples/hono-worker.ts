/**
 * Cloudflare Workers / Bun / Deno with Hono. Zero Node APIs needed.
 *   wrangler secret put PESAPAL_CONSUMER_KEY ...
 */
import { Hono } from 'hono';
import Pesakit from 'pesakit';
import { ipnHandler } from 'pesakit/hono';

type Env = { PESAPAL_CONSUMER_KEY: string; PESAPAL_CONSUMER_SECRET: string; PESAPAL_IPN_URL: string; PUBLIC_URL: string };

const app = new Hono<{ Bindings: Env }>();

const client = (env: Env) =>
  new Pesakit({ consumerKey: env.PESAPAL_CONSUMER_KEY, consumerSecret: env.PESAPAL_CONSUMER_SECRET, ipnUrl: env.PESAPAL_IPN_URL });

app.post('/pay', async (c) => {
  const body = await c.req.json();
  const order = await client(c.env).createPayment({
    amount: body.amount,
    currency: 'UGX',
    description: body.description,
    reference: `ORDER-${Date.now()}`,
    phoneNumber: body.phoneNumber,
    callbackUrl: `${c.env.PUBLIC_URL}/pesapal/callback`,
  });
  return c.json(order);
});

app.all('/pesapal/ipn', (c) =>
  ipnHandler(client(c.env), {
    onNotification: async (v, ipn) => console.log('IPN', ipn.orderMerchantReference, v.status),
  })(c),
);

export default app;
