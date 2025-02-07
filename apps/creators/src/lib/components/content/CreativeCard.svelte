<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { Button, Badge } from '$lib/components/ui';
  import { user } from '$lib/stores/auth';
  import { ipfsService } from '$lib/services/ipfs';
  import { formatCurrency } from '$lib/utils/currency';

  export let content: {
    id: string;
    title: string;
    description: string;
    media_url: string;
    media_type: 'image' | 'video' | 'audio' | '3d';
    creator: {
      id: string;
      name: string;
      avatar_url: string;
      is_verified: boolean;
    };
    category: string;
    tags: string[];
    likes: number;
    views: number;
    price?: number;
    token_id?: string;
    contract_address?: string;
    is_nft: boolean;
    is_premium: boolean;
    created_at: string;
  };

  let cardElement: HTMLElement;
  let mediaLoaded = false;
  let isExpanded = false;
  let isHovered = false;
  let parallaxX = 0;
  let parallaxY = 0;
  let gradientRotation = 0;

  function handleMouseMove(event: MouseEvent) {
    if (!cardElement) return;
    
    const rect = cardElement.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    
    parallaxX = (x - 0.5) * 20;
    parallaxY = (y - 0.5) * 20;
    gradientRotation = Math.atan2(y - 0.5, x - 0.5) * (180 / Math.PI);
  }

  function handleMouseLeave() {
    parallaxX = 0;
    parallaxY = 0;
    isHovered = false;
  }

  function toggleExpand() {
    isExpanded = !isExpanded;
  }

  let intersectionObserver: IntersectionObserver;

  onMount(() => {
    // Set up intersection observer for view counting
    intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            // Record view after 2 seconds of visibility
            setTimeout(() => {
              if (entry.isIntersecting) {
                recordView();
              }
            }, 2000);
          }
        });
      },
      { threshold: 0.5 }
    );

    if (cardElement) {
      intersectionObserver.observe(cardElement);
    }
  });

  onDestroy(() => {
    if (intersectionObserver) {
      intersectionObserver.disconnect();
    }
  });

  async function recordView() {
    if (!content.id) return;

    try {
      await supabase
        .from('content_views')
        .insert({
          content_id: content.id,
          viewer_id: $user?.id,
          source: 'feed'
        });
    } catch (error) {
      console.error('Failed to record view:', error);
    }
  }
</script>

<div
  class="creative-card relative"
  class:is-expanded={isExpanded}
  class:is-hovered={isHovered}
  bind:this={cardElement}
  on:mouseenter={() => isHovered = true}
  on:mouseleave={handleMouseLeave}
  on:mousemove={handleMouseMove}
  transition:fade
>
  <div
    class="card-inner bg-gradient-to-br from-purple-500 via-pink-500 to-yellow-500"
    style="
      transform: perspective(1000px) 
                rotateX({parallaxY}deg) 
                rotateY({parallaxX}deg);
      background: linear-gradient(
        {gradientRotation}deg,
        theme('colors.purple.500'),
        theme('colors.pink.500'),
        theme('colors.yellow.500')
      );
    "
  >
    <!-- Media Content -->
    <div class="relative aspect-square overflow-hidden">
      {#if !mediaLoaded}
        <div class="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div class="animate-pulse w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500"></div>
        </div>
      {/if}

      {#if content.media_type === 'video'}
        <video
          src={content.media_url}
          class="w-full h-full object-cover"
          poster={content.media_url + '?poster=true'}
          controls={isExpanded}
          loop
          muted={!isExpanded}
          on:loadeddata={() => mediaLoaded = true}
        ></video>
      {:else if content.media_type === 'audio'}
        <div class="absolute inset-0 bg-gradient-to-br from-purple-900 to-pink-900 flex items-center justify-center">
          <audio
            src={content.media_url}
            class="w-full"
            controls={isExpanded}
            on:loadeddata={() => mediaLoaded = true}
          ></audio>
        </div>
      {:else if content.media_type === '3d'}
        <model-viewer
          src={content.media_url}
          auto-rotate
          camera-controls
          class="w-full h-full"
          on:load={() => mediaLoaded = true}
        ></model-viewer>
      {:else}
        <img
          src={content.media_url}
          alt={content.title}
          class="w-full h-full object-cover"
          on:load={() => mediaLoaded = true}
        />
      {/if}

      <!-- Overlay -->
      <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>

      <!-- NFT Badge -->
      {#if content.is_nft}
        <div class="absolute top-4 right-4">
          <Badge variant="gradient" class="animate-pulse">NFT</Badge>
        </div>
      {/if}

      <!-- Premium Badge -->
      {#if content.is_premium}
        <div class="absolute top-4 left-4">
          <Badge variant="premium">Premium</Badge>
        </div>
      {/if}
    </div>

    <!-- Content Info -->
    <div class="p-4 space-y-3">
      <div class="flex items-start justify-between">
        <div>
          <h3 class="text-lg font-bold text-white">
            {content.title}
          </h3>
          <p class="text-sm text-gray-300 line-clamp-2">
            {content.description}
          </p>
        </div>
        {#if content.price}
          <div class="text-right">
            <div class="text-lg font-bold text-yellow-400">
              {formatCurrency(content.price)}
            </div>
            {#if content.is_nft}
              <div class="text-xs text-gray-400">
                Token #{content.token_id}
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Creator Info -->
      <div class="flex items-center space-x-2">
        <img
          src={content.creator.avatar_url}
          alt={content.creator.name}
          class="w-8 h-8 rounded-full ring-2 ring-pink-500"
        />
        <div>
          <div class="flex items-center space-x-1">
            <span class="text-white font-medium">
              {content.creator.name}
            </span>
            {#if content.creator.is_verified}
              <Badge variant="verified" size="sm" />
            {/if}
          </div>
          <div class="text-xs text-gray-400">
            {content.category}
          </div>
        </div>
      </div>

      <!-- Tags -->
      {#if content.tags.length > 0}
        <div class="flex flex-wrap gap-1">
          {#each content.tags as tag}
            <Badge variant="outline" size="sm">
              #{tag}
            </Badge>
          {/each}
        </div>
      {/if}

      <!-- Stats -->
      <div class="flex items-center justify-between text-sm text-gray-400">
        <div class="flex items-center space-x-4">
          <div class="flex items-center space-x-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <span>{content.likes}</span>
          </div>
          <div class="flex items-center space-x-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span>{content.views}</span>
          </div>
        </div>
        <Button
          variant="gradient"
          size="sm"
          on:click={toggleExpand}
        >
          {isExpanded ? 'Less' : 'More'}
        </Button>
      </div>
    </div>
  </div>
</div>

<style lang="postcss">
  .creative-card {
    @apply transition-all duration-300;
  }

  .card-inner {
    @apply rounded-xl overflow-hidden transition-transform duration-300;
  }

  .is-expanded {
    @apply col-span-2 row-span-2;
  }

  .is-hovered .card-inner {
    @apply shadow-2xl;
    box-shadow: 0 0 30px theme('colors.pink.500/30'),
                0 0 60px theme('colors.purple.500/20');
  }

  :global(.badge-gradient) {
    @apply bg-gradient-to-r from-purple-500 via-pink-500 to-yellow-500;
  }

  :global(.badge-premium) {
    @apply bg-gradient-to-r from-yellow-400 to-yellow-600 text-black font-bold;
  }

  :global(.badge-verified) {
    @apply bg-gradient-to-r from-blue-400 to-blue-600;
  }
</style> 