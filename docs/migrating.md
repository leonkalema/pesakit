# Migrating

## From pesakit 3.x

- `new Pesakit({ timeout, retries, enableLogging, logLevel })` became `{ timeoutMs, retry: { retries }, logger: false, logLevel }`.
- `createIpnHandler(options)` moved to `import { ipnHandler } from 'pesakit/express'` and takes `(client, options)`.
- `onNotification` now runs once per order and status by default (dedupe store). Pass `store: false` for the old behaviour.
- `getOAuthToken()` is `getToken()`.
- `getHealthStatus()`, `getMetrics()`, `getRateLimitStatus()` and `destroy()` are gone. Use `status()`. There is nothing to destroy.
- `environment: 'test'` is gone. Use `pesakit/testing`.
- Errors gained `pesapalCode`. `details.originalError` is now `details.cause`.
- CommonJS: `require('pesakit')` still returns the class.

## From pesakit 2.x

See 3.x notes in [CHANGELOG](https://github.com/leonkalema/pesakit/blob/main/CHANGELOG.md), then the list above. The 2.x IPN handler required a signature header Pesapal never sends, so if you are on 2.x your IPNs were never processed. Expect behaviour to change for the better.

## From a hand-rolled axios integration

```ts
// before
const { data } = await axios.post(`${base}/api/Auth/RequestToken`, { consumer_key, consumer_secret });
const token = data.token;
// ...

// after
const pesakit = new Pesakit({ consumerKey, consumerSecret, ipnUrl });
const order = await pesakit.createPayment({ ... });
```

Field names map one to one: `id` → `reference`, `callback_url` → `callbackUrl`, `notification_id` → `notificationId`, `billing_address.email_address` → `email`, `billing_address.phone_number` → `phoneNumber`. The `raw` property on every result still has Pesapal's original response if you need it.

## From other Pesapal npm packages

Most expose `submitOrder(payload)` with Pesapal's snake_case fields. Pass the same values to `createPayment()` with the camelCase names above. IPN handling: replace your route with the adapter for your framework and move your business logic into `onNotification`.
