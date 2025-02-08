<!-- ProductCard.svelte -->
<script lang="ts">
  import { Card } from '$lib/components/ui';
  import { Icon } from '$lib/components/ui';
  import { Badge } from '$lib/components/ui';
  import { PriceDisplay } from '$lib/components/marketplace';
  import { ReviewStars } from '$lib/components/marketplace';
  import { formatRelativeDate } from '$lib/utils';

  export let product: {
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
  };
</script>

<Card
  class="group relative overflow-hidden transition-all hover:shadow-lg"
  interactive
  hoverable
>
  <!-- Product Image -->
  <div class="relative aspect-square overflow-hidden">
    <img
      src={product.image}
      alt={product.title}
      class="h-full w-full object-cover transition-transform group-hover:scale-105"
    />
    
    <!-- Token Gated & NFT Badges -->
    <div class="absolute left-2 top-2 flex gap-1">
      {#if product.tokenGated}
        <Badge variant="secondary">
          <Icon name="lock" class="mr-1 h-3 w-3" />
          Token Gated
        </Badge>
      {/if}
      {#if product.nft}
        <Badge variant="secondary">
          <Icon name="gem" class="mr-1 h-3 w-3" />
          NFT
        </Badge>
      {/if}
    </div>
  </div>

  <!-- Product Info -->
  <div class="p-4">
    <div class="mb-2 flex items-start justify-between gap-4">
      <h3 class="line-clamp-2 text-lg font-semibold">
        {product.title}
      </h3>
      <PriceDisplay
        price={product.price}
        currency={product.currency}
        showIcon
        size="lg"
        class="flex-shrink-0"
      />
    </div>

    <p class="mb-4 line-clamp-2 text-sm text-muted-foreground">
      {product.description}
    </p>

    <!-- Seller Info -->
    <div class="mb-3 flex items-center gap-2">
      <img
        src={product.seller.avatar}
        alt={product.seller.name}
        class="h-6 w-6 rounded-full object-cover"
      />
      <span class="text-sm font-medium">
        {product.seller.name}
      </span>
      {#if product.seller.verified}
        <Icon
          name="badge-check"
          class="h-4 w-4 text-blue-500"
        />
      {/if}
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-between text-sm text-muted-foreground">
      <div class="flex items-center gap-1">
        <ReviewStars
          rating={product.rating}
          size="sm"
        />
        <span>({product.reviewCount})</span>
      </div>
      <time datetime={product.createdAt}>
        {formatRelativeDate(product.createdAt)}
      </time>
    </div>
  </div>
</Card>

<style>
  /* Add any component-specific styles here */
</style> 