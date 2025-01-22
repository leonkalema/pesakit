const axios = require('axios');
const axiosRetry = require('axios-retry');
const crypto = require('crypto');
const { Buffer } = require('buffer');

class Pesakit {
  constructor({ consumerKey, consumerSecret, environment = 'sandbox' }) {
    this.consumerKey = consumerKey;
    this.consumerSecret = consumerSecret;
    this.baseURL = environment === 'production' 
      ? 'https://pay.pesapal.com/v3'
      : 'https://cybqa.pesapal.com/pesapalv3';

    // Configure automatic retries
    axiosRetry(axios, {
      retries: 3,
      retryDelay: (retryCount) => retryCount * 1000,
      retryCondition: (error) => 
        axiosRetry.isNetworkError(error) || 
        axiosRetry.isRetryableError(error) ||
        error.response?.status >= 500
    });
  }

  async getOAuthToken() {
    const authString = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
    
    const response = await axios.post(
      `${this.baseURL}/api/auth/request-token`,
      {},
      {
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.token;
  }

  async createPayment(paymentData) {
    const token = await this.getOAuthToken();
    
    const response = await axios.post(
      `${this.baseURL}/api/payments/submit-order`,
      paymentData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.redirect_url;
  }

  async verifyPayment(orderTrackingId) {
    const token = await this.getOAuthToken();
    
    const response = await axios.get(
      `${this.baseURL}/api/transactions/get-transaction-status`,
      {
        params: { orderTrackingId },
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      status: response.data.payment_status,
      method: response.data.payment_method,
      amount: response.data.amount,
      currency: response.data.currency
    };
  }

  createIpnHandler() {
    return async (req, res, next) => {
      try {
        // Validate HMAC signature
        const signature = req.headers['x-pesapal-signature'];
        const payload = JSON.stringify(req.body);
        
        const expectedSignature = crypto
          .createHmac('sha256', this.consumerSecret)
          .update(payload)
          .digest('hex');

        if (signature !== expectedSignature) {
          return res.status(401).json({ error: 'Invalid signature' });
        }

        // Verify payment status
        const { orderTrackingId, status } = req.body;
        const verification = await this.verifyPayment(orderTrackingId);

        if (verification.status === status) {
          res.status(200).send('OK');
          // TODO: Trigger application-specific logic
        } else {
          res.status(400).json({ error: 'Status mismatch' });
        }
      } catch (error) {
        next(error);
      }
    };
  }
}

module.exports = Pesakit;
