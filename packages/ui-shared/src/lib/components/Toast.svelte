<script lang="ts">
  import { fly } from 'svelte/transition';
  import { toasts } from '../stores/toasts';
  import type { Toast } from '../stores/toasts';

  export let toast: Toast;

  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️'
  };

  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    warning: 'bg-yellow-500'
  };
</script>

<div
  class="flex items-center p-4 mb-4 rounded-lg shadow-lg bg-black/90 border-l-4 {colors[toast.type]}"
  role="alert"
  transition:fly={{ x: 100, duration: 300 }}
>
  <span class="mr-3">{icons[toast.type]}</span>
  <p class="text-sm">{toast.message}</p>
  <button
    class="ml-auto text-gray-400 hover:text-white"
    on:click={() => toasts.remove(toast.id)}
  >
    ×
  </button>
</div> 