import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// React Hook for Pesakit Integration
const usePesakit = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [paymentUrl, setPaymentUrl] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);

  const createPayment = useCallback(async (paymentData) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.post('/api/payments/create', paymentData);
      setPaymentUrl(response.data.redirect_url);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Payment creation failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyPayment = useCallback(async (orderTrackingId) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(`/api/payments/verify/${orderTrackingId}`);
      setPaymentStatus(response.data);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Payment verification failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    paymentUrl,
    paymentStatus,
    createPayment,
    verifyPayment
  };
};

// Payment Form Component
const PaymentForm = () => {
  const { loading, error, paymentUrl, createPayment } = usePesakit();
  const [formData, setFormData] = useState({
    amount: '',
    currency: 'KES',
    description: '',
    customerEmail: '',
    customerPhone: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const paymentData = {
      id: `order-${Date.now()}`,
      currency: formData.currency,
      amount: parseFloat(formData.amount),
      description: formData.description,
      callback_url: `${window.location.origin}/payment/callback`,
      notification_id: `notif-${Date.now()}`,
      billing_address: {
        email_address: formData.customerEmail,
        phone_number: formData.customerPhone,
        country_code: 'KE',
        first_name: 'Customer',
        last_name: 'Name'
      }
    };

    try {
      await createPayment(paymentData);
    } catch (err) {
      console.error('Payment creation failed:', err);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  if (paymentUrl) {
    return (
      <div className="payment-success">
        <h2>Payment Created Successfully!</h2>
        <p>Redirecting to payment gateway...</p>
        <a 
          href={paymentUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="btn btn-primary"
        >
          Complete Payment
        </a>
      </div>
    );
  }

  return (
    <div className="payment-form">
      <h2>Create Payment</h2>
      
      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="amount">Amount</label>
          <input
            type="number"
            id="amount"
            name="amount"
            value={formData.amount}
            onChange={handleInputChange}
            required
            min="1"
            step="0.01"
          />
        </div>

        <div className="form-group">
          <label htmlFor="currency">Currency</label>
          <select
            id="currency"
            name="currency"
            value={formData.currency}
            onChange={handleInputChange}
          >
            <option value="KES">KES - Kenyan Shilling</option>
            <option value="USD">USD - US Dollar</option>
            <option value="EUR">EUR - Euro</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <input
            type="text"
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="customerEmail">Customer Email</label>
          <input
            type="email"
            id="customerEmail"
            name="customerEmail"
            value={formData.customerEmail}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="customerPhone">Customer Phone</label>
          <input
            type="tel"
            id="customerPhone"
            name="customerPhone"
            value={formData.customerPhone}
            onChange={handleInputChange}
            required
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? 'Creating Payment...' : 'Create Payment'}
        </button>
      </form>
    </div>
  );
};

// Payment Status Component
const PaymentStatus = ({ orderTrackingId }) => {
  const { loading, error, paymentStatus, verifyPayment } = usePesakit();

  useEffect(() => {
    if (orderTrackingId) {
      verifyPayment(orderTrackingId);
    }
  }, [orderTrackingId, verifyPayment]);

  if (loading) {
    return <div className="loading">Verifying payment...</div>;
  }

  if (error) {
    return <div className="alert alert-error">{error}</div>;
  }

  if (!paymentStatus) {
    return <div>No payment status available</div>;
  }

  return (
    <div className="payment-status">
      <h3>Payment Status</h3>
      <div className={`status-badge status-${paymentStatus.status?.toLowerCase()}`}>
        {paymentStatus.status}
      </div>
      <div className="payment-details">
        <p><strong>Amount:</strong> {paymentStatus.amount} {paymentStatus.currency}</p>
        <p><strong>Method:</strong> {paymentStatus.method}</p>
        <p><strong>Order ID:</strong> {orderTrackingId}</p>
      </div>
    </div>
  );
};

// Main App Component
const App = () => {
  const [currentView, setCurrentView] = useState('payment');
  const [orderTrackingId, setOrderTrackingId] = useState('');

  return (
    <div className="app">
      <header>
        <h1>Pesakit React Example</h1>
        <nav>
          <button 
            onClick={() => setCurrentView('payment')}
            className={currentView === 'payment' ? 'active' : ''}
          >
            Create Payment
          </button>
          <button 
            onClick={() => setCurrentView('status')}
            className={currentView === 'status' ? 'active' : ''}
          >
            Check Status
          </button>
        </nav>
      </header>

      <main>
        {currentView === 'payment' && <PaymentForm />}
        {currentView === 'status' && (
          <div>
            <div className="form-group">
              <label htmlFor="orderTrackingId">Order Tracking ID</label>
              <input
                type="text"
                id="orderTrackingId"
                value={orderTrackingId}
                onChange={(e) => setOrderTrackingId(e.target.value)}
                placeholder="Enter order tracking ID"
              />
            </div>
            {orderTrackingId && <PaymentStatus orderTrackingId={orderTrackingId} />}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
