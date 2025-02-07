<!-- Toast.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';

  export let id: string;
  export let type: 'success' | 'error' | 'info' | 'warning' = 'info';
  export let title = '';
  export let message = '';
  export let duration = 5000;
  export let position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' = 'top-right';
  export let onClose: (id: string) => void;

  let progressWidth = 100;
  let timeoutId: number;
  let startTime: number;
  let remaining = duration;

  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️'
  };

  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    warning: 'bg-yellow-500'
  };

  function startTimer() {
    startTime = Date.now();
    timeoutId = window.setTimeout(() => {
      onClose(id);
    }, remaining);

    requestAnimationFrame(updateProgress);
  }

  function pauseTimer() {
    clearTimeout(timeoutId);
    remaining -= Date.now() - startTime;
  }

  function updateProgress() {
    if (!startTime) return;

    const elapsed = Date.now() - startTime;
    progressWidth = Math.max(0, ((remaining - elapsed) / duration) * 100);

    if (progressWidth > 0) {
      requestAnimationFrame(updateProgress);
    }
  }

  onMount(() => {
    startTimer();
    return () => clearTimeout(timeoutId);
  });
</script>

<div
  class="relative min-w-[320px] max-w-sm bg-gray-900 rounded-lg shadow-lg overflow-hidden"
  role="alert"
  on:mouseenter={pauseTimer}
  on:mouseleave={startTimer}
  transition:fly={{
    duration: 300,
    x: position.includes('right') ? 100 : -100,
    opacity: 0
  }}
>
  <div class="p-4 pr-12">
    <div class="flex items-center gap-3">
      <span class="text-xl" role="img" aria-label={type}>
        {icons[type]}
      </span>
      {#if title}
        <h4 class="font-medium">{title}</h4>
      {/if}
      <button
        class="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        on:click={() => onClose(id)}
        aria-label="Close notification"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fill-rule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clip-rule="evenodd"
          />
        </svg>
      </button>
    </div>
    {#if message}
      <p class="mt-1 text-gray-300">{message}</p>
    {/if}
  </div>

  <div class="h-1 {colors[type]} transition-all duration-200" style="width: {progressWidth}%" />
</div> 