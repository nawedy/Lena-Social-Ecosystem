<!-- AudioWaveform.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import WaveSurfer from 'wavesurfer.js';

  export let src: string;
  export let height = 64;
  export let waveColor = 'rgba(255, 255, 255, 0.2)';
  export let progressColor = 'rgba(255, 255, 255, 0.8)';
  export let cursorColor = '#ffffff';
  export let barWidth = 2;
  export let barGap = 1;
  export let responsive = true;
  export let normalize = true;
  export let class: string = '';

  let container: HTMLDivElement;
  let wavesurfer: WaveSurfer;
  let isReady = false;
  let isPlaying = false;

  onMount(() => {
    wavesurfer = WaveSurfer.create({
      container,
      height,
      waveColor,
      progressColor,
      cursorColor,
      barWidth,
      barGap,
      responsive,
      normalize,
      backend: 'WebAudio',
      hideScrollbar: true,
      interact: true,
      autoCenter: true
    });

    wavesurfer.load(src);

    wavesurfer.on('ready', () => {
      isReady = true;
    });

    wavesurfer.on('play', () => {
      isPlaying = true;
    });

    wavesurfer.on('pause', () => {
      isPlaying = false;
    });

    wavesurfer.on('finish', () => {
      isPlaying = false;
    });

    return () => {
      if (wavesurfer) {
        wavesurfer.destroy();
      }
    };
  });

  export function play() {
    if (wavesurfer && isReady) {
      wavesurfer.play();
    }
  }

  export function pause() {
    if (wavesurfer && isReady) {
      wavesurfer.pause();
    }
  }

  export function stop() {
    if (wavesurfer && isReady) {
      wavesurfer.stop();
    }
  }

  export function seek(position: number) {
    if (wavesurfer && isReady) {
      wavesurfer.seekTo(position);
    }
  }

  onDestroy(() => {
    if (wavesurfer) {
      wavesurfer.destroy();
    }
  });
</script>

<div
  bind:this={container}
  class="w-full {class}"
  role="application"
  aria-label="Audio waveform visualization"
>
  {#if !isReady}
    <div class="flex h-full items-center justify-center">
      <div class="h-1 w-full animate-pulse rounded-full bg-muted" />
    </div>
  {/if}
</div>

<style>
  /* Add any component-specific styles here */
</style> 