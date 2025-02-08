<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { cn } from '$lib/utils';

  export let variant: 'default' | 'destructive' | 'success' | 'warning' | 'info' = 'default';
  export let title: string | undefined = undefined;
  export let description: string | undefined = undefined;
  export let duration: number = 5000;
  export let position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' = 'bottom-right';
  export let class: string = '';

  let visible = true;
  let timeoutId: number;

  const variants = {
    default: 'bg-background text-foreground',
    destructive: 'bg-destructive text-destructive-foreground',
    success: 'bg-green-500 text-white',
    warning: 'bg-yellow-500 text-white',
    info: 'bg-blue-500 text-white'
  };

  const positions = {
    'top-left': 'top-0 left-0',
    'top-right': 'top-0 right-0',
    'bottom-left': 'bottom-0 left-0',
    'bottom-right': 'bottom-0 right-0'
  };

  const icons = {
    default: `<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
    destructive: `<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
    success: `<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
    warning: `<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>`,
    info: `<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`
  };

  $: classes = cn(
    'pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 shadow-lg transition-all',
    variants[variant],
    class
  );

  function startTimer() {
    if (duration > 0) {
      timeoutId = window.setTimeout(() => {
        visible = false;
      }, duration);
    }
  }

  function stopTimer() {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  }

  function dismiss() {
    visible = false;
  }

  onMount(() => {
    startTimer();
  });

  onDestroy(() => {
    stopTimer();
  });
</script>

{#if visible}
  <div
    class="pointer-events-none fixed z-50 flex max-h-screen w-full flex-col-reverse p-4 sm:right-0 sm:flex-col md:max-w-[420px]"
    class:sm:top-0={position.startsWith('top')}
    class:sm:bottom-0={position.startsWith('bottom')}
    class:sm:left-0={position.endsWith('left')}
    class:sm:right-0={position.endsWith('right')}
  >
    <div
      class={classes}
      role="alert"
      on:mouseenter={stopTimer}
      on:mouseleave={startTimer}
      transition:fly={{
        duration: 200,
        x: position.endsWith('left') ? -200 : 200
      }}
    >
      <div class="flex w-full flex-1 items-start gap-4">
        <div class="flex-shrink-0">
          {@html icons[variant]}
        </div>
        <div class="flex-1">
          {#if title}
            <div class="text-sm font-semibold">
              {title}
            </div>
          {/if}
          {#if description}
            <div class="mt-1 text-sm opacity-90">
              {description}
            </div>
          {:else}
            <slot />
          {/if}
        </div>
      </div>
      <button
        type="button"
        class="flex-shrink-0 rounded-md p-1 opacity-50 hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        on:click={dismiss}
      >
        <svg
          class="h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
        <span class="sr-only">Close</span>
      </button>
    </div>
  </div>
{/if}

<style>
  /* Add any component-specific styles here */
</style> 