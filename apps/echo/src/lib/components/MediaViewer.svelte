<!-- MediaViewer.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade, slide, scale } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { writable } from 'svelte/store';

  // Props
  export let mediaUrls: string[] = [];
  export let initialIndex = 0;
  export let aspectRatio: 'square' | 'original' | 'video' = 'original';
  export let showThumbnails = true;
  export let autoplay = false;

  // Types
  interface MediaItem {
    url: string;
    type: 'image' | 'video';
    loaded: boolean;
    error: boolean;
  }

  // Stores
  const currentIndex = writable(initialIndex);
  const isFullscreen = writable(false);
  const isPlaying = writable(false);
  const zoomLevel = writable(1);
  const panPosition = writable({ x: 0, y: 0 });

  // State
  let mediaItems: MediaItem[] = [];
  let touchStart = { x: 0, y: 0 };
  let swipeThreshold = 50;
  let containerWidth = 0;
  let containerHeight = 0;
  let autoplayInterval: NodeJS.Timeout;

  // Initialize media items
  $: {
    mediaItems = mediaUrls.map(url => ({
      url,
      type: getMediaType(url),
      loaded: false,
      error: false
    }));
  }

  function getMediaType(url: string): 'image' | 'video' {
    const ext = url.split('.').pop()?.toLowerCase();
    return ['mp4', 'webm', 'ogg'].includes(ext || '') ? 'video' : 'image';
  }

  onMount(() => {
    if (autoplay) startAutoplay();
    document.addEventListener('keydown', handleKeydown);
    window.addEventListener('resize', updateDimensions);
    updateDimensions();
  });

  onDestroy(() => {
    stopAutoplay();
    document.removeEventListener('keydown', handleKeydown);
    window.removeEventListener('resize', updateDimensions);
  });

  function updateDimensions() {
    const container = document.querySelector('.media-container');
    if (container) {
      containerWidth = container.clientWidth;
      containerHeight = container.clientHeight;
    }
  }

  function startAutoplay() {
    if (mediaItems.length > 1) {
      autoplayInterval = setInterval(() => {
        currentIndex.update(i => (i + 1) % mediaItems.length);
      }, 5000);
      isPlaying.set(true);
    }
  }

  function stopAutoplay() {
    if (autoplayInterval) {
      clearInterval(autoplayInterval);
      isPlaying.set(false);
    }
  }

  function toggleFullscreen() {
    isFullscreen.update(v => !v);
    zoomLevel.set(1);
    panPosition.set({ x: 0, y: 0 });
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!$isFullscreen) return;

    switch (event.key) {
      case 'ArrowLeft':
        previousMedia();
        break;
      case 'ArrowRight':
        nextMedia();
        break;
      case 'Escape':
        isFullscreen.set(false);
        break;
    }
  }

  function handleTouchStart(event: TouchEvent) {
    touchStart = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY
    };
  }

  function handleTouchEnd(event: TouchEvent) {
    const touchEnd = {
      x: event.changedTouches[0].clientX,
      y: event.changedTouches[0].clientY
    };

    const deltaX = touchEnd.x - touchStart.x;
    const deltaY = touchEnd.y - touchStart.y;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (Math.abs(deltaX) > swipeThreshold) {
        if (deltaX > 0) {
          previousMedia();
        } else {
          nextMedia();
        }
      }
    }
  }

  function previousMedia() {
    currentIndex.update(i => (i - 1 + mediaItems.length) % mediaItems.length);
  }

  function nextMedia() {
    currentIndex.update(i => (i + 1) % mediaItems.length);
  }

  function handleZoom(event: WheelEvent) {
    if (!$isFullscreen) return;
    event.preventDefault();

    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    zoomLevel.update(z => Math.max(1, Math.min(3, z + delta)));
  }

  function handleMediaLoad(index: number) {
    mediaItems[index].loaded = true;
    mediaItems = mediaItems;
  }

  function handleMediaError(index: number) {
    mediaItems[index].error = true;
    mediaItems = mediaItems;
  }
</script>

<div
  class="media-viewer"
  class:fullscreen={$isFullscreen}
  on:wheel={handleZoom}
>
  <div
    class="media-container"
    class:square={aspectRatio === 'square'}
    on:touchstart={handleTouchStart}
    on:touchend={handleTouchEnd}
  >
    <!-- Loading Indicator -->
    {#if !mediaItems[$currentIndex]?.loaded}
      <div class="loading-indicator" transition:fade>
        <div class="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    {/if}

    <!-- Media Content -->
    {#each mediaItems as item, i}
      {#if i === $currentIndex}
        <div
          class="media-item"
          style="transform: scale({$zoomLevel}) translate({$panPosition.x}px, {$panPosition.y}px)"
          transition:fade
        >
          {#if item.type === 'image'}
            <img
              src={item.url}
              alt="Media content"
              class="media-content"
              on:load={() => handleMediaLoad(i)}
              on:error={() => handleMediaError(i)}
            />
          {:else}
            <video
              src={item.url}
              class="media-content"
              controls={$isFullscreen}
              loop
              on:loadeddata={() => handleMediaLoad(i)}
              on:error={() => handleMediaError(i)}
            >
              <track kind="captions" />
            </video>
          {/if}
        </div>
      {/if}
    {/each}

    <!-- Error State -->
    {#if mediaItems[$currentIndex]?.error}
      <div class="error-message" transition:fade>
        <svg class="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p>Failed to load media</p>
      </div>
    {/if}

    <!-- Navigation Controls -->
    {#if mediaItems.length > 1}
      <button
        class="nav-button prev"
        on:click={previousMedia}
        transition:fade
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <button
        class="nav-button next"
        on:click={nextMedia}
        transition:fade
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    {/if}

    <!-- Controls Overlay -->
    <div class="controls-overlay" transition:fade>
      <button
        class="control-button"
        on:click={toggleFullscreen}
      >
        {#if $isFullscreen}
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        {:else}
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        {/if}
      </button>

      {#if mediaItems.length > 1}
        <button
          class="control-button"
          on:click={() => $isPlaying ? stopAutoplay() : startAutoplay()}
        >
          {#if $isPlaying}
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          {:else}
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          {/if}
        </button>
      {/if}
    </div>
  </div>

  <!-- Thumbnails -->
  {#if showThumbnails && mediaItems.length > 1}
    <div class="thumbnails-container" transition:slide>
      {#each mediaItems as item, i}
        <button
          class="thumbnail"
          class:active={i === $currentIndex}
          on:click={() => currentIndex.set(i)}
        >
          {#if item.type === 'image'}
            <img
              src={item.url}
              alt={`Thumbnail ${i + 1}`}
              loading="lazy"
            />
          {:else}
            <video src={item.url} />
            <div class="video-indicator">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 12V8l3.5 2-3.5 2z" />
              </svg>
            </div>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style lang="postcss">
  .media-viewer {
    @apply relative w-full;
  }

  .media-viewer.fullscreen {
    @apply fixed inset-0 z-50 bg-black;
  }

  .media-container {
    @apply relative w-full overflow-hidden bg-gray-900;
    height: 0;
    padding-bottom: 56.25%; /* 16:9 aspect ratio */
  }

  .media-container.square {
    padding-bottom: 100%;
  }

  .media-item {
    @apply absolute inset-0 flex items-center justify-center transition-transform duration-200;
  }

  .media-content {
    @apply max-w-full max-h-full object-contain;
  }

  .loading-indicator {
    @apply absolute inset-0 flex items-center justify-center bg-black bg-opacity-50;
  }

  .error-message {
    @apply absolute inset-0 flex flex-col items-center justify-center text-red-500;
  }

  .nav-button {
    @apply absolute top-1/2 transform -translate-y-1/2 p-2 bg-black bg-opacity-50
           text-white rounded-full opacity-0 transition-opacity duration-200
           hover:bg-opacity-75 focus:outline-none;
  }

  .media-container:hover .nav-button {
    @apply opacity-100;
  }

  .nav-button.prev {
    @apply left-4;
  }

  .nav-button.next {
    @apply right-4;
  }

  .controls-overlay {
    @apply absolute bottom-4 right-4 flex space-x-2;
  }

  .control-button {
    @apply p-2 bg-black bg-opacity-50 text-white rounded-full
           hover:bg-opacity-75 focus:outline-none transition-colors duration-200;
  }

  .thumbnails-container {
    @apply flex space-x-2 mt-2 overflow-x-auto pb-2;
  }

  .thumbnail {
    @apply relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0
           focus:outline-none focus:ring-2 focus:ring-blue-500;
  }

  .thumbnail.active {
    @apply ring-2 ring-blue-500;
  }

  .thumbnail img,
  .thumbnail video {
    @apply w-full h-full object-cover;
  }

  .video-indicator {
    @apply absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white;
  }
</style> 