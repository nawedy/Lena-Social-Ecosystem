<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { Button } from '$lib/components/ui';
  import { Icon } from '$lib/components/ui';
  import RecordRTC from 'recordrtc';

  export let maxDuration = 60; // Maximum recording duration in seconds
  export let countdown = 3; // Countdown before recording starts
  export let flipCamera = true; // Allow camera flipping
  export let filters = true; // Enable video filters
  export let effects = true; // Enable video effects

  let stream: MediaStream | null = null;
  let recorder: RecordRTC | null = null;
  let videoElement: HTMLVideoElement;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null;
  let recordingStartTime: number = 0;
  let recordingDuration: number = 0;
  let isRecording = false;
  let isPaused = false;
  let isCountingDown = false;
  let countdownValue = countdown;
  let currentFilter = 'none';
  let currentEffect = 'none';
  let facingMode: 'user' | 'environment' = 'user';

  const dispatch = createEventDispatcher<{
    start: void;
    stop: { blob: Blob };
    error: { message: string };
  }>();

  const filterOptions = [
    { value: 'none', label: 'Normal' },
    { value: 'grayscale', label: 'Grayscale' },
    { value: 'sepia', label: 'Sepia' },
    { value: 'invert', label: 'Invert' },
    { value: 'blur', label: 'Blur' }
  ];

  const effectOptions = [
    { value: 'none', label: 'None' },
    { value: 'glitch', label: 'Glitch' },
    { value: 'vhs', label: 'VHS' },
    { value: 'pixelate', label: 'Pixelate' },
    { value: 'rgb-shift', label: 'RGB Shift' }
  ];

  onMount(async () => {
    try {
      await initializeCamera();
      initializeCanvas();
      startVideoProcessing();
    } catch (error) {
      dispatch('error', { message: error.message });
    }
  });

  onDestroy(() => {
    stopRecording();
    stopCamera();
  });

  async function initializeCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1080 },
          height: { ideal: 1920 }
        },
        audio: true
      });
      videoElement.srcObject = stream;
      await videoElement.play();
    } catch (error) {
      console.error('Failed to initialize camera:', error);
      throw new Error('Failed to access camera and microphone');
    }
  }

  function initializeCanvas() {
    ctx = canvas.getContext('2d');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
  }

  function startVideoProcessing() {
    if (!ctx) return;

    function processFrame() {
      if (!ctx || !videoElement) return;

      // Draw video frame to canvas
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

      // Apply filter
      if (currentFilter !== 'none') {
        ctx.filter = getFilterStyle(currentFilter);
        ctx.drawImage(canvas, 0, 0);
        ctx.filter = 'none';
      }

      // Apply effect
      if (currentEffect !== 'none') {
        applyEffect(currentEffect);
      }

      requestAnimationFrame(processFrame);
    }

    requestAnimationFrame(processFrame);
  }

  function getFilterStyle(filter: string): string {
    switch (filter) {
      case 'grayscale':
        return 'grayscale(100%)';
      case 'sepia':
        return 'sepia(100%)';
      case 'invert':
        return 'invert(100%)';
      case 'blur':
        return 'blur(4px)';
      default:
        return 'none';
    }
  }

  function applyEffect(effect: string) {
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    switch (effect) {
      case 'glitch':
        applyGlitchEffect(data);
        break;
      case 'vhs':
        applyVHSEffect(data);
        break;
      case 'pixelate':
        applyPixelateEffect(data);
        break;
      case 'rgb-shift':
        applyRGBShiftEffect(data);
        break;
    }

    ctx.putImageData(imageData, 0, 0);
  }

  function applyGlitchEffect(data: Uint8ClampedArray) {
    const amount = Math.random() * 10;
    const shift = Math.random() * 20 - 10;

    for (let i = 0; i < data.length; i += 4) {
      if (Math.random() < 0.05) {
        data[i] = data[i + amount * 4] || data[i];
        data[i + 1] = data[i + 1 + shift * 4] || data[i + 1];
      }
    }
  }

  function applyVHSEffect(data: Uint8ClampedArray) {
    for (let i = 0; i < data.length; i += 4) {
      const offset = Math.sin(i / 4000) * 10;
      data[i] = data[i + offset * 4] || data[i];
      data[i + 1] = data[i + 1] || data[i + 1];
      data[i + 2] = data[i + 2 - offset * 4] || data[i + 2];
    }
  }

  function applyPixelateEffect(data: Uint8ClampedArray) {
    const size = 10;
    for (let y = 0; y < canvas.height; y += size) {
      for (let x = 0; x < canvas.width; x += size) {
        const pixel = ctx!.getImageData(x, y, 1, 1).data;
        ctx!.fillStyle = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
        ctx!.fillRect(x, y, size, size);
      }
    }
  }

  function applyRGBShiftEffect(data: Uint8ClampedArray) {
    const amount = 5;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = data[i + amount * 4] || data[i];
      data[i + 2] = data[i + 2 - amount * 4] || data[i + 2];
    }
  }

  async function startRecording() {
    if (!stream) return;

    isCountingDown = true;
    const countdownInterval = setInterval(() => {
      countdownValue--;
      if (countdownValue === 0) {
        clearInterval(countdownInterval);
        isCountingDown = false;
        beginRecording();
      }
    }, 1000);
  }

  function beginRecording() {
    const canvasStream = canvas.captureStream(30);
    const audioTrack = stream!.getAudioTracks()[0];
    canvasStream.addTrack(audioTrack);

    recorder = new RecordRTC(canvasStream, {
      type: 'video',
      mimeType: 'video/webm;codecs=h264',
      frameRate: 30,
      quality: 10,
      width: canvas.width,
      height: canvas.height
    });

    recorder.startRecording();
    isRecording = true;
    recordingStartTime = Date.now();

    // Start duration timer
    const durationInterval = setInterval(() => {
      if (!isPaused) {
        recordingDuration = (Date.now() - recordingStartTime) / 1000;
        if (recordingDuration >= maxDuration) {
          clearInterval(durationInterval);
          stopRecording();
        }
      }
    }, 100);

    dispatch('start');
  }

  async function stopRecording() {
    if (!recorder || !isRecording) return;

    recorder.stopRecording(() => {
      const blob = recorder!.getBlob();
      dispatch('stop', { blob });
      isRecording = false;
      recordingDuration = 0;
      countdownValue = countdown;
    });
  }

  function pauseRecording() {
    if (!recorder || !isRecording) return;
    recorder.pauseRecording();
    isPaused = true;
  }

  function resumeRecording() {
    if (!recorder || !isRecording) return;
    recorder.resumeRecording();
    isPaused = false;
  }

  async function flipCameraDirection() {
    facingMode = facingMode === 'user' ? 'environment' : 'user';
    stopCamera();
    await initializeCamera();
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
  }
</script>

<div class="relative w-full aspect-[9/16] bg-black overflow-hidden rounded-lg">
  <video
    bind:this={videoElement}
    class="absolute inset-0 w-full h-full object-cover"
    autoplay
    playsinline
    muted
  />
  
  <canvas
    bind:this={canvas}
    class="absolute inset-0 w-full h-full object-cover"
  />

  {#if isCountingDown}
    <div class="absolute inset-0 flex items-center justify-center">
      <span class="text-8xl font-bold text-white animate-bounce">
        {countdownValue}
      </span>
    </div>
  {/if}

  <div class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
    <div class="flex items-center justify-between">
      <div class="flex items-center space-x-4">
        {#if !isRecording}
          <Button
            variant="primary"
            size="lg"
            class="rounded-full"
            on:click={startRecording}
          >
            <Icon name="video" class="mr-2 h-5 w-5" />
            Record
          </Button>
        {:else}
          {#if isPaused}
            <Button
              variant="primary"
              size="lg"
              class="rounded-full"
              on:click={resumeRecording}
            >
              <Icon name="play" class="mr-2 h-5 w-5" />
              Resume
            </Button>
          {:else}
            <Button
              variant="secondary"
              size="lg"
              class="rounded-full"
              on:click={pauseRecording}
            >
              <Icon name="pause" class="mr-2 h-5 w-5" />
              Pause
            </Button>
          {/if}

          <Button
            variant="destructive"
            size="lg"
            class="rounded-full"
            on:click={stopRecording}
          >
            <Icon name="square" class="mr-2 h-5 w-5" />
            Stop
          </Button>
        {/if}
      </div>

      <div class="flex items-center space-x-4">
        {#if flipCamera}
          <Button
            variant="ghost"
            size="icon"
            class="rounded-full"
            on:click={flipCameraDirection}
          >
            <Icon name="flip-horizontal" class="h-5 w-5" />
          </Button>
        {/if}

        {#if filters}
          <select
            bind:value={currentFilter}
            class="bg-transparent text-white border-none focus:ring-0"
          >
            {#each filterOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        {/if}

        {#if effects}
          <select
            bind:value={currentEffect}
            class="bg-transparent text-white border-none focus:ring-0"
          >
            {#each effectOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        {/if}
      </div>
    </div>

    {#if isRecording}
      <div class="absolute top-4 left-4 flex items-center space-x-2">
        <div class="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
        <span class="text-white font-medium">
          {recordingDuration.toFixed(1)}s
        </span>
      </div>
    {/if}
  </div>
</div>

<style>
  select option {
    @apply bg-gray-900 text-white;
  }
</style> 