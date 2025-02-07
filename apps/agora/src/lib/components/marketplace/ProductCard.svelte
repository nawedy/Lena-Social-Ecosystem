<!-- ProductCard.svelte -->
<script lang="ts">
  import { Badge, Button } from '$lib/components/ui';
  import { formatCurrency } from '$lib/utils/currency';
  import { ipfsService } from '$lib/services/ipfs';
  import { onMount } from 'svelte';

  export let product: {
    id: string;
    title: string;
    description: string;
    price: number;
    currency: string;
    images: string[];
    seller: {
      username: string;
      avatar_url: string;
      reputation: number;
    };
    categories: string[];
    token_gated?: boolean;
    nft_contract?: string;
    stock?: number;
    views: number;
    created_at: string;
  };

  let mainImage: string;
  let loading = true;
  let error: string | null = null;

  async function loadMainImage() {
    try {
      if (product.images && product.images.length > 0) {
        // If using IPFS
        if (product.images[0].startsWith('ipfs://')) {
          const cid = product.images[0].replace('ipfs://', '');
          mainImage = await ipfsService.getImageUrl(cid);
        } else {
          mainImage = product.images[0];
        }
      }
    } catch (e) {
      error = 'Failed to load image';
      mainImage = '/placeholder-product.png';
    } finally {
      loading = false;
    }
  }

  onMount(loadMainImage);
</script>

<div class="group relative bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-lg transition-shadow overflow-hidden">
  <!-- Image -->
  <div class="aspect-square overflow-hidden bg-gray-100 dark:bg-gray-700">
    {#if loading}
      <div class="w-full h-full flex items-center justify-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    {:else if error}
      <div class="w-full h-full flex items-center justify-center text-gray-400">
        <span class="text-sm">{error}</span>
      </div>
    {:else}
      <img
        src={mainImage}
        alt={product.title}
        class="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-200"
      />
    {/if}
  </div>

  <!-- Content -->
  <div class="p-4">
    <!-- Title and Price -->
    <div class="mb-2">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white truncate">
        {product.title}
      </h3>
      <div class="flex items-center justify-between mt-1">
        <span class="text-lg font-bold text-emerald-600 dark:text-emerald-400">
          {formatCurrency(product.price, product.currency)}
        </span>
        {#if product.stock !== undefined}
          <span class="text-sm text-gray-500 dark:text-gray-400">
            {product.stock} available
          </span>
        {/if}
      </div>
    </div>

    <!-- Categories -->
    {#if product.categories && product.categories.length > 0}
      <div class="flex flex-wrap gap-1 mb-2">
        {#each product.categories as category}
          <Badge variant="secondary" class="text-xs">
            {category}
          </Badge>
        {/each}
      </div>
    {/if}

    <!-- Description -->
    <p class="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-4">
      {product.description}
    </p>

    <!-- Seller Info -->
    <div class="flex items-center justify-between">
      <div class="flex items-center space-x-2">
        <img
          src={product.seller.avatar_url || '/default-avatar.png'}
          alt={product.seller.username}
          class="w-6 h-6 rounded-full"
        />
        <span class="text-sm text-gray-600 dark:text-gray-400">
          {product.seller.username}
        </span>
        {#if product.seller.reputation >= 4.5}
          <Badge variant="success" class="text-xs">
            Trusted Seller
          </Badge>
        {/if}
      </div>
      {#if product.token_gated}
        <Badge variant="primary" class="text-xs">
          Token Gated
        </Badge>
      {/if}
    </div>

    <!-- Action Buttons -->
    <div class="mt-4 flex gap-2">
      <Button
        variant="primary"
        class="flex-1"
        href={`/marketplace/products/${product.id}`}
      >
        View Details
      </Button>
      {#if !product.token_gated}
        <Button
          variant="outline"
          class="flex-1"
          href={`/marketplace/products/${product.id}/purchase`}
        >
          Buy Now
        </Button>
      {/if}
    </div>
  </div>
</div> 