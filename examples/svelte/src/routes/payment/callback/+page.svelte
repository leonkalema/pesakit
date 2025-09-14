<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import PaymentStatus from '$lib/components/PaymentStatus.svelte';
  import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
  import { paymentService } from '$lib/services/payment-service.js';
  import type { PaymentVerification } from '$lib/types.js';

  let orderTrackingId = $state('');
  let verification: PaymentVerification | undefined = $state(undefined);
  let isLoading = $state(true);
  let error = $state('');

  onMount(async () => {
    // Extract order tracking ID from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const urlOrderId = urlParams.get('orderTrackingId') || 
                      urlParams.get('OrderTrackingId') ||
                      urlParams.get('order_tracking_id');
    
    if (urlOrderId) {
      orderTrackingId = urlOrderId;
      await verifyPaymentStatus();
    } else {
      error = 'No order tracking ID found in callback URL';
      isLoading = false;
    }
  });

  async function verifyPaymentStatus() {
    try {
      // Poll for payment status with retries
      const response = await paymentService.pollPaymentStatus(orderTrackingId, 15, 2000);
      
      if (response.success && response.verification) {
        verification = response.verification;
      } else {
        throw new Error(response.error || 'Failed to verify payment status');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Payment verification failed';
    } finally {
      isLoading = false;
    }
  }

  function handleRetry() {
    isLoading = true;
    error = '';
    verification = undefined;
    verifyPaymentStatus();
  }

  function handleNewPayment() {
    goto('/payment');
  }

  function handleViewStatus() {
    goto(`/status?orderTrackingId=${orderTrackingId}`);
  }
</script>

<svelte:head>
  <title>Payment Callback - PesaKit Demo</title>
</svelte:head>

<div class="animate-fade-in">
  <!-- Page Header -->
  <div class="text-center mb-8">
    <h1 class="text-3xl font-bold text-gray-900 mb-2">Payment Callback</h1>
    <p class="text-gray-600">
      Processing your payment response from PesaPal...
    </p>
  </div>

  {#if isLoading}
    <!-- Loading State -->
    <div class="bg-white rounded-lg shadow-lg p-8 max-w-md mx-auto text-center">
      <LoadingSpinner size="lg" />
      <h2 class="mt-4 text-xl font-semibold text-gray-900">
        Verifying Payment...
      </h2>
      <p class="mt-2 text-gray-600">
        Please wait while we confirm your payment status with PesaPal.
      </p>
      
      {#if orderTrackingId}
        <div class="mt-4 p-3 bg-gray-50 rounded-lg">
          <p class="text-sm text-gray-600">Order ID:</p>
          <code class="text-sm font-mono text-gray-800">{orderTrackingId}</code>
        </div>
      {/if}
    </div>

  {:else if error}
    <!-- Error State -->
    <div class="bg-white rounded-lg shadow-lg p-8 max-w-md mx-auto text-center">
      <div class="text-6xl mb-4">❌</div>
      <h2 class="text-xl font-semibold text-gray-900 mb-2">
        Verification Error
      </h2>
      <p class="text-gray-600 mb-6">
        {error}
      </p>
      
      <div class="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          class="flex-1 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          onclick={handleRetry}
        >
          Try Again
        </button>
        <button
          type="button"
          class="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          onclick={handleNewPayment}
        >
          New Payment
        </button>
      </div>
      
      {#if orderTrackingId}
        <button
          type="button"
          class="mt-3 w-full px-4 py-2 text-sm text-primary-600 hover:text-primary-700 focus:outline-none"
          onclick={handleViewStatus}
        >
          Check Status Manually
        </button>
      {/if}
    </div>

  {:else if verification}
    <!-- Payment Status Display -->
    <PaymentStatus
      orderTrackingId={orderTrackingId}
      verification={verification}
      onRetry={handleRetry}
      onNewPayment={handleNewPayment}
    />
    
    <!-- Additional Actions for Callback -->
    <div class="mt-8 text-center">
      <button
        type="button"
        class="inline-flex items-center px-4 py-2 text-sm text-primary-600 hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded-md"
        onclick={handleViewStatus}
      >
        View Full Status Page
        <svg class="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
        </svg>
      </button>
    </div>
  {/if}

  <!-- Callback Information -->
  <div class="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-2xl mx-auto">
    <h3 class="text-lg font-medium text-blue-800 mb-4">About Payment Callbacks</h3>
    <div class="space-y-3 text-sm text-blue-700">
      <div class="flex items-start">
        <span class="text-blue-400 mr-2">•</span>
        <div>
          <strong>Automatic Verification:</strong> This page automatically verifies your payment status when you return from PesaPal.
        </div>
      </div>
      <div class="flex items-start">
        <span class="text-blue-400 mr-2">•</span>
        <div>
          <strong>Real-time Updates:</strong> We poll PesaPal's API to get the most current payment status.
        </div>
      </div>
      <div class="flex items-start">
        <span class="text-blue-400 mr-2">•</span>
        <div>
          <strong>Secure Processing:</strong> All communication with PesaPal is encrypted and secure.
        </div>
      </div>
    </div>
  </div>
</div>
