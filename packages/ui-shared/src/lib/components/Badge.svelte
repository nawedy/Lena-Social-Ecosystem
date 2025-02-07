<script lang="ts">
  export let variant: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' = 'primary';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let rounded = false;
  export let glow = false;
  export let dot = false;
  export let pulse = false;

  const variantClasses = {
    primary: 'bg-primary-500 text-black',
    secondary: 'bg-gray-700 text-white',
    success: 'bg-green-500 text-white',
    warning: 'bg-yellow-500 text-black',
    error: 'bg-red-500 text-white',
    info: 'bg-blue-500 text-white'
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base'
  };

  const glowColors = {
    primary: 'shadow-primary',
    secondary: 'shadow-gray',
    success: 'shadow-green',
    warning: 'shadow-yellow',
    error: 'shadow-red',
    info: 'shadow-blue'
  };

  $: classes = [
    'inline-flex items-center justify-center font-medium',
    variantClasses[variant],
    sizeClasses[size],
    rounded ? 'rounded-full' : 'rounded',
    glow ? glowColors[variant] : '',
    '$$props.class'
  ].join(' ');
</script>

<div class={classes}>
  {#if dot}
    <span
      class="w-2 h-2 rounded-full mr-1.5 {pulse ? 'animate-pulse' : ''}"
      class:bg-black={variant === 'primary' || variant === 'warning'}
      class:bg-white={variant !== 'primary' && variant !== 'warning'}
    />
  {/if}
  <slot />
</div>

<style>
  .shadow-primary {
    box-shadow: 0 0 15px theme('colors.primary.500');
  }
  .shadow-gray {
    box-shadow: 0 0 15px theme('colors.gray.500');
  }
  .shadow-green {
    box-shadow: 0 0 15px theme('colors.green.500');
  }
  .shadow-yellow {
    box-shadow: 0 0 15px theme('colors.yellow.500');
  }
  .shadow-red {
    box-shadow: 0 0 15px theme('colors.red.500');
  }
  .shadow-blue {
    box-shadow: 0 0 15px theme('colors.blue.500');
  }
</style> 