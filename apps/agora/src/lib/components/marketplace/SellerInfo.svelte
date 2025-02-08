<!-- SellerInfo.svelte -->
<script lang="ts">
  import { Card } from '$lib/components/ui';
  import { Icon } from '$lib/components/ui';
  import { Badge } from '$lib/components/ui';
  import { ReviewStars } from '$lib/components/marketplace';
  import { formatRelativeDate } from '$lib/utils';

  export let seller: {
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
</script>

<Card class="overflow-hidden">
  <!-- Header -->
  <div class="border-b p-4">
    <div class="flex items-center gap-4">
      <img
        src={seller.avatar}
        alt={seller.name}
        class="h-16 w-16 rounded-full object-cover"
      />
      <div class="flex-1">
        <div class="flex items-center gap-2">
          <h2 class="text-xl font-semibold">{seller.name}</h2>
          {#if seller.verified}
            <Badge variant="success">
              <Icon name="badge-check" class="mr-1 h-4 w-4" />
              Verified
            </Badge>
          {/if}
        </div>
        {#if seller.location}
          <div class="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            <Icon name="map-pin" class="h-4 w-4" />
            <span>{seller.location}</span>
          </div>
        {/if}
      </div>
    </div>
    {#if seller.bio}
      <p class="mt-4 text-sm text-muted-foreground">
        {seller.bio}
      </p>
    {/if}
  </div>

  <!-- Stats -->
  <div class="grid grid-cols-3 divide-x border-b">
    <div class="p-4 text-center">
      <div class="text-2xl font-semibold">{seller.salesCount}</div>
      <div class="text-sm text-muted-foreground">Sales</div>
    </div>
    <div class="p-4 text-center">
      <div class="flex items-center justify-center gap-1">
        <span class="text-2xl font-semibold">{seller.rating.toFixed(1)}</span>
        <ReviewStars rating={seller.rating} size="sm" />
      </div>
      <div class="text-sm text-muted-foreground">
        {seller.reviewCount} reviews
      </div>
    </div>
    <div class="p-4 text-center">
      <div class="text-2xl font-semibold">
        {seller.responseTime}
      </div>
      <div class="text-sm text-muted-foreground">Response Time</div>
    </div>
  </div>

  <!-- Details -->
  <div class="space-y-4 p-4">
    <!-- Languages -->
    <div class="flex items-center gap-2">
      <Icon name="languages" class="h-5 w-5 text-muted-foreground" />
      <div class="flex flex-wrap gap-1">
        {#each seller.languages as language}
          <Badge variant="outline">{language}</Badge>
        {/each}
      </div>
    </div>

    <!-- Member Since -->
    <div class="flex items-center gap-2 text-sm text-muted-foreground">
      <Icon name="calendar" class="h-5 w-5" />
      <span>Member since {formatRelativeDate(seller.joinedAt)}</span>
    </div>
  </div>
</Card>

<style>
  /* Add any component-specific styles here */
</style> 