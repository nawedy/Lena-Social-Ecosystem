<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import VideoPlayer from './VideoPlayer.svelte';

  export let items: Array<{
    id: string;
    type: 'image' | 'video';
    url: string;
    thumbnail?: string;
    aspectRatio?: number;
    alt?: string;
  }>;
  export let layout: 'grid' | 'masonry' | 'carousel' = 'grid';
  export let columns = 3;
  export let gap = 4;
  export let lightbox = true;
  export let autoplay = false;

  const dispatch = createEventDispatcher<{
    select: { id: string };
    like: { id: string };
    share: { id: string };
  }>();

  let selectedItem: typeof items[number] | null = null;
  let currentIndex = 0;
  let container: HTMLElement;
  let lightboxVisible = false;

  function handleSelect(item: typeof items[number]) {
    if (lightbox) {
      selectedItem = item;
      currentIndex = items.findIndex(i => i.id === item.id);
      lightboxVisible = true;
    }
    dispatch('select', { id: item.id });
  }

  function handleLike(item: typeof items[number]) {
    if (!item) return;
    dispatch('like', { id: item.id });
  }

  function handleShare(item: typeof items[number]) {
    if (!item) return;
    dispatch('share', { id: item.id });
  }

  function handlePrevious() {
    if (currentIndex > 0) {
      currentIndex--;
      selectedItem = items[currentIndex];
    }
  }

  function handleNext() {
    if (currentIndex < items.length - 1) {
      currentIndex++;
      selectedItem = items[currentIndex];
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!lightboxVisible) return;

    switch (event.key) {
      case 'ArrowLeft':
        handlePrevious();
        break;
      case 'ArrowRight':
        handleNext();
        break;
      case 'Escape':
        lightboxVisible = false;
        break;
    }
  }

  $: gridClasses = [
    'grid gap-4',
    layout === 'grid' && `grid-cols-${columns}`,
    layout === 'masonry' && 'columns-${columns}',
    '$$props.class'
  ].join(' ');

  $: itemClasses = (item: typeof items[number]) => [
    'relative group overflow-hidden rounded-lg bg-black',
    layout === 'grid' && 'aspect-square',
    layout === 'masonry' && 'mb-4',
    layout === 'carousel' && 'flex-shrink-0 w-80'
  ].join(' ');
</script>

<svelte:window on:keydown={handleKeydown} />

<div bind:this={container} class={layout === 'carousel' ? 'flex gap-4 overflow-x-auto' : gridClasses}>
  {#each items as item (item.id)}
    <div class={itemClasses(item)}>
      {#if item.type === 'image'}
        <img
          src={item.thumbnail || item.url}
          alt={item.alt || ''}
          class="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
          loading="lazy"
          on:click={() => handleSelect(item)}
        />
      {:else}
        <VideoPlayer
          src={item.url}
          poster={item.thumbnail}
          platform="short-video"
          {autoplay}
          controls={false}
          class="w-full h-full"
          on:click={() => handleSelect(item)}
        />
      {/if}

      <div
        class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end justify-between p-4"
      >
        <div class="flex gap-2">
          <button
            class="text-white hover:text-primary-400 transition-colors"
            on:click={() => handleLike(item)}
          >
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </button>
          <button
            class="text-white hover:text-primary-400 transition-colors"
            on:click={() => handleShare(item)}
          >
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  {/each}
</div>

{#if lightboxVisible && selectedItem}
  <div
    class="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center"
    transition:fade={{ duration: 200 }}
    on:click={() => (lightboxVisible = false)}
  >
    <div
      class="relative max-w-[90vw] max-h-[90vh]"
      transition:scale={{ duration: 200 }}
      on:click|stopPropagation
    >
      {#if selectedItem.type === 'image'}
        <img
          src={selectedItem.url}
          alt={selectedItem.alt || ''}
          class="max-w-full max-h-[90vh] object-contain"
        />
      {:else}
        <VideoPlayer
          src={selectedItem.url}
          poster={selectedItem.thumbnail}
          platform="short-video"
          controls
          class="max-w-full max-h-[90vh]"
        />
      {/if}

      <div class="absolute top-4 right-4 flex gap-2">
        <button
          class="p-2 text-white hover:text-primary-400 transition-colors rounded-lg hover:bg-white/10"
          on:click={() => selectedItem && handleLike(selectedItem)}
        >
          <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </button>
        <button
          class="p-2 text-white hover:text-primary-400 transition-colors rounded-lg hover:bg-white/10"
          on:click={() => selectedItem && handleShare(selectedItem)}
        >
          <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z" />
          </svg>
        </button>
        <button
          class="p-2 text-white hover:text-primary-400 transition-colors rounded-lg hover:bg-white/10"
          on:click={() => (lightboxVisible = false)}
        >
          <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      </div>

      {#if currentIndex > 0}
        <button
          class="absolute left-4 top-1/2 -translate-y-1/2 p-2 text-white hover:text-primary-400 transition-colors rounded-lg hover:bg-white/10"
          on:click={handlePrevious}
        >
          <svg class="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
          </svg>
        </button>
      {/if}

      {#if currentIndex < items.length - 1}
        <button
          class="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-white hover:text-primary-400 transition-colors rounded-lg hover:bg-white/10"
          on:click={handleNext}
        >
          <svg class="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
          </svg>
        </button>
      {/if}
    </div>
  </div>
{/if} 