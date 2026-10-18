# Pesakit client

```ts
import Pesakit from 'pesakit';
const pesakit = new Pesakit(config);
```

See [Go live](../guide/production#options) for config options.

## Methods

### `getToken(): Promise<string>`
Bearer token from `RequestToken`. Cached in memory for its lifetime (5 minutes). Concurrent callers share one request.

### `invalidateToken(): void`

### `registerIpnUrl(url, type?): Promise<IpnRecord>`
`RegisterIPN`. `type` is `'GET'` or `'POST'`, default from config.

### `getIpnList(): Promise<IpnRecord[]>`
`GetIpnList`.

### `ensureIpnUrl(url, type?): Promise<IpnRecord>`
Returns the active record for `url` or registers it. Cached per client.

### `createPayment(request): Promise<PaymentResult>`
`SubmitOrderRequest`. See [Payments](../guide/payments).

### `verifyPayment(orderTrackingId): Promise<PaymentVerification>`
`GetTransactionStatus`. See [IPN and verification](../guide/ipn).

### `refundPayment(request): Promise<ActionResult>`
`RefundRequest`. See [Refunds](../guide/refunds).

### `cancelOrder(orderTrackingId): Promise<ActionResult>`
`CancelOrder`.

### `handleIpn(input, options?): Promise<IpnOutcome>`
Framework neutral IPN processing. `input` is `{ query?, body? }`. Returns `{ status, body, ipn, verification, duplicate, error? }`. The adapters are thin wrappers around this.

### `static parseIpn(input): IpnNotification`
Parse without verifying.

### `status()`
Circuit breaker state, rate limit usage, token cache state.

### `resetCircuitBreaker()`

## Named exports

```ts
import {
  Pesakit, PaymentStatus, STATUS_CODES, BASE_URLS, VERSION,
  parseIpn, MemoryIpnStore, ipnDedupeKey,
  PesakitError, ValidationError, AuthenticationError, PaymentError,
  NetworkError, RateLimitError, CircuitOpenError,
} from 'pesakit';
```

## Subpaths

| Import | What |
| --- | --- |
| `pesakit/express` | `ipnHandler` |
| `pesakit/fastify` | `ipnHandler`, `pesapalIpn` plugin |
| `pesakit/hono` | `ipnHandler` |
| `pesakit/fetch` | `ipnHandler` for Request/Response |
| `pesakit/next` | `ipnRouteHandler`, `ipnApiHandler` |
| `pesakit/sveltekit` | `ipnHandler` |
| `pesakit/testing` | `createMockPesapal`, `MockPesapal`, `fixtures` |
| `pesakit/checkout` | `mountCheckout`, `postCallbackMessage`, `pollStatus` (browser) |
