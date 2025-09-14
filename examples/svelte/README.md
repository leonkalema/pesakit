# PesaKit SvelteKit Integration Example

A complete working example of PesaPal integration using SvelteKit with iframe checkout, callback handling, and status polling.

## 🚀 Features

- **Server-side PesaPal Integration**: Secure credential handling with `pesakit@2.0.5`
- **Iframe Checkout Modal**: Seamless payment experience without leaving your app
- **PostMessage Communication**: Automatic callback detection and modal closure
- **Status Polling**: Real-time payment verification with terminal state detection
- **TypeScript + Zod**: Full type safety and input validation
- **Production Ready**: HTTPS, error handling, correlation IDs

## 📋 Prerequisites

- Node.js 18+
- PesaPal merchant account with consumer key/secret
- Public HTTPS URL for IPN callbacks (use ngrok for development)

## 🛠️ Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env`:
   ```bash
   PESAPAL_CONSUMER_KEY=your_consumer_key
   PESAPAL_CONSUMER_SECRET=your_consumer_secret
   PESAPAL_ENVIRONMENT=production  # or sandbox
   PESAPAL_IPN_URL=https://yourdomain.com/api/payments/ipn
   ```

3. **Run the app:**
   ```bash
   npm run dev
   ```

Open `http://localhost:5175` and test the payment flow.

## 🧭 SvelteKit Integration Guide

This section documents exactly how to wire PesaPal in SvelteKit using `pesakit` on the server and a simple iframe flow on the client.

### 1) Install dependencies

```bash
npm install pesakit@^2.0.5 zod dotenv
```

Notes:
- `pesakit@2.0.5` allows passing `notificationId` or `ipnUrl` without stripping them.
- Use `pesakit` on the server only. Never expose your PesaPal keys to the client.

### 2) Environment variables

Create `.env` (server-side only):

```bash
PESAPAL_CONSUMER_KEY=your_key
PESAPAL_CONSUMER_SECRET=your_secret
PESAPAL_ENVIRONMENT=production # or sandbox
PESAPAL_IPN_URL=https://yourdomain.com/api/payments/ipn
```

Ensure `PESAPAL_IPN_URL` is publicly reachable in production. In development, you can register a temporary public URL with a tunnel (e.g., `ngrok`).

### 3) Server endpoints

Implement 3 SvelteKit server routes:

- `src/routes/api/payments/create/+server.ts`
  - Validates input
  - Authenticates to Pesapal, discovers/registers IPN once, and sends `SubmitOrderRequest`
  - Returns `{ success, orderTrackingId, redirectUrl }`

- `src/routes/api/payments/callback/+server.ts`
  - Receives Pesapal redirect with `OrderTrackingId` and `OrderMerchantReference`
  - Renders a small HTML page that `postMessage`s `{ type: 'pesapal:callback', orderTrackingId }` to the parent window

- `src/routes/api/payments/status/+server.ts`
  - Accepts `orderTrackingId` query param
  - Calls `Transactions/GetTransactionStatus`
  - Returns `{ success, paymentStatusDescription, statusCode, confirmationCode, merchantReference }`

This example already includes all three endpoints.

### 4) Frontend usage

- Submit a payment request to `/api/payments/create`
- On success, open `result.redirectUrl` in an iframe modal
- Listen for `message` events with `type === 'pesapal:callback'`
- Close the iframe and call `/api/payments/status?orderTrackingId=...` until a terminal status (COMPLETED/FAILED/REVERSED)

See `src/routes/+page.svelte` for a complete working example (under 400 lines).

### 5) IPN in production

Pesapal will call your IPN URL on status change. For production-grade apps:

- Implement `src/routes/api/payments/ipn/+server.ts` to accept the IPN call
- Verify status via `GetTransactionStatus`
- Persist the transaction and status to your database
- Respond with a JSON payload including `status: 200` when processed

The demo auto-discovers or registers the IPN URL server-side and caches the `notification_id` in memory so you don’t need to store it in `.env`.

### 6) Security checklist

- Never expose `PESAPAL_CONSUMER_KEY` or `PESAPAL_CONSUMER_SECRET` to the browser
- Use HTTPS in production for callback and IPN
- Validate all inputs on the server
- Log correlation IDs and handle retries/timeouts (configured in `pesakit`)

### 7) Production readiness

This example is production-ready when deployed to a server environment (Vercel/Netlify/Node). The browser code never touches PesaPal directly; it talks to your server routes only.

---

## 🏗️ Project Structure

```
src/
├── lib/
│   └── types.ts            # TypeScript definitions and sample products
├── routes/
│   ├── api/payments/       # Server-side payment endpoints
│   │   ├── create/+server.ts    # Creates payment via pesakit
│   │   ├── callback/+server.ts  # Handles PesaPal redirect
│   │   └── status/+server.ts    # Checks payment status
│   └── +page.svelte        # Main page with payment form and iframe modal
└── app.css                 # Tailwind CSS styles
```

## 🎯 How It Works

### 1. Payment Creation Flow

The main page (`+page.svelte`) contains:
- Product selection (Basic/Premium/Enterprise plans)
- Customer info form (name, email, phone)
- Payment button that calls `/api/payments/create`

```typescript
// Frontend: Submit payment data
const response = await fetch('/api/payments/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    amount: selectedProduct.amount,
    currency: 'KES',
    description: selectedProduct.description,
    reference: `ORDER-${Date.now()}`,
    email: customerInfo.email,
    firstName: customerInfo.firstName,
    lastName: customerInfo.lastName,
    phoneNumber: customerInfo.phone,
    callbackUrl: `${window.location.origin}/api/payments/callback`
  })
});

// Server response includes redirectUrl for PesaPal checkout
if (result.success) {
  // Open iframe modal with PesaPal checkout
  iframeUrl = result.redirectUrl;
  showIframe = true;
}
```

### 2. Server Endpoints

**`/api/payments/create/+server.ts`**
- Validates input with Zod
- Uses `pesakit` to authenticate and create payment
- Auto-discovers/registers IPN URL if needed
- Returns `{ success, orderTrackingId, redirectUrl }`

**`/api/payments/callback/+server.ts`**
- Receives PesaPal redirect with `OrderTrackingId`
- Renders HTML page that posts message to parent window
- Enables automatic iframe closure

**`/api/payments/status/+server.ts`**
- Accepts `orderTrackingId` query parameter
- Calls PesaPal `GetTransactionStatus` endpoint
- Returns payment status and details

### 3. Iframe Modal & Status Polling

```typescript
// Listen for callback message from iframe
function onMessage(e: MessageEvent) {
  const msg = e?.data as any;
  if (msg?.type === 'pesapal:callback' && msg.orderTrackingId) {
    showIframe = false;  // Close iframe
    pollStatus(msg.orderTrackingId);  // Start polling
  }
}

// Poll status until terminal state
async function pollStatus(orderTrackingId: string) {
  for (let i = 0; i < 10; i++) {
    const res = await fetch(`/api/payments/status?orderTrackingId=${orderTrackingId}`);
    const data = await res.json();
    
    if (data.paymentStatusDescription === 'COMPLETED') {
      paymentStatus = `Payment COMPLETED. Ref: ${data.merchantReference}`;
      return;
    }
    await new Promise(r => setTimeout(r, 1500));  // Wait 1.5s
  }
}
```

## 🔧 Configuration

### Environment Variables

```bash
# Required for production
PESAPAL_CONSUMER_KEY=your_production_key
PESAPAL_CONSUMER_SECRET=your_production_secret
PESAPAL_ENVIRONMENT=production

# Optional - for debugging
LOG_LEVEL=debug
```

## 🚀 Production Deployment

### Build for Production

```bash
npm run build
```

### Environment Setup

1. **Set production environment variables** in your hosting platform
2. **Configure HTTPS** for callback and IPN URLs
3. **Set up public IPN URL** (required for PesaPal webhooks)

### Deployment Options

- **Vercel**: Connect GitHub repo, set environment variables
- **Netlify**: Connect GitHub repo, configure build settings
- **Traditional VPS**: Upload build files, configure reverse proxy

## 🔒 Security Notes

- **Never expose credentials**: `PESAPAL_CONSUMER_KEY/SECRET` stay server-side only
- **HTTPS required**: Production callback/IPN URLs must use HTTPS
- **Input validation**: All user inputs validated with Zod schemas
- **Correlation IDs**: Every request tracked for debugging

## 🐛 Troubleshooting

### Common Issues

1. **IPN Registration 409 Error**
   - Fixed in `pesakit@2.0.5` - update if using older version
   - Ensure `PESAPAL_IPN_URL` is publicly accessible

2. **Environment Variables Not Found**
   - Server routes need `PESAPAL_*` (no `VITE_` prefix)
   - Client code cannot access server environment variables

3. **Iframe Not Opening**
   - Check browser console for errors
   - Verify `/api/payments/create` returns `redirectUrl`

### Debug Mode
Set `LOG_LEVEL=debug` to see detailed pesakit logs.

## 📚 Key Files

- **`src/routes/+page.svelte`** - Main UI with payment form and iframe modal
- **`src/routes/api/payments/create/+server.ts`** - Payment creation endpoint
- **`src/routes/api/payments/callback/+server.ts`** - PesaPal redirect handler
- **`src/routes/api/payments/status/+server.ts`** - Status checking endpoint
- **`src/lib/types.ts`** - TypeScript definitions and sample products

## 🤝 Contributing

This example demonstrates the complete PesaPal integration pattern. To extend:

1. Add IPN webhook endpoint for real-time status updates
2. Add database persistence for transaction history
3. Add receipt/invoice generation
4. Add email notifications

## 📄 License

MIT License - part of the PesaKit project.

## 🆘 Support

- **PesaKit Documentation**: [GitHub](https://github.com/leonkalema/pesakit)
- **PesaPal API Docs**: [Developer Portal](https://developer.pesapal.com)
- **Issues**: Report bugs or request features on GitHub

---

**Built with SvelteKit, TypeScript, and Tailwind CSS**
