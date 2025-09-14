# Pesakit - Production-Ready Pesapal Integration

[![npm version](https://badge.fury.io/js/pesakit.svg)](https://badge.fury.io/js/pesakit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js CI](https://github.com/leonkalema/pesakit/workflows/Node.js%20CI/badge.svg)](https://github.com/leonkalema/pesakit/actions)

A enterprise-grade Node.js client for Pesapal's V3 API with comprehensive security, monitoring, and resilience features. Built for production environments with extensive error handling, caching, rate limiting, and observability.

## 🚀 Features

### Core Functionality
- ✅ **Pesapal API V3 Integration** - Full support for authentication, payments, and verification
- ✅ **Multi-Environment Support** - Seamless sandbox/production switching
- ✅ **TypeScript Support** - Comprehensive type definitions with strict typing
- ✅ **Framework Agnostic** - Works with Express, Fastify, Koa, Next.js, and more

### Enterprise Security
- 🔒 **Secure Token Caching** - Encrypted token storage with TTL management
- 🔒 **Timing-Safe Signature Validation** - Protection against timing attacks
- 🔒 **Input Validation** - Comprehensive schema validation with Joi
- 🔒 **Sensitive Data Sanitization** - Automatic redaction in logs
- 🔒 **Correlation ID Tracking** - Request tracing across services

### Production Resilience
- 🛡️ **Circuit Breaker Pattern** - Automatic failure detection and recovery
- 🛡️ **Rate Limiting** - Token bucket, sliding window, and fixed window strategies
- 🛡️ **Exponential Backoff Retry** - Intelligent retry with jitter
- 🛡️ **Health Checks** - Comprehensive system health monitoring
- 🛡️ **Graceful Degradation** - Fallback mechanisms for API failures

### Observability & Monitoring
- 📊 **Structured Logging** - JSON logs with correlation IDs using Pino
- 📊 **Metrics Collection** - Counters, gauges, histograms with percentiles
- 📊 **Performance Tracking** - Request timing and throughput monitoring
- 📊 **Error Tracking** - Detailed error classification and reporting

## 📋 Prerequisites

- **Node.js 18+** (LTS recommended)
- **Pesapal Merchant Account** with API access
- **Consumer Credentials** (Key & Secret from Pesapal dashboard)
- **Registered IPN URL** for webhook notifications

## 🛠️ Installation

```bash
npm install pesakit
```

## ⚡ Quick Start

```javascript
const Pesakit = require('pesakit');

// Initialize with comprehensive configuration
const client = new Pesakit({
  consumerKey: process.env.PESAPAL_CONSUMER_KEY,
  consumerSecret: process.env.PESAPAL_CONSUMER_SECRET,
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
  timeout: 30000,
  retries: 3,
  enableLogging: true,
  logLevel: 'info'
});

// Create a payment
const paymentUrl = await client.createPayment({
  amount: 1000.00,
  description: 'Premium subscription',
  reference: `ORDER-${Date.now()}`,
  email: 'customer@example.com',
  callbackUrl: 'https://yourapp.com/webhook/pesapal',
  currency: 'KES'
});

console.log('Payment URL:', paymentUrl);
```

## 📖 Complete API Documentation

### Configuration Options

```javascript
const client = new Pesakit({
  consumerKey: 'your_consumer_key',        // Required: Pesapal consumer key
  consumerSecret: 'your_consumer_secret',  // Required: Pesapal consumer secret
  environment: 'sandbox',                  // Optional: 'sandbox' | 'production'
  timeout: 30000,                         // Optional: Request timeout in ms
  retries: 3,                             // Optional: Number of retry attempts
  enableLogging: true,                    // Optional: Enable structured logging
  logLevel: 'info'                        // Optional: Log level
});
```

### Payment Creation

```javascript
// Comprehensive payment data
const paymentData = {
  amount: 1500.75,                        // Required: Payment amount
  description: 'Order #12345',           // Required: Payment description
  reference: 'ORDER-12345',              // Required: Unique reference
  email: 'customer@example.com',         // Required: Customer email
  callbackUrl: 'https://app.com/ipn',    // Required: IPN callback URL
  currency: 'KES',                       // Optional: Currency code
  firstName: 'John',                     // Optional: Customer first name
  lastName: 'Doe',                       // Optional: Customer last name
  phoneNumber: '+254712345678',          // Optional: Phone number
  billingAddress: {                      // Optional: Billing address
    line1: '123 Main St',
    city: 'Nairobi',
    countryCode: 'KE'
  }
};

try {
  const paymentUrl = await client.createPayment(paymentData);
  console.log('Redirect customer to:', paymentUrl);
} catch (error) {
  console.error('Payment creation failed:', error.message);
  // Handle specific error types
  if (error.code === 'VALIDATION_ERROR') {
    console.log('Validation details:', error.details);
  }
}
```

### Payment Verification

```javascript
try {
  const verification = await client.verifyPayment('ORDER-12345');
  
  console.log('Payment Status:', verification.status);     // COMPLETED, PENDING, FAILED
  console.log('Payment Method:', verification.method);     // M-PESA, Card, etc.
  console.log('Amount:', verification.amount);
  console.log('Currency:', verification.currency);
  console.log('Timestamp:', verification.timestamp);
} catch (error) {
  if (error.code === 'PAYMENT_ERROR' && error.statusCode === 404) {
    console.log('Payment not found');
  }
}
```

### IPN (Webhook) Handler

```javascript
// Express.js example with comprehensive error handling
const express = require('express');
const app = express();

app.use(express.json());

// Create IPN handler with callbacks
const ipnHandler = client.createIpnHandler({
  onSuccess: async (ipnData, verification) => {
    console.log(`Payment ${ipnData.orderTrackingId} completed`);
    
    // Update your database
    await updateOrderStatus(ipnData.orderTrackingId, 'completed');
    
    // Send confirmation email
    await sendConfirmationEmail(verification);
  },
  
  onFailure: async (ipnData, verification, error) => {
    console.error(`Payment ${ipnData.orderTrackingId} failed:`, error);
    
    // Handle failed payments
    await updateOrderStatus(ipnData.orderTrackingId, 'failed');
  },
  
  validateSignature: true  // Enable signature validation (recommended)
});

app.post('/webhook/pesapal', ipnHandler);

app.listen(3000);
```

### Health Monitoring

```javascript
// Check system health
const health = await client.getHealthStatus();
console.log('System Status:', health.status);  // healthy, degraded, unhealthy, critical
console.log('Health Checks:', health.checks);

// Get performance metrics
const metrics = client.getMetrics();
console.log('Uptime:', metrics.uptime);
console.log('API Calls:', metrics.counters);
console.log('Response Times:', metrics.histograms);

// Check rate limit status
const rateLimitStatus = client.getRateLimitStatus('payment:key');
console.log('Available Tokens:', rateLimitStatus?.availableTokens);
```
## 🏗️ Framework Integration Examples

### Express.js Production Setup

```javascript
const express = require('express');
const Pesakit = require('pesakit');

const app = express();
app.use(express.json());

// Initialize Pesakit with production configuration
const pesakit = new Pesakit({
  consumerKey: process.env.PESAPAL_CONSUMER_KEY,
  consumerSecret: process.env.PESAPAL_CONSUMER_SECRET,
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
  timeout: 30000,
  retries: 3,
  logLevel: process.env.LOG_LEVEL || 'info'
});

// Payment creation endpoint
app.post('/api/payments', async (req, res) => {
  try {
    const paymentUrl = await pesakit.createPayment(req.body);
    res.json({ success: true, paymentUrl });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
      code: error.code,
      correlationId: error.details?.correlationId
    });
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  const health = await pesakit.getHealthStatus();
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  const metrics = pesakit.getMetrics();
  res.json(metrics);
});

// IPN webhook endpoint
app.post('/webhook/pesapal', pesakit.createIpnHandler({
  onSuccess: async (ipnData, verification) => {
    // Update order status in database
    await updateOrderStatus(ipnData.orderTrackingId, 'completed');
  }
}));

// Graceful shutdown
process.on('SIGTERM', () => {
  pesakit.destroy();
  process.exit(0);
});

app.listen(process.env.PORT || 3000);
```
```

### Next.js API Routes

```javascript
// pages/api/payments/create.js
import Pesakit from 'pesakit';

const pesakit = new Pesakit({
  consumerKey: process.env.PESAPAL_CONSUMER_KEY,
  consumerSecret: process.env.PESAPAL_CONSUMER_SECRET,
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const paymentUrl = await pesakit.createPayment(req.body);
    res.json({ success: true, paymentUrl });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
      correlationId: error.details?.correlationId
    });
  }
}
```

### Fastify Plugin

```javascript
const fastify = require('fastify')({ logger: true });
const Pesakit = require('pesakit');

// Register Pesakit as a plugin
fastify.register(async function (fastify) {
  const pesakit = new Pesakit({
    consumerKey: process.env.PESAPAL_CONSUMER_KEY,
    consumerSecret: process.env.PESAPAL_CONSUMER_SECRET,
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
  });
  
  fastify.decorate('pesakit', pesakit);
  
  // Add hooks for cleanup
  fastify.addHook('onClose', async () => {
    pesakit.destroy();
  });
});

// Payment routes
fastify.post('/payments', async (request, reply) => {
  try {
    const paymentUrl = await fastify.pesakit.createPayment(request.body);
    return { success: true, paymentUrl };
  } catch (error) {
    reply.code(error.statusCode || 500);
    return { success: false, error: error.message };
  }
});

fastify.listen({ port: 3000 });
```

## 🔧 Error Handling & Debugging

### Error Types

```javascript
const {
  AuthenticationError,
  ValidationError,
  PaymentError,
  NetworkError,
  RateLimitError,
  SignatureError,
  ConfigurationError
} = require('pesakit');

try {
  await client.createPayment(paymentData);
} catch (error) {
  switch (error.constructor) {
    case ValidationError:
      console.log('Invalid input:', error.details);
      break;
    case AuthenticationError:
      console.log('Invalid credentials');
      break;
    case PaymentError:
      console.log('Payment failed:', error.message);
      break;
    case RateLimitError:
      console.log('Rate limit exceeded, retry after:', error.details.retryAfter);
      break;
    case NetworkError:
      console.log('Network issue:', error.message);
      break;
    default:
      console.log('Unexpected error:', error.message);
  }
  
  // All errors include correlation ID for tracking
  console.log('Correlation ID:', error.details?.correlationId);
}
```

### Debugging & Logging

```javascript
// Enable debug logging
const client = new Pesakit({
  consumerKey: process.env.PESAPAL_CONSUMER_KEY,
  consumerSecret: process.env.PESAPAL_CONSUMER_SECRET,
  logLevel: 'debug'  // trace, debug, info, warn, error
});

// Monitor metrics for debugging
setInterval(() => {
  const metrics = client.getMetrics();
  console.log('API Success Rate:', {
    auth: metrics.counters['auth.success']?.[0]?.value || 0,
    payments: metrics.counters['payment.create.success']?.[0]?.value || 0,
    errors: metrics.counters['payment.create.error']?.[0]?.value || 0
  });
}, 60000);
```

## 🚀 Production Deployment

### Environment Variables

```bash
# Required
PESAPAL_CONSUMER_KEY=your_production_consumer_key
PESAPAL_CONSUMER_SECRET=your_production_consumer_secret
NODE_ENV=production

# Optional
LOG_LEVEL=info
PESAPAL_TIMEOUT=30000
PESAPAL_RETRIES=3
PORT=3000
```

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PESAPAL_CONSUMER_KEY=${PESAPAL_CONSUMER_KEY}
      - PESAPAL_CONSUMER_SECRET=${PESAPAL_CONSUMER_SECRET}
      - LOG_LEVEL=info
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Kubernetes Deployment

```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pesakit-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: pesakit-app
  template:
    metadata:
      labels:
        app: pesakit-app
    spec:
      containers:
      - name: app
        image: your-registry/pesakit-app:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: PESAPAL_CONSUMER_KEY
          valueFrom:
            secretKeyRef:
              name: pesapal-secrets
              key: consumer-key
        - name: PESAPAL_CONSUMER_SECRET
          valueFrom:
            secretKeyRef:
              name: pesapal-secrets
              key: consumer-secret
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

### Monitoring & Alerting

```javascript
// monitoring.js - Prometheus metrics example
const client = require('prom-client');
const express = require('express');
const Pesakit = require('pesakit');

// Create custom metrics
const paymentCounter = new client.Counter({
  name: 'pesakit_payments_total',
  help: 'Total number of payment requests',
  labelNames: ['status', 'currency']
});

const paymentDuration = new client.Histogram({
  name: 'pesakit_payment_duration_seconds',
  help: 'Payment request duration',
  buckets: [0.1, 0.5, 1, 2, 5]
});

// Integrate with Pesakit metrics
const pesakit = new Pesakit(config);

pesakit.metrics.on('metric', (metric) => {
  if (metric.name.includes('payment.create')) {
    paymentCounter.inc({
      status: metric.name.includes('success') ? 'success' : 'error',
      currency: metric.tags?.currency || 'unknown'
    });
  }
});

// Expose metrics endpoint
app.get('/metrics', (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(client.register.metrics());
});
```
## 🧪 Testing

### Running Tests

```bash
# Install dependencies
npm install

# Run unit tests
npm test

# Run tests with coverage
npm run test:coverage

# Run integration tests (requires test credentials)
npm run test:integration

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Security audit
npm run security:audit
```

### Test Environment Setup

```bash
# .env.test
PESAPAL_CONSUMER_KEY=test_consumer_key
PESAPAL_CONSUMER_SECRET=test_consumer_secret
PESAPAL_ENV=sandbox
LOG_LEVEL=error
```

### Writing Tests

```javascript
const Pesakit = require('pesakit');
const nock = require('nock');

describe('Payment Tests', () => {
  let client;
  
  beforeEach(() => {
    client = new Pesakit({
      consumerKey: 'test_key',
      consumerSecret: 'test_secret',
      environment: 'sandbox'
    });
    
    // Mock Pesapal API
    nock('https://cybqa.pesapal.com')
      .post('/pesapalv3/api/auth/request-token')
      .reply(200, { token: 'test_token', expires_in: 3600 });
  });
  
  afterEach(() => {
    client.destroy();
    nock.cleanAll();
  });
  
  test('should create payment successfully', async () => {
    nock('https://cybqa.pesapal.com')
      .post('/pesapalv3/api/payments/submit-order')
      .reply(200, { redirect_url: 'https://payment.url' });
    
    const paymentUrl = await client.createPayment({
      amount: 1000,
      description: 'Test payment',
      reference: 'TEST-123',
      email: 'test@example.com',
      callbackUrl: 'https://test.com/callback'
    });
    
    expect(paymentUrl).toBe('https://payment.url');
  });
});
```

## 📊 Performance & Scaling

### Performance Optimization

```javascript
// Use connection pooling for high-throughput applications
const https = require('https');
const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000
});

// Configure axios to use the agent
axios.defaults.httpsAgent = agent;

// Optimize token caching for multiple instances
const client = new Pesakit({
  consumerKey: process.env.PESAPAL_CONSUMER_KEY,
  consumerSecret: process.env.PESAPAL_CONSUMER_SECRET,
  environment: 'production',
  // Reduce token refresh frequency
  timeout: 15000,
  retries: 2
});
```

### Load Balancing

```javascript
// Use cluster module for CPU-intensive operations
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  
  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork();
  });
} else {
  // Worker process
  const app = require('./app');
  app.listen(process.env.PORT || 3000);
}
```

## 🔒 Security Best Practices

### 1. Credential Management
- Never hardcode credentials in source code
- Use environment variables or secure vaults
- Rotate credentials regularly
- Use different credentials for different environments

### 2. Network Security
- Always use HTTPS in production
- Implement proper CORS policies
- Use rate limiting to prevent abuse
- Validate all incoming webhook requests

### 3. Data Protection
- Enable signature validation for webhooks
- Sanitize logs to prevent credential leakage
- Use correlation IDs for request tracking
- Implement proper error handling

## 📈 Monitoring & Observability

### Key Metrics to Monitor

1. **Payment Success Rate**: `payment.create.success / (payment.create.success + payment.create.error)`
2. **API Response Time**: P50, P95, P99 percentiles
3. **Token Cache Hit Rate**: `auth.cache_hit / (auth.cache_hit + auth.cache_miss)`
4. **Circuit Breaker Status**: Open/closed state
5. **Rate Limit Violations**: `rate_limit_error` count

### Alerting Rules

```yaml
# Prometheus alerting rules
groups:
- name: pesakit
  rules:
  - alert: PesakitHighErrorRate
    expr: rate(pesakit_payments_total{status="error"}[5m]) > 0.1
    for: 2m
    labels:
      severity: warning
    annotations:
      summary: High payment error rate detected
      
  - alert: PesakitCircuitBreakerOpen
    expr: pesakit_circuit_breaker_state == 1
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: Circuit breaker is open
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/leonkalema/pesakit.git
cd pesakit

# Install dependencies
npm install

# Run tests
npm test

# Start development with watch mode
npm run dev
```

### Submitting Changes

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [Full API Documentation](https://github.com/leonkalema/pesakit/wiki)
- **Issues**: [GitHub Issues](https://github.com/leonkalema/pesakit/issues)
- **Discussions**: [GitHub Discussions](https://github.com/leonkalema/pesakit/discussions)

## 🏆 Acknowledgments

- Pesapal for providing the payment gateway API
- The Node.js community for excellent tooling
- Contributors and users who help improve this library

---

**Built with ❤️ for the African fintech ecosystem**
