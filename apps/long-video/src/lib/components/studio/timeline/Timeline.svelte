<!-- Timeline.svelte -->
<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { spring } from 'svelte/motion';
  import type { Chapter } from '$lib/types';
  import { formatTime } from '$lib/utils/video';

  const dispatch = createEventDispatcher();

  // Props
  export let thumbnails: string[] = [];
  export let currentTime = 0;
  export let duration = 0;
  export let inPoint = 0;
  export let outPoint = duration;
  export let chapters: Chapter[] = [];
  export let markers: { time: number; label: string }[] = [];

  // State
  let timelineElement: HTMLElement;
  let isDragging = false;
  let isInPointDragging = false;
  let isOutPointDragging = false;
  let zoom = 1;
  let scrollPosition = 0;
  let containerWidth = 0;
  let timelineWidth = 0;

  // Animated values
  const playhead = spring(0, {
    stiffness: 0.2,
    damping: 0.8
  });

  $: {
    if (!isDragging) {
      playhead.set((currentTime / duration) * timelineWidth);
    }
  }

  onMount(() => {
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  });

  function updateDimensions() {
    if (timelineElement) {
      containerWidth = timelineElement.clientWidth;
      timelineWidth = containerWidth * zoom;
    }
  }

  function handleMouseDown(event: MouseEvent) {
    if (event.button !== 0) return;
    
    isDragging = true;
    updateTimeFromMouse(event);
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }

  function handleMouseMove(event: MouseEvent) {
    if (!isDragging) return;
    updateTimeFromMouse(event);
  }

  function handleMouseUp() {
    isDragging = false;
    isInPointDragging = false;
    isOutPointDragging = false;
    
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }

  function updateTimeFromMouse(event: MouseEvent) {
    if (!timelineElement) return;

    const rect = timelineElement.getBoundingClientRect();
    const x = event.clientX - rect.left + scrollPosition;
    const time = (x / timelineWidth) * duration;
    
    if (isInPointDragging) {
      inPoint = Math.max(0, Math.min(time, outPoint));
      dispatch('inpointchange', { time: inPoint });
    } else if (isOutPointDragging) {
      outPoint = Math.max(inPoint, Math.min(time, duration));
      dispatch('outpointchange', { time: outPoint });
    } else {
      currentTime = Math.max(0, Math.min(time, duration));
      dispatch('timeupdate', { time: currentTime });
    }
  }

  function handleWheel(event: WheelEvent) {
    if (event.ctrlKey || event.metaKey) {
      // Zoom
      event.preventDefault();
      const oldZoom = zoom;
      zoom = Math.max(1, Math.min(10, zoom + event.deltaY * -0.001));
      
      // Adjust scroll to keep the current time position stable
      const timelineRect = timelineElement.getBoundingClientRect();
      const mouseX = event.clientX - timelineRect.left;
      const timelineX = mouseX + scrollPosition;
      const newScrollPosition = (timelineX * (zoom / oldZoom)) - mouseX;
      
      scrollPosition = Math.max(0, Math.min(newScrollPosition, timelineWidth - containerWidth));
      updateDimensions();
    } else {
      // Scroll
      scrollPosition = Math.max(0, Math.min(scrollPosition + event.deltaX, timelineWidth - containerWidth));
    }
  }

  function startInPointDrag(event: MouseEvent) {
    event.stopPropagation();
    isInPointDragging = true;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }

  function startOutPointDrag(event: MouseEvent) {
    event.stopPropagation();
    isOutPointDragging = true;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }
</script>

<div 
  class="timeline"
  bind:this={timelineElement}
  on:mousedown={handleMouseDown}
  on:wheel={handleWheel}
>
  <div 
    class="timeline-content"
    style="
      width: {timelineWidth}px;
      transform: translateX({-scrollPosition}px)
    "
  >
    <!-- Thumbnails -->
    <div class="thumbnail-track">
      {#each thumbnails as thumbnail, i}
        {@const left = (i / thumbnails.length) * 100}
        <img
          src={thumbnail}
          alt="Timeline thumbnail"
          style="left: {left}%"
          class="thumbnail"
        />
      {/each}
    </div>

    <!-- Trim handles -->
    <div 
      class="trim-handle in-point"
      style="left: {(inPoint / duration) * 100}%"
      on:mousedown={startInPointDrag}
    >
      <div class="handle-label">{formatTime(inPoint)}</div>
    </div>

    <div 
      class="trim-handle out-point"
      style="left: {(outPoint / duration) * 100}%"
      on:mousedown={startOutPointDrag}
    >
      <div class="handle-label">{formatTime(outPoint)}</div>
    </div>

    <!-- Trim region -->
    <div 
      class="trim-region"
      style="
        left: {(inPoint / duration) * 100}%;
        width: {((outPoint - inPoint) / duration) * 100}%
      "
    />

    <!-- Chapter markers -->
    {#each chapters as chapter}
      <div 
        class="chapter-marker"
        style="left: {(chapter.startTime / duration) * 100}%"
        title={chapter.title}
      >
        <div class="marker-label">{chapter.title}</div>
      </div>
    {/each}

    <!-- Custom markers -->
    {#each markers as marker}
      <div 
        class="custom-marker"
        style="left: {(marker.time / duration) * 100}%"
        title={marker.label}
      >
        <div class="marker-label">{marker.label}</div>
      </div>
    {/each}

    <!-- Playhead -->
    <div 
      class="playhead"
      style="transform: translateX({$playhead}px)"
    >
      <div class="playhead-line" />
      <div class="playhead-time">{formatTime(currentTime)}</div>
    </div>
  </div>

  <!-- Time ruler -->
  <div class="time-ruler">
    {#each Array(Math.ceil(duration)) as _, i}
      {@const left = (i / duration) * 100}
      {#if i % 5 === 0}
        <div 
          class="ruler-mark major"
          style="left: {left}%"
        >
          <span class="ruler-time">{formatTime(i)}</span>
        </div>
      {:else}
        <div 
          class="ruler-mark minor"
          style="left: {left}%"
        />
      {/if}
    {/each}
  </div>
</div>

<style lang="postcss">
  .timeline {
    position: relative;
    width: 100%;
    height: 100%;
    background: var(--surface-color-dark, #000);
    overflow: hidden;
    user-select: none;
  }

  .timeline-content {
    position: relative;
    height: calc(100% - 24px);
    will-change: transform;
  }

  .thumbnail-track {
    position: relative;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.3);
  }

  .thumbnail {
    position: absolute;
    height: 100%;
    width: auto;
    aspect-ratio: 16/9;
    object-fit: cover;
    opacity: 0.7;
    pointer-events: none;
  }

  .trim-handle {
    position: absolute;
    top: 0;
    width: 4px;
    height: 100%;
    background: var(--primary-color, #00a8ff);
    cursor: ew-resize;
    z-index: 2;

    &.in-point {
      border-right: 1px solid rgba(255, 255, 255, 0.5);
    }

    &.out-point {
      border-left: 1px solid rgba(255, 255, 255, 0.5);
    }
  }

  .handle-label {
    position: absolute;
    top: -24px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--primary-color, #00a8ff);
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
    white-space: nowrap;
  }

  .trim-region {
    position: absolute;
    top: 0;
    height: 100%;
    background: rgba(var(--primary-color-rgb, 0, 168, 255), 0.2);
    pointer-events: none;
  }

  .chapter-marker {
    position: absolute;
    top: 0;
    width: 2px;
    height: 100%;
    background: var(--accent-color, #ffcc00);
    z-index: 1;
  }

  .custom-marker {
    position: absolute;
    top: 0;
    width: 2px;
    height: 100%;
    background: var(--secondary-color, #ff00cc);
    z-index: 1;
  }

  .marker-label {
    position: absolute;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
    white-space: nowrap;
    opacity: 0;
    transition: opacity 0.2s;

    .chapter-marker:hover &,
    .custom-marker:hover & {
      opacity: 1;
    }
  }

  .playhead {
    position: absolute;
    top: 0;
    height: 100%;
    z-index: 3;
    pointer-events: none;
    will-change: transform;
  }

  .playhead-line {
    width: 2px;
    height: 100%;
    background: #ff0000;
    box-shadow: 0 0 4px rgba(255, 0, 0, 0.5);
  }

  .playhead-time {
    position: absolute;
    top: -24px;
    left: 50%;
    transform: translateX(-50%);
    background: #ff0000;
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
    white-space: nowrap;
  }

  .time-ruler {
    position: relative;
    height: 24px;
    background: var(--surface-color-light, #2a2a2a);
    border-top: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  }

  .ruler-mark {
    position: absolute;
    top: 0;
    width: 1px;
    background: rgba(255, 255, 255, 0.3);

    &.major {
      height: 12px;
      background: rgba(255, 255, 255, 0.5);
    }

    &.minor {
      height: 6px;
    }
  }

  .ruler-time {
    position: absolute;
    top: 14px;
    left: 4px;
    font-size: 10px;
    color: rgba(255, 255, 255, 0.7);
    white-space: nowrap;
  }
</style> 