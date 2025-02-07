<script lang="ts">
  export let type: 'text' | 'password' | 'email' | 'number' | 'search' | 'tel' | 'url' = 'text';
  export let value: string | number = '';
  export let placeholder = '';
  export let label = '';
  export let error = '';
  export let disabled = false;
  export let required = false;
  export let fullWidth = true;
  export let icon: string | null = null;

  let focused = false;
  let inputElement: HTMLInputElement;

  function handleFocus() {
    focused = true;
  }

  function handleBlur() {
    focused = false;
  }

  $: containerClasses = [
    'relative',
    fullWidth ? 'w-full' : 'w-auto',
    '$$props.class'
  ].join(' ');

  $: inputClasses = [
    'w-full bg-black/50 border rounded-lg px-4 py-2 transition-all duration-200',
    'focus:ring-2 focus:outline-none',
    icon ? 'pl-10' : '',
    error
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/50'
      : 'border-primary-900/50 focus:border-primary-500 focus:ring-primary-500/50',
    disabled ? 'opacity-50 cursor-not-allowed' : ''
  ].join(' ');
</script>

<div class={containerClasses}>
  {#if label}
    <label
      for={$$props.id}
      class="block text-sm font-medium mb-1"
    >
      {label}
      {#if required}
        <span class="text-red-500">*</span>
      {/if}
    </label>
  {/if}

  <div class="relative">
    {#if icon}
      <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
        {icon}
      </span>
    {/if}

    <input
      bind:this={inputElement}
      {type}
      bind:value
      {placeholder}
      {disabled}
      {required}
      class={inputClasses}
      on:focus={handleFocus}
      on:blur={handleBlur}
      on:input
      on:change
      {...$$restProps}
    />

    {#if error}
      <p class="mt-1 text-sm text-red-500">{error}</p>
    {/if}
  </div>
</div> 