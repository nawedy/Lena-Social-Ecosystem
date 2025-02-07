<!-- Button Component -->
<script lang="ts">
  import { cn } from '$lib/utils';
  import { Icon } from '$lib/components/ui';

  export let variant: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'success' = 'default';
  export let size: 'default' | 'sm' | 'lg' | 'icon' = 'default';
  export let class: string = '';
  export let disabled: boolean = false;
  export let loading: boolean = false;
  export let icon: string | undefined = undefined;
  export let iconPosition: 'left' | 'right' = 'left';

  const variants = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    link: 'text-primary underline-offset-4 hover:underline',
    success: 'bg-green-500 text-white hover:bg-green-600'
  };

  const sizes = {
    default: 'h-10 px-4 py-2',
    sm: 'h-9 rounded-md px-3',
    lg: 'h-11 rounded-md px-8',
    icon: 'h-10 w-10'
  };

  $: className = cn(
    'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
    variants[variant],
    sizes[size],
    class
  );
</script>

<button
  class={className}
  {disabled}
  {...$$restProps}
  on:click
  on:mouseover
  on:focus
>
  {#if loading}
    <Icon name="loader" class="mr-2 h-4 w-4 animate-spin" />
  {:else if icon && iconPosition === 'left'}
    <Icon name={icon} class="mr-2 h-4 w-4" />
  {/if}
  <slot />
  {#if icon && iconPosition === 'right' && !loading}
    <Icon name={icon} class="ml-2 h-4 w-4" />
  {/if}
</button>

<style>
  :global(.success) {
    @apply bg-green-500 text-white hover:bg-green-600;
  }
</style> 