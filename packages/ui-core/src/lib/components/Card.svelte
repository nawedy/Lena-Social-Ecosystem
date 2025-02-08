<script lang="ts">
  import { cn } from '$lib/utils';

  export let variant: 'default' | 'outline' | 'ghost' = 'default';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let interactive: boolean = false;
  export let hoverable: boolean = false;
  export let class: string = '';

  const variants = {
    default: 'bg-card text-card-foreground shadow-sm',
    outline: 'border border-input bg-background',
    ghost: 'bg-transparent'
  };

  const sizes = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  };

  $: classes = cn(
    'rounded-lg',
    variants[variant],
    sizes[size],
    interactive && 'cursor-pointer transition-all hover:scale-[1.02]',
    hoverable && 'hover:shadow-lg transition-shadow',
    class
  );
</script>

<div
  class={classes}
  on:click
  on:mouseenter
  on:mouseleave
  {...$$restProps}
>
  <slot name="header" />
  <slot />
  <slot name="footer" />
</div>

<style>
  /* Add any component-specific styles here */
</style> 