<!-- ImageViewer.svelte -->
<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { spring } from 'svelte/motion';
  import { fade } from 'svelte/transition';

  const dispatch = createEventDispatcher();

  // Props
  export let src: string;
  export let alt: string = '';
  export let maxZoom = 3;
  export let minZoom = 1;
  export let zoomStep = 0.5;
  export let doubleTapZoom = 2;
  export let disableZoom = false;
  export let objectFit: 'contain' | 'cover' = 'contain';

  // State
  let container: HTMLDivElement;
  let image: HTMLImageElement;
  let isLoading = true;
  let isError = false;
  let isDragging = false;
  let lastTapTime = 0;
  let lastTouchDistance = 0;
  let startPoint = { x: 0, y: 0 };
  let imageSize = { width: 0, height: 0 };

  // Springs for smooth animations
  const scale = spring(1, {
    stiffness: 0.2,
    damping: 0.8
  });

  const position = spring({ x: 0, y: 0 }, {
    stiffness: 0.2,
    damping: 0.8
  });

  // Lifecycle
  onMount(() => {
    // Add event listeners for touch gestures
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: false });

    // Add wheel event listener for zoom
    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('wheel', handleWheel);
    };
  });

  // Event handlers
  function handleImageLoad() {
    isLoading = false;
    imageSize = {
      width: image.naturalWidth,
      height: image.naturalHeight
    };
    dispatch('load');
  }

  function handleImageError() {
    isLoading = false;
    isError = true;
    dispatch('error');
  }

  function handleTouchStart(event: TouchEvent) {
    if (disableZoom) return;
    event.preventDefault();

    const touch = event.touches[0];
    startPoint = { x: touch.clientX, y: touch.clientY };
    isDragging = true;

    // Handle double tap
    const now = Date.now();
    if (now - lastTapTime < 300) {
      handleDoubleTap(touch);
    }
    lastTapTime = now;

    // Handle pinch zoom
    if (event.touches.length === 2) {
      const touch2 = event.touches[1];
      lastTouchDistance = Math.hypot(
        touch2.clientX - touch.clientX,
        touch2.clientY - touch.clientY
      );
    }
  }

  function handleTouchMove(event: TouchEvent) {
    if (disableZoom || !isDragging) return;
    event.preventDefault();

    // Handle pinch zoom
    if (event.touches.length === 2) {
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );

      const delta = distance - lastTouchDistance;
      const newScale = Math.min(
        maxZoom,
        Math.max(minZoom, $scale + (delta * 0.01))
      );
      scale.set(newScale);

      lastTouchDistance = distance;
      return;
    }

    // Handle pan
    const touch = event.touches[0];
    const deltaX = touch.clientX - startPoint.x;
    const deltaY = touch.clientY - startPoint.y;

    if ($scale > 1) {
      const bounds = getBounds();
      position.set({
        x: Math.min(bounds.right, Math.max(bounds.left, $position.x + deltaX)),
        y: Math.min(bounds.bottom, Math.max(bounds.top, $position.y + deltaY))
      });
    }

    startPoint = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchEnd() {
    isDragging = false;
  }

  function handleWheel(event: WheelEvent) {
    if (disableZoom) return;
    event.preventDefault();

    const delta = -event.deltaY * 0.01;
    const newScale = Math.min(
      maxZoom,
      Math.max(minZoom, $scale + (delta * zoomStep))
    );
    scale.set(newScale);

    // Adjust position to keep the point under cursor
    if (newScale > 1) {
      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      const deltaScale = newScale / $scale;
      const bounds = getBounds();
      
      position.set({
        x: Math.min(bounds.right, Math.max(bounds.left, 
          $position.x + (x - ($position.x + rect.width / 2)) * (deltaScale - 1)
        )),
        y: Math.min(bounds.bottom, Math.max(bounds.top,
          $position.y + (y - ($position.y + rect.height / 2)) * (deltaScale - 1)
        ))
      });
    }
  }

  function handleDoubleTap(touch: Touch) {
    const newScale = $scale === 1 ? doubleTapZoom : 1;
    scale.set(newScale);

    if (newScale === 1) {
      position.set({ x: 0, y: 0 });
    } else {
      const rect = container.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      
      position.set({
        x: (rect.width / 2 - x) * (newScale - 1),
        y: (rect.height / 2 - y) * (newScale - 1)
      });
    }
  }

  function getBounds() {
    if (!container) return { left: 0, right: 0, top: 0, bottom: 0 };

    const rect = container.getBoundingClientRect();
    const maxX = (rect.width * ($scale - 1)) / 2;
    const maxY = (rect.height * ($scale - 1)) / 2;

    return {
      left: -maxX,
      right: maxX,
      top: -maxY,
      bottom: maxY
    };
  }
</script>

<div 
  class="image-viewer"
  class:loading={isLoading}
  class:error={isError}
  bind:this={container}
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

  {#if isError}
    <div class="error-overlay" transition:fade>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path 
          stroke-linecap="round" 
          stroke-linejoin="round" 
          stroke-width="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <span>Failed to load image</span>
    </div>
  {/if}

  <img
    bind:this={image}
    {src}
    {alt}
    style="
      transform: translate({$position.x}px, {$position.y}px) scale({$scale});
      object-fit: {objectFit};
    "
    on:load={handleImageLoad}
    on:error={handleImageError}
    draggable="false"
  />
</div>

<style lang="postcss">
  .image-viewer {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    touch-action: none;
    user-select: none;
  }

  .loading-overlay,
  .error-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: rgba(0, 0, 0, 0.5);
    color: white;
    z-index: 1;
  }

  .spinner {
    width: 32px;
    height: 32px;
    animation: spin 1s linear infinite;
  }

  .error-overlay {
    svg {
      width: 32px;
      height: 32px;
      color: #ff4444;
    }

    span {
      font-size: 14px;
    }
  }

  img {
    width: 100%;
    height: 100%;
    will-change: transform;
    transition: transform 0.1s linear;
    pointer-events: none;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style> 