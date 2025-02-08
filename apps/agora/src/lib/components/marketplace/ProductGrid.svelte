<!-- ProductGrid.svelte -->
<script lang="ts">
  import { ProductCard } from '$lib/components/marketplace';
  import { cn } from '$lib/utils';

  export let products: Array<{
    id: string;
    title: string;
    description: string;
    price: number;
    currency: string;
    image: string;
    seller: {
      id: string;
      name: string;
      avatar: string;
      verified: boolean;
    };
    rating: number;
    reviewCount: number;
    createdAt: string;
    tokenGated?: boolean;
    nft?: boolean;
  }>;
  export let loading = false;
  export let cols: 2 | 3 | 4 = 3;
  export let gap: 'sm' | 'md' | 'lg' = 'md';
  export let class: string = '';

  const colsConfig = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
  };

  const gapConfig = {
    sm: 'gap-4',
    md: 'gap-6',
    lg: 'gap-8'
  };
</script>

<div
  class={cn(
    'grid',
    colsConfig[cols],
    gapConfig[gap],
    class
  )}
>
  {#if loading}
    {#each Array(cols * 2) as _}
      <div class="aspect-[3/4] rounded-lg bg-muted animate-pulse" />
    {/each}
  {:else}
    {#each products as product (product.id)}
      <ProductCard {product} />
    {/each}
  {/if}
</div>

<style>
  /* Add any component-specific styles here */
</style> 