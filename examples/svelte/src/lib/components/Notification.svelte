<script lang="ts">
  import type { NotificationProps } from '../types.js';

  let { type, title, message, show, onClose }: NotificationProps = $props();

  const typeStyles = {
    success: {
      container: 'bg-success-50 border-success-200',
      icon: 'text-success-400',
      title: 'text-success-800',
      message: 'text-success-700',
      button: 'text-success-500 hover:text-success-600'
    },
    error: {
      container: 'bg-error-50 border-error-200',
      icon: 'text-error-400',
      title: 'text-error-800',
      message: 'text-error-700',
      button: 'text-error-500 hover:text-error-600'
    },
    warning: {
      container: 'bg-yellow-50 border-yellow-200',
      icon: 'text-yellow-400',
      title: 'text-yellow-800',
      message: 'text-yellow-700',
      button: 'text-yellow-500 hover:text-yellow-600'
    },
    info: {
      container: 'bg-blue-50 border-blue-200',
      icon: 'text-blue-400',
      title: 'text-blue-800',
      message: 'text-blue-700',
      button: 'text-blue-500 hover:text-blue-600'
    }
  };

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  function handleClose() {
    onClose();
  }
</script>

{#if show}
  <div class="fixed top-4 right-4 z-50 max-w-sm w-full animate-slide-up">
    <div class="rounded-lg border p-4 shadow-lg {typeStyles[type].container}">
      <div class="flex">
        <div class="flex-shrink-0">
          <span class="text-xl {typeStyles[type].icon}">
            {icons[type]}
          </span>
        </div>
        <div class="ml-3 flex-1">
          <h3 class="text-sm font-medium {typeStyles[type].title}">
            {title}
          </h3>
          <div class="mt-1 text-sm {typeStyles[type].message}">
            {message}
          </div>
        </div>
        <div class="ml-4 flex-shrink-0">
          <button
            type="button"
            class="inline-flex rounded-md {typeStyles[type].button} focus:outline-none focus:ring-2 focus:ring-offset-2"
            onclick={handleClose}
          >
            <span class="sr-only">Close</span>
            <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
