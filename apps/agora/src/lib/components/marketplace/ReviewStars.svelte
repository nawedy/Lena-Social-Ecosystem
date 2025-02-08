<!-- ReviewStars.svelte -->
<script lang="ts">
  import { Icon } from '$lib/components/ui';
  import { cn } from '$lib/utils';

  export let rating: number;
  export let maxRating: number = 5;
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let interactive = false;
  export let onChange: ((rating: number) => void) | undefined = undefined;
  export let class: string = '';

  const sizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  $: fullStars = Math.floor(rating);
  $: hasHalfStar = rating % 1 >= 0.5;
  $: emptyStars = maxRating - fullStars - (hasHalfStar ? 1 : 0);

  function handleClick(index: number) {
    if (interactive && onChange) {
      onChange(index + 1);
    }
  }

  function handleHover(index: number) {
    if (interactive) {
      // Add hover effect
    }
  }
</script>

<div
  class={cn(
    'flex items-center space-x-0.5',
    interactive && 'cursor-pointer',
    class
  )}
>
  {#each Array(fullStars) as _, i}
    <Icon
      name="star-filled"
      class={cn(sizes[size], 'text-yellow-400')}
      on:click={() => handleClick(i)}
      on:mouseenter={() => handleHover(i)}
    />
  {/each}

  {#if hasHalfStar}
    <Icon
      name="star-half"
      class={cn(sizes[size], 'text-yellow-400')}
      on:click={() => handleClick(fullStars)}
      on:mouseenter={() => handleHover(fullStars)}
    />
  {/if}

  {#each Array(emptyStars) as _, i}
    <Icon
      name="star"
      class={cn(sizes[size], 'text-muted-foreground')}
      on:click={() => handleClick(fullStars + (hasHalfStar ? 1 : 0) + i)}
      on:mouseenter={() => handleHover(fullStars + (hasHalfStar ? 1 : 0) + i)}
    />
  {/each}
</div>

<style>
  /* Add any component-specific styles here */
</style> 