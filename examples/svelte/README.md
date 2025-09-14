# PesaKit Svelte Example

A production-ready Svelte application demonstrating seamless PesaPal integration with modern web technologies.

## 🚀 Features

- **Modular Components**: Each component is under 400 lines, following senior-level development practices
- **TypeScript First**: Comprehensive type safety with Zod validation
- **Tailwind CSS**: Beautiful, responsive design with custom animations
- **Production Ready**: Error handling, loading states, and user feedback
- **Real-time Updates**: Payment status polling and verification
- **Accessible**: WCAG compliant forms and interactions

## 📋 Prerequisites

- Node.js 18+ (LTS recommended)
- npm, pnpm, or yarn
- PesaPal merchant account (for production use)

## 🛠️ Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up your PesaPal credentials:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your actual PesaPal credentials:
   ```bash
   PESAPAL_CONSUMER_KEY=your_actual_consumer_key
   PESAPAL_CONSUMER_SECRET=your_actual_consumer_secret
   PESAPAL_ENVIRONMENT=sandbox
   ```

3. **Run the app:**
   ```bash
   npm run dev
   ```

That's it! Open `http://localhost:5173` and start creating payments.

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
│   ├── components/           # Reusable UI components
│   │   ├── LoadingSpinner.svelte
│   │   ├── Notification.svelte
│   │   ├── PaymentCard.svelte
│   │   ├── PaymentForm.svelte
│   │   └── PaymentStatus.svelte
│   ├── services/            # Business logic services
│   │   └── payment-service.ts
│   └── types.ts            # TypeScript definitions
├── routes/
│   ├── api/                # API endpoints
│   │   ├── payments/
│   │   └── health/
│   ├── payment/            # Payment flow pages
│   ├── status/             # Status checking
│   └── +page.svelte        # Home page
└── app.css                 # Global styles
```

## 🎯 Usage Examples

### Basic Payment Creation

```typescript
import { paymentService } from '$lib/services/payment-service.js';

const paymentData = {
  amount: 1000,
  description: 'Premium subscription',
  reference: 'ORDER-12345',
  email: 'customer@example.com',
  firstName: 'John',
  lastName: 'Doe',
  phoneNumber: '+254712345678',
  currency: 'KES',
  callbackUrl: 'https://yourapp.com/payment/callback'
};

const response = await paymentService.createPayment(paymentData);
if (response.success) {
  window.location.href = response.paymentUrl;
}
```

### Payment Status Verification

```typescript
const verification = await paymentService.verifyPayment('ORDER-12345');
console.log('Payment Status:', verification.verification?.status);
```

### Real-time Status Polling

```typescript
const result = await paymentService.pollPaymentStatus('ORDER-12345', 30, 2000);
// Polls every 2 seconds for up to 30 attempts
```

## 🧩 Component Architecture

### PaymentForm Component
- Comprehensive form validation with Zod
- Real-time error feedback
- Responsive design with Tailwind CSS
- Accessibility features (ARIA labels, keyboard navigation)

### PaymentStatus Component
- Real-time status updates
- Visual status indicators
- Action buttons based on payment state
- Print receipt functionality

### Notification System
- Toast-style notifications
- Multiple types (success, error, warning, info)
- Auto-dismiss with manual override
- Smooth animations

## 🔧 Configuration

### Environment Variables

```bash
# Required for production
PESAPAL_CONSUMER_KEY=your_production_key
PESAPAL_CONSUMER_SECRET=your_production_secret
PESAPAL_ENVIRONMENT=production

# Optional
LOG_LEVEL=info
PAYMENT_TIMEOUT=30000
```

### Tailwind Configuration

The project includes a comprehensive Tailwind setup with:
- Custom color palette for payments
- Animation utilities
- Form plugin for better form styling
- Responsive design utilities

## 🚀 Production Deployment

### Build for Production

```bash
npm run build
```

### Environment Setup

1. **Set production environment variables**
2. **Configure your web server** to serve the built files
3. **Set up SSL/TLS** for secure payment processing
4. **Configure CORS** for your domain

### Deployment Options

- **Vercel**: `npm i -g vercel && vercel`
- **Netlify**: Connect your Git repository
- **Docker**: Use the included Dockerfile
- **Traditional hosting**: Upload the `build` directory

## 🧪 Testing

### Demo Mode
The application includes demo functionality with mock responses:
- Sample payment creation
- Mock verification responses  
- Simulated payment statuses

### Test Order IDs
- `DEMO-COMPLETED-12345` - Completed payment
- `DEMO-PENDING-67890` - Pending payment
- `DEMO-FAILED-11111` - Failed payment

## 🔒 Security Features

- **Input Validation**: Zod schema validation on all forms
- **Type Safety**: Comprehensive TypeScript coverage
- **Error Handling**: Graceful error states with user feedback
- **Secure Communication**: HTTPS enforcement in production
- **Data Sanitization**: Automatic sanitization of user inputs

## 📱 Responsive Design

The application is fully responsive with:
- Mobile-first design approach
- Touch-friendly interactions
- Optimized layouts for all screen sizes
- Progressive enhancement

## 🎨 Customization

### Styling
- Modify `tailwind.config.js` for custom colors/spacing
- Update `src/app.css` for global styles
- Component-specific styles in individual `.svelte` files

### Branding
- Update colors in the Tailwind config
- Replace logo and favicon in `src/lib/assets/`
- Modify navigation and footer in `+layout.svelte`

## 🐛 Troubleshooting

### Common Issues

1. **Build Errors**
   ```bash
   # Clear node_modules and reinstall
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **TypeScript Errors**
   ```bash
   # Run type checking
   npm run check
   ```

3. **Styling Issues**
   ```bash
   # Rebuild Tailwind
   npm run dev
   ```

### Debug Mode
Set `LOG_LEVEL=debug` in your environment to enable detailed logging.

## 📚 API Reference

### Payment Service Methods

- `createPayment(data)` - Create a new payment
- `verifyPayment(id)` - Verify payment status
- `pollPaymentStatus(id, attempts, interval)` - Poll for status updates
- `formatCurrency(amount, currency)` - Format currency display
- `generateReference(prefix)` - Generate unique reference IDs

### Component Props

Detailed prop interfaces are available in `src/lib/types.ts` with full TypeScript support.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Follow the coding standards (max 400 lines per file)
4. Add TypeScript types for all new code
5. Test your changes thoroughly
6. Submit a pull request

## 📄 License

This example is part of the PesaKit project and follows the same MIT license.

## 🆘 Support

- **Documentation**: [PesaKit GitHub](https://github.com/leonkalema/pesakit)
- **Issues**: Report bugs or request features
- **Discussions**: Community support and questions

---

**Built with ❤️ using Svelte 5, TypeScript, and Tailwind CSS**
