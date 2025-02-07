<!-- Card.svelte -->
<script lang="ts">
  export let variant: 'default' | 'hover' | 'interactive' = 'default';
  export let padding: 'none' | 'sm' | 'md' | 'lg' = 'md';
  export let fullWidth = false;

  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  };

  const variantClasses = {
    default: 'bg-primary-900/20',
    hover: 'bg-primary-900/20 hover:bg-primary-900/30 transition-colors duration-200',
    interactive: 'bg-primary-900/20 hover:bg-primary-900/30 hover:shadow-neon transition-all duration-200 cursor-pointer'
  };

  $: classes = [
    'rounded-lg',
    paddingClasses[padding],
    variantClasses[variant],
    fullWidth && 'w-full',
    '$$props.class'
  ].join(' ');
</script>

<div
  class={classes}
  role={variant === 'interactive' ? 'button' : 'article'}
  on:click
  on:mouseover
  on:mouseenter
  on:mouseleave
  on:focus
  on:blur
  tabindex={variant === 'interactive' ? 0 : undefined}
  {...$$restProps}
>
  <slot />
</div>

<style>
  .shadow-neon {
    box-shadow: 0 0 15px theme('colors.primary.500');
  }
</style> 