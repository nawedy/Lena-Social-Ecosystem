<!-- Preview.svelte -->
<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { VideoPlayer } from '$lib/components/player';
  import type { VideoMetadata } from '$lib/types';

  const dispatch = createEventDispatcher();

  // Props
  export let ipfsHash: string;
  export let currentTime = 0;
  export let duration = 0;
  export let isPlaying = false;

  // State
  let player: any; // VideoPlayer instance
  let isFullscreen = false;
  let isSeeking = false;

  onMount(() => {
    setupKeyboardShortcuts();
  });

  function setupKeyboardShortcuts() {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case ' ':
          event.preventDefault();
          togglePlayback();
          break;
        case 'j':
          seekBackward();
          break;
        case 'l':
          seekForward();
          break;
        case 'k':
          togglePlayback();
          break;
        case ',':
          if (event.shiftKey) {
            seekPreviousFrame();
          }
          break;
        case '.':
          if (event.shiftKey) {
            seekNextFrame();
          }
          break;
        case 'f':
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }

  function handleTimeUpdate(event: CustomEvent) {
    if (!isSeeking) {
      currentTime = event.detail.currentTime;
      dispatch('timeupdate', { time: currentTime });
    }
  }

  function handleDurationChange(event: CustomEvent) {
    duration = event.detail.duration;
    dispatch('durationchange', { duration });
  }

  function handlePlay() {
    isPlaying = true;
    dispatch('play');
  }

  function handlePause() {
    isPlaying = false;
    dispatch('pause');
  }

  function togglePlayback() {
    if (isPlaying) {
      player?.pause();
    } else {
      player?.play();
    }
  }

  function seekBackward() {
    if (!player) return;
    const newTime = Math.max(0, currentTime - 10);
    player.currentTime = newTime;
    dispatch('timeupdate', { time: newTime });
  }

  function seekForward() {
    if (!player) return;
    const newTime = Math.min(duration, currentTime + 10);
    player.currentTime = newTime;
    dispatch('timeupdate', { time: newTime });
  }

  function seekPreviousFrame() {
    if (!player) return;
    const frameTime = 1 / 30; // Assuming 30fps
    const newTime = Math.max(0, currentTime - frameTime);
    player.currentTime = newTime;
    dispatch('timeupdate', { time: newTime });
  }

  function seekNextFrame() {
    if (!player) return;
    const frameTime = 1 / 30; // Assuming 30fps
    const newTime = Math.min(duration, currentTime + frameTime);
    player.currentTime = newTime;
    dispatch('timeupdate', { time: newTime });
  }

  function toggleFullscreen() {
    if (isFullscreen) {
      document.exitFullscreen();
    } else {
      player?.requestFullscreen();
    }
  }

  $: {
    // Update player time when currentTime prop changes
    if (player && !isSeeking && Math.abs(player.currentTime - currentTime) > 0.1) {
      player.currentTime = currentTime;
    }
  }

  $: {
    // Update player playback state when isPlaying prop changes
    if (player) {
      if (isPlaying && player.paused) {
        player.play();
      } else if (!isPlaying && !player.paused) {
        player.pause();
      }
    }
  }
</script>

<div class="preview" class:fullscreen={isFullscreen}>
  <div class="video-container">
    <VideoPlayer
      bind:this={player}
      {ipfsHash}
      startTime={currentTime}
      on:timeupdate={handleTimeUpdate}
      on:durationchange={handleDurationChange}
      on:play={handlePlay}
      on:pause={handlePause}
      on:fullscreenchange={(e) => isFullscreen = e.detail.fullscreen}
    />
  </div>

  <div class="preview-overlay" class:hidden={isPlaying}>
    <div class="preview-info">
      <div class="preview-controls">
        <button 
          class="control-button large"
          on:click={togglePlayback}
          title={isPlaying ? 'Pause (K)' : 'Play (K)'}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            {#if isPlaying}
              <path 
                stroke-linecap="round" 
                stroke-linejoin="round" 
                stroke-width="2" 
                d="M6 4h4v16H6zM14 4h4v16h-4z"
              />
            {:else}
              <path 
                stroke-linecap="round" 
                stroke-linejoin="round" 
                stroke-width="2" 
                d="M5 3l14 9-14 9V3z"
              />
            {/if}
          </svg>
        </button>

        <div class="secondary-controls">
          <button 
            class="control-button"
            on:click={seekBackward}
            title="Backward 10s (J)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path 
                stroke-linecap="round" 
                stroke-linejoin="round" 
                stroke-width="2" 
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>

          <button 
            class="control-button"
            on:click={seekForward}
            title="Forward 10s (L)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path 
                stroke-linecap="round" 
                stroke-linejoin="round" 
                stroke-width="2" 
                d="M12 8v4l-3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>
        </div>
      </div>

      <div class="preview-shortcuts">
        <div class="shortcut">
          <kbd>Space</kbd> or <kbd>K</kbd>
          <span>Play/Pause</span>
        </div>
        <div class="shortcut">
          <kbd>J</kbd>/<kbd>L</kbd>
          <span>-/+ 10 seconds</span>
        </div>
        <div class="shortcut">
          <kbd>⇧</kbd>+<kbd>,</kbd>/<kbd>.</kbd>
          <span>Previous/Next frame</span>
        </div>
        <div class="shortcut">
          <kbd>F</kbd>
          <span>Fullscreen</span>
        </div>
      </div>
    </div>
  </div>
</div>

<style lang="postcss">
  .preview {
    position: relative;
    width: 100%;
    height: 100%;
    background: #000;
    
    &.fullscreen {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 9999;
    }
  }

  .video-container {
    width: 100%;
    height: 100%;
  }

  .preview-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 1;
    transition: opacity 0.2s;

    &.hidden {
      opacity: 0;
      pointer-events: none;
    }
  }

  .preview-info {
    text-align: center;
    color: white;
  }

  .preview-controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    margin-bottom: 40px;
  }

  .control-button {
    background: transparent;
    border: 2px solid white;
    border-radius: 50%;
    color: white;
    width: 48px;
    height: 48px;
    padding: 10px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.1);
      transform: scale(1.1);
    }

    &.large {
      width: 64px;
      height: 64px;
      padding: 14px;
    }

    svg {
      width: 100%;
      height: 100%;
    }
  }

  .secondary-controls {
    display: flex;
    gap: 20px;
  }

  .preview-shortcuts {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    font-size: 14px;
    opacity: 0.7;
  }

  .shortcut {
    display: flex;
    align-items: center;
    gap: 8px;

    kbd {
      background: rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      padding: 2px 6px;
      font-family: monospace;
    }

    span {
      color: rgba(255, 255, 255, 0.8);
    }
  }
</style> 