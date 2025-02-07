<script lang="ts">
  import { fade } from 'svelte/transition';

  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let class: string = '';

  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };
</script>

<div
  class="verified-badge {class}"
  class:sm={size === 'sm'}
  class:lg={size === 'lg'}
  title="Verified Profile"
  transition:fade
>
  <svg
    class={sizes[size]}
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path
      fill-rule="evenodd"
      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
      clip-rule="evenodd"
    />
  </svg>
</div>

<style>
  .verified-badge {
    @apply inline-flex items-center justify-center bg-blue-500 text-white rounded-full p-1;
  }

  .verified-badge.sm {
    @apply p-0.5;
  }

  .verified-badge.lg {
    @apply p-1.5;
  }

  .verified-badge:hover {
    @apply bg-blue-600;
  }

  /* Dark mode styles */
  :global(.dark) .verified-badge {
    @apply bg-blue-600;
  }

  :global(.dark) .verified-badge:hover {
    @apply bg-blue-700;
  }
</style> 