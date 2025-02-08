<!-- VideoPlayer.svelte -->
<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { Button } from '$lib/components/ui';
  import { Icon } from '$lib/components/ui';

  export let src: string;
  export let poster: string | undefined = undefined;
  export let autoplay = false;
  export let loop = true;
  export let muted = false;
  export let controls = true;
  export let preload: 'none' | 'metadata' | 'auto' = 'metadata';

  let video: HTMLVideoElement;
  let progressBar: HTMLDivElement;
  let isPlaying = false;
  let isMuted = muted;
  let volume = 1;
  let currentTime = 0;
  let duration = 0;
  let buffered = 0;
  let isFullscreen = false;
  let showControls = true;
  let controlsTimeout: NodeJS.Timeout;

  const dispatch = createEventDispatcher<{
    play: void;
    pause: void;
    ended: void;
    timeupdate: { currentTime: number; duration: number };
    volumechange: { volume: number; muted: boolean };
    fullscreenchange: { isFullscreen: boolean };
  }>();

  onMount(() => {
    if (video) {
      video.volume = volume;
      video.muted = isMuted;

      // Update buffered amount
      video.addEventListener('progress', updateBuffered);

      // Handle fullscreen changes
      document.addEventListener('fullscreenchange', handleFullscreenChange);
    }
  });

  onDestroy(() => {
    if (video) {
      video.removeEventListener('progress', updateBuffered);
    }
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
  });

  function updateBuffered() {
    if (video.buffered.length > 0) {
      buffered = (video.buffered.end(video.buffered.length - 1) / video.duration) * 100;
    }
  }

  function handleFullscreenChange() {
    isFullscreen = document.fullscreenElement !== null;
    dispatch('fullscreenchange', { isFullscreen });
  }

  function togglePlay() {
    if (video.paused) {
      video.play();
      isPlaying = true;
      dispatch('play');
    } else {
      video.pause();
      isPlaying = false;
      dispatch('pause');
    }
  }

  function toggleMute() {
    isMuted = !isMuted;
    video.muted = isMuted;
    dispatch('volumechange', { volume, muted: isMuted });
  }

  function handleVolumeChange(event: Event) {
    volume = parseFloat((event.target as HTMLInputElement).value);
    video.volume = volume;
    if (volume === 0) {
      isMuted = true;
    } else if (isMuted) {
      isMuted = false;
    }
    dispatch('volumechange', { volume, muted: isMuted });
  }

  function handleTimeUpdate() {
    currentTime = video.currentTime;
    duration = video.duration;
    dispatch('timeupdate', { currentTime, duration });
  }

  function handleProgressClick(event: MouseEvent) {
    const rect = progressBar.getBoundingClientRect();
    const pos = (event.clientX - rect.left) / rect.width;
    video.currentTime = pos * video.duration;
  }

  function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  async function toggleFullscreen() {
    if (!document.fullscreenElement) {
      await video.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  }

  function showControlsTemporarily() {
    showControls = true;
    clearTimeout(controlsTimeout);
    controlsTimeout = setTimeout(() => {
      if (isPlaying) {
        showControls = false;
      }
    }, 3000);
  }

  function handleEnded() {
    isPlaying = false;
    dispatch('ended');
  }

  $: if (video) {
    video.muted = isMuted;
  }
</script>

<div
  class="relative w-full aspect-[9/16] bg-black overflow-hidden rounded-lg group"
  on:mousemove={showControlsTemporarily}
  on:mouseleave={() => showControls = false}
>
  <video
    bind:this={video}
    {src}
    {poster}
    {preload}
    class="w-full h-full object-cover"
    on:play={() => isPlaying = true}
    on:pause={() => isPlaying = false}
    on:timeupdate={handleTimeUpdate}
    on:ended={handleEnded}
    {loop}
    {autoplay}
  />

  {#if controls}
    <div
      class="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300"
      class:opacity-0={!showControls && isPlaying}
      class:opacity-100={showControls || !isPlaying}
    >
      <!-- Progress bar -->
      <div
        bind:this={progressBar}
        class="relative h-1 bg-white/20 cursor-pointer"
        on:click={handleProgressClick}
      >
        <div
          class="absolute h-full bg-white/30"
          style="width: {buffered}%"
        />
        <div
          class="absolute h-full bg-primary"
          style="width: {(currentTime / duration) * 100}%"
        >
          <div class="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full transform scale-0 group-hover:scale-100 transition-transform" />
        </div>
      </div>

      <!-- Controls -->
      <div class="p-4 flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            class="text-white hover:text-primary"
            on:click={togglePlay}
          >
            <Icon name={isPlaying ? 'pause' : 'play'} class="h-6 w-6" />
          </Button>

          <div class="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              class="text-white hover:text-primary"
              on:click={toggleMute}
            >
              <Icon
                name={isMuted ? 'volume-x' : volume > 0.5 ? 'volume-2' : 'volume-1'}
                class="h-5 w-5"
              />
            </Button>

            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              on:input={handleVolumeChange}
              class="w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer"
            />
          </div>

          <div class="text-white text-sm font-medium">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          class="text-white hover:text-primary"
          on:click={toggleFullscreen}
        >
          <Icon name={isFullscreen ? 'minimize' : 'maximize'} class="h-5 w-5" />
        </Button>
      </div>
    </div>
  {/if}
</div>

<style>
  input[type="range"]::-webkit-slider-thumb {
    @apply appearance-none w-3 h-3 bg-primary rounded-full cursor-pointer;
  }

  input[type="range"]::-moz-range-thumb {
    @apply appearance-none w-3 h-3 bg-primary rounded-full cursor-pointer border-none;
  }

  input[type="range"]::-ms-thumb {
    @apply appearance-none w-3 h-3 bg-primary rounded-full cursor-pointer;
  }
</style> 