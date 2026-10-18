# Getting started

## Install

```bash
npm install pesakit
```

Node 18 or newer, Bun, Deno, Cloudflare Workers and Vercel Edge all work. The core has no dependencies and uses `fetch`.

## Credentials

Create a merchant account at Pesapal. Sandbox keys per country are listed in the Pesapal developer docs under API 3.0. Production keys come from your merchant dashboard.

Never put the consumer secret in browser code.

## First payment

```ts
import Pesakit from 'pesakit';

const pesakit = new Pesakit({
  consumerKey: process.env.PESAPAL_CONSUMER_KEY!,
  consumerSecret: process.env.PESAPAL_CONSUMER_SECRET!,
  environment: 'sandbox',
  ipnUrl: 'https://yourapp.com/pesapal/ipn',
});

const order = await pesakit.createPayment({
  amount: 1500,
  currency: 'KES',
  description: 'Order 1042',
  reference: 'ORDER-1042',
  email: 'jane@example.com',
  callbackUrl: 'https://yourapp.com/pesapal/callback',
});

// Send the customer here
order.redirectUrl;
```

## The flow

1. Your server calls `createPayment()` and gets `redirectUrl` and `orderTrackingId`.
2. The customer pays on Pesapal's page. Redirect them to it, or load it in an iframe.
3. Pesapal sends the customer to your `callbackUrl` with `OrderTrackingId` in the query.
4. Pesapal calls your `ipnUrl` server-to-server. This is the reliable signal.
5. In both handlers you call `verifyPayment(orderTrackingId)` and act on `status`.

The IPN URL must be public. Use a tunnel such as ngrok during development. The sandbox sends IPNs too.

## CommonJS

```js
const Pesakit = require('pesakit');
const { ipnHandler } = require('pesakit/express');
```
