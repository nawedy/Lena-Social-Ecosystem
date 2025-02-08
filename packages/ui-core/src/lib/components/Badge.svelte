<script lang="ts">
  import { cn } from '$lib/utils';

  export let variant: 'default' | 'secondary' | 'outline' | 'destructive' | 'success' | 'warning' | 'info' = 'default';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let removable: boolean = false;
  export let class: string = '';

  const variants = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/80',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/80',
    success: 'bg-green-500 text-white hover:bg-green-600',
    warning: 'bg-yellow-500 text-white hover:bg-yellow-600',
    info: 'bg-blue-500 text-white hover:bg-blue-600'
  };

  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-0.5',
    lg: 'text-base px-3 py-1'
  };

  $: classes = cn(
    'inline-flex items-center rounded-full font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
    variants[variant],
    sizes[size],
    class
  );

  function handleRemove() {
    if (removable) {
      dispatch('remove');
    }
  }
</script>

<div class={classes} {...$$restProps}>
  <slot />
  {#if removable}
    <button
      type="button"
      class="ml-1 rounded-full hover:bg-black/10 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      on:click={handleRemove}
      aria-label="Remove"
    >
      <svg
        class="h-3 w-3"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
          clip-rule="evenodd"
        />
      </svg>
    </button>
  {/if}
</div>

<style>
  /* Add any component-specific styles here */
</style> 