# pesakit

Pesapal API 3.0 client for JavaScript and TypeScript. Zero dependencies. Runs on Node 18+, Bun, Deno, Cloudflare Workers and Vercel Edge.

[![npm](https://img.shields.io/npm/v/pesakit.svg)](https://www.npmjs.com/package/pesakit)
[![CI](https://github.com/leonkalema/pesakit/actions/workflows/ci.yml/badge.svg)](https://github.com/leonkalema/pesakit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Every V3 endpoint: token, IPN registration and listing, orders, subscriptions, status, refunds, cancellation. An IPN handler that follows Pesapal's real contract and dedupes retries. Adapters for Express, Fastify, Hono, Next.js and SvelteKit. A mock Pesapal so you can test without credentials.

**Docs: https://leonkalema.github.io/pesakit**

## Install

```bash
npm install pesakit
```

## Use

```ts
import Pesakit from 'pesakit';

const pesakit = new Pesakit({
  consumerKey: process.env.PESAPAL_CONSUMER_KEY!,
  consumerSecret: process.env.PESAPAL_CONSUMER_SECRET!,
  environment: 'sandbox',                     // or 'production'
  ipnUrl: 'https://yourapp.com/pesapal/ipn',  // registered once, reused
});

// 1. Create an order, send the customer to redirectUrl
const order = await pesakit.createPayment({
  amount: 1500,
  currency: 'KES',
  description: 'Order 1042',
  reference: 'ORDER-1042',
  email: 'jane@example.com',
  callbackUrl: 'https://yourapp.com/pesapal/callback',
});

// 2. Confirm from your IPN or callback handler
const v = await pesakit.verifyPayment(order.orderTrackingId);
v.status;           // 'COMPLETED' | 'FAILED' | 'REVERSED' | 'INVALID' (pending)
v.confirmationCode; // for refunds
```

## IPN

```ts
import { ipnHandler } from 'pesakit/express';

app.all('/pesapal/ipn', ipnHandler(pesakit, {
  onNotification: async (verification, ipn) => {
    // runs once per order and status; throw to make Pesapal retry
    await orders.markPaid(ipn.orderMerchantReference, verification);
  },
}));
```

Also `pesakit/next`, `pesakit/sveltekit`, `pesakit/hono`, `pesakit/fastify`, and `pesakit/fetch` for anything that speaks `Request`/`Response`.

## More

```ts
await pesakit.createPayment({ ...order, subscription: { accountNumber: 'C-77', startDate: '01-11-2026', endDate: '01-11-2027', frequency: 'MONTHLY' } });
await pesakit.refundPayment({ confirmationCode: v.confirmationCode!, amount: 500, username: 'ops', remarks: 'Returned' });
await pesakit.cancelOrder(order.orderTrackingId);
await pesakit.getIpnList();
```

## Test without credentials

```ts
import { createMockPesapal } from 'pesakit/testing';

const mock = createMockPesapal();
const pesakit = new Pesakit({ ...mock.clientConfig, ipnUrl: 'https://test/ipn' });
const order = await pesakit.createPayment({ /* ... */ });
mock.settle(order.orderTrackingId, 'COMPLETED');
```

## Browser checkout

```ts
import { mountCheckout, pollStatus } from 'pesakit/checkout';
```

Loads the Pesapal page in an iframe, hears your callback page, polls your status endpoint. No secrets in the browser.

## Errors

`ValidationError`, `AuthenticationError`, `PaymentError`, `NetworkError`, `RateLimitError`, `CircuitOpenError`. Each has `code`, `statusCode`, `pesapalCode` and `details.pesapal` with Pesapal's own message. Pesapal's HTTP 200 error bodies are raised, not swallowed.

## Payouts

Pesapal has no public payout API. pesakit covers collections. See the [payouts page](https://leonkalema.github.io/pesakit/payouts).

## Upgrading

[Migrating guide](https://leonkalema.github.io/pesakit/migrating) covers 3.x, 2.x and hand-rolled integrations.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security reports: [SECURITY.md](SECURITY.md).

MIT
