<!-- Select Component -->
<script lang="ts">
  import { cn } from '$lib/utils';
  import { Icon } from '$lib/components/ui';

  export let value: string;
  export let options: { value: string; label: string }[] = [];
  export let placeholder: string = 'Select an option';
  export let disabled: boolean = false;
  export let class: string = '';
  export let error: string | undefined = undefined;

  $: selected = options.find(option => option.value === value);
</script>

<div class="relative">
  <select
    bind:value
    class={cn(
      'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      error && 'border-red-500 focus:ring-red-500',
      class
    )}
    {disabled}
    {...$$restProps}
  >
    {#if !value}
      <option value="" disabled selected>{placeholder}</option>
    {/if}
    {#each options as option}
      <option value={option.value}>{option.label}</option>
    {/each}
  </select>
  <Icon
    name="chevron-down"
    class="absolute right-3 top-3 h-4 w-4 opacity-50"
  />
</div>
{#if error}
  <p class="mt-1 text-sm text-red-500">{error}</p>
{/if}

<style>
  select {
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
  }
</style> 