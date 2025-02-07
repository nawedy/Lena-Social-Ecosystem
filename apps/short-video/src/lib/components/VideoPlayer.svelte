<!-- VideoPlayer.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { gsap } from 'gsap';

  export let src: string;
  export let autoplay = false;
  export let loop = true;
  export let muted = false;
  export let poster: string | undefined = undefined;

  let video: HTMLVideoElement;
  let container: HTMLDivElement;
  let playing = false;
  let progress = 0;
  let volume = 1;
  let showControls = false;
  let controlsTimeout: number;

  // Touch handling for double tap
  let lastTap = 0;
  let tapTimeout: number;
  let tapPosition = { x: 0, y: 0 };

  onMount(() => {
    if (autoplay) {
      playVideo();
    }

    // Intersection Observer for autoplay
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (autoplay) playVideo();
          } else {
            pauseVideo();
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
      clearTimeout(controlsTimeout);
      clearTimeout(tapTimeout);
    };
  });

  function playVideo() {
    if (video.paused) {
      video.play().catch(() => {
        // Autoplay was prevented
        playing = false;
      });
      playing = true;
    }
  }

  function pauseVideo() {
    if (!video.paused) {
      video.pause();
      playing = false;
    }
  }

  function togglePlay() {
    if (video.paused) {
      playVideo();
    } else {
      pauseVideo();
    }
  }

  function toggleMute() {
    video.muted = !video.muted;
    muted = video.muted;
  }

  function handleTimeUpdate() {
    progress = (video.currentTime / video.duration) * 100;
  }

  function handleVolumeChange() {
    volume = video.volume;
    muted = video.muted;
  }

  function handleTouchStart(event: TouchEvent) {
    const touch = event.touches[0];
    const now = Date.now();
    
    tapPosition = {
      x: touch.clientX,
      y: touch.clientY
    };

    if (now - lastTap < 300) {
      // Double tap detected
      clearTimeout(tapTimeout);
      handleDoubleTap(tapPosition);
    } else {
      tapTimeout = window.setTimeout(() => {
        // Single tap
        togglePlay();
      }, 300);
    }

    lastTap = now;
  }

  function handleDoubleTap(position: { x: number; y: number }) {
    // Create heart animation
    const heart = document.createElement('div');
    heart.className = 'heart-animation';
    heart.style.left = `${position.x - 25}px`;
    heart.style.top = `${position.y - 25}px`;
    container.appendChild(heart);

    gsap.to(heart, {
      opacity: 0,
      scale: 2,
      y: -100,
      duration: 1,
      ease: 'power2.out',
      onComplete: () => {
        container.removeChild(heart);
      }
    });

    // TODO: Trigger like action
  }

  function showControlsTemporarily() {
    showControls = true;
    clearTimeout(controlsTimeout);
    controlsTimeout = window.setTimeout(() => {
      showControls = false;
    }, 3000);
  }
</script>

<div
  bind:this={container}
  class="relative w-full h-full bg-black"
  on:touchstart={handleTouchStart}
  on:mousemove={showControlsTemporarily}
>
  <video
    bind:this={video}
    {src}
    {poster}
    {loop}
    playsinline
    class="w-full h-full object-cover"
    on:timeupdate={handleTimeUpdate}
    on:volumechange={handleVolumeChange}
  />

  <!-- Video Controls -->
  {#if showControls}
    <div
      class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent"
      transition:fade={{ duration: 200 }}
    >
      <!-- Progress Bar -->
      <div class="w-full h-1 bg-gray-700 rounded-full mb-4">
        <div
          class="h-full bg-primary-500 rounded-full"
          style="width: {progress}%"
        />
      </div>

      <!-- Control Buttons -->
      <div class="flex items-center gap-4">
        <button
          class="text-white hover:text-primary-500 transition-colors"
          on:click={togglePlay}
        >
          {#if playing}
            <span class="text-2xl">⏸️</span>
          {:else}
            <span class="text-2xl">▶️</span>
          {/if}
        </button>

        <button
          class="text-white hover:text-primary-500 transition-colors"
          on:click={toggleMute}
        >
          {#if muted}
            <span class="text-2xl">🔇</span>
          {:else}
            <span class="text-2xl">🔊</span>
          {/if}
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .heart-animation {
    position: fixed;
    width: 50px;
    height: 50px;
    background: url('/icons/heart.svg') no-repeat center center;
    background-size: contain;
    pointer-events: none;
    z-index: 50;
  }
</style> 