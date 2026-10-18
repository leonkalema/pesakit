# Testing

`pesakit/testing` is a fake Pesapal API 3.0 with the same endpoints, response shapes and error codes. No credentials, no network.

```ts
import Pesakit from 'pesakit';
import { createMockPesapal } from 'pesakit/testing';

const mock = createMockPesapal();
const pesakit = new Pesakit({ ...mock.clientConfig, ipnUrl: 'https://test/ipn' });

const order = await pesakit.createPayment({ /* ... */ });
mock.settle(order.orderTrackingId, 'COMPLETED');

const v = await pesakit.verifyPayment(order.orderTrackingId);
expect(v.isCompleted).toBe(true);
```

## What it checks

- Credentials, bearer tokens and expiry.
- Duplicate references, unregistered `notification_id`, missing contact.
- Refund rules: only completed, once, not above the amount.
- Cancel rules: not completed, once.

## IPN tests

```ts
const out = await pesakit.handleIpn({ query: mock.ipnFor(order.orderTrackingId) }, { onNotification });
expect(out.status).toBe(200);
```

## Faults

```ts
mock.failNextWith(503);          // next request gets HTTP 503
mock.failNextWith(200, { ... });  // custom body
```

## Real HTTP server

For end-to-end tests of an app that reads `PESAPAL_*` from env:

```ts
const server = await mock.listen();
process.env.PESAPAL_BASE_URL = server.url;   // pass as baseUrl to Pesakit
await server.close();
```

## Inspect calls

`mock.calls` records every request: method, path, query, body, headers.

## Fixtures

`fixtures` exports sample Pesapal responses (`token`, `submitOrder`, `statusCompleted`, `statusPending`, `statusFailed`, `authFailed`, `refund`, `cancel`, `ipnQuery`) for stubbing by hand.

## Live sandbox

```bash
PESAPAL_CONSUMER_KEY=... PESAPAL_CONSUMER_SECRET=... npm run test:integration
```
