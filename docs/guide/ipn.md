# IPN and verification

Pesapal calls your IPN URL whenever a transaction changes state. It sends three values as query parameters (GET) or a JSON body (POST):

```
OrderTrackingId=b945e4af-...&OrderMerchantReference=ORDER-1042&OrderNotificationType=IPNCHANGE
```

There is no signature. The IPN carries no payment details. Verification means calling `GetTransactionStatus`, and pesakit does that for you.

## Handler

```ts
import { ipnHandler } from 'pesakit/express';

app.all('/pesapal/ipn', ipnHandler(pesakit, {
  onNotification: async (verification, ipn) => {
    await orders.update(ipn.orderMerchantReference, { status: verification.status });
  },
}));
```

Every adapter does the same five things:

1. Parse the notification.
2. Call `verifyPayment(orderTrackingId)`.
3. Check the dedupe store. Pesapal retries IPNs, so your callback runs once per order and status.
4. Run `onNotification(verification, ipn)`. If it throws, reply 500 so Pesapal retries later.
5. Reply with the JSON Pesapal expects: `{ orderNotificationType, orderTrackingId, orderMerchantReference, status: 200 }`.

See [Frameworks](../frameworks/express) for each adapter, or use `pesakit.handleIpn({ query, body }, options)` directly. It returns `{ status, body }` for you to send.

## Dedupe store

The default store is in memory, bounded to 10 000 keys. Fine for one process. For several instances, pass your own:

```ts
const store = {
  has: (key) => redis.exists(key).then(Boolean),
  add: (key) => redis.set(key, '1', 'EX', 60 * 60 * 24 * 7),
};
ipnHandler(pesakit, { store, onNotification });
```

Keys look like `${orderTrackingId}:${notificationType}:${status}`. Pass `store: false` to disable.

## Verification result

```ts
const v = await pesakit.verifyPayment(orderTrackingId);
v.status          // 'COMPLETED' | 'FAILED' | 'REVERSED' | 'INVALID'
v.statusCode      // 1 | 2 | 3 | 0
v.isCompleted
v.confirmationCode  // needed for refunds
v.method            // 'MpesaKE', 'Visa', ...
v.paymentAccount    // masked phone or card
v.amount, v.currency, v.merchantReference, v.createdDate
v.raw
```

A payment that has not been made yet comes back as `INVALID` with `statusCode: 0`. That is how Pesapal reports pending.

## Callback page

Pesapal also sends the customer's browser to `callbackUrl?OrderTrackingId=...&OrderMerchantReference=...`. Treat it as a UI event only: call `verifyPayment()` there too, show the result, and let the IPN be the source of truth for fulfilment. A customer can close the tab before the redirect; the IPN still arrives.
