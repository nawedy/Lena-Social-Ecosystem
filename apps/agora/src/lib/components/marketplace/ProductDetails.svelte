<!-- ProductDetails.svelte -->
<script lang="ts">
  import { Card } from '$lib/components/ui';
  import { Icon } from '$lib/components/ui';
  import { Badge } from '$lib/components/ui';
  import { Button } from '$lib/components/ui';
  import { PriceDisplay } from '$lib/components/marketplace';
  import { ReviewStars } from '$lib/components/marketplace';
  import { SellerInfo } from '$lib/components/marketplace';
  import { formatRelativeDate } from '$lib/utils';

  export let product: {
    id: string;
    title: string;
    description: string;
    price: number;
    currency: string;
    images: string[];
    seller: {
      id: string;
      name: string;
      avatar: string;
      bio: string;
      verified: boolean;
      rating: number;
      reviewCount: number;
      salesCount: number;
      joinedAt: string;
      responseTime: string;
      languages: string[];
      location?: string;
    };
    rating: number;
    reviewCount: number;
    createdAt: string;
    tokenGated?: boolean;
    nft?: boolean;
    categories?: {
      id: string;
      name: string;
      slug: string;
    }[];
  };

  let selectedImage = product.images[0];
</script>

<div class="grid gap-6 lg:grid-cols-2">
  <!-- Images -->
  <div class="space-y-4">
    <div class="aspect-square overflow-hidden rounded-lg border">
      <img
        src={selectedImage}
        alt={product.title}
        class="h-full w-full object-cover"
      />
    </div>
    {#if product.images.length > 1}
      <div class="grid grid-cols-4 gap-4">
        {#each product.images as image}
          <button
            class="aspect-square overflow-hidden rounded-lg border transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 {selectedImage === image ? 'border-primary' : ''}"
            on:click={() => selectedImage = image}
          >
            <img
              src={image}
              alt={product.title}
              class="h-full w-full object-cover"
            />
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Info -->
  <div class="space-y-6">
    <div>
      <div class="mb-2 flex items-center gap-2">
        {#if product.tokenGated}
          <Badge variant="secondary">
            <Icon name="lock" class="mr-1 h-4 w-4" />
            Token Gated
          </Badge>
        {/if}
        {#if product.nft}
          <Badge variant="secondary">
            <Icon name="gem" class="mr-1 h-4 w-4" />
            NFT
          </Badge>
        {/if}
      </div>

      <h1 class="text-3xl font-bold">{product.title}</h1>

      <div class="mt-4 flex items-center gap-4">
        <PriceDisplay
          price={product.price}
          currency={product.currency}
          showIcon
          size="lg"
        />
        <div class="flex items-center gap-1">
          <ReviewStars rating={product.rating} />
          <span class="text-sm text-muted-foreground">
            ({product.reviewCount} reviews)
          </span>
        </div>
      </div>
    </div>

    <!-- Categories -->
    {#if product.categories?.length}
      <div class="flex flex-wrap gap-2">
        {#each product.categories as category}
          <Badge variant="outline">
            {category.name}
          </Badge>
        {/each}
      </div>
    {/if}

    <!-- Description -->
    <Card class="p-4">
      <h2 class="mb-2 text-lg font-semibold">Description</h2>
      <p class="whitespace-pre-wrap text-muted-foreground">
        {product.description}
      </p>
    </Card>

    <!-- Seller -->
    <div>
      <h2 class="mb-2 text-lg font-semibold">About the Seller</h2>
      <SellerInfo seller={product.seller} />
    </div>

    <!-- Actions -->
    <div class="flex gap-4">
      <Button variant="primary" size="lg" class="flex-1">
        <Icon name="shopping-cart" class="mr-2 h-5 w-5" />
        Buy Now
      </Button>
      <Button variant="outline" size="lg">
        <Icon name="message-circle" class="mr-2 h-5 w-5" />
        Contact Seller
      </Button>
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-between text-sm text-muted-foreground">
      <time datetime={product.createdAt}>
        Listed {formatRelativeDate(product.createdAt)}
      </time>
      <div class="flex items-center gap-1">
        <Icon name="eye" class="h-4 w-4" />
        <span>24 viewing</span>
      </div>
    </div>
  </div>
</div>

<style>
  /* Add any component-specific styles here */
</style> 