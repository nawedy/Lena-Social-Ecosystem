<!-- VideoPlayer.svelte -->
<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  import Hls from 'hls.js';
  import { analytics } from '$lib/services/analytics';

  const dispatch = createEventDispatcher();

  // Props
  export let src: string;
  export let poster: string | undefined = undefined;
  export let autoplay = false;
  export let muted = false;
  export let loop = false;
  export let controls = true;
  export let preload: 'none' | 'metadata' | 'auto' = 'metadata';
  export let playsinline = true;
  export let crossOrigin: 'anonymous' | 'use-credentials' | null = 'anonymous';
  export let volume = 1;
  export let playbackRate = 1;
  export let quality: string | undefined = undefined;
  export let startTime = 0;

  // State
  let video: HTMLVideoElement;
  let hls: Hls | null = null;
  let isLoading = true;
  let isError = false;
  let isPlaying = false;
  let isSeeking = false;
  let currentTime = 0;
  let duration = 0;
  let buffered = 0;
  let qualities: string[] = [];
  let currentQuality: string | undefined = undefined;
  let volumeBeforeMute = 1;
  let playbackStartTime = 0;
  let lastHeartbeat = 0;
  let heartbeatInterval: number;

  // Lifecycle
  onMount(async () => {
    if (startTime > 0) {
      video.currentTime = startTime;
    }

    if (Hls.isSupported() && src.endsWith('.m3u8')) {
      setupHLS();
    } else {
      video.src = src;
    }

    // Set up heartbeat for analytics
    heartbeatInterval = window.setInterval(sendHeartbeat, 30000);
  });

  onDestroy(() => {
    if (hls) {
      hls.destroy();
    }
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    if (isPlaying) {
      trackPlaybackEnd();
    }
  });

  // HLS setup
  function setupHLS() {
    hls = new Hls({
      maxBufferLength: 30,
      maxMaxBufferLength: 600,
      maxBufferSize: 60 * 1000 * 1000, // 60MB
      startLevel: -1,
      capLevelToPlayerSize: true,
      debug: false
    });

    hls.loadSource(src);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
      qualities = data.levels.map(level => `${level.height}p`);
      currentQuality = quality || qualities[qualities.length - 1];
      dispatch('qualitiesloaded', { qualities });
    });

    hls.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            hls?.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls?.recoverMediaError();
            break;
          default:
            handleError();
            break;
        }
      }
    });
  }

  // Event handlers
  function handlePlay() {
    isPlaying = true;
    playbackStartTime = Date.now();
    dispatch('play');

    analytics.trackEvent({
      type: 'video_play',
      contentId: src,
      contentType: 'video',
      data: {
        currentTime,
        timestamp: Date.now()
      }
    });
  }

  function handlePause() {
    isPlaying = false;
    dispatch('pause');
    trackPlaybackEnd();
  }

  function handleTimeUpdate() {
    currentTime = video.currentTime;
    dispatch('timeupdate', { currentTime, duration });
  }

  function handleProgress() {
    if (video.buffered.length > 0) {
      buffered = video.buffered.end(video.buffered.length - 1);
      dispatch('progress', { buffered });
    }
  }

  function handleLoadedMetadata() {
    duration = video.duration;
    isLoading = false;
    dispatch('load');
  }

  function handleError() {
    isError = true;
    isLoading = false;
    dispatch('error', { message: 'Failed to load video' });
  }

  function handleEnded() {
    isPlaying = false;
    dispatch('ended');
    trackPlaybackEnd();
  }

  function handleSeeking() {
    isSeeking = true;
    dispatch('seeking', { currentTime });
  }

  function handleSeeked() {
    isSeeking = false;
    dispatch('seeked', { currentTime });

    analytics.trackEvent({
      type: 'video_seek',
      contentId: src,
      contentType: 'video',
      data: {
        from: currentTime,
        to: video.currentTime,
        timestamp: Date.now()
      }
    });
  }

  function handleVolumeChange() {
    dispatch('volumechange', { volume: video.volume, muted: video.muted });

    analytics.trackEvent({
      type: 'video_volume_change',
      contentId: src,
      contentType: 'video',
      data: {
        volume: video.volume,
        muted: video.muted,
        timestamp: Date.now()
      }
    });
  }

  function handleRateChange() {
    dispatch('ratechange', { playbackRate: video.playbackRate });

    analytics.trackEvent({
      type: 'video_rate_change',
      contentId: src,
      contentType: 'video',
      data: {
        rate: video.playbackRate,
        timestamp: Date.now()
      }
    });
  }

  // Player controls
  export function play() {
    return video.play();
  }

  export function pause() {
    video.pause();
  }

  export function seek(time: number) {
    video.currentTime = Math.max(0, Math.min(time, duration));
  }

  export function setVolume(value: number) {
    video.volume = Math.max(0, Math.min(value, 1));
    if (value > 0) {
      video.muted = false;
    }
  }

  export function toggleMute() {
    if (video.muted) {
      video.muted = false;
      video.volume = volumeBeforeMute;
    } else {
      volumeBeforeMute = video.volume;
      video.muted = true;
    }
  }

  export function setPlaybackRate(rate: number) {
    video.playbackRate = rate;
  }

  export function setQuality(level: string) {
    if (hls && qualities.includes(level)) {
      const index = qualities.indexOf(level);
      hls.currentLevel = index;
      currentQuality = level;
      dispatch('qualitychange', { quality: level });

      analytics.trackEvent({
        type: 'video_quality_change',
        contentId: src,
        contentType: 'video',
        data: {
          quality: level,
          timestamp: Date.now()
        }
      });
    }
  }

  // Analytics
  function sendHeartbeat() {
    if (isPlaying && Date.now() - lastHeartbeat >= 30000) {
      analytics.trackEvent({
        type: 'video_heartbeat',
        contentId: src,
        contentType: 'video',
        data: {
          currentTime,
          timestamp: Date.now(),
          playbackRate: video.playbackRate,
          quality: currentQuality
        }
      });
      lastHeartbeat = Date.now();
    }
  }

  function trackPlaybackEnd() {
    const endTime = Date.now();
    const watchTime = endTime - playbackStartTime;

    analytics.trackEvent({
      type: 'video_stop',
      contentId: src,
      contentType: 'video',
      data: {
        currentTime,
        watchTime,
        timestamp: endTime
      }
    });
  }
</script>

<div 
  class="video-player"
  class:loading={isLoading}
  class:error={isError}
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
      <span>Failed to load video</span>
    </div>
  {/if}

  <video
    bind:this={video}
    class="video"
    {poster}
    {autoplay}
    {muted}
    {loop}
    {controls}
    {preload}
    {playsinline}
    {crossOrigin}
    {volume}
    {playbackRate}
    on:play={handlePlay}
    on:pause={handlePause}
    on:timeupdate={handleTimeUpdate}
    on:progress={handleProgress}
    on:loadedmetadata={handleLoadedMetadata}
    on:error={handleError}
    on:ended={handleEnded}
    on:seeking={handleSeeking}
    on:seeked={handleSeeked}
    on:volumechange={handleVolumeChange}
    on:ratechange={handleRateChange}
  />
</div>

<style lang="postcss">
  .video-player {
    position: relative;
    width: 100%;
    height: 100%;
    background: black;
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

  .video {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style> 