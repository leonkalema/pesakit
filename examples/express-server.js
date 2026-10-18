/**
 * Express example.
 *   PESAPAL_CONSUMER_KEY=... PESAPAL_CONSUMER_SECRET=... \
 *   PESAPAL_IPN_URL=https://your-public-host/pesapal/ipn PUBLIC_URL=https://your-public-host \
 *   node examples/express-server.js
 */
import express from 'express';
import Pesakit from 'pesakit';
import { ipnHandler } from 'pesakit/express';

const app = express();
app.use(express.json());

const pesakit = new Pesakit({
  consumerKey: process.env.PESAPAL_CONSUMER_KEY,
  consumerSecret: process.env.PESAPAL_CONSUMER_SECRET,
  environment: process.env.PESAPAL_ENVIRONMENT || 'sandbox',
  ipnUrl: process.env.PESAPAL_IPN_URL,
});

// 1. Create a payment and send the customer to redirectUrl.
app.post('/pay', async (req, res) => {
  try {
    const order = await pesakit.createPayment({
      amount: req.body.amount,
      currency: 'KES',
      description: req.body.description,
      reference: `ORDER-${Date.now()}`,
      email: req.body.email,
      phoneNumber: req.body.phoneNumber,
      callbackUrl: `${process.env.PUBLIC_URL}/pesapal/callback`,
    });
    res.json(order);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message, code: error.code, pesapal: error.details?.pesapal });
  }
});

// 2. Customer lands here after checkout. Verify, never trust the redirect alone.
app.get('/pesapal/callback', async (req, res) => {
  const v = await pesakit.verifyPayment(req.query.OrderTrackingId);
  res.send(`Payment ${v.status} for ${v.merchantReference}`);
});

// 3. Pesapal calls this server-to-server. Mount with app.all for GET and POST IPNs.
app.all('/pesapal/ipn', ipnHandler(pesakit, {
  onNotification: async (verification, ipn) => {
    // Runs once per (order, status). Throw to make Pesapal retry.
    console.log('IPN', ipn.orderMerchantReference, verification.status, verification.confirmationCode);
  },
}));

// 4. Admin actions.
app.post('/pesapal/refund', async (req, res) => res.json(await pesakit.refundPayment(req.body)));
app.post('/pesapal/cancel/:id', async (req, res) => res.json(await pesakit.cancelOrder(req.params.id)));

app.get('/health', (_req, res) => res.json(pesakit.status()));
app.listen(process.env.PORT || 3000, () => console.log('Listening'));
