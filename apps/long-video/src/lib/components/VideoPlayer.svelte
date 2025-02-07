<!-- VideoPlayer.svelte -->
<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import Hls from 'hls.js';
  import { Button, Icon, Slider } from '@lena/ui';

  export let src: string;
  export let poster: string | null = null;
  export let autoplay = false;
  export let muted = false;
  export let loop = false;
  export let title = '';
  export let qualities: Array<{
    label: string;
    src: string;
    bitrate: number;
  }> = [];

  const dispatch = createEventDispatcher();
  let videoElement: HTMLVideoElement;
  let controlsElement: HTMLDivElement;
  let hls: Hls | null = null;
  let playing = false;
  let currentTime = 0;
  let duration = 0;
  let volume = 1;
  let showControls = true;
  let showQualityMenu = false;
  let hideControlsTimeout: number;
  let currentQuality = qualities[0]?.label || 'auto';

  $: progress = duration ? (currentTime / duration) * 100 : 0;
  $: formattedCurrentTime = formatTime(currentTime);
  $: formattedDuration = formatTime(duration);

  onMount(() => {
    if (Hls.isSupported() && src.includes('.m3u8')) {
      hls = new Hls({
        autoStartLoad: true,
        startLevel: -1,
        debug: false,
        capLevelToPlayerSize: true
      });

      hls.loadSource(src);
      hls.attachMedia(videoElement);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (autoplay) videoElement.play();
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        const level = hls.levels[data.level];
        dispatch('qualitychange', {
          height: level.height,
          bitrate: level.bitrate
        });
      });
    } else {
      videoElement.src = src;
    }

    // Handle keyboard shortcuts
    window.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    if (hls) {
      hls.destroy();
    }
    window.removeEventListener('keydown', handleKeydown);
  });

  function handlePlay() {
    if (videoElement.paused) {
      videoElement.play();
    } else {
      videoElement.pause();
    }
  }

  function handleTimeUpdate() {
    currentTime = videoElement.currentTime;
    dispatch('timeupdate', { currentTime });
  }

  function handleSeek(e: MouseEvent) {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    currentTime = percentage * duration;
    videoElement.currentTime = currentTime;
  }

  function handleVolumeChange(e: CustomEvent) {
    volume = e.detail;
    videoElement.volume = volume;
    videoElement.muted = volume === 0;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (document.activeElement?.tagName === 'INPUT') return;

    switch (e.key.toLowerCase()) {
      case ' ':
      case 'k':
        e.preventDefault();
        handlePlay();
        break;
      case 'f':
        e.preventDefault();
        handleFullscreen();
        break;
      case 'm':
        e.preventDefault();
        handleMute();
        break;
      case 'arrowleft':
        e.preventDefault();
        seek(-10);
        break;
      case 'arrowright':
        e.preventDefault();
        seek(10);
        break;
      case 'arrowup':
        e.preventDefault();
        adjustVolume(0.1);
        break;
      case 'arrowdown':
        e.preventDefault();
        adjustVolume(-0.1);
        break;
    }
  }

  function seek(seconds: number) {
    const newTime = Math.max(0, Math.min(currentTime + seconds, duration));
    videoElement.currentTime = newTime;
  }

  function adjustVolume(delta: number) {
    volume = Math.max(0, Math.min(1, volume + delta));
    videoElement.volume = volume;
  }

  function handleMute() {
    videoElement.muted = !videoElement.muted;
  }

  function handleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      videoElement.requestFullscreen();
    }
  }

  function handleMouseMove() {
    showControls = true;
    clearTimeout(hideControlsTimeout);
    hideControlsTimeout = window.setTimeout(() => {
      if (!videoElement.paused) {
        showControls = false;
      }
    }, 3000);
  }

  function setQuality(quality: string) {
    if (!hls) return;

    const levelIndex = hls.levels.findIndex(level => 
      level.height === parseInt(quality)
    );

    if (levelIndex !== -1) {
      hls.currentLevel = levelIndex;
    }

    showQualityMenu = false;
    currentQuality = quality;
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
</script>

<div 
  class="relative w-full bg-black aspect-video group"
  on:mousemove={handleMouseMove}
  on:mouseleave={() => showControls = false}
>
  <video
    bind:this={videoElement}
    class="w-full h-full"
    {poster}
    {autoplay}
    {muted}
    {loop}
    on:play={() => playing = true}
    on:pause={() => playing = false}
    on:timeupdate={handleTimeUpdate}
    on:loadedmetadata={() => duration = videoElement.duration}
    on:ended={() => dispatch('ended')}
  >
    <track kind="captions" />
  </video>

  <!-- Video Controls -->
  <div
    bind:this={controlsElement}
    class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent
           transition-opacity duration-300"
    class:opacity-0={!showControls}
    class:pointer-events-none={!showControls}
  >
    <!-- Title Bar -->
    <div class="absolute top-0 left-0 right-0 p-4">
      <h2 class="text-white text-lg font-medium line-clamp-1">{title}</h2>
    </div>

    <!-- Main Controls -->
    <div class="absolute bottom-0 left-0 right-0 p-4 space-y-2">
      <!-- Progress Bar -->
      <div 
        class="w-full h-1 bg-white/30 cursor-pointer group"
        on:click={handleSeek}
      >
        <div 
          class="h-full bg-primary-500 relative"
          style="width: {progress}%"
        >
          <div class="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 
                      bg-primary-500 rounded-full scale-0 group-hover:scale-100
                      transition-transform" />
        </div>
      </div>

      <!-- Control Buttons -->
      <div class="flex items-center gap-4">
        <Button
          variant="ghost"
          class="!p-2"
          on:click={handlePlay}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          <Icon name={playing ? 'pause' : 'play'} size={24} />
        </Button>

        <!-- Volume Control -->
        <div class="flex items-center gap-2">
          <Button
            variant="ghost"
            class="!p-2"
            on:click={handleMute}
            aria-label={volume === 0 ? 'Unmute' : 'Mute'}
          >
            <Icon 
              name={volume === 0 ? 'volume-x' : volume < 0.5 ? 'volume-1' : 'volume-2'}
              size={24}
            />
          </Button>
          <div class="w-20">
            <Slider
              value={volume}
              min={0}
              max={1}
              step={0.01}
              on:change={handleVolumeChange}
            />
          </div>
        </div>

        <span class="text-sm text-white">
          {formattedCurrentTime} / {formattedDuration}
        </span>

        <div class="flex-1" />

        <!-- Quality Selector -->
        {#if qualities.length > 0}
          <div class="relative">
            <Button
              variant="ghost"
              class="!p-2"
              on:click={() => showQualityMenu = !showQualityMenu}
              aria-label="Quality settings"
            >
              <Icon name="settings" size={24} />
            </Button>

            {#if showQualityMenu}
              <div class="absolute bottom-full right-0 mb-2 w-48 bg-gray-900 
                          rounded-lg shadow-lg overflow-hidden">
                {#each qualities as quality}
                  <button
                    class="w-full px-4 py-2 text-left hover:bg-gray-800 
                           transition-colors text-sm"
                    class:text-primary-400={currentQuality === quality.label}
                    on:click={() => setQuality(quality.label)}
                  >
                    {quality.label}
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {/if}

        <Button
          variant="ghost"
          class="!p-2"
          on:click={handleFullscreen}
          aria-label="Toggle fullscreen"
        >
          <Icon name="maximize" size={24} />
        </Button>
      </div>
    </div>
  </div>
</div>

<style>
  video::-webkit-media-controls {
    display: none !important;
  }
  
  video::-webkit-media-controls-enclosure {
    display: none !important;
  }
</style> 