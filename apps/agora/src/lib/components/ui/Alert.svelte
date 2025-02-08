<!-- Alert.svelte -->
<script lang="ts">
  import { fade } from 'svelte/transition';
  import { Icon } from '$lib/components/ui';
  import { cn } from '$lib/utils';

  export let variant: 'default' | 'destructive' | 'warning' | 'success' | 'info' = 'default';
  export let title: string | undefined = undefined;
  export let dismissible = false;
  export let class: string = '';

  let visible = true;

  const variants = {
    default: 'bg-background text-foreground',
    destructive: 'bg-destructive/15 text-destructive dark:bg-destructive/20',
    warning: 'bg-yellow-500/15 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400',
    success: 'bg-green-500/15 text-green-600 dark:bg-green-500/20 dark:text-green-400',
    info: 'bg-blue-500/15 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
  };

  const icons = {
    default: 'info',
    destructive: 'alert-triangle',
    warning: 'alert-circle',
    success: 'check-circle',
    info: 'info'
  };

  function dismiss() {
    visible = false;
  }
</script>

{#if visible}
  <div
    class={cn(
      'relative w-full rounded-lg border p-4',
      variants[variant],
      class
    )}
    role="alert"
    transition:fade={{ duration: 200 }}
    {...$$restProps}
  >
    <div class="flex items-start gap-4">
      <Icon
        name={icons[variant]}
        class="h-5 w-5 flex-shrink-0"
      />

      <div class="flex-1">
        {#if title}
          <h5 class="mb-1 font-medium leading-none tracking-tight">
            {title}
          </h5>
        {/if}
        <div class="text-sm [&_p]:leading-relaxed">
          <slot />
        </div>
      </div>

      {#if dismissible}
        <button
          type="button"
          class="absolute right-4 top-4 rounded-md p-1 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          on:click={dismiss}
        >
          <Icon
            name="x"
            class="h-4 w-4"
          />
          <span class="sr-only">Dismiss</span>
        </button>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* Add any component-specific styles here */
</style> 