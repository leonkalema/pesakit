const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Pesakit = require('../index');

const app = express();
const port = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize Pesakit
const pesakit = new Pesakit({
  consumerKey: process.env.PESAPAL_CONSUMER_KEY,
  consumerSecret: process.env.PESAPAL_CONSUMER_SECRET,
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
  logLevel: process.env.LOG_LEVEL || 'info',
  timeout: parseInt(process.env.PESAPAL_TIMEOUT) || 30000,
  retries: parseInt(process.env.PESAPAL_RETRIES) || 3
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const health = await pesakit.getHealthStatus();
    res.status(health.status === 'healthy' ? 200 : 503).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    const metrics = await pesakit.getMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve metrics',
      message: error.message
    });
  }
});

// Create payment endpoint
app.post('/api/payments/create', async (req, res) => {
  try {
    const paymentData = req.body;
    
    // Add correlation ID for tracking
    const correlationId = req.headers['x-correlation-id'] || `req-${Date.now()}`;
    
    const redirectUrl = await pesakit.createPayment(paymentData, { correlationId });
    
    res.json({
      success: true,
      redirect_url: redirectUrl,
      order_id: paymentData.id,
      correlation_id: correlationId
    });
  } catch (error) {
    console.error('Payment creation failed:', error);
    
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.name || 'PaymentError',
      message: error.message,
      correlation_id: error.correlationId
    });
  }
});

// Verify payment endpoint
app.get('/api/payments/verify/:orderTrackingId', async (req, res) => {
  try {
    const { orderTrackingId } = req.params;
    const correlationId = req.headers['x-correlation-id'] || `verify-${Date.now()}`;
    
    const verification = await pesakit.verifyPayment(orderTrackingId, { correlationId });
    
    res.json({
      success: true,
      ...verification,
      correlation_id: correlationId
    });
  } catch (error) {
    console.error('Payment verification failed:', error);
    
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.name || 'VerificationError',
      message: error.message,
      correlation_id: error.correlationId
    });
  }
});

// IPN webhook endpoint
app.post('/api/payments/webhook', pesakit.createIpnHandler({
  onSuccess: (data) => {
    console.log('Payment successful:', data);
    // Add your business logic here
    // e.g., update database, send confirmation email, etc.
  },
  onFailure: (data) => {
    console.log('Payment failed:', data);
    // Add your failure handling logic here
  },
  onPending: (data) => {
    console.log('Payment pending:', data);
    // Add your pending handling logic here
  }
}));

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  
  res.status(error.statusCode || 500).json({
    success: false,
    error: error.name || 'InternalServerError',
    message: process.env.NODE_ENV === 'production' 
      ? 'An internal server error occurred' 
      : error.message,
    correlation_id: error.correlationId || req.headers['x-correlation-id']
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'NotFound',
    message: 'Endpoint not found'
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  
  try {
    await pesakit.destroy();
    console.log('Pesakit resources cleaned up');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  
  try {
    await pesakit.destroy();
    console.log('Pesakit resources cleaned up');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
  
  process.exit(0);
});

app.listen(port, () => {
  console.log(`Pesakit Express server running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log(`Metrics: http://localhost:${port}/metrics`);
});

module.exports = app;
