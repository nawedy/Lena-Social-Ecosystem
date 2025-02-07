<!-- QueueManager.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Button, Icon } from '@lena/ui';
  import { dndzone } from 'svelte-dnd-action';

  export let currentTrack: {
    id: string;
    title: string;
    artist: string;
    artwork?: string;
    duration: number;
  } | null = null;

  export let queue: Array<{
    id: string;
    title: string;
    artist: string;
    artwork?: string;
    duration: number;
  }> = [];

  export let recommendations: Array<{
    id: string;
    title: string;
    artist: string;
    artwork?: string;
    duration: number;
    confidence: number;
  }> = [];

  const dispatch = createEventDispatcher();
  let isExpanded = false;
  let isDragging = false;
  let showRecommendations = false;

  function handleDndConsider(e: CustomEvent<{ items: typeof queue }>) {
    isDragging = true;
    queue = e.detail.items;
  }

  function handleDndFinalize(e: CustomEvent<{ items: typeof queue }>) {
    isDragging = false;
    queue = e.detail.items;
    dispatch('reorder', { queue });
  }

  function removeFromQueue(trackId: string) {
    queue = queue.filter(track => track.id !== trackId);
    dispatch('remove', { trackId });
  }

  function addToQueue(track: typeof recommendations[0]) {
    queue = [...queue, track];
    dispatch('add', { track });
  }

  function clearQueue() {
    queue = [];
    dispatch('clear');
  }

  function saveQueue() {
    dispatch('save', { queue });
  }

  function formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
</script>

<div class="rounded-lg bg-gray-800/50 overflow-hidden">
  <!-- Header -->
  <button
    class="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-700/50 transition-colors"
    on:click={() => isExpanded = !isExpanded}
  >
    <div class="flex items-center gap-2">
      <Icon name="list-music" size={20} />
      <span class="font-medium">Queue</span>
      <span class="text-sm text-gray-400">({queue.length})</span>
    </div>
    <Icon 
      name="chevron-down"
      size={20}
      class="transform transition-transform duration-200"
      class:rotate-180={isExpanded}
    />
  </button>

  {#if isExpanded}
    <div class="p-4 space-y-4">
      <!-- Queue Actions -->
      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          on:click={clearQueue}
          disabled={queue.length === 0}
        >
          Clear Queue
        </Button>
        <Button
          variant="outline"
          size="sm"
          on:click={saveQueue}
          disabled={queue.length === 0}
        >
          Save Queue
        </Button>
        <Button
          variant="outline"
          size="sm"
          on:click={() => showRecommendations = !showRecommendations}
        >
          {showRecommendations ? 'Hide' : 'Show'} Recommendations
        </Button>
      </div>

      <!-- Current Track -->
      {#if currentTrack}
        <div class="flex items-center gap-3 p-3 bg-primary-500/10 rounded-lg">
          <div class="w-12 h-12 rounded overflow-hidden flex-shrink-0">
            <img
              src={currentTrack.artwork || 'default-artwork.png'}
              alt={currentTrack.title}
              class="w-full h-full object-cover"
            />
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-medium truncate">{currentTrack.title}</p>
            <p class="text-sm text-gray-400 truncate">{currentTrack.artist}</p>
          </div>
          <span class="text-sm text-gray-400">
            {formatDuration(currentTrack.duration)}
          </span>
        </div>
      {/if}

      <!-- Queue List -->
      {#if queue.length > 0}
        <div
          use:dndzone={{items: queue}}
          on:consider={handleDndConsider}
          on:finalize={handleDndFinalize}
          class="space-y-2"
        >
          {#each queue as track (track.id)}
            <div
              class="flex items-center gap-3 p-3 bg-gray-700/30 rounded-lg"
              class:opacity-50={isDragging}
            >
              <div class="flex-shrink-0 text-gray-400">
                <Icon name="grip-vertical" size={20} />
              </div>
              <div class="w-10 h-10 rounded overflow-hidden flex-shrink-0">
                <img
                  src={track.artwork || 'default-artwork.png'}
                  alt={track.title}
                  class="w-full h-full object-cover"
                />
              </div>
              <div class="flex-1 min-w-0">
                <p class="truncate">{track.title}</p>
                <p class="text-sm text-gray-400 truncate">{track.artist}</p>
              </div>
              <span class="text-sm text-gray-400">
                {formatDuration(track.duration)}
              </span>
              <button
                class="p-1 text-gray-400 hover:text-white transition-colors"
                on:click={() => removeFromQueue(track.id)}
              >
                <Icon name="x" size={20} />
              </button>
            </div>
          {/each}
        </div>
      {:else}
        <p class="text-center text-gray-400 py-4">Queue is empty</p>
      {/if}

      <!-- Recommendations -->
      {#if showRecommendations && recommendations.length > 0}
        <div class="mt-6">
          <h3 class="text-sm font-medium text-gray-400 mb-3">Recommended Next</h3>
          <div class="space-y-2">
            {#each recommendations as track (track.id)}
              <div class="flex items-center gap-3 p-3 bg-gray-700/30 rounded-lg">
                <div class="w-10 h-10 rounded overflow-hidden flex-shrink-0">
                  <img
                    src={track.artwork || 'default-artwork.png'}
                    alt={track.title}
                    class="w-full h-full object-cover"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="truncate">{track.title}</p>
                  <p class="text-sm text-gray-400 truncate">{track.artist}</p>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-sm text-primary-400">
                    {Math.round(track.confidence * 100)}% match
                  </span>
                  <button
                    class="p-1 text-gray-400 hover:text-white transition-colors"
                    on:click={() => addToQueue(track)}
                  >
                    <Icon name="plus" size={20} />
                  </button>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div> 