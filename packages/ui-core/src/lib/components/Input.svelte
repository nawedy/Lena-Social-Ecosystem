<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { cn } from '$lib/utils';

  export let type: string = 'text';
  export let value: string = '';
  export let placeholder: string = '';
  export let label: string | undefined = undefined;
  export let error: string | undefined = undefined;
  export let hint: string | undefined = undefined;
  export let disabled: boolean = false;
  export let required: boolean = false;
  export let readonly: boolean = false;
  export let autocomplete: string | undefined = undefined;
  export let pattern: string | undefined = undefined;
  export let minlength: number | undefined = undefined;
  export let maxlength: number | undefined = undefined;
  export let min: number | string | undefined = undefined;
  export let max: number | string | undefined = undefined;
  export let step: number | string | undefined = undefined;
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
    'file:border-0 file:bg-transparent file:text-sm file:font-medium',
    'placeholder:text-muted-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
    error && 'border-destructive focus-visible:ring-destructive',
    sizes[size],
    class
  );

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    value = target.value;
    dispatch('input', event);
  }

  function handleChange(event: Event) {
    dispatch('change', event);
  }

  function handleFocus(event: FocusEvent) {
    dispatch('focus', event);
  }

  function handleBlur(event: FocusEvent) {
    dispatch('blur', event);
  }
</script>

<div class="input-container">
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

  <input
    {type}
    id={label}
    class={classes}
    {placeholder}
    {disabled}
    {required}
    {readonly}
    {autocomplete}
    {pattern}
    {minlength}
    {maxlength}
    {min}
    {max}
    {step}
    value={value}
    on:input={handleInput}
    on:change={handleChange}
    on:focus={handleFocus}
    on:blur={handleBlur}
    aria-invalid={!!error}
    aria-describedby={error ? `${label}-error` : hint ? `${label}-hint` : undefined}
    {...$$restProps}
  />

  {#if error}
    <p
      id={`${label}-error`}
      class="mt-2 text-sm text-destructive"
      role="alert"
    >
      {error}
    </p>
  {:else if hint}
    <p
      id={`${label}-hint`}
      class="mt-2 text-sm text-muted-foreground"
    >
      {hint}
    </p>
  {/if}
</div>

<style>
  .input-container {
    position: relative;
  }

  input[type="number"]::-webkit-inner-spin-button,
  input[type="number"]::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  input[type="number"] {
    -moz-appearance: textfield;
  }

  input[type="search"]::-webkit-search-decoration,
  input[type="search"]::-webkit-search-cancel-button,
  input[type="search"]::-webkit-search-results-button,
  input[type="search"]::-webkit-search-results-decoration {
    -webkit-appearance: none;
  }
</style> 