<script lang="ts">
  import { fade } from 'svelte/transition';
  import { cn } from '$lib/utils';

  export let variant: 'default' | 'destructive' | 'success' | 'warning' | 'info' = 'default';
  export let title: string | undefined = undefined;
  export let description: string | undefined = undefined;
  export let dismissible: boolean = false;
  export let icon: boolean = true;
  export let class: string = '';

  const variants = {
    default: 'bg-background text-foreground',
    destructive: 'bg-destructive/15 text-destructive dark:bg-destructive/20',
    success: 'bg-green-500/15 text-green-600 dark:bg-green-500/20 dark:text-green-400',
    warning: 'bg-yellow-500/15 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400',
    info: 'bg-blue-500/15 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
  };

  const icons = {
    default: `<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
    destructive: `<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
    success: `<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
    warning: `<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>`,
    info: `<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`
  };

  let visible = true;

  $: classes = cn(
    'relative w-full rounded-lg border p-4',
    variants[variant],
    class
  );

  function dismiss() {
    visible = false;
  }
</script>

{#if visible}
  <div
    class={classes}
    role="alert"
    transition:fade={{ duration: 200 }}
    {...$$restProps}
  >
    <div class="flex items-start gap-4">
      {#if icon}
        <div class="flex-shrink-0">
          {@html icons[variant]}
        </div>
      {/if}

      <div class="flex-1">
        {#if title}
          <h5 class="mb-1 font-medium leading-none tracking-tight">
            {title}
          </h5>
        {/if}
        {#if description}
          <div class="text-sm [&_p]:leading-relaxed">
            {description}
          </div>
        {:else}
          <slot />
        {/if}
      </div>

      {#if dismissible}
        <button
          type="button"
          class="absolute right-4 top-4 rounded-md p-1 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
          <span class="sr-only">Dismiss</span>
        </button>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* Add any component-specific styles here */
</style> 