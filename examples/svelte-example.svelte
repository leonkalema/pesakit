<script>
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';

  // Svelte stores for state management
  const loading = writable(false);
  const error = writable(null);
  const paymentUrl = writable(null);
  const paymentStatus = writable(null);

  // Form data
  let formData = {
    amount: '',
    currency: 'KES',
    description: '',
    customerEmail: '',
    customerPhone: ''
  };

  let currentView = 'payment';
  let orderTrackingId = '';

  // Payment creation function
  async function createPayment() {
    loading.set(true);
    error.set(null);
    
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
      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData)
      });

      if (!response.ok) {
        throw new Error('Payment creation failed');
      }

      const data = await response.json();
      paymentUrl.set(data.redirect_url);
    } catch (err) {
      error.set(err.message || 'Payment creation failed');
    } finally {
      loading.set(false);
    }
  }

  // Payment verification function
  async function verifyPayment(trackingId) {
    loading.set(true);
    error.set(null);
    
    try {
      const response = await fetch(`/api/payments/verify/${trackingId}`);
      
      if (!response.ok) {
        throw new Error('Payment verification failed');
      }

      const data = await response.json();
      paymentStatus.set(data);
    } catch (err) {
      error.set(err.message || 'Payment verification failed');
    } finally {
      loading.set(false);
    }
  }

  // Handle form submission
  async function handleSubmit(event) {
    event.preventDefault();
    await createPayment();
  }

  // Handle order tracking ID change
  function handleTrackingIdChange() {
    if (orderTrackingId) {
      verifyPayment(orderTrackingId);
    }
  }

  // Reactive statement to verify payment when tracking ID changes
  $: if (orderTrackingId && currentView === 'status') {
    handleTrackingIdChange();
  }
</script>

<main class="app">
  <header>
    <h1>Pesakit Svelte Example</h1>
    <nav>
      <button 
        class:active={currentView === 'payment'}
        on:click={() => currentView = 'payment'}
      >
        Create Payment
      </button>
      <button 
        class:active={currentView === 'status'}
        on:click={() => currentView = 'status'}
      >
        Check Status
      </button>
    </nav>
  </header>

  <section class="content">
    {#if currentView === 'payment'}
      <div class="payment-form">
        <h2>Create Payment</h2>
        
        {#if $error}
          <div class="alert alert-error">
            {$error}
          </div>
        {/if}

        {#if $paymentUrl}
          <div class="payment-success">
            <h3>Payment Created Successfully!</h3>
            <p>Redirecting to payment gateway...</p>
            <a 
              href={$paymentUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              class="btn btn-primary"
            >
              Complete Payment
            </a>
          </div>
        {:else}
          <form on:submit={handleSubmit}>
            <div class="form-group">
              <label for="amount">Amount</label>
              <input
                type="number"
                id="amount"
                bind:value={formData.amount}
                required
                min="1"
                step="0.01"
              />
            </div>

            <div class="form-group">
              <label for="currency">Currency</label>
              <select id="currency" bind:value={formData.currency}>
                <option value="KES">KES - Kenyan Shilling</option>
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
              </select>
            </div>

            <div class="form-group">
              <label for="description">Description</label>
              <input
                type="text"
                id="description"
                bind:value={formData.description}
                required
              />
            </div>

            <div class="form-group">
              <label for="customerEmail">Customer Email</label>
              <input
                type="email"
                id="customerEmail"
                bind:value={formData.customerEmail}
                required
              />
            </div>

            <div class="form-group">
              <label for="customerPhone">Customer Phone</label>
              <input
                type="tel"
                id="customerPhone"
                bind:value={formData.customerPhone}
                required
              />
            </div>

            <button 
              type="submit" 
              disabled={$loading}
              class="btn btn-primary"
            >
              {$loading ? 'Creating Payment...' : 'Create Payment'}
            </button>
          </form>
        {/if}
      </div>
    {:else if currentView === 'status'}
      <div class="payment-status-section">
        <h2>Check Payment Status</h2>
        
        <div class="form-group">
          <label for="orderTrackingId">Order Tracking ID</label>
          <input
            type="text"
            id="orderTrackingId"
            bind:value={orderTrackingId}
            placeholder="Enter order tracking ID"
          />
        </div>

        {#if $loading}
          <div class="loading">Verifying payment...</div>
        {:else if $error}
          <div class="alert alert-error">{$error}</div>
        {:else if $paymentStatus}
          <div class="payment-status">
            <h3>Payment Status</h3>
            <div class="status-badge status-{$paymentStatus.status?.toLowerCase()}">
              {$paymentStatus.status}
            </div>
            <div class="payment-details">
              <p><strong>Amount:</strong> {$paymentStatus.amount} {$paymentStatus.currency}</p>
              <p><strong>Method:</strong> {$paymentStatus.method}</p>
              <p><strong>Order ID:</strong> {orderTrackingId}</p>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </section>
</main>

<style>
  .app {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  header {
    margin-bottom: 30px;
  }

  h1 {
    color: #2c3e50;
    margin-bottom: 20px;
  }

  nav {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
  }

  nav button {
    padding: 10px 20px;
    border: 2px solid #3498db;
    background: white;
    color: #3498db;
    border-radius: 5px;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  nav button:hover {
    background: #3498db;
    color: white;
  }

  nav button.active {
    background: #3498db;
    color: white;
  }

  .form-group {
    margin-bottom: 20px;
  }

  label {
    display: block;
    margin-bottom: 5px;
    font-weight: 600;
    color: #2c3e50;
  }

  input, select {
    width: 100%;
    padding: 12px;
    border: 2px solid #ddd;
    border-radius: 5px;
    font-size: 16px;
    transition: border-color 0.3s ease;
  }

  input:focus, select:focus {
    outline: none;
    border-color: #3498db;
  }

  .btn {
    padding: 12px 24px;
    border: none;
    border-radius: 5px;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.3s ease;
    text-decoration: none;
    display: inline-block;
    text-align: center;
  }

  .btn-primary {
    background: #3498db;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #2980b9;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .alert {
    padding: 15px;
    border-radius: 5px;
    margin-bottom: 20px;
  }

  .alert-error {
    background: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
  }

  .payment-success {
    text-align: center;
    padding: 30px;
    background: #d4edda;
    border: 1px solid #c3e6cb;
    border-radius: 5px;
    color: #155724;
  }

  .loading {
    text-align: center;
    padding: 20px;
    color: #666;
  }

  .payment-status {
    background: #f8f9fa;
    padding: 20px;
    border-radius: 5px;
    border: 1px solid #dee2e6;
  }

  .status-badge {
    display: inline-block;
    padding: 8px 16px;
    border-radius: 20px;
    font-weight: bold;
    text-transform: uppercase;
    font-size: 14px;
    margin-bottom: 15px;
  }

  .status-completed {
    background: #28a745;
    color: white;
  }

  .status-pending {
    background: #ffc107;
    color: #212529;
  }

  .status-failed {
    background: #dc3545;
    color: white;
  }

  .payment-details p {
    margin: 8px 0;
    color: #495057;
  }

  .payment-details strong {
    color: #212529;
  }
</style>
