# Errors

Every error extends `PesakitError` with `code`, `statusCode`, `details`, `timestamp` and `pesapalCode`.

| Class | `code` | When |
| --- | --- | --- |
| `ValidationError` | `VALIDATION_ERROR` | Bad input. Nothing was sent. `details.fields` lists each problem |
| `AuthenticationError` | `AUTHENTICATION_ERROR` | Wrong keys, expired token, HTTP 401/403 |
| `PaymentError` | `PAYMENT_ERROR` | Pesapal rejected the request or the order was not found |
| `NetworkError` | `NETWORK_ERROR` | Timeout or connection failure after retries |
| `RateLimitError` | `RATE_LIMIT_ERROR` | Client side limit hit |
| `CircuitOpenError` | `CIRCUIT_OPEN` | Too many recent failures; requests fail fast |

```ts
import { PaymentError, ValidationError } from 'pesakit';

try {
  await pesakit.createPayment(data);
} catch (e) {
  if (e instanceof ValidationError) console.log(e.details.fields);
  if (e instanceof PaymentError) console.log(e.pesapalCode, e.details.pesapal?.message);
}
```

Pesapal often answers HTTP 200 with an `error` object or `status: "500"`. pesakit turns those into `PaymentError` or `AuthenticationError` so you never read a null `order_tracking_id` by accident.
