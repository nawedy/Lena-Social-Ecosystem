<!-- AudioPlayer.svelte -->
<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { Button, Icon, Slider } from '@lena/ui';
  import { gsap } from 'gsap';

  export let src: string;
  export let title: string;
  export let artist: string;
  export let album: string;
  export let artwork: string;
  export let duration = 0;
  export let nextTrack: (() => void) | null = null;
  export let prevTrack: (() => void) | null = null;
  export let crossfadeDuration = 0; // in seconds

  const dispatch = createEventDispatcher();
  let audioElement: HTMLAudioElement;
  let canvasElement: HTMLCanvasElement;
  let audioContext: AudioContext;
  let analyser: AnalyserNode;
  let dataArray: Uint8Array;
  let currentTime = 0;
  let volume = 1;
  let isPlaying = false;
  let isMuted = false;
  let isLooping = false;
  let isShuffle = false;
  let isLiked = false;
  let nextAudio: HTMLAudioElement | null = null;
  let animationFrame: number;

  $: progress = duration ? (currentTime / duration) * 100 : 0;
  $: formattedCurrentTime = formatTime(currentTime);
  $: formattedDuration = formatTime(duration);

  onMount(() => {
    // Initialize Web Audio API
    audioContext = new AudioContext();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    // Connect audio to analyser
    const source = audioContext.createMediaElementSource(audioElement);
    source.connect(analyser);
    analyser.connect(audioContext.destination);

    // Start visualization
    drawVisualization();

    // Handle keyboard shortcuts
    window.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    cancelAnimationFrame(animationFrame);
    window.removeEventListener('keydown', handleKeydown);
    if (audioContext) {
      audioContext.close();
    }
  });

  function drawVisualization() {
    const ctx = canvasElement.getContext('2d')!;
    const width = canvasElement.width;
    const height = canvasElement.height;
    const barWidth = width / analyser.frequencyBinCount;

    function draw() {
      animationFrame = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, width, height);

      dataArray.forEach((value, i) => {
        const barHeight = (value / 255) * height;
        const hue = (i / analyser.frequencyBinCount) * 360;
        
        ctx.fillStyle = `hsla(${hue}, 100%, 50%, 0.8)`;
        ctx.fillRect(
          i * barWidth,
          height - barHeight,
          barWidth - 1,
          barHeight
        );
      });
    }

    draw();
  }

  async function handlePlay() {
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    if (audioElement.paused) {
      await audioElement.play();
      isPlaying = true;
      dispatch('play');
    } else {
      audioElement.pause();
      isPlaying = false;
      dispatch('pause');
    }
  }

  function handleTimeUpdate() {
    currentTime = audioElement.currentTime;
    dispatch('timeupdate', { currentTime });

    // Start crossfade if near the end and next track is available
    if (crossfadeDuration > 0 && nextTrack && !nextAudio) {
      const timeRemaining = duration - currentTime;
      if (timeRemaining <= crossfadeDuration) {
        startCrossfade();
      }
    }
  }

  function handleSeek(e: MouseEvent) {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    currentTime = percentage * duration;
    audioElement.currentTime = currentTime;
  }

  function handleVolumeChange(e: CustomEvent) {
    volume = e.detail;
    audioElement.volume = volume;
    isMuted = volume === 0;

    // Animate volume bars
    const bars = document.querySelectorAll('.volume-bar');
    bars.forEach((bar, i) => {
      const threshold = (i + 1) / bars.length;
      gsap.to(bar, {
        opacity: volume >= threshold ? 1 : 0.3,
        duration: 0.2
      });
    });
  }

  function handleKeydown(e: KeyboardEvent) {
    if (document.activeElement?.tagName === 'INPUT') return;

    switch (e.key.toLowerCase()) {
      case ' ':
        e.preventDefault();
        handlePlay();
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
      case 'l':
        e.preventDefault();
        isLooping = !isLooping;
        audioElement.loop = isLooping;
        break;
      case 'n':
        e.preventDefault();
        if (nextTrack) nextTrack();
        break;
      case 'p':
        e.preventDefault();
        if (prevTrack) prevTrack();
        break;
    }
  }

  function seek(seconds: number) {
    const newTime = Math.max(0, Math.min(currentTime + seconds, duration));
    audioElement.currentTime = newTime;
  }

  function adjustVolume(delta: number) {
    volume = Math.max(0, Math.min(1, volume + delta));
    audioElement.volume = volume;
  }

  function handleMute() {
    isMuted = !isMuted;
    audioElement.muted = isMuted;
  }

  function startCrossfade() {
    if (!nextTrack || nextAudio) return;

    // Create and prepare next audio element
    nextAudio = new Audio();
    nextAudio.src = src; // Will be updated when nextTrack is called
    nextAudio.volume = 0;
    nextAudio.preload = 'auto';

    // Start fading out current track
    gsap.to(audioElement, {
      volume: 0,
      duration: crossfadeDuration,
      ease: 'power1.inOut',
      onComplete: () => {
        audioElement.pause();
        nextTrack?.();
      }
    });

    // Start fading in next track
    nextAudio.play();
    gsap.to(nextAudio, {
      volume,
      duration: crossfadeDuration,
      ease: 'power1.inOut',
      onComplete: () => {
        nextAudio = null;
      }
    });
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

<div class="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-md border-t border-primary-900/50">
  <!-- Progress Bar -->
  <div 
    class="h-1 bg-gray-800 cursor-pointer group"
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

  <div class="max-w-7xl mx-auto px-4 h-20 flex items-center gap-4">
    <!-- Track Info -->
    <div class="flex items-center gap-4 w-1/4">
      <img
        src={artwork}
        alt={`${title} by ${artist}`}
        class="w-14 h-14 rounded-lg"
      />
      <div class="min-w-0">
        <h3 class="font-medium truncate">{title}</h3>
        <p class="text-sm text-gray-400 truncate">{artist}</p>
      </div>
      <button
        class="flex-shrink-0"
        class:text-primary-400={isLiked}
        on:click={() => isLiked = !isLiked}
      >
        <Icon name={isLiked ? 'heart-filled' : 'heart'} size={20} />
      </button>
    </div>

    <!-- Main Controls -->
    <div class="flex-1 flex flex-col items-center gap-2">
      <div class="flex items-center gap-4">
        <button
          class="text-gray-400 hover:text-white transition-colors"
          class:text-primary-400={isShuffle}
          on:click={() => isShuffle = !isShuffle}
          disabled={!nextTrack}
        >
          <Icon name="shuffle" size={20} />
        </button>

        <button
          class="text-gray-400 hover:text-white transition-colors"
          on:click={() => prevTrack?.()}
          disabled={!prevTrack}
        >
          <Icon name="skip-back" size={24} />
        </button>

        <button
          class="w-10 h-10 rounded-full bg-white text-black hover:scale-105 
                 transition-transform flex items-center justify-center"
          on:click={handlePlay}
        >
          <Icon name={isPlaying ? 'pause' : 'play'} size={24} />
        </button>

        <button
          class="text-gray-400 hover:text-white transition-colors"
          on:click={() => nextTrack?.()}
          disabled={!nextTrack}
        >
          <Icon name="skip-forward" size={24} />
        </button>

        <button
          class="text-gray-400 hover:text-white transition-colors"
          class:text-primary-400={isLooping}
          on:click={() => {
            isLooping = !isLooping;
            audioElement.loop = isLooping;
          }}
        >
          <Icon name="repeat" size={20} />
        </button>
      </div>

      <div class="flex items-center gap-2 text-sm text-gray-400">
        <span>{formattedCurrentTime}</span>
        <div class="w-96 h-1 bg-gray-800 rounded-full overflow-hidden">
          <canvas
            bind:this={canvasElement}
            width="384"
            height="4"
            class="w-full h-full"
          />
        </div>
        <span>{formattedDuration}</span>
      </div>
    </div>

    <!-- Volume Control -->
    <div class="flex items-center gap-3 w-1/4 justify-end">
      <button
        class="text-gray-400 hover:text-white transition-colors"
        on:click={handleMute}
      >
        <Icon 
          name={isMuted ? 'volume-x' : volume < 0.5 ? 'volume-1' : 'volume-2'}
          size={20}
        />
      </button>

      <div class="w-32">
        <Slider
          value={volume}
          min={0}
          max={1}
          step={0.01}
          on:change={handleVolumeChange}
        />
      </div>
    </div>
  </div>

  <!-- Hidden Audio Element -->
  <audio
    bind:this={audioElement}
    {src}
    preload="auto"
    on:timeupdate={handleTimeUpdate}
    on:ended={() => {
      if (!isLooping && nextTrack) nextTrack();
    }}
  />
</div> 