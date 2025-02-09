<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { VideoPlayer } from '@tiktok-toe/ui-shared/components';
  import { Button, Icon } from '@tiktok-toe/ui-shared/components/ui';
  import { duetService } from '@tiktok-toe/shared/services/video/DuetService';

  export let originalVideoId: string;
  export let originalVideoUrl: string;
  export let mode: 'duet' | 'reaction' = 'duet';
  export let layout: 'side-by-side' | 'picture-in-picture' | 'vertical-split' = 'side-by-side';

  const dispatch = createEventDispatcher<{
    complete: { outputUrl: string; duration: number };
    error: { message: string };
    cancel: void;
  }>();

  let recording = false;
  let processing = false;
  let error: string | null = null;
  let sessionId: string | null = null;
  let previewStream: MediaStream | null = null;
  let videoElement: HTMLVideoElement;
  let countdown = 3;
  let countdownInterval: ReturnType<typeof setInterval>;
  let duration = 0;
  let durationInterval: ReturnType<typeof setInterval>;

  onMount(async () => {
    try {
      // Request camera and microphone permissions early
      previewStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      if (videoElement) {
        videoElement.srcObject = previewStream;
        videoElement.play();
      }
    } catch (err) {
      error = 'Failed to access camera and microphone';
      dispatch('error', { message: error });
    }
  });

  onDestroy(() => {
    cleanup();
  });

  function cleanup() {
    if (previewStream) {
      previewStream.getTracks().forEach(track => track.stop());
    }
    if (countdownInterval) {
      clearInterval(countdownInterval);
    }
    if (durationInterval) {
      clearInterval(durationInterval);
    }
    if (sessionId) {
      duetService.cleanup();
    }
  }

  async function startRecording() {
    error = null;
    countdown = 3;

    // Start countdown
    countdownInterval = setInterval(() => {
      countdown--;
      if (countdown === 0) {
        clearInterval(countdownInterval);
        initiateRecording();
      }
    }, 1000);
  }

  async function initiateRecording() {
    try {
      sessionId = await duetService.startDuet(originalVideoId, {
        layout,
        isReaction: mode === 'reaction'
      });

      recording = true;
      duration = 0;
      durationInterval = setInterval(() => {
        duration++;
        if (duration >= 60) { // Max 60 seconds
          stopRecording();
        }
      }, 1000);

      // Listen for completion
      duetService.once('duet_completed', (event: { outputUrl: string; duration: number }) => {
        processing = false;
        dispatch('complete', {
          outputUrl: event.outputUrl,
          duration: event.duration
        });
      });

      duetService.once('duet_failed', (event: { error: string }) => {
        processing = false;
        error = event.error;
        dispatch('error', { message: event.error });
      });

    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to start recording';
      dispatch('error', { message: error || 'Unknown error' });
    }
  }

  async function stopRecording() {
    if (!sessionId) return;

    try {
      recording = false;
      processing = true;
      clearInterval(durationInterval);

      await duetService.stopDuet(sessionId);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to stop recording';
      dispatch('error', { message: error || 'Unknown error' });
    }
  }

  async function addReaction(type: string, value: string) {
    if (!sessionId || mode !== 'reaction') return;

    try {
      await duetService.addReaction(sessionId, { type, value });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to add reaction';
      dispatch('error', { message: error || 'Unknown error' });
    }
  }

  function formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  $: containerClasses = [
    'relative w-full h-full bg-black',
    layout === 'side-by-side' ? 'grid grid-cols-2 gap-2' :
    layout === 'vertical-split' ? 'grid grid-rows-2 gap-2' :
    'relative'
  ].join(' ');

  $: previewClasses = [
    'relative overflow-hidden rounded-lg bg-black',
    layout === 'picture-in-picture' ? 'absolute bottom-4 right-4 w-1/3 h-1/3 z-10' : 'w-full h-full'
  ].join(' ');
</script>

<div class="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
  <div class="relative w-full max-w-4xl h-[80vh]">
    <!-- Close Button -->
    <button
      class="absolute -top-12 right-0 text-white hover:text-primary-400 transition-colors"
      on:click={() => dispatch('cancel')}
    >
      <Icon name="x" class="w-8 h-8" />
    </button>

    <div class={containerClasses}>
      <!-- Original Video -->
      <div class="relative w-full h-full">
        <VideoPlayer
          src={originalVideoUrl}
          autoplay={recording}
          loop={!recording}
          controls={!recording}
          muted={recording}
        />
      </div>

      <!-- Preview/Recording -->
      <div class={previewClasses}>
        <video
          bind:this={videoElement}
          class="w-full h-full object-cover"
          autoplay
          playsinline
          muted
        />

        {#if countdown > 0 && !recording}
          <div
            class="absolute inset-0 flex items-center justify-center bg-black/50"
            transition:fade
          >
            <span class="text-6xl font-bold text-white">{countdown}</span>
          </div>
        {/if}
      </div>

      <!-- Controls -->
      <div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4">
        {#if !recording}
          <Button
            variant="primary"
            size="lg"
            disabled={processing}
            on:click={startRecording}
          >
            {#if processing}
              Processing...
            {:else}
              Start {mode === 'duet' ? 'Duet' : 'Reaction'}
            {/if}
          </Button>
        {:else}
          <div class="flex items-center gap-8">
            <span class="text-white font-medium">
              {formatDuration(duration)}
            </span>
            <Button
              variant="danger"
              size="lg"
              on:click={stopRecording}
            >
              Stop Recording
            </Button>
          </div>
        {/if}
      </div>

      <!-- Layout Controls -->
      {#if mode === 'duet' && !recording}
        <div
          class="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 p-2 rounded-lg"
          transition:slide
        >
          <button
            class="p-2 rounded-lg transition-colors"
            class:bg-primary-500={layout === 'side-by-side'}
            on:click={() => layout = 'side-by-side'}
          >
            <Icon name="layout-sidebar" class="w-6 h-6" />
          </button>
          <button
            class="p-2 rounded-lg transition-colors"
            class:bg-primary-500={layout === 'picture-in-picture'}
            on:click={() => layout = 'picture-in-picture'}
          >
            <Icon name="picture-in-picture" class="w-6 h-6" />
          </button>
          <button
            class="p-2 rounded-lg transition-colors"
            class:bg-primary-500={layout === 'vertical-split'}
            on:click={() => layout = 'vertical-split'}
          >
            <Icon name="layout-stack" class="w-6 h-6" />
          </button>
        </div>
      {/if}

      <!-- Reaction Controls -->
      {#if mode === 'reaction' && recording}
        <div
          class="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2"
          transition:slide
        >
          <button
            class="p-2 bg-primary-500 rounded-full hover:bg-primary-400 transition-colors"
            on:click={() => addReaction('emoji', '👍')}
          >
            👍
          </button>
          <button
            class="p-2 bg-primary-500 rounded-full hover:bg-primary-400 transition-colors"
            on:click={() => addReaction('emoji', '❤️')}
          >
            ❤️
          </button>
          <button
            class="p-2 bg-primary-500 rounded-full hover:bg-primary-400 transition-colors"
            on:click={() => addReaction('emoji', '😂')}
          >
            😂
          </button>
          <button
            class="p-2 bg-primary-500 rounded-full hover:bg-primary-400 transition-colors"
            on:click={() => addReaction('emoji', '😮')}
          >
            😮
          </button>
        </div>
      {/if}

      <!-- Error Message -->
      {#if error}
        <div
          class="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg"
          transition:slide
        >
          {error}
        </div>
      {/if}
    </div>
  </div>
</div> 