<script lang="ts">
  import type { PaymentCardProps } from '../types.js';
  import { paymentService } from '../services/payment-service.js';

  let { title, description, amount, currency, onSelect }: PaymentCardProps = $props();

  function handleSelect() {
    const reference = paymentService.generateReference('DEMO');
    onSelect({
      amount,
      description: title,
      reference,
      currency,
      callbackUrl: `${window.location.origin}/payment/callback`
    });
  }
</script>

<div class="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
  <div class="p-6">
    <div class="flex items-start justify-between">
      <div class="flex-1">
        <h3 class="text-lg font-semibold text-gray-900 mb-2">
          {title}
        </h3>
        <p class="text-sm text-gray-600 mb-4">
          {description}
        </p>
        <div class="flex items-baseline">
          <span class="text-2xl font-bold text-primary-600">
            {paymentService.formatCurrency(amount, currency)}
          </span>
          <span class="ml-1 text-sm text-gray-500">/{currency}</span>
        </div>
      </div>
    </div>
    
    <button
      type="button"
      class="mt-6 w-full bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors duration-200"
      onclick={handleSelect}
    >
      Select Plan
    </button>
  </div>
</div>
