<script lang="ts">
  import { onMount } from 'svelte';
  import PaymentStatus from '$lib/components/PaymentStatus.svelte';
  import Notification from '$lib/components/Notification.svelte';
  import { paymentService } from '$lib/services/payment-service.js';
  import { goto } from '$app/navigation';
  import type { PaymentVerification, NotificationProps } from '$lib/types.js';

  let orderTrackingId = $state('');
  let verification: PaymentVerification | undefined = $state(undefined);
  let isLoading = $state(false);
  let error = $state('');

  let notification: Omit<NotificationProps, 'onClose'> & { show: boolean } = $state({
    type: 'info',
    title: '',
    message: '',
    show: false
  });

  onMount(() => {
    // Check if there's an order tracking ID in the URL params
    const urlParams = new URLSearchParams(window.location.search);
    const urlOrderId = urlParams.get('orderTrackingId') || urlParams.get('OrderTrackingId');
    
    if (urlOrderId) {
      orderTrackingId = urlOrderId;
      handleVerifyPayment();
    }
  });

  async function handleVerifyPayment() {
    if (!orderTrackingId.trim()) {
      showNotification('error', 'Invalid Input', 'Please enter a valid order tracking ID');
      return;
    }

    isLoading = true;
    error = '';
    verification = undefined;

    try {
      const response = await paymentService.verifyPayment(orderTrackingId.trim());
      
      if (response.success && response.verification) {
        verification = response.verification;
        
        if (verification.status === 'COMPLETED') {
          showNotification('success', 'Payment Verified', 'Your payment has been completed successfully!');
        } else if (verification.status === 'FAILED') {
          showNotification('error', 'Payment Failed', 'Your payment could not be processed.');
        } else if (verification.status === 'PENDING') {
          showNotification('info', 'Payment Pending', 'Your payment is still being processed.');
        }
      } else {
        throw new Error(response.error || 'Failed to verify payment');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Verification failed';
      showNotification('error', 'Verification Failed', error);
    } finally {
      isLoading = false;
    }
  }

  async function handlePollStatus() {
    if (!orderTrackingId.trim()) return;

    isLoading = true;
    showNotification('info', 'Polling Status', 'Checking payment status continuously...');

    try {
      const response = await paymentService.pollPaymentStatus(orderTrackingId.trim(), 10, 3000);
      
      if (response.success && response.verification) {
        verification = response.verification;
        
        if (verification.status === 'COMPLETED') {
          showNotification('success', 'Payment Completed', 'Your payment has been completed successfully!');
        } else if (verification.status === 'FAILED') {
          showNotification('error', 'Payment Failed', 'Your payment could not be processed.');
        } else {
          showNotification('warning', 'Status Unchanged', 'Payment is still pending after polling.');
        }
      } else {
        throw new Error(response.error || 'Polling failed');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Polling failed';
      showNotification('error', 'Polling Failed', error);
    } finally {
      isLoading = false;
    }
  }

  function handleRetry() {
    verification = undefined;
    error = '';
    handleVerifyPayment();
  }

  function handleNewPayment() {
    goto('/payment');
  }

  function showNotification(type: NotificationProps['type'], title: string, message: string) {
    notification = {
      type,
      title,
      message,
      show: true
    };
  }

  function hideNotification() {
    notification.show = false;
  }

  function handleInputKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      handleVerifyPayment();
    }
  }
</script>

<div class="animate-fade-in">
  <!-- Page Header -->
  <div class="text-center mb-8">
    <h1 class="text-3xl font-bold text-gray-900 mb-2">Payment Status</h1>
    <p class="text-gray-600">
      Check the status of your PesaPal payment using your order tracking ID
    </p>
  </div>

  <!-- Order Tracking ID Input -->
  <div class="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto mb-8">
    <div class="mb-6">
      <label for="orderTrackingId" class="block text-sm font-medium text-gray-700 mb-2">
        Order Tracking ID
      </label>
      <div class="flex space-x-3">
        <input
          id="orderTrackingId"
          type="text"
          class="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
          bind:value={orderTrackingId}
          onkeypress={handleInputKeyPress}
          placeholder="Enter your order tracking ID (e.g., PAY-1234567890-ABC123)"
          disabled={isLoading}
        />
        <button
          type="button"
          class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          onclick={handleVerifyPayment}
          disabled={isLoading || !orderTrackingId.trim()}
        >
          {isLoading ? 'Checking...' : 'Check Status'}
        </button>
      </div>
      <p class="mt-2 text-sm text-gray-500">
        You can find your order tracking ID in your payment confirmation email or receipt.
      </p>
    </div>

    <!-- Additional Actions -->
    {#if orderTrackingId.trim() && !isLoading}
      <div class="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          class="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          onclick={handlePollStatus}
        >
          Poll Status (Real-time)
        </button>
        <button
          type="button"
          class="flex-1 px-4 py-2 bg-success-600 text-white rounded-md hover:bg-success-700 focus:outline-none focus:ring-2 focus:ring-success-500 focus:ring-offset-2"
          onclick={handleNewPayment}
        >
          Create New Payment
        </button>
      </div>
    {/if}
  </div>

  <!-- Payment Status Display -->
  {#if verification || isLoading || error}
    <PaymentStatus
      orderTrackingId={orderTrackingId}
      verification={verification}
      isLoading={isLoading}
      onRetry={handleRetry}
      onNewPayment={handleNewPayment}
    />
  {/if}

  <!-- Sample Order IDs for Demo -->
  <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-2xl mx-auto mt-8">
    <h3 class="text-lg font-medium text-yellow-800 mb-4">Demo Mode</h3>
    <p class="text-sm text-yellow-700 mb-4">
      Since this is a demo environment, you can use these sample order tracking IDs to test the status checking functionality:
    </p>
    
    <div class="space-y-2">
      <div class="flex items-center justify-between bg-white p-3 rounded border">
        <div>
          <code class="text-sm font-mono text-gray-800">DEMO-COMPLETED-12345</code>
          <span class="ml-2 text-xs text-green-600 font-medium">COMPLETED</span>
        </div>
        <button
          type="button"
          class="text-xs text-primary-600 hover:text-primary-700 font-medium"
          onclick={() => { orderTrackingId = 'DEMO-COMPLETED-12345'; handleVerifyPayment(); }}
        >
          Try This
        </button>
      </div>
      
      <div class="flex items-center justify-between bg-white p-3 rounded border">
        <div>
          <code class="text-sm font-mono text-gray-800">DEMO-PENDING-67890</code>
          <span class="ml-2 text-xs text-yellow-600 font-medium">PENDING</span>
        </div>
        <button
          type="button"
          class="text-xs text-primary-600 hover:text-primary-700 font-medium"
          onclick={() => { orderTrackingId = 'DEMO-PENDING-67890'; handleVerifyPayment(); }}
        >
          Try This
        </button>
      </div>
      
      <div class="flex items-center justify-between bg-white p-3 rounded border">
        <div>
          <code class="text-sm font-mono text-gray-800">DEMO-FAILED-11111</code>
          <span class="ml-2 text-xs text-red-600 font-medium">FAILED</span>
        </div>
        <button
          type="button"
          class="text-xs text-primary-600 hover:text-primary-700 font-medium"
          onclick={() => { orderTrackingId = 'DEMO-FAILED-11111'; handleVerifyPayment(); }}
        >
          Try This
        </button>
      </div>
    </div>
    
    <p class="text-xs text-yellow-600 mt-4">
      In production, these would be real order tracking IDs from PesaPal.
    </p>
  </div>

  <!-- Help Section -->
  <div class="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-2xl mx-auto mt-8">
    <h3 class="text-lg font-medium text-blue-800 mb-4">Need Help?</h3>
    <div class="space-y-3 text-sm text-blue-700">
      <div class="flex items-start">
        <span class="text-blue-400 mr-2">•</span>
        <div>
          <strong>Order Tracking ID:</strong> This is provided when you create a payment and is also sent to your email.
        </div>
      </div>
      <div class="flex items-start">
        <span class="text-blue-400 mr-2">•</span>
        <div>
          <strong>Real-time Polling:</strong> Use this feature to continuously check for status updates until the payment is completed.
        </div>
      </div>
      <div class="flex items-start">
        <span class="text-blue-400 mr-2">•</span>
        <div>
          <strong>Status Types:</strong> COMPLETED (successful), PENDING (processing), FAILED (unsuccessful), CANCELLED (user cancelled).
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Notification Component -->
<Notification
  type={notification.type}
  title={notification.title}
  message={notification.message}
  show={notification.show}
  onClose={hideNotification}
/>
