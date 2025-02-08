<!-- AudioPlayer.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Card } from '$lib/components/ui';
  import { Icon } from '$lib/components/ui';
  import { Button } from '$lib/components/ui';
  import { Slider } from '$lib/components/ui';
  import { formatDuration } from '$lib/utils';

  export let src: string;
  export let title: string;
  export let artist: string;
  export let artwork?: string;
  export let preview = false; // If true, only plays first 30 seconds
  export let autoplay = false;
  export let class: string = '';

  let audio: HTMLAudioElement;
  let duration = 0;
  let currentTime = 0;
  let isPlaying = false;
  let volume = 1;
  let isMuted = false;
  let isLoading = true;

  onMount(() => {
    audio = new Audio(src);
    audio.preload = 'metadata';
    audio.volume = volume;

    audio.addEventListener('loadedmetadata', () => {
      duration = preview ? Math.min(30, audio.duration) : audio.duration;
      isLoading = false;
      if (autoplay) play();
    });

    audio.addEventListener('timeupdate', () => {
      currentTime = audio.currentTime;
      if (preview && currentTime >= 30) {
        pause();
        audio.currentTime = 0;
      }
    });

    audio.addEventListener('ended', () => {
      isPlaying = false;
      audio.currentTime = 0;
    });

    return () => {
      audio.pause();
      audio.src = '';
      audio.remove();
    };
  });

  function play() {
    audio.play();
    isPlaying = true;
  }

  function pause() {
    audio.pause();
    isPlaying = false;
  }

  function togglePlay() {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }

  function seek(value: number) {
    if (!audio) return;
    audio.currentTime = value;
    currentTime = value;
  }

  function setVolume(value: number) {
    if (!audio) return;
    volume = value;
    audio.volume = value;
    if (value > 0) isMuted = false;
  }

  function toggleMute() {
    if (!audio) return;
    isMuted = !isMuted;
    audio.volume = isMuted ? 0 : volume;
  }

  onDestroy(() => {
    if (audio) {
      audio.pause();
      audio.src = '';
      audio.remove();
    }
  });
</script>

<Card class="p-4 {class}">
  <div class="flex items-center gap-4">
    <!-- Artwork -->
    {#if artwork}
      <div class="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg">
        <img
          src={artwork}
          alt={title}
          class="h-full w-full object-cover"
        />
      </div>
    {/if}

    <!-- Info & Controls -->
    <div class="flex-1">
      <div class="mb-2">
        <h3 class="font-semibold">{title}</h3>
        <p class="text-sm text-muted-foreground">{artist}</p>
      </div>

      <!-- Progress -->
      <div class="space-y-2">
        <Slider
          value={currentTime}
          max={duration}
          step={0.1}
          onValueChange={seek}
          disabled={isLoading}
          class="mb-1"
        />
        <div class="flex justify-between text-xs text-muted-foreground">
          <span>{formatDuration(currentTime)}</span>
          <span>{formatDuration(duration)}</span>
        </div>
      </div>
    </div>

    <!-- Controls -->
    <div class="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        disabled={isLoading}
        on:click={togglePlay}
      >
        <Icon
          name={isPlaying ? 'pause' : 'play'}
          class="h-6 w-6"
        />
      </Button>

      <div class="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          on:click={toggleMute}
        >
          <Icon
            name={isMuted ? 'volume-x' : volume > 0.5 ? 'volume-2' : volume > 0 ? 'volume-1' : 'volume'}
            class="h-5 w-5"
          />
        </Button>
        <Slider
          value={volume}
          max={1}
          step={0.01}
          onValueChange={setVolume}
          class="w-24"
        />
      </div>
    </div>
  </div>

  {#if preview}
    <div class="mt-2 text-center text-xs text-muted-foreground">
      Preview only. Purchase to access full track.
    </div>
  {/if}
</Card>

<style>
  /* Add any component-specific styles here */
</style> 