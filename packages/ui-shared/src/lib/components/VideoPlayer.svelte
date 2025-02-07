<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';

  export let src: string;
  export let poster: string | undefined = undefined;
  export let platform: 'short-video' | 'long-video' = 'short-video';
  export let autoplay = false;
  export let loop = false;
  export let muted = false;
  export let controls = true;
  export let pip = false;
  export let quality: '360p' | '480p' | '720p' | '1080p' | '4k' = '1080p';

  const dispatch = createEventDispatcher<{
    play: void;
    pause: void;
    ended: void;
    timeupdate: { currentTime: number; duration: number };
    qualitychange: { quality: typeof quality };
  }>();

  let video: HTMLVideoElement;
  let showControls = false;
  let isPlaying = false;
  let progress = 0;
  let volume = 1;
  let showVolumeSlider = false;
  let controlsTimeout: number;

  onMount(() => {
    if (autoplay) {
      play();
    }
  });

  onDestroy(() => {
    clearTimeout(controlsTimeout);
  });

  function play() {
    video.play().catch(() => {
      // Autoplay was prevented
      muted = true;
      video.play();
    });
  }

  function pause() {
    video.pause();
  }

  function togglePlay() {
    if (video.paused) {
      play();
    } else {
      pause();
    }
  }

  function toggleMute() {
    muted = !muted;
  }

  function handleVolumeChange(e: Event) {
    const input = e.target as HTMLInputElement;
    volume = parseFloat(input.value);
    video.volume = volume;
    muted = volume === 0;
  }

  function handleProgress(e: Event) {
    const input = e.target as HTMLInputElement;
    const time = (parseFloat(input.value) * video.duration) / 100;
    video.currentTime = time;
  }

  function handleMouseMove() {
    showControls = true;
    clearTimeout(controlsTimeout);
    if (!video.paused) {
      controlsTimeout = window.setTimeout(() => {
        showControls = false;
      }, 2000);
    }
  }

  function formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  $: if (video) {
    video.muted = muted;
  }

  $: containerClasses = [
    'relative group overflow-hidden rounded-lg bg-black',
    platform === 'short-video' ? 'aspect-[9/16]' : 'aspect-video',
    '$$props.class'
  ].join(' ');

  $: controlsClasses = [
    'absolute inset-0 flex flex-col justify-end p-4 transition-opacity duration-200',
    'bg-gradient-to-t from-black/50 to-transparent',
    !showControls && !video?.paused && 'opacity-0 group-hover:opacity-100'
  ].join(' ');
</script>

<div
  class={containerClasses}
  on:mousemove={handleMouseMove}
  on:mouseleave={() => (showControls = false)}
>
  <video
    bind:this={video}
    {src}
    {poster}
    class="w-full h-full object-contain"
    playsinline
    {loop}
    on:play={() => {
      isPlaying = true;
      dispatch('play');
    }}
    on:pause={() => {
      isPlaying = false;
      dispatch('pause');
    }}
    on:ended={() => {
      isPlaying = false;
      dispatch('ended');
    }}
    on:timeupdate={() => {
      progress = (video.currentTime / video.duration) * 100;
      dispatch('timeupdate', { currentTime: video.currentTime, duration: video.duration });
    }}
  />

  {#if controls}
    <div class={controlsClasses}>
      <!-- Progress bar -->
      <div class="w-full mb-4">
        <input
          type="range"
          min="0"
          max="100"
          value={progress}
          class="w-full h-1 bg-white/30 rounded-full appearance-none cursor-pointer"
          on:input={handleProgress}
        />
        <div class="flex justify-between text-sm mt-1">
          <span>{formatTime(video?.currentTime || 0)}</span>
          <span>{formatTime(video?.duration || 0)}</span>
        </div>
      </div>

      <!-- Controls -->
      <div class="flex items-center gap-4">
        <button
          class="text-white hover:text-primary-400 transition-colors"
          on:click={togglePlay}
        >
          {#if isPlaying}
            <svg class="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          {:else}
            <svg class="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          {/if}
        </button>

        <!-- Volume -->
        <div class="relative flex items-center group">
          <button
            class="text-white hover:text-primary-400 transition-colors"
            on:click={toggleMute}
          >
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              {#if muted || volume === 0}
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              {:else if volume < 0.5}
                <path d="M5 9v6h4l5 5V4L9 9H5zm11.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
              {:else}
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              {/if}
            </svg>
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            class="w-0 group-hover:w-24 origin-left transition-all duration-200 h-1 ml-2 bg-white/30 rounded-full appearance-none cursor-pointer"
            on:input={handleVolumeChange}
          />
        </div>

        {#if platform === 'long-video'}
          <!-- Quality selector -->
          <div class="relative ml-auto">
            <button
              class="text-white hover:text-primary-400 transition-colors"
              on:click={() => (showVolumeSlider = !showVolumeSlider)}
            >
              {quality}
            </button>
            {#if showVolumeSlider}
              <div
                class="absolute bottom-full right-0 mb-2 bg-black/90 rounded-lg py-1"
                transition:fade={{ duration: 100 }}
              >
                {#each ['360p', '480p', '720p', '1080p', '4k'] as q}
                  <button
                    class="block w-full px-4 py-2 text-left hover:bg-primary-900/50 transition-colors"
                    class:text-primary-500={quality === q}
                    on:click={() => {
                      quality = q as typeof quality;
                      showVolumeSlider = false;
                      dispatch('qualitychange', { quality: q as typeof quality });
                    }}
                  >
                    {q}
                  </button>
                {/each}
              </div>
            {/if}
          </div>

          {#if pip}
            <button
              class="text-white hover:text-primary-400 transition-colors"
              on:click={() => video.requestPictureInPicture()}
            >
              <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z" />
              </svg>
            </button>
          {/if}
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  input[type="range"] {
    accent-color: var(--color-primary-500);
  }

  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background-color: var(--color-primary-500);
    cursor: pointer;
  }

  input[type="range"]::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background-color: var(--color-primary-500);
    border: none;
    cursor: pointer;
  }
</style> 