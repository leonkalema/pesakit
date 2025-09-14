<script lang="ts">
  import { PaymentFormSchema, type PaymentFormData, type ValidationErrors, CURRENCIES } from '../types.js';
  import LoadingSpinner from './LoadingSpinner.svelte';

  interface PaymentFormProps {
    initialData?: Partial<PaymentFormData>;
    isLoading?: boolean;
    onSubmit: (data: PaymentFormData) => void;
    onCancel?: () => void;
  }

  let { initialData = {}, isLoading = false, onSubmit, onCancel }: PaymentFormProps = $props();

  let formData: Partial<PaymentFormData> = $state({
    amount: 0,
    description: '',
    reference: '',
    email: '',
    firstName: '',
    lastName: '',
    phoneNumber: '+254',
    currency: 'KES',
    callbackUrl: '',
    ...initialData
  });

  let errors: ValidationErrors = $state({});
  let touched: Record<string, boolean> = $state({});

  function validateField(field: keyof PaymentFormData, value: any) {
    try {
      const fieldSchema = PaymentFormSchema.shape[field];
      fieldSchema.parse(value);
      
      // Remove error if validation passes
      if (errors[field]) {
        const newErrors = { ...errors };
        delete newErrors[field];
        errors = newErrors;
      }
    } catch (error: any) {
      if (error.errors) {
        errors = {
          ...errors,
          [field]: error.errors.map((e: any) => e.message)
        };
      }
    }
  }

  function handleInputChange(field: keyof PaymentFormData, value: any) {
    formData = { ...formData, [field]: value };
    
    if (touched[field]) {
      validateField(field, value);
    }
  }

  function handleBlur(field: keyof PaymentFormData) {
    touched = { ...touched, [field]: true };
    validateField(field, formData[field]);
  }

  function validateForm(): boolean {
    try {
      PaymentFormSchema.parse(formData);
      errors = {};
      return true;
    } catch (error: any) {
      if (error.errors) {
        const newErrors: ValidationErrors = {};
        error.errors.forEach((err: any) => {
          const field = err.path[0];
          if (!newErrors[field]) {
            newErrors[field] = [];
          }
          newErrors[field].push(err.message);
        });
        errors = newErrors;
      }
      return false;
    }
  }

  function handleSubmit(event: Event) {
    event.preventDefault();
    
    // Mark all fields as touched
    Object.keys(formData).forEach(field => {
      touched = { ...touched, [field]: true };
    });

    if (validateForm()) {
      onSubmit(formData as PaymentFormData);
    }
  }

  function handleCancel() {
    if (onCancel) {
      onCancel();
    }
  }

  function getFieldError(field: string): string | undefined {
    return errors[field]?.[0];
  }

  function hasFieldError(field: string): boolean {
    return touched[field] && !!errors[field]?.length;
  }
</script>

<div class="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
  <div class="mb-6">
    <h2 class="text-2xl font-bold text-gray-900 mb-2">Payment Details</h2>
    <p class="text-gray-600">Please fill in your payment information below.</p>
  </div>

  <form onsubmit={handleSubmit} class="space-y-6">
    <!-- Amount and Currency -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label for="amount" class="block text-sm font-medium text-gray-700 mb-2">
          Amount *
        </label>
        <input
          id="amount"
          type="number"
          step="0.01"
          min="1"
          class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 {hasFieldError('amount') ? 'border-error-500' : ''}"
          bind:value={formData.amount}
          oninput={(e) => handleInputChange('amount', parseFloat(e.currentTarget.value) || 0)}
          onblur={() => handleBlur('amount')}
          disabled={isLoading}
          placeholder="0.00"
        />
        {#if hasFieldError('amount')}
          <p class="mt-1 text-sm text-error-600">{getFieldError('amount')}</p>
        {/if}
      </div>

      <div>
        <label for="currency" class="block text-sm font-medium text-gray-700 mb-2">
          Currency *
        </label>
        <select
          id="currency"
          class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
          bind:value={formData.currency}
          onchange={(e) => handleInputChange('currency', e.currentTarget.value)}
          disabled={isLoading}
        >
          {#each CURRENCIES as currency}
            <option value={currency.value}>{currency.label}</option>
          {/each}
        </select>
      </div>
    </div>

    <!-- Description -->
    <div>
      <label for="description" class="block text-sm font-medium text-gray-700 mb-2">
        Description *
      </label>
      <input
        id="description"
        type="text"
        class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 {hasFieldError('description') ? 'border-error-500' : ''}"
        bind:value={formData.description}
        oninput={(e) => handleInputChange('description', e.currentTarget.value)}
        onblur={() => handleBlur('description')}
        disabled={isLoading}
        placeholder="Payment description"
        maxlength="200"
      />
      {#if hasFieldError('description')}
        <p class="mt-1 text-sm text-error-600">{getFieldError('description')}</p>
      {/if}
    </div>

    <!-- Reference -->
    <div>
      <label for="reference" class="block text-sm font-medium text-gray-700 mb-2">
        Reference *
      </label>
      <input
        id="reference"
        type="text"
        class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 {hasFieldError('reference') ? 'border-error-500' : ''}"
        bind:value={formData.reference}
        oninput={(e) => handleInputChange('reference', e.currentTarget.value)}
        onblur={() => handleBlur('reference')}
        disabled={isLoading}
        placeholder="Unique reference ID"
        maxlength="50"
      />
      {#if hasFieldError('reference')}
        <p class="mt-1 text-sm text-error-600">{getFieldError('reference')}</p>
      {/if}
    </div>

    <!-- Personal Information -->
    <div class="border-t pt-6">
      <h3 class="text-lg font-medium text-gray-900 mb-4">Personal Information</h3>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label for="firstName" class="block text-sm font-medium text-gray-700 mb-2">
            First Name *
          </label>
          <input
            id="firstName"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 {hasFieldError('firstName') ? 'border-error-500' : ''}"
            bind:value={formData.firstName}
            oninput={(e) => handleInputChange('firstName', e.currentTarget.value)}
            onblur={() => handleBlur('firstName')}
            disabled={isLoading}
            placeholder="John"
            maxlength="50"
          />
          {#if hasFieldError('firstName')}
            <p class="mt-1 text-sm text-error-600">{getFieldError('firstName')}</p>
          {/if}
        </div>

        <div>
          <label for="lastName" class="block text-sm font-medium text-gray-700 mb-2">
            Last Name *
          </label>
          <input
            id="lastName"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 {hasFieldError('lastName') ? 'border-error-500' : ''}"
            bind:value={formData.lastName}
            oninput={(e) => handleInputChange('lastName', e.currentTarget.value)}
            onblur={() => handleBlur('lastName')}
            disabled={isLoading}
            placeholder="Doe"
            maxlength="50"
          />
          {#if hasFieldError('lastName')}
            <p class="mt-1 text-sm text-error-600">{getFieldError('lastName')}</p>
          {/if}
        </div>
      </div>
    </div>

    <!-- Contact Information -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label for="email" class="block text-sm font-medium text-gray-700 mb-2">
          Email Address *
        </label>
        <input
          id="email"
          type="email"
          class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 {hasFieldError('email') ? 'border-error-500' : ''}"
          bind:value={formData.email}
          oninput={(e) => handleInputChange('email', e.currentTarget.value)}
          onblur={() => handleBlur('email')}
          disabled={isLoading}
          placeholder="john.doe@example.com"
        />
        {#if hasFieldError('email')}
          <p class="mt-1 text-sm text-error-600">{getFieldError('email')}</p>
        {/if}
      </div>

      <div>
        <label for="phoneNumber" class="block text-sm font-medium text-gray-700 mb-2">
          Phone Number *
        </label>
        <input
          id="phoneNumber"
          type="tel"
          class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 {hasFieldError('phoneNumber') ? 'border-error-500' : ''}"
          bind:value={formData.phoneNumber}
          oninput={(e) => handleInputChange('phoneNumber', e.currentTarget.value)}
          onblur={() => handleBlur('phoneNumber')}
          disabled={isLoading}
          placeholder="+254712345678"
        />
        {#if hasFieldError('phoneNumber')}
          <p class="mt-1 text-sm text-error-600">{getFieldError('phoneNumber')}</p>
        {/if}
      </div>
    </div>

    <!-- Callback URL -->
    <div>
      <label for="callbackUrl" class="block text-sm font-medium text-gray-700 mb-2">
        Callback URL *
      </label>
      <input
        id="callbackUrl"
        type="url"
        class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 {hasFieldError('callbackUrl') ? 'border-error-500' : ''}"
        bind:value={formData.callbackUrl}
        oninput={(e) => handleInputChange('callbackUrl', e.currentTarget.value)}
        onblur={() => handleBlur('callbackUrl')}
        disabled={isLoading}
        placeholder="https://yourapp.com/payment/callback"
      />
      {#if hasFieldError('callbackUrl')}
        <p class="mt-1 text-sm text-error-600">{getFieldError('callbackUrl')}</p>
      {/if}
    </div>

    <!-- Form Actions -->
    <div class="flex flex-col sm:flex-row gap-3 pt-6 border-t">
      {#if onCancel}
        <button
          type="button"
          class="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          onclick={handleCancel}
          disabled={isLoading}
        >
          Cancel
        </button>
      {/if}
      
      <button
        type="submit"
        class="flex-1 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        disabled={isLoading}
      >
        {#if isLoading}
          <LoadingSpinner size="sm" color="white" />
          <span class="ml-2">Processing...</span>
        {:else}
          Create Payment
        {/if}
      </button>
    </div>
  </form>
</div>
