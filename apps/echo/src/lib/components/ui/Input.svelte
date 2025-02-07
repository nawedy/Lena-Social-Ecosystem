<!-- Input.svelte -->
<script lang="ts">
  export let type: string = 'text';
  export let label: string | undefined = undefined;
  export let value: string = '';
  export let placeholder: string = '';
  export let error: string | undefined = undefined;
  export let disabled: boolean = false;
  export let required: boolean = false;

  const baseStyles = 'w-full rounded-lg border bg-white dark:bg-gray-900 px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  const normalStyles = 'border-gray-300 dark:border-gray-600 focus:border-primary-500 focus:ring-primary-500';
  const errorStyles = 'border-red-500 focus:border-red-500 focus:ring-red-500';
  const disabledStyles = 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-75';

  $: classes = [
    baseStyles,
    error ? errorStyles : normalStyles,
    disabled && disabledStyles
  ].filter(Boolean).join(' ');
</script>

<div class="input-group">
  {#if label}
    <label
      class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
      for={label}
    >
      {label}
      {#if required}
        <span class="text-red-500">*</span>
      {/if}
    </label>
  {/if}

  <input
    {type}
    id={label}
    class={classes}
    {placeholder}
    bind:value
    {disabled}
    {required}
    {...$$restProps}
    on:input
    on:change
    on:focus
    on:blur
  />

  {#if error}
    <p class="mt-1 text-sm text-red-500">{error}</p>
  {/if}
</div>

<style>
  .input-group {
    position: relative;
  }

  input::placeholder {
    @apply text-gray-400 dark:text-gray-500;
  }
</style> 