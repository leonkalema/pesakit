# Express

```ts
import express from 'express';
import Pesakit from 'pesakit';
import { ipnHandler } from 'pesakit/express';

const app = express();
app.use(express.json());

const pesakit = new Pesakit({ consumerKey, consumerSecret, environment: 'sandbox', ipnUrl: 'https://yourapp.com/pesapal/ipn' });

app.post('/pay', async (req, res) => {
  const order = await pesakit.createPayment({ ...req.body, callbackUrl: 'https://yourapp.com/pesapal/callback' });
  res.json(order);
});

app.get('/pesapal/callback', async (req, res) => {
  const v = await pesakit.verifyPayment(String(req.query.OrderTrackingId));
  res.send(`Payment ${v.status}`);
});

app.all('/pesapal/ipn', ipnHandler(pesakit, {
  onNotification: async (verification, ipn) => { /* update your order */ },
}));
```

Use `app.all` so both GET and POST IPN types work. `express.json()` must run before the handler for POST IPNs. On a 500 the handler also calls `next(error)` so your error middleware sees it.

Works with Connect and Koa through `koa-connect`.
