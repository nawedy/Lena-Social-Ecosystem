<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  import { cn } from '$lib/utils';

  export let value: string | string[] = '';
  export let options: { value: string; label: string; disabled?: boolean }[] = [];
  export let placeholder: string = 'Select an option';
  export let label: string | undefined = undefined;
  export let error: string | undefined = undefined;
  export let hint: string | undefined = undefined;
  export let disabled: boolean = false;
  export let required: boolean = false;
  export let multiple: boolean = false;
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let class: string = '';

  const dispatch = createEventDispatcher();

  const sizes = {
    sm: 'h-8 text-sm',
    md: 'h-10 text-base',
    lg: 'h-12 text-lg'
  };

  $: classes = cn(
    'flex w-full rounded-md border bg-background px-3 py-2 ring-offset-background',
    'text-sm placeholder:text-muted-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
    error && 'border-destructive focus-visible:ring-destructive',
    sizes[size],
    class
  );

  function handleChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    if (multiple) {
      const selectedOptions = Array.from(target.selectedOptions).map(option => option.value);
      value = selectedOptions;
    } else {
      value = target.value;
    }
    dispatch('change', event);
  }

  function handleFocus(event: FocusEvent) {
    dispatch('focus', event);
  }

  function handleBlur(event: FocusEvent) {
    dispatch('blur', event);
  }
</script>

<div class="select-container">
  {#if label}
    <label
      class="mb-2 block text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      for={label}
    >
      {label}
      {#if required}
        <span class="text-destructive">*</span>
      {/if}
    </label>
  {/if}

  <div class="relative">
    <select
      id={label}
      class={classes}
      {disabled}
      {required}
      {multiple}
      value={value}
      on:change={handleChange}
      on:focus={handleFocus}
      on:blur={handleBlur}
      aria-invalid={!!error}
      aria-describedby={error ? `${label}-error` : hint ? `${label}-hint` : undefined}
      {...$$restProps}
    >
      {#if !multiple}
        <option value="" disabled selected={!value}>
          {placeholder}
        </option>
      {/if}
      {#each options as option}
        <option
          value={option.value}
          disabled={option.disabled}
          selected={multiple ? value.includes(option.value) : value === option.value}
        >
          {option.label}
        </option>
      {/each}
    </select>

    {#if !multiple}
      <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
        <svg
          class="h-4 w-4 text-muted-foreground"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M6 8l4 4 4-4"
          />
        </svg>
      </div>
    {/if}
  </div>

  {#if error}
    <p
      id={`${label}-error`}
      class="mt-2 text-sm text-destructive"
      role="alert"
      transition:fade
    >
      {error}
    </p>
  {:else if hint}
    <p
      id={`${label}-hint`}
      class="mt-2 text-sm text-muted-foreground"
      transition:fade
    >
      {hint}
    </p>
  {/if}
</div>

<style>
  .select-container {
    position: relative;
  }

  select {
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
  }

  select::-ms-expand {
    display: none;
  }

  select[multiple] {
    padding-right: 0.75rem;
  }

  select[multiple] option {
    padding: 0.5rem;
  }

  /* Dark mode styles */
  :global(.dark) select option {
    background-color: hsl(var(--background));
    color: hsl(var(--foreground));
  }
</style> 