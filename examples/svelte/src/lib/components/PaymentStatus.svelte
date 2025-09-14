<script lang="ts">
  import type { PaymentVerification } from '../types.js';
  import LoadingSpinner from './LoadingSpinner.svelte';
  import { paymentService } from '../services/payment-service.js';

  interface PaymentStatusProps {
    orderTrackingId: string;
    verification?: PaymentVerification;
    isLoading?: boolean;
    onRetry?: () => void;
    onNewPayment?: () => void;
  }

  let { orderTrackingId, verification, isLoading = false, onRetry, onNewPayment }: PaymentStatusProps = $props();

  function getStatusIcon(status: string) {
    switch (status) {
      case 'COMPLETED':
        return '✅';
      case 'FAILED':
        return '❌';
      case 'CANCELLED':
        return '🚫';
      case 'PENDING':
      default:
        return '⏳';
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'COMPLETED':
        return 'text-success-600 bg-success-50 border-success-200';
      case 'FAILED':
        return 'text-error-600 bg-error-50 border-error-200';
      case 'CANCELLED':
        return 'text-gray-600 bg-gray-50 border-gray-200';
      case 'PENDING':
      default:
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    }
  }

  function getStatusMessage(status: string) {
    switch (status) {
      case 'COMPLETED':
        return 'Your payment has been completed successfully!';
      case 'FAILED':
        return 'Your payment could not be processed. Please try again.';
      case 'CANCELLED':
        return 'Your payment was cancelled.';
      case 'PENDING':
      default:
        return 'Your payment is being processed. Please wait...';
    }
  }

  function handleRetry() {
    if (onRetry) {
      onRetry();
    }
  }

  function handleNewPayment() {
    if (onNewPayment) {
      onNewPayment();
    }
  }
</script>

<div class="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
  <div class="text-center">
    {#if isLoading}
      <div class="mb-6">
        <LoadingSpinner size="lg" />
        <h2 class="mt-4 text-xl font-semibold text-gray-900">
          Checking Payment Status...
        </h2>
        <p class="mt-2 text-gray-600">
          Please wait while we verify your payment.
        </p>
      </div>
    {:else if verification}
      <div class="mb-6">
        <div class="text-6xl mb-4">
          {getStatusIcon(verification.status)}
        </div>
        
        <div class="inline-flex items-center px-4 py-2 rounded-full border {getStatusColor(verification.status)} mb-4">
          <span class="text-sm font-medium">
            {verification.status}
          </span>
        </div>
        
        <h2 class="text-xl font-semibold text-gray-900 mb-2">
          Payment Status
        </h2>
        
        <p class="text-gray-600 mb-6">
          {getStatusMessage(verification.status)}
        </p>
      </div>

      <!-- Payment Details -->
      <div class="bg-gray-50 rounded-lg p-4 mb-6">
        <h3 class="text-sm font-medium text-gray-900 mb-3">Payment Details</h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-600">Order ID:</span>
            <span class="font-mono text-gray-900">{orderTrackingId}</span>
          </div>
          
          {#if verification.amount && verification.currency}
            <div class="flex justify-between">
              <span class="text-gray-600">Amount:</span>
              <span class="font-semibold text-gray-900">
                {paymentService.formatCurrency(verification.amount, verification.currency)}
              </span>
            </div>
          {/if}
          
          {#if verification.method}
            <div class="flex justify-between">
              <span class="text-gray-600">Payment Method:</span>
              <span class="text-gray-900">{verification.method}</span>
            </div>
          {/if}
          
          {#if verification.merchantReference}
            <div class="flex justify-between">
              <span class="text-gray-600">Reference:</span>
              <span class="font-mono text-gray-900">{verification.merchantReference}</span>
            </div>
          {/if}
          
          {#if verification.timestamp}
            <div class="flex justify-between">
              <span class="text-gray-600">Timestamp:</span>
              <span class="text-gray-900">
                {new Date(verification.timestamp).toLocaleString()}
              </span>
            </div>
          {/if}
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex flex-col sm:flex-row gap-3">
        {#if verification.status === 'FAILED' && onRetry}
          <button
            type="button"
            class="flex-1 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            onclick={handleRetry}
          >
            Try Again
          </button>
        {/if}
        
        {#if onNewPayment}
          <button
            type="button"
            class="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            onclick={handleNewPayment}
          >
            New Payment
          </button>
        {/if}
        
        {#if verification.status === 'COMPLETED'}
          <button
            type="button"
            class="flex-1 px-4 py-2 bg-success-600 text-white rounded-md hover:bg-success-700 focus:outline-none focus:ring-2 focus:ring-success-500 focus:ring-offset-2"
            onclick={() => window.print()}
          >
            Print Receipt
          </button>
        {/if}
      </div>
    {:else}
      <div class="mb-6">
        <div class="text-6xl mb-4">❓</div>
        <h2 class="text-xl font-semibold text-gray-900 mb-2">
          Unable to Check Status
        </h2>
        <p class="text-gray-600 mb-6">
          We couldn't retrieve the payment status. Please try again.
        </p>
        
        {#if onRetry}
          <button
            type="button"
            class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            onclick={handleRetry}
          >
            Check Status
          </button>
        {/if}
      </div>
    {/if}
  </div>
</div>
