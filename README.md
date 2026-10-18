# pesakit

Pesapal API 3.0 client for Node.js. Full V3 coverage: one-off payments, subscriptions, status checks, refunds, cancellation, IPN registration and an IPN handler that follows Pesapal's real contract.

[![npm version](https://img.shields.io/npm/v/pesakit.svg)](https://www.npmjs.com/package/pesakit)
[![Node.js CI](https://github.com/leonkalema/pesakit/actions/workflows/ci.yml/badge.svg)](https://github.com/leonkalema/pesakit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Works with Kenya, Uganda, Tanzania, Rwanda, Malawi, Zambia and Zimbabwe merchant accounts. Card, M-PESA, Airtel Money, MTN MoMo and every other method Pesapal offers your account.

## Install

```bash
npm install pesakit
```

Node 18 or newer. Ships ESM and CommonJS, with TypeScript types.

```js
import Pesakit from 'pesakit';        // ESM
const Pesakit = require('pesakit');   // CommonJS
```

## Quick start

```js
import Pesakit from 'pesakit';

const pesakit = new Pesakit({
  consumerKey: process.env.PESAPAL_CONSUMER_KEY,
  consumerSecret: process.env.PESAPAL_CONSUMER_SECRET,
  environment: 'sandbox',                       // or 'production'
  ipnUrl: 'https://yourapp.com/pesapal/ipn'     // registered once, reused after
});

// 1. Create a payment and send the customer to redirectUrl
const order = await pesakit.createPayment({
  amount: 1500,
  currency: 'KES',
  description: 'Order 1042',
  reference: 'ORDER-1042',                      // your unique id, max 50 chars
  email: 'jane@example.com',
  phoneNumber: '254712345678',
  callbackUrl: 'https://yourapp.com/pesapal/callback'
});
// order = { orderTrackingId, merchantReference, redirectUrl }

// 2. Confirm the result from your IPN or callback handler
const status = await pesakit.verifyPayment(order.orderTrackingId);
// status.status: 'COMPLETED' | 'FAILED' | 'REVERSED' | 'INVALID'
```

## Credentials

Sandbox keys per country are listed in Pesapal's developer docs under API 3.0. Production keys come from your Pesapal merchant dashboard.

## API

### `new Pesakit(config)`

| Option | Default | Notes |
| --- | --- | --- |
| `consumerKey` | required | |
| `consumerSecret` | required | |
| `environment` | `'sandbox'` | `'sandbox'` or `'production'` |
| `ipnUrl` | | Default IPN URL. Looked up in your IPN list, registered if missing, on the first payment without `notificationId`. |
| `ipnNotificationType` | `'GET'` | `'GET'` or `'POST'`. How Pesapal calls your IPN URL. |
| `timeout` | `30000` | Per request, ms |
| `retries` | `3` | Retries on network errors and 5xx, exponential backoff |
| `enableLogging` | `true` | JSON logs to the console |
| `logLevel` | `'info'` | `trace` `debug` `info` `warn` `error` |

### `createPayment(data)` → `{ orderTrackingId, merchantReference, redirectUrl, raw }`

Calls `SubmitOrderRequest`.

| Field | Required | Notes |
| --- | --- | --- |
| `amount` | yes | |
| `currency` | | ISO 4217. Default `KES`. |
| `description` | yes | Max 100 chars |
| `reference` | yes | Your order id. Unique per merchant. Max 50 chars, letters, digits, `- _ . :` |
| `callbackUrl` | yes | Where Pesapal sends the customer after checkout |
| `email` or `phoneNumber` | one of | |
| `notificationId` | | `ipnId` from `registerIpnUrl()`. Falls back to `ipnUrl` here, then in config. |
| `ipnUrl` | | Per-payment override of the config value |
| `cancellationUrl` | | Shown as a cancel link on the checkout page |
| `redirectMode` | | `'TOP_WINDOW'` or `'PARENT_WINDOW'` for iframe checkouts |
| `branch` | | Store or branch label in your dashboard |
| `firstName` `middleName` `lastName` | | |
| `billingAddress` | | `{ line1, line2, city, state, postalCode, zipCode, countryCode }` |
| `subscription` | | See recurring payments below |

Show `redirectUrl` to the customer: redirect to it, or load it in an iframe with `redirectMode: 'PARENT_WINDOW'`.

### Recurring payments

```js
await pesakit.createPayment({
  amount: 999,
  currency: 'KES',
  description: 'Monthly plan',
  reference: 'SUB-77',
  email: 'jane@example.com',
  callbackUrl: 'https://yourapp.com/pesapal/callback',
  subscription: {
    accountNumber: 'CUSTOMER-77',
    startDate: '01-11-2026',   // DD-MM-YYYY
    endDate: '01-11-2027',
    frequency: 'MONTHLY'       // DAILY | WEEKLY | MONTHLY | YEARLY
  }
});
```

Only Visa and Mastercard support recurring billing. The customer confirms the subscription on the checkout page. Each later charge arrives as an IPN with `orderNotificationType: 'RECURRING'`; call `verifyPayment()` and read `subscriptionTransactionInfo`.

### `verifyPayment(orderTrackingId)` → verification

Calls `GetTransactionStatus`. Call it from your IPN handler and your callback route. The redirect alone proves nothing.

```js
{
  status: 'COMPLETED',        // COMPLETED | FAILED | REVERSED | INVALID
  statusCode: 1,              // 0 INVALID, 1 COMPLETED, 2 FAILED, 3 REVERSED
  isCompleted: true,
  orderTrackingId: '...',
  merchantReference: 'ORDER-1042',
  method: 'MpesaKE',
  amount: 1500,
  currency: 'KES',
  paymentAccount: '2547XXXX',
  confirmationCode: 'QCD4...',  // needed for refunds
  createdDate: '2026-10-18T09:12:44.123',
  message: 'Request processed successfully',
  raw: { /* full Pesapal response */ }
}
```

A pending payment comes back as `INVALID` with `statusCode: 0`. That is how Pesapal reports "not paid yet".

### IPN

Pesapal calls your IPN URL whenever a transaction changes state, with `OrderTrackingId`, `OrderMerchantReference` and `OrderNotificationType` as query parameters (GET) or a JSON body (POST). There is no signature. Verification means calling `GetTransactionStatus`, which the handler does for you.

```js
// Express, Fastify (with express compat), Koa via koa-connect, Next.js pages API
app.all('/pesapal/ipn', pesakit.createIpnHandler({
  onNotification: async (verification, ipn) => {
    await orders.update(ipn.orderMerchantReference, { status: verification.status });
    // throw to answer 500 so Pesapal retries later
  },
  onError: async (error, ipn, req) => { /* optional logging */ }
}));
```

The handler replies with the JSON acknowledgement Pesapal expects:

```json
{ "orderNotificationType": "IPNCHANGE", "orderTrackingId": "...", "orderMerchantReference": "...", "status": 200 }
```

For frameworks without `req`/`res` (SvelteKit, Next.js app router, Hono, Remix) use the static parser and build the reply yourself:

```js
const ipn = Pesakit.parseIpn({ query: Object.fromEntries(url.searchParams), body });
const verification = await pesakit.verifyPayment(ipn.orderTrackingId);
return Response.json({ ...ipn, status: 200 });
```

Pesapal needs a public URL. Use a tunnel such as ngrok while developing. The sandbox sends IPNs too.

### `registerIpnUrl(url, type = 'GET')` → `{ ipnId, url, notificationType, status, createdDate, raw }`

Calls `RegisterIPN`. Pass `ipnId` as `notificationId` in `createPayment()`.

### `getIpnList()` → `IpnRecord[]`

Calls `GetIpnList`.

### `ensureIpnUrl(url, type = 'GET')` → `IpnRecord`

Returns the active registration for `url`, or registers it. `createPayment()` uses this when you give it an `ipnUrl`.

### `refundPayment({ confirmationCode, amount, username, remarks })` → `{ status, message, raw }`

Calls `RefundRequest`. `confirmationCode` is on the verification result. Rules from Pesapal: only `COMPLETED` payments, one refund per payment, cards can be partial, mobile money must be the full amount. A `200` means "received"; the merchant approves it in the dashboard before money moves. A rejection throws `PaymentError`.

### `cancelOrder(orderTrackingId)` → `{ status, message, raw }`

Calls `CancelOrder`. Only pending or failed orders can be cancelled, once. A rejection throws `PaymentError`.

### `getOAuthToken()`, `invalidateToken()`

Tokens are fetched with `RequestToken` and cached in memory for their lifetime (5 minutes). You rarely need these.

### Ops

`getHealthStatus()`, `getMetrics()`, `getRateLimitStatus(key)`, `destroy()`.

## Errors

Every error extends `PesakitError` and has `code`, `statusCode`, `details` and `timestamp`. Pesapal's own error object, when present, is in `details.pesapal`.

| Class | code | When |
| --- | --- | --- |
| `ValidationError` | `VALIDATION_ERROR` | Bad input. Nothing was sent. `details.fields` lists the problems. |
| `AuthenticationError` | `AUTHENTICATION_ERROR` | Wrong credentials, or Pesapal returned 401/403 |
| `PaymentError` | `PAYMENT_ERROR` | Pesapal rejected the request, or the order was not found |
| `NetworkError` | `NETWORK_ERROR` | Timeout, connection failure, or the circuit breaker is open |

```js
import Pesakit, { ValidationError, PaymentError } from 'pesakit';

try {
  await pesakit.createPayment(data);
} catch (error) {
  if (error instanceof ValidationError) console.log(error.details.fields);
  if (error instanceof PaymentError) console.log(error.details.pesapal?.code);
}
```

Common Pesapal error codes: `invalid_consumer_key_or_secret_provided`, `duplicate_reference` (reuse of `reference`), `invalid_notification_id`.

## Built in

- Token cache: one `RequestToken` call per 5 minutes per process.
- Retries with exponential backoff on network errors and 5xx.
- Circuit breaker per endpoint (opossum) so a Pesapal outage fails fast.
- Token-bucket rate limiter, 100 requests per minute per credential.
- Structured JSON logs with a correlation id per client. Set `enableLogging: false` to silence.
- Metrics counters and timers via `getMetrics()`.

## Examples

- [`examples/express-server.js`](examples/express-server.js): pay, callback, IPN, refund, cancel.
- [`examples/svelte`](examples/svelte): SvelteKit app with iframe checkout, callback `postMessage`, status polling and an IPN route.
- [`examples/react-example.jsx`](examples/react-example.jsx): browser side only. Never put your consumer secret in the browser.

## Testing

```bash
npm test                  # unit tests, mocked with nock
PESAPAL_CONSUMER_KEY=... PESAPAL_CONSUMER_SECRET=... npm run test:integration   # live sandbox
```

## Upgrading from 2.x

- `createPayment()` returns `{ orderTrackingId, merchantReference, redirectUrl }`, not a string.
- `createIpnHandler()` takes `onNotification(verification, ipn)` and `onError`. The old `onSuccess`, `onFailure` and `validateSignature` options are gone: Pesapal does not sign IPNs, so the old handler rejected every real notification.
- `verifyPayment()` returns `statusCode` and `confirmationCode`, and reports pending orders as `INVALID` the way Pesapal does.
- `registerIpnUrl()` returns an object; read `.ipnId`.
- `country_code` is no longer hard-coded to `KE`. Pass `billingAddress.countryCode` if you want it.
- CommonJS `require('pesakit')` works again via the bundled `dist/index.cjs`.

## License

MIT
