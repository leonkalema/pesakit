# Changelog

## 3.0.0

### Added
- `getIpnList()`, `ensureIpnUrl()`, `refundPayment()`, `cancelOrder()`.
- Subscription orders via `subscription: { accountNumber, startDate, endDate, frequency }`.
- `cancellationUrl`, `redirectMode`, `branch`, `middleName` and full billing address on orders.
- `ipnUrl` and `ipnNotificationType` client config. The URL is registered once and reused.
- `Pesakit.parseIpn(req)` for frameworks without Express style `req`/`res`.
- Named exports for the client, `STATUS_CODES` and all error classes.
- CommonJS build at `dist/index.cjs`. `require('pesakit')` works.
- CI on Node 18, 20 and 22.

### Changed
- IPN handler now follows Pesapal's contract: parse `OrderTrackingId`, call `GetTransactionStatus`, reply with the JSON acknowledgement. Options are `onNotification` and `onError`.
- `createPayment()` returns `{ orderTrackingId, merchantReference, redirectUrl, raw }`.
- `verifyPayment()` maps `status_code` and exposes `confirmationCode`, `paymentAccount`, `createdDate` and `raw`.
- `registerIpnUrl()` returns the full record.
- Pesapal error bodies on HTTP 200 are raised as typed errors with `details.pesapal`.
- Retries now apply (they were configured on an unused axios instance).
- Token cache TTL follows Pesapal's 5 minute expiry.
- Validation accepts any ISO 4217 currency and either email or phone.

### Removed
- Hard-coded `country_code: 'KE'`.
- HMAC signature check on IPNs (Pesapal sends none).
- Unused dependencies: pino, pino-pretty, crypto-js.

## 2.0.5

Last 2.x release.
