<!-- VideoPlayer.svelte -->
<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import Hls from 'hls.js';
  import Plyr from 'plyr';
  import 'plyr/dist/plyr.css';
  import { fade } from 'svelte/transition';
  import { ChaptersControl } from './controls';
  import { QualitySelector } from './quality';
  import { CaptionsManager } from './captions';
  import type { VideoMetadata, Chapter, Caption } from '$lib/types';
  import { createVideoAnalytics } from '$lib/analytics';
  import { formatTime, getOptimalQuality } from '$lib/utils/video';

  const dispatch = createEventDispatcher();

  // Props
  export let videoId: string;
  export let ipfsHash: string;
  export let title: string;
  export let chapters: Chapter[] = [];
  export let captions: Caption[] = [];
  export let startTime: number = 0;
  export let autoplay: boolean = false;
  export let loop: boolean = false;
  export let muted: boolean = false;
  export let quality: string = 'auto';
  export let metadata: VideoMetadata;

  // Internal state
  let player: Plyr;
  let hls: Hls;
  let videoElement: HTMLVideoElement;
  let currentTime = 0;
  let duration = 0;
  let buffered = 0;
  let playing = false;
  let volume = 1;
  let playbackRate = 1;
  let qualityLevels: string[] = [];
  let currentQuality = 'auto';
  let isTheaterMode = false;
  let isPiPActive = false;
  let showControls = true;
  let lastActivity = Date.now();
  let controlsTimeout: NodeJS.Timeout;

  // Analytics
  let analytics = createVideoAnalytics(videoId);
  let lastUpdateTime = 0;
  const ANALYTICS_UPDATE_INTERVAL = 5000; // 5 seconds

  onMount(async () => {
    initializePlayer();
    setupHLS();
    setupEventListeners();
    setupAnalytics();
    
    if (document.pictureInPictureEnabled) {
      setupPictureInPicture();
    }

    return () => {
      cleanup();
    };
  });

  function initializePlayer() {
    const defaultOptions = {
      controls: [
        'play-large',
        'play',
        'progress',
        'current-time',
        'duration',
        'mute',
        'volume',
        'captions',
        'settings',
        'pip',
        'airplay',
        'fullscreen',
      ],
      settings: ['captions', 'quality', 'speed', 'loop'],
      quality: {
        default: quality,
        options: qualityLevels,
      },
      captions: { active: true, language: 'auto', update: true },
      tooltips: { controls: true, seek: true },
      keyboard: { focused: true, global: false },
    };

    player = new Plyr(videoElement, defaultOptions);
  }

  function setupHLS() {
    if (Hls.isSupported()) {
      hls = new Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 600,
        maxBufferSize: 60 * 1000 * 1000, // 60MB
        startLevel: -1, // Auto quality selection
      });

      // Construct the HLS manifest URL from IPFS hash
      const manifestUrl = `https://ipfs.io/ipfs/${ipfsHash}/master.m3u8`;
      hls.loadSource(manifestUrl);
      hls.attachMedia(videoElement);

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        qualityLevels = data.levels.map(level => level.height + 'p');
        updateQualityOptions();
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        currentQuality = qualityLevels[data.level];
        dispatch('qualitychange', { quality: currentQuality });
      });
    }
  }

  function setupEventListeners() {
    // Player events
    player.on('timeupdate', handleTimeUpdate);
    player.on('play', () => {
      playing = true;
      dispatch('play');
    });
    player.on('pause', () => {
      playing = false;
      dispatch('pause');
    });
    player.on('ended', handleEnded);
    player.on('progress', handleProgress);
    player.on('volumechange', () => volume = player.volume);
    player.on('ratechange', () => playbackRate = player.speed);

    // Mouse movement for controls
    videoElement.addEventListener('mousemove', handleMouseMove);
    videoElement.addEventListener('mouseleave', () => {
      showControls = false;
    });
  }

  function setupAnalytics() {
    setInterval(() => {
      if (playing && currentTime > lastUpdateTime) {
        analytics.updateWatchTime(currentTime - lastUpdateTime);
        lastUpdateTime = currentTime;
      }
    }, ANALYTICS_UPDATE_INTERVAL);
  }

  function setupPictureInPicture() {
    videoElement.addEventListener('enterpictureinpicture', () => {
      isPiPActive = true;
      dispatch('pipchange', { active: true });
    });

    videoElement.addEventListener('leavepictureinpicture', () => {
      isPiPActive = false;
      dispatch('pipchange', { active: false });
    });
  }

  function handleTimeUpdate() {
    currentTime = player.currentTime;
    duration = player.duration;
    
    // Update chapters
    if (chapters.length > 0) {
      const currentChapter = chapters.find((chapter, index) => {
        const nextChapter = chapters[index + 1];
        return currentTime >= chapter.startTime && 
               (!nextChapter || currentTime < nextChapter.startTime);
      });
      
      if (currentChapter) {
        dispatch('chapterchange', { chapter: currentChapter });
      }
    }
  }

  function handleProgress() {
    if (videoElement.buffered.length > 0) {
      buffered = videoElement.buffered.end(videoElement.buffered.length - 1);
    }
  }

  function handleEnded() {
    playing = false;
    dispatch('ended');
    analytics.videoEnded();
  }

  function handleMouseMove() {
    showControls = true;
    lastActivity = Date.now();
    
    clearTimeout(controlsTimeout);
    controlsTimeout = setTimeout(() => {
      if (playing && Date.now() - lastActivity > 2000) {
        showControls = false;
      }
    }, 2000);
  }

  function updateQualityOptions() {
    if (player) {
      player.quality = {
        default: currentQuality,
        options: qualityLevels,
        forced: true,
        onChange: (quality: string) => {
          if (hls) {
            const levelIndex = qualityLevels.indexOf(quality);
            hls.currentLevel = levelIndex;
          }
        },
      };
    }
  }

  function toggleTheaterMode() {
    isTheaterMode = !isTheaterMode;
    dispatch('theatermode', { active: isTheaterMode });
  }

  async function togglePiP() {
    try {
      if (!isPiPActive) {
        await videoElement.requestPictureInPicture();
      } else {
        await document.exitPictureInPicture();
      }
    } catch (error) {
      console.error('PiP error:', error);
    }
  }

  function cleanup() {
    if (player) {
      player.destroy();
    }
    if (hls) {
      hls.destroy();
    }
    clearTimeout(controlsTimeout);
  }

  onDestroy(() => {
    cleanup();
  });
</script>

<div 
  class="video-player-container {isTheaterMode ? 'theater-mode' : ''}"
  class:pip-active={isPiPActive}
>
  <div class="video-wrapper" transition:fade>
    <video
      bind:this={videoElement}
      {title}
      playsinline
      {autoplay}
      {loop}
      {muted}
      crossorigin="anonymous"
      class="video-player"
    >
      {#each captions as caption}
        <track
          kind="captions"
          label={caption.language}
          src={caption.url}
          srclang={caption.language}
        />
      {/each}
    </video>

    {#if showControls}
      <div class="custom-controls" transition:fade={{ duration: 200 }}>
        <ChaptersControl 
          {chapters}
          currentTime={currentTime}
          {duration}
          on:seek={(e) => player.currentTime = e.detail.time}
        />
        
        <div class="control-bar">
          <button
            class="theater-mode-btn"
            on:click={toggleTheaterMode}
            title="Theater mode"
          >
            <svg><!-- Theater mode icon --></svg>
          </button>
          
          {#if document.pictureInPictureEnabled}
            <button
              class="pip-btn"
              on:click={togglePiP}
              title="Picture-in-Picture"
            >
              <svg><!-- PiP icon --></svg>
            </button>
          {/if}

          <QualitySelector
            qualities={qualityLevels}
            currentQuality={currentQuality}
            on:change={(e) => player.quality = e.detail.quality}
          />
        </div>
      </div>
    {/if}
  </div>
</div>

<style lang="postcss">
  .video-player-container {
    position: relative;
    width: 100%;
    background: #000;
    aspect-ratio: 16/9;
    
    &.theater-mode {
      max-width: none;
      width: 100vw;
      height: calc(100vh - 60px);
      margin: 0;
    }
    
    &.pip-active {
      opacity: 0.5;
    }
  }

  .video-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .video-player {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .custom-controls {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: linear-gradient(transparent, rgba(0,0,0,0.7));
    padding: 20px;
    z-index: 2;
  }

  .control-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 10px;
  }

  button {
    background: transparent;
    border: none;
    color: white;
    padding: 5px;
    cursor: pointer;
    opacity: 0.8;
    transition: opacity 0.2s;

    &:hover {
      opacity: 1;
    }

    svg {
      width: 24px;
      height: 24px;
    }
  }

  :global(.plyr) {
    --plyr-color-main: var(--primary-color, #00a8ff);
    --plyr-video-background: #000;
    --plyr-video-control-color: #fff;
  }
</style> 