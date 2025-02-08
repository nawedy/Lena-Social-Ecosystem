<!-- SearchBar.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { debounce } from '$lib/utils';
  import { Icon } from '$lib/components/ui';

  export let value = '';
  export let placeholder = 'Search for products, services, or sellers...';
  export let onSearch: (query: string) => void;
  export let debounceMs = 300;

  const dispatch = createEventDispatcher();
  let inputElement: HTMLInputElement;

  const debouncedSearch = debounce((query: string) => {
    onSearch(query);
    dispatch('search', query);
  }, debounceMs);

  function handleInput(event: Event) {
    const query = (event.target as HTMLInputElement).value;
    value = query;
    debouncedSearch(query);
  }

  function handleClear() {
    value = '';
    onSearch('');
    dispatch('search', '');
    inputElement.focus();
  }

  function handleSubmit(event: Event) {
    event.preventDefault();
    onSearch(value);
    dispatch('search', value);
  }
</script>

<form
  class="relative flex items-center w-full"
  on:submit={handleSubmit}
>
  <div class="relative flex-1">
    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
      <Icon
        name="search"
        class="h-5 w-5 text-muted-foreground"
      />
    </div>
    <input
      bind:this={inputElement}
      type="search"
      class="block w-full pl-10 pr-12 py-2 border border-input bg-background rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      {placeholder}
      bind:value
      on:input={handleInput}
    />
    {#if value}
      <button
        type="button"
        class="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
        on:click={handleClear}
      >
        <Icon
          name="x"
          class="h-5 w-5"
        />
      </button>
    {/if}
  </div>
  <button
    type="submit"
    class="ml-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
  >
    Search
  </button>
</form>

<style>
  /* Hide the default clear button in search inputs */
  input[type="search"]::-webkit-search-decoration,
  input[type="search"]::-webkit-search-cancel-button,
  input[type="search"]::-webkit-search-results-button,
  input[type="search"]::-webkit-search-results-decoration {
    -webkit-appearance: none;
  }
</style> 