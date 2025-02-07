<!-- Button.svelte -->
<script lang="ts">
  export let variant: 'primary' | 'secondary' | 'outline' = 'primary';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let disabled = false;
  export let loading = false;
  export let fullWidth = false;
  export let type: 'button' | 'submit' | 'reset' = 'button';

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg'
  };

  $: classes = [
    'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200',
    sizeClasses[size],
    fullWidth && 'w-full',
    variant === 'primary' && 'bg-gradient-to-r from-primary-500 to-primary-600 text-black hover:from-primary-400 hover:to-primary-500 hover:shadow-neon',
    variant === 'secondary' && 'bg-gradient-to-r from-secondary-500 to-secondary-600 text-black hover:from-secondary-400 hover:to-secondary-500 hover:shadow-neon-secondary',
    variant === 'outline' && 'border-2 border-primary-500 text-primary-500 hover:bg-primary-500/10',
    (disabled || loading) && 'opacity-50 cursor-not-allowed pointer-events-none'
  ].filter(Boolean).join(' ');
</script>

<button
  {type}
  class={classes}
  {disabled}
  on:click
  {...$$restProps}
>
  {#if loading}
    <svg
      class="animate-spin -ml-1 mr-2 h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      />
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  {/if}
  <slot />
</button> 