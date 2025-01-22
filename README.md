# Pesapal Node.js Integration (Pesakit)

A universal Node.js client for Pesapal's V3 API that works with any JavaScript framework. Provides core payment processing functionality while allowing developers to implement framework-specific UI components.

## Features

- Pesapal API authentication ✅ 
- Payment request creation ✅
- Sandbox/production environments ✅
- TypeScript support ✅
- ✅ IPN handling (createIpnHandler middleware)
- ✅ Payment status tracking (verifyPayment method)
- ✅ Automatic retry mechanisms (3 attempts with backoff)

## Prerequisites

- Node.js 16+
- Pesapal merchant account
- Pesapal consumer credentials (key & secret)
- Registered IPN URL with Pesapal

## Setup

1. Install the package:
```bash
npm install pesakit
```

2. Configure environment variables:
```bash
PESAPAL_CONSUMER_KEY=your_consumer_key
PESAPAL_CONSUMER_SECRET=your_consumer_secret
PESAPAL_ENV=sandbox # or 'production'
```

3. Implement IPN handler in your application:
```javascript
// Example Express endpoint
app.post('/ipn-callback', async (req, res) => {
  const { OrderTrackingId, Status } = req.body;
  // Update your order status in database
  res.status(200).end();
});
```

## Usage

### Core API Client

```javascript
const Pesakit = require('pesakit');

// Initialize with environment variables
const client = new Pesakit({
  consumerKey: process.env.PESAPAL_CONSUMER_KEY,
  consumerSecret: process.env.PESAPAL_CONSUMER_SECRET,
  environment: process.env.PESAPAL_ENV || 'sandbox'
});

// Example payment flow
async function processPayment(orderDetails) {
  try {
    const paymentUrl = await client.createPayment({
      amount: orderDetails.total,
      description: orderDetails.items.join(', '),
      reference: orderDetails.id,
      email: orderDetails.customerEmail,
      callbackUrl: process.env.IPN_CALLBACK_URL
    });
    
    return paymentUrl;
  } catch (error) {
    console.error('Payment processing failed:', error);
    throw new Error('Could not initiate payment');
  }
}
```

### Framework Integration Examples

**Express.js Route:**
```javascript
app.post('/create-payment', async (req, res) => {
  try {
    const paymentUrl = await processPayment(req.body);
    res.json({ url: paymentUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**React Hook:**
```javascript
import Pesakit from 'pesakit';

export function usePesapal() {
  const createPayment = async (order) => {
    const client = new Pesakit({
      consumerKey: process.env.REACT_APP_PESAPAL_KEY,
      consumerSecret: process.env.REACT_APP_PESAPAL_SECRET,
      environment: process.env.REACT_APP_PESAPAL_ENV
    });
    
    return client.createPayment(order);
  };

  return { createPayment };
}
```

**Vue.js Plugin:**
```javascript
import Pesakit from 'pesakit';

export default {
  install: (app, options) => {
    const client = new Pesakit(options);
    app.config.globalProperties.$pesapal = client;
  }
};
```

## API Endpoints

### POST /api/pesapal

Initiates a payment request with Pesapal:
- Validates the payment amount
- Creates a unique reference
- Submits the order to Pesapal
- Returns a payment URL for the iframe

### GET /api/pesapal

Checks the status of a payment:
- Handles IPN notifications
- Verifies payment status
- Updates booking status

## Error Handling

The integration includes comprehensive error handling for:
- Invalid amounts
- Missing IPN configurations
- Failed payment attempts
- Network errors
- Authentication failures

## Development vs Production

- Use the sandbox environment (`cybqa.pesapal.com`) for development
- Switch to production URLs (`pay.pesapal.com`) for live deployments
- Test thoroughly in sandbox before going live

## Important Notes

1. Always validate payment amounts before submission
2. Keep your consumer key and secret secure
3. Implement proper error handling
4. Test the integration thoroughly in sandbox mode
5. Register and maintain your IPN URL
6. Handle payment status updates appropriately

## Testing

For testing in sandbox mode:
1. Use test credentials from Pesapal
2. Test various payment methods
3. Verify IPN functionality
4. Check payment status updates
5. Test error scenarios

## Contributing

Feel free to submit issues and enhancement requests!
