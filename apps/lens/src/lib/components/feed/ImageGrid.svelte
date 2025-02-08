<!-- ImageGrid.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import type { Post } from '$lib/types';
  import { posts } from '$lib/services/posts';
  import { analytics } from '$lib/services/analytics';
  import { config } from '$lib/services/config';
  import PostCard from './PostCard.svelte';
  import IntersectionObserver from '../shared/IntersectionObserver.svelte';

  // Props
  export let columns = 3;
  export let gap = 16;
  export let loadMoreThreshold = 0.8;

  // State
  let container: HTMLDivElement;
  let items: Post[] = [];
  let columnHeights: number[] = [];
  let isLoading = false;
  let hasMore = true;
  let page = 1;
  let observer: IntersectionObserver | null = null;

  // Computed
  $: columnWidth = container 
    ? (container.offsetWidth - (gap * (columns - 1))) / columns 
    : 0;

  $: gridStyles = `
    display: grid;
    grid-template-columns: repeat(${columns}, 1fr);
    gap: ${gap}px;
  `;

  // Lifecycle
  onMount(async () => {
    // Initial load
    await loadPosts();

    // Setup resize observer
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(recalculateLayout);
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  });

  // Methods
  async function loadPosts() {
    if (isLoading || !hasMore) return;
    isLoading = true;

    try {
      const response = await posts.getFeed({
        page,
        perPage: 30,
        type: 'photo'
      });

      items = [...items, ...response.items];
      hasMore = response.hasMore;
      page++;

      // Track feed view
      analytics.trackEvent({
        type: 'feed_view',
        data: {
          page,
          count: response.items.length
        }
      });

      // Recalculate layout after images load
      await Promise.all(
        response.items.map(item => 
          preloadImages(item.media.map(m => m.url))
        )
      );
      recalculateLayout();
    } catch (error) {
      console.error('Failed to load posts:', error);
    } finally {
      isLoading = false;
    }
  }

  function preloadImages(urls: string[]): Promise<void[]> {
    return Promise.all(
      urls.map(url => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = url;
        });
      })
    );
  }

  function recalculateLayout() {
    if (!container || items.length === 0) return;

    // Reset column heights
    columnHeights = Array(columns).fill(0);

    // Position each item
    items.forEach((item, index) => {
      // Find shortest column
      const minHeight = Math.min(...columnHeights);
      const columnIndex = columnHeights.indexOf(minHeight);

      // Calculate item height based on aspect ratio
      const media = item.media[0];
      const aspectRatio = media.width / media.height;
      const height = columnWidth / aspectRatio;

      // Update column height
      columnHeights[columnIndex] += height + gap;

      // Update item position
      const itemElement = container.children[index] as HTMLElement;
      if (itemElement) {
        itemElement.style.gridColumn = `${columnIndex + 1}`;
        itemElement.style.height = `${height}px`;
      }
    });

    // Update container height
    container.style.height = `${Math.max(...columnHeights)}px`;
  }

  function handleIntersect(entries: IntersectionObserverEntry[]) {
    const [entry] = entries;
    if (entry.isIntersecting) {
      loadPosts();
    }
  }

  function handlePostInteraction(event: CustomEvent) {
    const { type, post } = event.detail;
    dispatch('interaction', { type, post });
  }
</script>

<div 
  class="image-grid"
  bind:this={container}
  style={gridStyles}
>
  {#each items as post (post.id)}
    <div class="grid-item" transition:fade>
      <PostCard 
        {post}
        on:like
        on:comment
        on:save
        on:share
        on:interaction={handlePostInteraction}
      />
    </div>
  {/each}

  {#if isLoading}
    <div class="loading-state" transition:fade>
      <svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path 
          stroke-linecap="round" 
          stroke-linejoin="round" 
          stroke-width="2"
          d="M12 6v4m0 4v4m-4-8h8M6 12h12"
        />
      </svg>
      <span>Loading more posts...</span>
    </div>
  {/if}

  {#if hasMore && !isLoading}
    <IntersectionObserver
      threshold={loadMoreThreshold}
      on:intersect={handleIntersect}
    >
      <div class="load-more-trigger" />
    </IntersectionObserver>
  {/if}
</div>

<style lang="postcss">
  .image-grid {
    position: relative;
    width: 100%;
    min-height: 200px;
  }

  .grid-item {
    position: relative;
    width: 100%;
    overflow: hidden;
    border-radius: 8px;
    background: var(--surface-color-light, #2a2a2a);
    transition: transform 0.2s;

    &:hover {
      transform: translateY(-2px);
    }
  }

  .loading-state {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 24px;
    color: rgba(255, 255, 255, 0.7);
  }

  .spinner {
    width: 24px;
    height: 24px;
    animation: spin 1s linear infinite;
  }

  .load-more-trigger {
    position: absolute;
    bottom: 200px;
    left: 0;
    right: 0;
    height: 1px;
    pointer-events: none;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @media (max-width: 1024px) {
    :global(.image-grid) {
      --columns: 2;
    }
  }

  @media (max-width: 640px) {
    :global(.image-grid) {
      --columns: 1;
    }
  }
</style> 