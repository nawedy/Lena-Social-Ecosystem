<!-- Input.svelte -->
<script lang="ts">
  export let type: 'text' | 'email' | 'password' | 'search' | 'number' = 'text';
  export let value: string | number = '';
  export let placeholder = '';
  export let disabled = false;
  export let error = '';
  export let label = '';
  export let id = '';
  export let required = false;

  $: classes = [
    'w-full bg-black/50 border rounded-lg px-4 py-2 transition-all duration-200',
    'focus:outline-none focus:ring-2 focus:ring-primary-500/50',
    error ? 'border-red-500' : 'border-primary-900/50 focus:border-primary-500',
    disabled && 'opacity-50 cursor-not-allowed'
  ].filter(Boolean).join(' ');
</script>

{#if label}
  <label
    for={id}
    class="block text-sm font-medium text-gray-400 mb-1"
  >
    {label}
    {#if required}
      <span class="text-red-500">*</span>
    {/if}
  </label>
{/if}

{#if type === 'text'}
  <input type="text" bind:value {placeholder} {disabled} {required} class={classes} on:input on:change on:focus on:blur {...$$restProps} />
{:else if type === 'email'}
  <input type="email" bind:value {placeholder} {disabled} {required} class={classes} on:input on:change on:focus on:blur {...$$restProps} />
{:else if type === 'password'}
  <input type="password" bind:value {placeholder} {disabled} {required} class={classes} on:input on:change on:focus on:blur {...$$restProps} />
{:else if type === 'search'}
  <input type="search" bind:value {placeholder} {disabled} {required} class={classes} on:input on:change on:focus on:blur {...$$restProps} />
{:else if type === 'number'}
  <input type="number" bind:value {placeholder} {disabled} {required} class={classes} on:input on:change on:focus on:blur {...$$restProps} />
{/if}

{#if error}
  <p class="mt-1 text-sm text-red-500">{error}</p>
{/if} 