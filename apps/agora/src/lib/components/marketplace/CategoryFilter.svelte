<!-- CategoryFilter.svelte -->
<script lang="ts">
  import { Badge } from '$lib/components/ui';

  export let categories: string[] = [];
  export let selected: string = 'all';
  export let onChange: (category: string) => void;

  const popularCategories = [
    'Digital Art',
    'Music',
    'Software',
    'Services',
    'Gaming',
    'Education',
    'Web3',
    'Memberships'
  ];

  // Ensure 'All' is always first and popular categories are prioritized
  $: sortedCategories = [
    'all',
    ...popularCategories.filter(c => categories.includes(c)),
    ...categories.filter(c => !popularCategories.includes(c))
  ];
</script>

<div class="flex flex-wrap gap-2">
  {#each sortedCategories as category}
    <button
      class="group"
      on:click={() => onChange(category)}
    >
      <Badge
        variant={selected === category ? 'primary' : 'outline'}
        class="cursor-pointer transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
      >
        {#if category === 'all'}
          All Categories
        {:else}
          {category}
        {/if}
        {#if selected === category}
          <span class="ml-1 text-xs opacity-75">×</span>
        {/if}
      </Badge>
    </button>
  {/each}
</div>

<style>
  button {
    -webkit-tap-highlight-color: transparent;
  }
</style> 