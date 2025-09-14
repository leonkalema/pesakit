<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import PaymentForm from '$lib/components/PaymentForm.svelte';
  import Notification from '$lib/components/Notification.svelte';
  import { paymentService } from '$lib/services/payment-service.js';
  import type { PaymentFormData, PaymentState, NotificationProps } from '$lib/types.js';

  let paymentState: PaymentState = $state({
    step: 'form',
    formData: {},
    isLoading: false
  });

  let notification: Omit<NotificationProps, 'onClose'> & { show: boolean } = $state({
    type: 'info',
    title: '',
    message: '',
    show: false
  });

  onMount(() => {
    // Load any pre-selected payment data from session storage
    const selectedPayment = sessionStorage.getItem('selectedPayment');
    if (selectedPayment) {
      try {
        const data = JSON.parse(selectedPayment);
        paymentState.formData = {
          ...data,
          firstName: '',
          lastName: '',
          email: '',
          phoneNumber: '+254'
        };
        sessionStorage.removeItem('selectedPayment');
      } catch (error) {
        console.error('Failed to parse selected payment data:', error);
      }
    }
  });

  async function handlePaymentSubmit(formData: PaymentFormData) {
    paymentState.isLoading = true;
    paymentState.step = 'processing';

    try {
      const response = await paymentService.createPayment(formData);
      
      if (response.success && response.paymentUrl) {
        paymentState.paymentUrl = response.paymentUrl;
        paymentState.orderTrackingId = paymentService.extractOrderTrackingId(response.paymentUrl);
        paymentState.step = 'redirect';
        
        showNotification('success', 'Payment Created', 'Redirecting to payment gateway...');
        
        // Redirect to payment URL after a short delay
        setTimeout(() => {
          window.location.href = response.paymentUrl!;
        }, 2000);
      } else {
        throw new Error(response.error || 'Failed to create payment');
      }
    } catch (error) {
      paymentState.step = 'form';
      paymentState.error = error instanceof Error ? error.message : 'Payment creation failed';
      
      showNotification('error', 'Payment Failed', paymentState.error);
    } finally {
      paymentState.isLoading = false;
    }
  }

  function handleCancel() {
    goto('/');
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
</script>

<div class="animate-fade-in">
  <!-- Page Header -->
  <div class="text-center mb-8">
    <h1 class="text-3xl font-bold text-gray-900 mb-2">Create Payment</h1>
    <p class="text-gray-600">
      Fill in the details below to create a secure payment with PesaPal
    </p>
  </div>

  <!-- Payment Steps Indicator -->
  <div class="mb-8">
    <div class="flex items-center justify-center space-x-4">
      <div class="flex items-center">
        <div class="w-8 h-8 rounded-full {paymentState.step === 'form' ? 'bg-primary-600 text-white' : paymentState.step === 'processing' || paymentState.step === 'redirect' ? 'bg-success-600 text-white' : 'bg-gray-300 text-gray-600'} flex items-center justify-center text-sm font-medium">
          1
        </div>
        <span class="ml-2 text-sm font-medium {paymentState.step === 'form' ? 'text-primary-600' : paymentState.step === 'processing' || paymentState.step === 'redirect' ? 'text-success-600' : 'text-gray-500'}">
          Payment Details
        </span>
      </div>
      
      <div class="w-16 h-0.5 {paymentState.step === 'processing' || paymentState.step === 'redirect' ? 'bg-success-600' : 'bg-gray-300'}"></div>
      
      <div class="flex items-center">
        <div class="w-8 h-8 rounded-full {paymentState.step === 'processing' ? 'bg-primary-600 text-white' : paymentState.step === 'redirect' ? 'bg-success-600 text-white' : 'bg-gray-300 text-gray-600'} flex items-center justify-center text-sm font-medium">
          2
        </div>
        <span class="ml-2 text-sm font-medium {paymentState.step === 'processing' ? 'text-primary-600' : paymentState.step === 'redirect' ? 'text-success-600' : 'text-gray-500'}">
          Processing
        </span>
      </div>
      
      <div class="w-16 h-0.5 {paymentState.step === 'redirect' ? 'bg-success-600' : 'bg-gray-300'}"></div>
      
      <div class="flex items-center">
        <div class="w-8 h-8 rounded-full {paymentState.step === 'redirect' ? 'bg-primary-600 text-white' : 'bg-gray-300 text-gray-600'} flex items-center justify-center text-sm font-medium">
          3
        </div>
        <span class="ml-2 text-sm font-medium {paymentState.step === 'redirect' ? 'text-primary-600' : 'text-gray-500'}">
          Payment Gateway
        </span>
      </div>
    </div>
  </div>

  <!-- Payment Form -->
  {#if paymentState.step === 'form'}
    <PaymentForm
      initialData={paymentState.formData}
      isLoading={paymentState.isLoading}
      onSubmit={handlePaymentSubmit}
      onCancel={handleCancel}
    />
  {/if}

  <!-- Processing State -->
  {#if paymentState.step === 'processing'}
    <div class="bg-white rounded-lg shadow-lg p-8 max-w-md mx-auto text-center">
      <div class="animate-pulse-slow mb-6">
        <div class="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto">
          <span class="text-3xl">⚡</span>
        </div>
      </div>
      <h2 class="text-xl font-semibold text-gray-900 mb-2">
        Creating Payment...
      </h2>
      <p class="text-gray-600 mb-6">
        Please wait while we set up your secure payment with PesaPal.
      </p>
      <div class="w-full bg-gray-200 rounded-full h-2">
        <div class="bg-primary-600 h-2 rounded-full animate-pulse" style="width: 75%"></div>
      </div>
    </div>
  {/if}

  <!-- Redirect State -->
  {#if paymentState.step === 'redirect'}
    <div class="bg-white rounded-lg shadow-lg p-8 max-w-md mx-auto text-center">
      <div class="text-6xl mb-6">🚀</div>
      <h2 class="text-xl font-semibold text-gray-900 mb-2">
        Redirecting to Payment Gateway
      </h2>
      <p class="text-gray-600 mb-6">
        You will be redirected to PesaPal to complete your payment securely.
      </p>
      
      {#if paymentState.paymentUrl}
        <div class="mb-6">
          <a 
            href={paymentState.paymentUrl}
            class="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            Continue to Payment
            <svg class="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
            </svg>
          </a>
        </div>
      {/if}
      
      <p class="text-xs text-gray-500">
        If you're not redirected automatically, click the button above.
      </p>
    </div>
  {/if}

  <!-- Security Notice -->
  <div class="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
    <div class="flex items-start">
      <div class="flex-shrink-0">
        <span class="text-blue-400 text-xl">🔒</span>
      </div>
      <div class="ml-3">
        <h3 class="text-sm font-medium text-blue-800">
          Secure Payment Processing
        </h3>
        <div class="mt-1 text-sm text-blue-700">
          <p>
            Your payment is processed securely through PesaPal's encrypted gateway. 
            We never store your payment information on our servers.
          </p>
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
