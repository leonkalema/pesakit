<script lang="ts">
  import { SAMPLE_PRODUCTS } from '$lib/types.js';
  import type { PaymentFormData } from '$lib/types.js';

  let selectedProduct: any = null;
  let isProcessing = false;
  let paymentStatus = '';
  let showIframe = false;
  let iframeUrl: string | null = null;
  let lastOrderTrackingId: string | null = null;
  let customerInfo = {
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  };

  function selectProduct(product: any) {
    selectedProduct = product;
  }

  async function processPayment() {
    if (!selectedProduct || !customerInfo.email) return;
    
    isProcessing = true;
    paymentStatus = 'Processing payment...';

    try {
      const paymentData = {
        amount: selectedProduct.amount,
        currency: selectedProduct.currency,
        description: selectedProduct.description,
        reference: `ORDER-${Date.now()}`,
        email: customerInfo.email,
        firstName: customerInfo.firstName,
        lastName: customerInfo.lastName,
        phoneNumber: customerInfo.phone.startsWith('+254') ? customerInfo.phone : `+254${customerInfo.phone.replace(/^0/, '')}`,
        callbackUrl: `${window.location.origin}/api/payments/callback`
      };

      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData)
      });

      const result = await response.json();
      
      if (result.success) {
        paymentStatus = `Payment created! Order ID: ${result.orderTrackingId}`;
        lastOrderTrackingId = result.orderTrackingId as string;
        iframeUrl = result.redirectUrl as string;
        showIframe = Boolean(iframeUrl);
      } else {
        paymentStatus = `Payment failed: ${result.error}`;
      }
    } catch (error) {
      paymentStatus = `Error: ${error}`;
    } finally {
      isProcessing = false;
    }
  }

  function resetForm() {
    selectedProduct = null;
    customerInfo = { firstName: '', lastName: '', email: '', phone: '' };
    paymentStatus = '';
  }

  async function pollStatus(orderTrackingId: string) {
    paymentStatus = 'Verifying payment...';
    const maxAttempts = 10;
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < maxAttempts; i++) {
      const res = await fetch(`/api/payments/status?orderTrackingId=${encodeURIComponent(orderTrackingId)}`);
      const data = await res.json();
      if (data.success) {
        const desc = data.paymentStatusDescription as string | null;
        if (desc === 'COMPLETED' || desc === 'FAILED' || desc === 'REVERSED') {
          paymentStatus = `Payment ${desc}. Ref: ${data.merchantReference ?? ''}`.trim();
          return;
        }
        paymentStatus = `Status: ${desc ?? 'PENDING'}...`;
      } else {
        paymentStatus = `Status check error: ${data.error ?? 'unknown'}`;
      }
      await delay(1500);
    }
    paymentStatus = 'Status check timed out. Please check later or refresh.';
  }

  function onMessage(e: MessageEvent) {
    const msg = e?.data as any;
    if (!msg || msg.type !== 'pesapal:callback') return;
    if (msg.orderTrackingId) {
      showIframe = false;
      iframeUrl = null;
      lastOrderTrackingId = msg.orderTrackingId;
      pollStatus(msg.orderTrackingId);
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('message', onMessage);
  }
</script>

<div class="animate-fade-in">
  <!-- Hero Section -->
  <div class="text-center mb-12">
    <h1 class="text-4xl font-bold text-gray-900 mb-4">
      PesaKit Svelte Demo
    </h1>
    <p class="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
      Experience seamless PesaPal integration with our production-ready Svelte components. 
      Choose a plan below to see the complete payment flow in action.
    </p>
    <div class="flex items-center justify-center space-x-2 text-sm text-gray-500">
      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        ✓ Production Ready
      </span>
      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        ✓ TypeScript
      </span>
      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
        ✓ Tailwind CSS
      </span>
    </div>

  {#if showIframe && iframeUrl}
    <!-- Payment Iframe Modal -->
    <div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl w-[95vw] h-[90vh] max-w-5xl relative">
        <button
          class="absolute top-3 right-3 px-3 py-1 rounded bg-gray-800 text-white text-sm hover:bg-gray-700"
          on:click={() => { showIframe = false; iframeUrl = null; }}
          aria-label="Close payment iframe"
        >
          Close
        </button>
        <iframe
          title="PesaPal Payment"
          src={iframeUrl}
          class="w-full h-full rounded-b-lg"
          allow="payment *; clipboard-read; clipboard-write"
        />
      </div>
    </div>
  {/if}
  </div>

  <!-- Features Grid -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
    <div class="text-center p-6 bg-white rounded-lg shadow-sm border border-gray-200">
      <div class="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-4">
        <span class="text-2xl">🔒</span>
      </div>
      <h3 class="text-lg font-semibold text-gray-900 mb-2">Secure Payments</h3>
      <p class="text-gray-600">
        Enterprise-grade security with encrypted token caching and signature validation.
      </p>
    </div>

    <div class="text-center p-6 bg-white rounded-lg shadow-sm border border-gray-200">
      <div class="w-12 h-12 bg-success-100 rounded-lg flex items-center justify-center mx-auto mb-4">
        <span class="text-2xl">⚡</span>
      </div>
      <h3 class="text-lg font-semibold text-gray-900 mb-2">Fast Integration</h3>
      <p class="text-gray-600">
        Modular components with comprehensive TypeScript support for rapid development.
      </p>
    </div>

    <div class="text-center p-6 bg-white rounded-lg shadow-sm border border-gray-200">
      <div class="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-4">
        <span class="text-2xl">📊</span>
      </div>
      <h3 class="text-lg font-semibold text-gray-900 mb-2">Full Monitoring</h3>
      <p class="text-gray-600">
        Built-in metrics, health checks, and error tracking for production environments.
      </p>
    </div>
  </div>

  <!-- Product Selection & Checkout -->
  <div class="mb-12">
    <div class="text-center mb-8">
      <h2 class="text-3xl font-bold text-gray-900 mb-4">Select Product & Checkout</h2>
      <p class="text-lg text-gray-600">
        Choose a product and complete payment on this page
      </p>
    </div>

    <!-- Product Selection -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {#each SAMPLE_PRODUCTS as product}
        <div class="border rounded-lg p-6 cursor-pointer transition-all {selectedProduct?.name === product.name ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}">
          <button 
            class="w-full text-left"
            on:click={() => selectProduct(product)}
          >
            <h3 class="text-xl font-semibold mb-2">{product.name}</h3>
            <p class="text-gray-600 mb-4">{product.description}</p>
            <div class="text-2xl font-bold text-blue-600">
              {product.currency} {product.amount.toLocaleString()}
            </div>
          </button>
        </div>
      {/each}
    </div>

    <!-- Checkout Form -->
    {#if selectedProduct}
      <div class="max-w-md mx-auto bg-white border rounded-lg p-6">
        <h3 class="text-lg font-semibold mb-4">Complete Your Purchase</h3>
        <div class="mb-4 p-3 bg-gray-50 rounded">
          <div class="font-medium">{selectedProduct.name}</div>
          <div class="text-sm text-gray-600">{selectedProduct.description}</div>
          <div class="font-bold text-lg">{selectedProduct.currency} {selectedProduct.amount.toLocaleString()}</div>
        </div>

        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <input
              bind:value={customerInfo.firstName}
              placeholder="First Name"
              class="border rounded px-3 py-2"
              required
            />
            <input
              bind:value={customerInfo.lastName}
              placeholder="Last Name"
              class="border rounded px-3 py-2"
              required
            />
          </div>
          <input
            bind:value={customerInfo.email}
            type="email"
            placeholder="Email"
            class="w-full border rounded px-3 py-2"
            required
          />
          <input
            bind:value={customerInfo.phone}
            placeholder="Phone"
            class="w-full border rounded px-3 py-2"
          />
          
          <button
            on:click={processPayment}
            disabled={isProcessing || !customerInfo.email}
            class="w-full bg-blue-600 text-white py-3 rounded font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? 'Processing...' : `Pay ${selectedProduct.currency} ${selectedProduct.amount.toLocaleString()}`}
          </button>

          {#if paymentStatus}
            <div class="p-3 rounded {paymentStatus.includes('successful') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
              {paymentStatus}
            </div>
          {/if}

          <button
            on:click={resetForm}
            class="w-full text-gray-600 py-2 hover:text-gray-800"
          >
            Choose Different Product
          </button>
        </div>
      </div>
    {/if}
  </div>

  <!-- Technical Details -->
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
    <h2 class="text-2xl font-bold text-gray-900 mb-6">Technical Implementation</h2>
    
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div>
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Key Features</h3>
        <ul class="space-y-2 text-gray-600">
          <li class="flex items-center">
            <span class="text-green-500 mr-2">✓</span>
            Modular Svelte 5 components (&lt;400 lines each)
          </li>
          <li class="flex items-center">
            <span class="text-green-500 mr-2">✓</span>
            Comprehensive TypeScript types with Zod validation
          </li>
          <li class="flex items-center">
            <span class="text-green-500 mr-2">✓</span>
            Responsive Tailwind CSS styling
          </li>
          <li class="flex items-center">
            <span class="text-green-500 mr-2">✓</span>
            Production-ready error handling
          </li>
          <li class="flex items-center">
            <span class="text-green-500 mr-2">✓</span>
            Real-time payment status polling
          </li>
          <li class="flex items-center">
            <span class="text-green-500 mr-2">✓</span>
            Accessible form components
          </li>
        </ul>
      </div>

      <div>
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Architecture</h3>
        <ul class="space-y-2 text-gray-600">
          <li class="flex items-center">
            <span class="text-blue-500 mr-2">→</span>
            Service-oriented architecture
          </li>
          <li class="flex items-center">
            <span class="text-blue-500 mr-2">→</span>
            Centralized payment service
          </li>
          <li class="flex items-center">
            <span class="text-blue-500 mr-2">→</span>
            Type-safe API communication
          </li>
          <li class="flex items-center">
            <span class="text-blue-500 mr-2">→</span>
            Reusable UI components
          </li>
          <li class="flex items-center">
            <span class="text-blue-500 mr-2">→</span>
            State management with $state runes
          </li>
          <li class="flex items-center">
            <span class="text-blue-500 mr-2">→</span>
            Progressive enhancement
          </li>
        </ul>
      </div>
    </div>

    <div class="mt-8 p-4 bg-gray-50 rounded-lg">
      <h4 class="text-sm font-semibold text-gray-900 mb-2">Quick Start</h4>
      <code class="text-sm text-gray-700 font-mono">
        npm install pesakit zod @tailwindcss/forms
      </code>
    </div>
  </div>
</div>
