<!-- ImageGallery.svelte -->
<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { fade, scale } from 'svelte/transition';

  export let images: Array<{
    id: string;
    url: string;
    thumbnail?: string;
    alt?: string;
    width?: number;
    height?: number;
  }>;
  export let columns = 3;
  export let gap = 16;
  export let lightbox = true;

  const dispatch = createEventDispatcher<{
    select: { image: typeof images[number] };
  }>();

  let container: HTMLElement;
  let selectedImage: typeof images[number] | null = null;
  let columnHeights: number[] = [];
  let columnElements: HTMLElement[][] = [];

  $: {
    columnHeights = Array(columns).fill(0);
    columnElements = Array(columns).fill(null).map(() => []);
  }

  onMount(() => {
    const resizeObserver = new ResizeObserver(() => {
      if (container) {
        const containerWidth = container.offsetWidth;
        const newColumns = Math.min(
          columns,
          Math.max(1, Math.floor(containerWidth / 300))
        );
        if (newColumns !== columns) {
          columns = newColumns;
        }
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  });

  function getShortestColumn(): number {
    return columnHeights.indexOf(Math.min(...columnHeights));
  }

  function handleImageLoad(event: Event, image: typeof images[number]) {
    const img = event.target as HTMLImageElement;
    const columnIndex = getShortestColumn();
    
    columnElements[columnIndex].push(img.parentElement as HTMLElement);
    columnHeights[columnIndex] += img.height + gap;
    columnHeights = columnHeights;
  }

  function handleImageClick(image: typeof images[number]) {
    if (lightbox) {
      selectedImage = image;
    }
    dispatch('select', { image });
  }

  function handleKeydown(event: KeyboardEvent, image: typeof images[number]) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleImageClick(image);
    }
  }

  function closeLightbox() {
    selectedImage = null;
  }

  function handleLightboxKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      closeLightbox();
    }
  }
</script>

<div
  bind:this={container}
  class="relative grid"
  style="grid-template-columns: repeat({columns}, 1fr); gap: {gap}px;"
>
  {#each images as image (image.id)}
    <button
      class="relative overflow-hidden rounded-lg bg-transparent border-none p-0"
      on:click={() => handleImageClick(image)}
      on:keydown={(e) => handleKeydown(e, image)}
      aria-label={`View ${image.alt || 'image'} in lightbox`}
    >
      <img
        src={image.thumbnail || image.url}
        alt={image.alt || ''}
        class="w-full h-auto transition-transform duration-200 hover:scale-105"
        on:load={(e) => handleImageLoad(e, image)}
        loading="lazy"
      />
    </button>
  {/each}
</div>

{#if lightbox && selectedImage}
  <div
    class="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center"
    transition:fade={{ duration: 200 }}
    role="dialog"
    aria-modal="true"
    aria-label="Image lightbox"
    on:keydown={handleLightboxKeydown}
  >
    <div
      class="relative max-w-[90vw] max-h-[90vh]"
      transition:scale={{ duration: 200 }}
      role="document"
    >
      <img
        src={selectedImage.url}
        alt={selectedImage.alt || ''}
        class="max-w-full max-h-[90vh] object-contain"
      />
      <button
        class="absolute top-4 right-4 text-white hover:text-primary-500 transition-colors"
        on:click={closeLightbox}
        aria-label="Close lightbox"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  </div>
{/if} 