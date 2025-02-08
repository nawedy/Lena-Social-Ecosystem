<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { Button } from '$lib/components/ui';
  import { Icon } from '$lib/components/ui';
  import { createFFmpeg } from '@ffmpeg/ffmpeg';

  export let videoBlob: Blob;
  export let maxDuration = 60; // Maximum video duration in seconds

  let video: HTMLVideoElement;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null;
  let ffmpeg: any;
  let processing = false;
  let currentTime = 0;
  let duration = 0;
  let startTrim = 0;
  let endTrim = 0;
  let volume = 1;
  let speed = 1;
  let filters: string[] = [];
  let selectedFilter = 'none';

  const dispatch = createEventDispatcher<{
    save: { blob: Blob; thumbnail: Blob };
    error: { message: string };
  }>();

  const filterOptions = [
    { value: 'none', label: 'Normal' },
    { value: 'brightness', label: 'Bright' },
    { value: 'contrast', label: 'Contrast' },
    { value: 'saturation', label: 'Saturate' },
    { value: 'sepia', label: 'Sepia' },
    { value: 'grayscale', label: 'Grayscale' }
  ];

  onMount(async () => {
    try {
      // Initialize video
      video.src = URL.createObjectURL(videoBlob);
      await video.load();
      duration = video.duration;
      endTrim = duration;

      // Initialize canvas
      ctx = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Initialize FFmpeg
      ffmpeg = createFFmpeg({ log: true });
      await ffmpeg.load();
    } catch (error) {
      dispatch('error', { message: 'Failed to initialize video editor' });
    }
  });

  onDestroy(() => {
    if (video) {
      URL.revokeObjectURL(video.src);
    }
  });

  function updateCanvas() {
    if (!ctx || !video) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Apply filters
    if (selectedFilter !== 'none') {
      ctx.filter = getFilterStyle(selectedFilter);
      ctx.drawImage(canvas, 0, 0);
      ctx.filter = 'none';
    }

    requestAnimationFrame(updateCanvas);
  }

  function getFilterStyle(filter: string): string {
    switch (filter) {
      case 'brightness':
        return 'brightness(1.2)';
      case 'contrast':
        return 'contrast(1.2)';
      case 'saturation':
        return 'saturate(1.5)';
      case 'sepia':
        return 'sepia(100%)';
      case 'grayscale':
        return 'grayscale(100%)';
      default:
        return 'none';
    }
  }

  async function handleSave() {
    if (processing) return;

    try {
      processing = true;

      // Write input video
      ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(videoBlob));

      // Build FFmpeg command
      let filters = [];

      // Trim video
      if (startTrim > 0 || endTrim < duration) {
        filters.push(`trim=start=${startTrim}:end=${endTrim}`);
      }

      // Adjust speed
      if (speed !== 1) {
        filters.push(`setpts=${1/speed}*PTS`);
      }

      // Adjust volume
      if (volume !== 1) {
        filters.push(`volume=${volume}`);
      }

      // Apply visual filters
      if (selectedFilter !== 'none') {
        filters.push(getFFmpegFilter(selectedFilter));
      }

      // Build filter string
      const filterString = filters.length > 0 ? `-vf "${filters.join(',')}"` : '';

      // Process video
      await ffmpeg.run(
        '-i', 'input.mp4',
        ...filterString.split(' '),
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        'output.mp4'
      );

      // Generate thumbnail
      await ffmpeg.run(
        '-i', 'output.mp4',
        '-ss', '00:00:01',
        '-vframes', '1',
        'thumbnail.jpg'
      );

      // Read output files
      const videoData = ffmpeg.FS('readFile', 'output.mp4');
      const thumbnailData = ffmpeg.FS('readFile', 'thumbnail.jpg');

      // Create blobs
      const processedVideo = new Blob([videoData.buffer], { type: 'video/mp4' });
      const thumbnail = new Blob([thumbnailData.buffer], { type: 'image/jpeg' });

      // Clean up
      ffmpeg.FS('unlink', 'input.mp4');
      ffmpeg.FS('unlink', 'output.mp4');
      ffmpeg.FS('unlink', 'thumbnail.jpg');

      dispatch('save', { blob: processedVideo, thumbnail });
    } catch (error) {
      dispatch('error', { message: 'Failed to process video' });
    } finally {
      processing = false;
    }
  }

  function getFFmpegFilter(filter: string): string {
    switch (filter) {
      case 'brightness':
        return 'eq=brightness=0.2';
      case 'contrast':
        return 'eq=contrast=1.2';
      case 'saturation':
        return 'eq=saturation=1.5';
      case 'sepia':
        return 'colorbalance=rs=.393:gs=.769:bs=.189:rm=.349:gm=.686:bm=.168:rh=.272:gh=.534:bh=.131';
      case 'grayscale':
        return 'colorchannelmixer=.3:.59:.11:0:.3:.59:.11:0:.3:.59:.11';
      default:
        return '';
    }
  }

  async function fetchFile(blob: Blob): Promise<Uint8Array> {
    const buffer = await blob.arrayBuffer();
    return new Uint8Array(buffer);
  }

  function handleTimeUpdate() {
    currentTime = video.currentTime;
  }

  function handleTrimChange() {
    video.currentTime = startTrim;
  }

  function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
</script>

<div class="relative w-full aspect-[9/16] bg-black overflow-hidden rounded-lg">
  <video
    bind:this={video}
    class="absolute inset-0 w-full h-full object-cover"
    on:timeupdate={handleTimeUpdate}
    playsinline
  />

  <canvas
    bind:this={canvas}
    class="absolute inset-0 w-full h-full object-cover"
  />

  <div class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
    <!-- Playback controls -->
    <div class="flex items-center justify-between mb-4">
      <Button
        variant="ghost"
        size="icon"
        class="text-white hover:text-primary"
        on:click={() => video.paused ? video.play() : video.pause()}
      >
        <Icon name={video.paused ? 'play' : 'pause'} class="h-6 w-6" />
      </Button>

      <div class="text-white text-sm">
        {formatTime(currentTime)} / {formatTime(duration)}
      </div>
    </div>

    <!-- Trim controls -->
    <div class="mb-4">
      <div class="flex items-center justify-between text-white text-sm mb-2">
        <span>Trim</span>
        <span>{formatTime(endTrim - startTrim)}</span>
      </div>
      <div class="relative h-2 bg-white/20 rounded-full">
        <input
          type="range"
          min="0"
          max={duration}
          step="0.1"
          bind:value={startTrim}
          on:change={handleTrimChange}
          class="absolute w-full h-full opacity-0 cursor-pointer"
        />
        <input
          type="range"
          min="0"
          max={duration}
          step="0.1"
          bind:value={endTrim}
          on:change={handleTrimChange}
          class="absolute w-full h-full opacity-0 cursor-pointer"
        />
        <div
          class="absolute h-full bg-primary rounded-full"
          style="left: {(startTrim / duration) * 100}%; right: {100 - (endTrim / duration) * 100}%"
        />
      </div>
    </div>

    <!-- Volume control -->
    <div class="mb-4">
      <div class="flex items-center justify-between text-white text-sm mb-2">
        <span>Volume</span>
        <span>{Math.round(volume * 100)}%</span>
      </div>
      <input
        type="range"
        min="0"
        max="2"
        step="0.1"
        bind:value={volume}
        class="w-full h-2 bg-white/20 rounded-full appearance-none cursor-pointer"
      />
    </div>

    <!-- Speed control -->
    <div class="mb-4">
      <div class="flex items-center justify-between text-white text-sm mb-2">
        <span>Speed</span>
        <span>{speed}x</span>
      </div>
      <input
        type="range"
        min="0.5"
        max="2"
        step="0.1"
        bind:value={speed}
        class="w-full h-2 bg-white/20 rounded-full appearance-none cursor-pointer"
      />
    </div>

    <!-- Filter selection -->
    <div class="mb-4">
      <div class="text-white text-sm mb-2">Filters</div>
      <div class="flex items-center space-x-2 overflow-x-auto">
        {#each filterOptions as filter}
          <button
            class="px-3 py-1 rounded-full text-sm font-medium transition-colors"
            class:bg-primary={selectedFilter === filter.value}
            class:text-white={selectedFilter === filter.value}
            class:bg-white/10={selectedFilter !== filter.value}
            class:text-white/80={selectedFilter !== filter.value}
            on:click={() => selectedFilter = filter.value}
          >
            {filter.label}
          </button>
        {/each}
      </div>
    </div>

    <!-- Save button -->
    <Button
      variant="primary"
      class="w-full"
      disabled={processing}
      on:click={handleSave}
    >
      {#if processing}
        <Icon name="loader" class="mr-2 h-5 w-5 animate-spin" />
        Processing...
      {:else}
        <Icon name="check" class="mr-2 h-5 w-5" />
        Save
      {/if}
    </Button>
  </div>
</div>

<style>
  input[type="range"]::-webkit-slider-thumb {
    @apply appearance-none w-4 h-4 bg-primary rounded-full cursor-pointer;
  }

  input[type="range"]::-moz-range-thumb {
    @apply appearance-none w-4 h-4 bg-primary rounded-full cursor-pointer border-none;
  }

  input[type="range"]::-ms-thumb {
    @apply appearance-none w-4 h-4 bg-primary rounded-full cursor-pointer;
  }
</style> 