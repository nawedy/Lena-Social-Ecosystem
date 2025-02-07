<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { Button, Input, Alert } from '$lib/components/ui';
  import { supabase } from '$lib/supabaseClient';
  import CreativeCard from '../content/CreativeCard.svelte';

  export let category: string | null = null;
  export let creatorId: string | null = null;
  export let searchQuery: string = '';
  export let sortBy: 'trending' | 'latest' | 'popular' = 'trending';

  let content: any[] = [];
  let loading = false;
  let error: string | null = null;
  let hasMore = true;
  let isLoadingMore = false;
  let lastScrollY = 0;
  let parallaxElements: HTMLElement[] = [];
  let gridElement: HTMLElement;

  // Parallax effect on scroll
  function handleScroll() {
    const scrollY = window.scrollY;
    const delta = scrollY - lastScrollY;
    lastScrollY = scrollY;

    // Apply parallax to cards
    parallaxElements.forEach((el, i) => {
      const speed = 1 + (i % 3) * 0.2; // Varying speeds for different cards
      const y = parseFloat(el.style.getPropertyValue('--parallax-y') || '0');
      el.style.setProperty('--parallax-y', `${y - delta * speed}px`);
    });

    // Check if we need to load more content
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 1000) {
      if (!isLoadingMore && hasMore) {
        loadContent({ loadMore: true });
      }
    }
  }

  // Dynamic grid layout
  function updateLayout() {
    if (!gridElement) return;

    const cards = Array.from(gridElement.children) as HTMLElement[];
    const columns = Math.floor(gridElement.offsetWidth / 300); // 300px minimum card width
    const gaps = new Array(columns).fill(0);

    cards.forEach((card) => {
      const minGap = Math.min(...gaps);
      const columnIndex = gaps.indexOf(minGap);
      const x = columnIndex * (100 / columns);
      
      card.style.setProperty('--card-x', `${x}%`);
      card.style.setProperty('--card-y', `${minGap}px`);
      
      gaps[columnIndex] += card.offsetHeight + 20; // 20px gap
    });

    gridElement.style.height = `${Math.max(...gaps)}px`;
  }

  async function loadContent(options: { loadMore?: boolean } = {}) {
    if (loading || (options.loadMore && !hasMore)) return;

    try {
      loading = true;
      error = null;

      let query = supabase
        .from('creative_content')
        .select(`
          *,
          creator:creator_id(
            id,
            name,
            avatar_url,
            is_verified
          )
        `)
        .limit(20);

      if (options.loadMore) {
        const lastItem = content[content.length - 1];
        if (sortBy === 'trending') {
          query = query.lt('trending_score', lastItem.trending_score);
        } else if (sortBy === 'popular') {
          query = query.lt('views', lastItem.views);
        } else {
          query = query.lt('created_at', lastItem.created_at);
        }
      }

      if (category) {
        query = query.eq('category', category);
      }

      if (creatorId) {
        query = query.eq('creator_id', creatorId);
      }

      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,tags.cs.{${searchQuery}}`);
      }

      if (sortBy === 'trending') {
        query = query.order('trending_score', { ascending: false });
      } else if (sortBy === 'popular') {
        query = query.order('views', { ascending: false });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      if (options.loadMore) {
        content = [...content, ...(data || [])];
        hasMore = data?.length === 20;
      } else {
        content = data || [];
        hasMore = data?.length === 20;
        window.scrollTo(0, 0);
      }

      // Update layout after content loads
      setTimeout(updateLayout, 100);
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
      if (options.loadMore) {
        isLoadingMore = false;
      }
    }
  }

  // Reactive statements
  $: {
    if (category || sortBy || searchQuery) {
      loadContent();
    }
  }

  // Lifecycle
  onMount(() => {
    loadContent();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', updateLayout);

    // Update parallax elements after initial render
    setTimeout(() => {
      parallaxElements = Array.from(document.querySelectorAll('.creative-card'));
      updateLayout();
    }, 100);
  });

  onDestroy(() => {
    window.removeEventListener('scroll', handleScroll);
    window.removeEventListener('resize', updateLayout);
  });
</script>

<div class="relative min-h-screen">
  <!-- Loading State -->
  {#if loading && !isLoadingMore}
    <div class="flex justify-center py-12">
      <div class="w-16 h-16 relative">
        <div class="absolute inset-0 rounded-full border-4 border-purple-500 animate-ping"></div>
        <div class="absolute inset-2 rounded-full border-4 border-pink-500 animate-ping" style="animation-delay: 0.2s"></div>
        <div class="absolute inset-4 rounded-full border-4 border-yellow-500 animate-ping" style="animation-delay: 0.4s"></div>
      </div>
    </div>
  {/if}

  <!-- Error State -->
  {#if error}
    <Alert variant="error" title="Error" message={error} class="my-6" />
  {/if}

  <!-- Content Grid -->
  {#if content.length > 0}
    <div
      class="creative-grid"
      bind:this={gridElement}
      transition:fade
    >
      {#each content as item (item.id)}
        <div
          class="creative-card-wrapper absolute w-[calc(100%/var(--columns)-20px)]"
          style="
            transform: translate3d(var(--card-x), var(--card-y), 0) 
                      translateY(var(--parallax-y, 0));
          "
          transition:fade
        >
          <CreativeCard {content} />
        </div>
      {/each}
    </div>
  {:else if !loading}
    <div class="text-center py-12">
      <p class="text-gray-400">No content found</p>
    </div>
  {/if}

  <!-- Loading More Indicator -->
  {#if isLoadingMore}
    <div class="flex justify-center py-8">
      <div class="w-10 h-10 relative">
        <div class="absolute inset-0 rounded-full border-4 border-purple-500/50 animate-ping"></div>
        <div class="absolute inset-1 rounded-full border-4 border-pink-500/50 animate-ping" style="animation-delay: 0.1s"></div>
        <div class="absolute inset-2 rounded-full border-4 border-yellow-500/50 animate-ping" style="animation-delay: 0.2s"></div>
      </div>
    </div>
  {/if}
</div>

<style lang="postcss">
  .creative-grid {
    @apply relative w-full;
    --columns: 3;
  }

  @screen sm {
    .creative-grid {
      --columns: 2;
    }
  }

  @screen md {
    .creative-grid {
      --columns: 3;
    }
  }

  @screen lg {
    .creative-grid {
      --columns: 4;
    }
  }

  .creative-card-wrapper {
    @apply transition-transform duration-300 will-change-transform;
  }

  /* Custom scrollbar */
  :global(body::-webkit-scrollbar) {
    @apply w-2;
  }

  :global(body::-webkit-scrollbar-track) {
    @apply bg-gradient-to-b from-purple-900 to-pink-900;
  }

  :global(body::-webkit-scrollbar-thumb) {
    @apply bg-gradient-to-b from-purple-500 via-pink-500 to-yellow-500 rounded-full;
  }
</style> 