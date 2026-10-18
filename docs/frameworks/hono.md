# Hono, Cloudflare Workers, Bun, Deno

```ts
import { Hono } from 'hono';
import Pesakit from 'pesakit';
import { ipnHandler } from 'pesakit/hono';

const app = new Hono<{ Bindings: Env }>();

app.all('/pesapal/ipn', (c) => {
  const pesakit = new Pesakit({ consumerKey: c.env.PESAPAL_CONSUMER_KEY, consumerSecret: c.env.PESAPAL_CONSUMER_SECRET, ipnUrl: c.env.PESAPAL_IPN_URL });
  return ipnHandler(pesakit, { onNotification })(c);
});

export default app;
```

On Workers each request can get a fresh client; the token cache then lives per isolate. For a shared token across isolates, wrap `getToken()` with KV. Most apps do not need it: Pesapal allows a token request per call.

`pesakit/fetch` gives a plain `(Request) => Promise<Response>` handler for `Bun.serve`, `Deno.serve`, Remix, Astro and Nitro.
