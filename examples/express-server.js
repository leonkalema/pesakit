/**
 * Express example: create a payment, verify it, receive IPNs.
 *
 *   PESAPAL_CONSUMER_KEY=... PESAPAL_CONSUMER_SECRET=... \
 *   PESAPAL_IPN_URL=https://your-public-host/pesapal/ipn node examples/express-server.js
 */
import express from 'express';
import Pesakit from '../index.js';

const app = express();
app.use(express.json());

const pesakit = new Pesakit({
  consumerKey: process.env.PESAPAL_CONSUMER_KEY,
  consumerSecret: process.env.PESAPAL_CONSUMER_SECRET,
  environment: process.env.PESAPAL_ENVIRONMENT || 'sandbox',
  ipnUrl: process.env.PESAPAL_IPN_URL
});

// 1. Create a payment and send the customer to Pesapal.
app.post('/pay', async (req, res) => {
  try {
    const { amount, email, phoneNumber, description } = req.body;
    const order = await pesakit.createPayment({
      amount,
      email,
      phoneNumber,
      description,
      reference: `ORDER-${Date.now()}`,
      currency: 'KES',
      callbackUrl: `${process.env.PUBLIC_URL}/pesapal/callback`
    });
    res.json(order); // { orderTrackingId, merchantReference, redirectUrl }
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message, details: error.details });
  }
});

// 2. Pesapal redirects the customer here after checkout. Never trust it alone.
app.get('/pesapal/callback', async (req, res) => {
  const verification = await pesakit.verifyPayment(req.query.OrderTrackingId);
  res.send(`Payment ${verification.status} (${verification.merchantReference})`);
});

// 3. Pesapal calls this server-to-server. Register it as PESAPAL_IPN_URL.
app.all('/pesapal/ipn', pesakit.createIpnHandler({
  onNotification: async (verification, ipn) => {
    // Update your order. Throw to make Pesapal retry later.
    console.log('IPN', ipn.orderMerchantReference, verification.status, verification.confirmationCode);
  }
}));

// 4. Refund or cancel from your admin tools.
app.post('/pesapal/refund', async (req, res) => {
  const result = await pesakit.refundPayment({
    confirmationCode: req.body.confirmationCode,
    amount: req.body.amount,
    username: req.body.username,
    remarks: req.body.remarks
  });
  res.json(result);
});

app.post('/pesapal/cancel/:orderTrackingId', async (req, res) => {
  res.json(await pesakit.cancelOrder(req.params.orderTrackingId));
});

app.get('/health', async (_req, res) => res.json(await pesakit.getHealthStatus()));

app.listen(process.env.PORT || 3000, () => console.log('Listening'));
