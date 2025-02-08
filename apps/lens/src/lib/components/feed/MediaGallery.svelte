<!-- MediaGallery.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import type { Media } from '$lib/types';
  import VideoPlayer from '../shared/VideoPlayer.svelte';
  import ImageViewer from '../shared/ImageViewer.svelte';
  import { analytics } from '$lib/services/analytics';

  // Props
  export let media: Media[];
  export let aspectRatio: string = '4:5';
  export let autoplay = false;
  export let muted = true;
  export let loop = true;

  // State
  let currentIndex = 0;
  let isFullscreen = false;
  let container: HTMLElement;
  let isLoading = true;
  let loadedMedia = new Set<string>();

  // Computed
  $: currentMedia = media[currentIndex];
  $: isGallery = media.length > 1;
  $: isVideo = currentMedia?.type.startsWith('video/');
  $: aspectRatioStyle = aspectRatio === 'original' 
    ? '' 
    : `aspect-ratio: ${aspectRatio};`;

  onMount(() => {
    // Preload next image in gallery
    if (isGallery && currentIndex < media.length - 1) {
      const nextImage = new Image();
      nextImage.src = media[currentIndex + 1].url;
    }
  });

  function handleMediaLoad(mediaId: string) {
    loadedMedia.add(mediaId);
    loadedMedia = loadedMedia;
    if (loadedMedia.size === 1) {
      isLoading = false;
    }
  }

  function handleNext() {
    if (currentIndex < media.length - 1) {
      currentIndex++;
      // Preload next image
      if (currentIndex < media.length - 1) {
        const nextImage = new Image();
        nextImage.src = media[currentIndex + 1].url;
      }
      trackGalleryNavigation('next');
    }
  }

  function handlePrevious() {
    if (currentIndex > 0) {
      currentIndex--;
      trackGalleryNavigation('previous');
    }
  }

  function handleFullscreen() {
    if (!document.fullscreenElement) {
      container.requestFullscreen();
      isFullscreen = true;
    } else {
      document.exitFullscreen();
      isFullscreen = false;
    }
    trackFullscreenToggle();
  }

  function trackGalleryNavigation(direction: 'next' | 'previous') {
    analytics.trackEvent({
      type: 'gallery_navigation',
      contentId: currentMedia.id,
      contentType: 'media',
      data: {
        direction,
        position: currentIndex,
        totalItems: media.length
      }
    });
  }

  function trackFullscreenToggle() {
    analytics.trackEvent({
      type: 'fullscreen_toggle',
      contentId: currentMedia.id,
      contentType: 'media',
      data: {
        isFullscreen
      }
    });
  }
</script>

<div 
  class="media-gallery"
  class:fullscreen={isFullscreen}
  bind:this={container}
  style={aspectRatioStyle}
>
  {#if isLoading}
    <div class="loading-overlay" transition:fade>
      <svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path 
          stroke-linecap="round" 
          stroke-linejoin="round" 
          stroke-width="2"
          d="M12 6v4m0 4v4m-4-8h8M6 12h12"
        />
      </svg>
    </div>
  {/if}

  <div class="media-container">
    {#if isVideo}
      <VideoPlayer
        src={currentMedia.url}
        poster={currentMedia.thumbnailUrl}
        {autoplay}
        {muted}
        {loop}
        on:load={() => handleMediaLoad(currentMedia.id)}
      />
    {:else}
      <ImageViewer
        src={currentMedia.url}
        alt={currentMedia.metadata?.alt || ''}
        on:load={() => handleMediaLoad(currentMedia.id)}
      />
    {/if}
  </div>

  {#if isGallery}
    <div class="gallery-controls">
      <button
        class="nav-button prev"
        disabled={currentIndex === 0}
        on:click={handlePrevious}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2"
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>

      <button
        class="nav-button next"
        disabled={currentIndex === media.length - 1}
        on:click={handleNext}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2"
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>

      <div class="gallery-indicators">
        {#each media as _, index}
          <button
            class="indicator"
            class:active={index === currentIndex}
            on:click={() => currentIndex = index}
          />
        {/each}
      </div>
    </div>
  {/if}

  <button
    class="fullscreen-button"
    on:click={handleFullscreen}
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      {#if isFullscreen}
        <path 
          stroke-linecap="round" 
          stroke-linejoin="round" 
          stroke-width="2"
          d="M4 14h6m0 0v6m0-6L3 21m17-7h-6m0 0v6m0-6l7 7M4 10h6m0 0V4m0 6L3 3m17 7h-6m0 0V4m0 6l7-7"
        />
      {:else}
        <path 
          stroke-linecap="round" 
          stroke-linejoin="round" 
          stroke-width="2"
          d="M4 8V4m0 0h4M4 4l5 5m11-5v4m0-4h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
        />
      {/if}
    </svg>
  </button>
</div>

<style lang="postcss">
  .media-gallery {
    position: relative;
    width: 100%;
    background: black;
    overflow: hidden;

    &.fullscreen {
      position: fixed;
      inset: 0;
      z-index: 9999;
    }
  }

  .loading-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1;

    .spinner {
      width: 40px;
      height: 40px;
      color: white;
      animation: spin 1s linear infinite;
    }
  }

  .media-container {
    width: 100%;
    height: 100%;
  }

  .gallery-controls {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    opacity: 0;
    transition: opacity 0.2s;

    &:hover {
      opacity: 1;
    }
  }

  .nav-button {
    width: 40px;
    height: 40px;
    background: rgba(0, 0, 0, 0.5);
    border: none;
    border-radius: 50%;
    color: white;
    cursor: pointer;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      background: rgba(0, 0, 0, 0.8);
      transform: scale(1.1);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    svg {
      width: 24px;
      height: 24px;
    }
  }

  .gallery-indicators {
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 8px;
  }

  .indicator {
    width: 8px;
    height: 8px;
    padding: 0;
    background: rgba(255, 255, 255, 0.5);
    border: none;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.8);
    }

    &.active {
      background: white;
      transform: scale(1.2);
    }
  }

  .fullscreen-button {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 40px;
    height: 40px;
    background: rgba(0, 0, 0, 0.5);
    border: none;
    border-radius: 50%;
    color: white;
    cursor: pointer;
    opacity: 0;
    transition: all 0.2s;

    &:hover {
      background: rgba(0, 0, 0, 0.8);
      transform: scale(1.1);
    }

    svg {
      width: 24px;
      height: 24px;
    }
  }

  .media-gallery:hover .fullscreen-button {
    opacity: 1;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style> 