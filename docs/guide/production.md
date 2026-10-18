# Go live

1. Set `environment: 'production'` and your live keys.
2. Register a production IPN URL over HTTPS.
3. Make `onNotification` idempotent anyway. The dedupe store covers retries, but a redeploy with the memory store starts empty.
4. Use a shared dedupe store (Redis, your database) when you run more than one instance.
5. Log `error.details.pesapal` on failures. It has Pesapal's own code and message.
6. Keep `verifyPayment()` in the callback route. Customers refresh and share that URL.
7. Set `timeoutMs` and `retry` to match your platform limits. Serverless functions with a 10 second cap want `timeoutMs: 8000, retry: { retries: 1 }`.

## Options

| Option | Default | Notes |
| --- | --- | --- |
| `timeoutMs` | 30000 | Per request |
| `retry` | `{ retries: 3, baseDelayMs: 300, maxDelayMs: 5000 }` | Network errors and 5xx. `false` disables |
| `circuitBreaker` | `{ failureThreshold: 5, resetTimeoutMs: 30000 }` | `false` disables |
| `rateLimit` | `{ limit: 100, windowMs: 60000 }` | Client side. `false` disables |
| `logger` | console JSON | Pass your own `{ debug, info, warn, error }` or `false` |
| `logLevel` | `warn` | |
| `fetch` | `globalThis.fetch` | For proxies, custom agents or tests |

`pesakit.status()` returns breaker state, rate limit usage and whether a token is cached. Expose it on a health endpoint.
