<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { Button, Badge } from '$lib/components/ui';
  import { user } from '$lib/stores/auth';
  import { ipfsService } from '$lib/services/ipfs';
  import { formatTimeAgo } from '$lib/utils/time';

  export let post: {
    id: string;
    content: string;
    media_urls: string[];
    tags: string[];
    sentiment_score: number;
    trending_score: number;
    is_verified: boolean;
    is_breaking_news: boolean;
    likes: number;
    reposts: number;
    replies: number;
    author: {
      id: string;
      username: string;
      avatar_url: string;
      is_verified: boolean;
    };
    created_at: string;
  };

  let mediaLoaded = false;
  let isHovered = false;
  let isViral = false;
  let viralAnimation: number;

  // Viral animation effect
  $: {
    if (post.trending_score > 100 && !isViral) {
      isViral = true;
      startViralAnimation();
    }
  }

  function startViralAnimation() {
    if (viralAnimation) return;
    
    let intensity = 0;
    const maxIntensity = 3;
    const duration = 1000;
    const startTime = Date.now();

    viralAnimation = window.requestAnimationFrame(function animate() {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;

      if (progress < 1) {
        intensity = Math.sin(progress * Math.PI * 8) * maxIntensity * (1 - progress);
        const transform = `translate(${Math.random() * intensity - intensity/2}px, ${Math.random() * intensity - intensity/2}px)`;
        if (cardElement) {
          cardElement.style.transform = transform;
        }
        viralAnimation = window.requestAnimationFrame(animate);
      } else {
        if (cardElement) {
          cardElement.style.transform = '';
        }
        viralAnimation = 0;
        isViral = false;
      }
    });
  }

  let cardElement: HTMLElement;

  onDestroy(() => {
    if (viralAnimation) {
      window.cancelAnimationFrame(viralAnimation);
    }
  });
</script>

<div
  class="post-card relative"
  class:is-viral={isViral}
  class:is-hovered={isHovered}
  bind:this={cardElement}
  on:mouseenter={() => isHovered = true}
  on:mouseleave={() => isHovered = false}
  transition:fade
>
  <div class="bg-gray-900 rounded-lg overflow-hidden shadow-neon">
    <!-- Author Info -->
    <div class="p-4 flex items-center space-x-3">
      <img
        src={post.author.avatar_url || '/default-avatar.png'}
        alt={post.author.username}
        class="w-10 h-10 rounded-full ring-2 ring-cyberpunk-red"
      />
      <div class="flex-1 min-w-0">
        <div class="flex items-center space-x-2">
          <span class="text-white font-medium truncate">
            @{post.author.username}
          </span>
          {#if post.author.is_verified}
            <Badge variant="glow">Verified</Badge>
          {/if}
        </div>
        <span class="text-gray-400 text-sm">
          {formatTimeAgo(post.created_at)}
        </span>
      </div>
      {#if post.is_breaking_news}
        <Badge variant="error" class="animate-pulse">Breaking</Badge>
      {/if}
    </div>

    <!-- Content -->
    <div class="px-4 pb-3">
      <p class="text-white whitespace-pre-wrap break-words">
        {post.content}
      </p>
    </div>

    <!-- Media -->
    {#if post.media_urls.length > 0}
      <div class="relative aspect-video bg-black">
        {#if !mediaLoaded}
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyberpunk-red"></div>
          </div>
        {/if}
        {#if post.media_urls[0].endsWith('.mp4')}
          <video
            src={post.media_urls[0]}
            class="w-full h-full object-cover"
            controls
            on:loadeddata={() => mediaLoaded = true}
          ></video>
        {:else}
          <img
            src={post.media_urls[0]}
            alt="Post media"
            class="w-full h-full object-cover"
            on:load={() => mediaLoaded = true}
          />
        {/if}
      </div>
    {/if}

    <!-- Tags -->
    {#if post.tags.length > 0}
      <div class="px-4 py-2 flex flex-wrap gap-2">
        {#each post.tags as tag}
          <Badge variant="outline" class="text-xs">
            #{tag}
          </Badge>
        {/each}
      </div>
    {/if}

    <!-- Actions -->
    <div class="px-4 py-3 border-t border-gray-800 flex items-center justify-between">
      <button
        class="flex items-center space-x-2 text-gray-400 hover:text-cyberpunk-red transition-colors"
        on:click
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
        <span>{post.likes}</span>
      </button>

      <button
        class="flex items-center space-x-2 text-gray-400 hover:text-cyberpunk-red transition-colors"
        on:click
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <span>{post.replies}</span>
      </button>

      <button
        class="flex items-center space-x-2 text-gray-400 hover:text-cyberpunk-red transition-colors"
        on:click
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span>{post.reposts}</span>
      </button>

      <button
        class="flex items-center space-x-2 text-gray-400 hover:text-cyberpunk-red transition-colors"
        on:click
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
      </button>
    </div>
  </div>
</div>

<style lang="postcss">
  .post-card {
    @apply transition-all duration-300;
  }

  .shadow-neon {
    box-shadow: 0 0 10px theme('colors.cyberpunk-red.500/20'),
                0 0 20px theme('colors.cyberpunk-red.500/10');
  }

  .is-viral {
    animation: glitch 0.3s infinite;
  }

  .is-hovered {
    transform: translateY(-2px);
    box-shadow: 0 0 20px theme('colors.cyberpunk-red.500/30'),
                0 0 40px theme('colors.cyberpunk-red.500/20');
  }

  @keyframes glitch {
    0% {
      transform: translate(0);
    }
    20% {
      transform: translate(-2px, 2px);
    }
    40% {
      transform: translate(-2px, -2px);
    }
    60% {
      transform: translate(2px, 2px);
    }
    80% {
      transform: translate(2px, -2px);
    }
    100% {
      transform: translate(0);
    }
  }
</style> 