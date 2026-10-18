# Checkout in the browser

Two ways to show the Pesapal page.

## Redirect

Send the customer to `order.redirectUrl`. Pesapal brings them back to `callbackUrl`. Simplest, works everywhere.

## Iframe

Create the order with `redirectMode: 'PARENT_WINDOW'`, then use `pesakit/checkout` in the browser. It has no secrets and talks only to your own server.

```ts
import { mountCheckout, pollStatus } from 'pesakit/checkout';

const order = await fetch('/pay', { method: 'POST', body }).then((r) => r.json());

const checkout = mountCheckout({
  container: '#checkout',
  redirectUrl: order.redirectUrl,
  onCallback: async () => {
    checkout.destroy();
    const status = await pollStatus(() =>
      fetch(`/status/${order.orderTrackingId}`).then((r) => r.json()).then((j) => j.status),
    );
    // status: COMPLETED | FAILED | REVERSED
  },
});
```

On your callback page:

```ts
import { postCallbackMessage } from 'pesakit/checkout';
postCallbackMessage(); // tells the parent window checkout finished
```

Your `/status/:id` endpoint calls `verifyPayment()` and returns `{ status }`.

`pollStatus` checks every 2 seconds for up to 2 minutes by default and stops on the first non-`INVALID` status.
