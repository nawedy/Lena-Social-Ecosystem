<!-- VideoChapters.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Icon } from '@lena/ui';

  export let currentTime = 0;
  export let duration = 0;
  export let chapters: Array<{
    title: string;
    timestamp: number;
    aiGenerated?: boolean;
    thumbnail?: string;
  }> = [];

  const dispatch = createEventDispatcher();
  let isExpanded = false;

  $: activeChapterIndex = chapters.findIndex((chapter, index) => {
    const nextChapter = chapters[index + 1];
    return currentTime >= chapter.timestamp && 
           (!nextChapter || currentTime < nextChapter.timestamp);
  });

  function handleChapterClick(timestamp: number) {
    dispatch('seek', { timestamp });
  }

  function formatTimestamp(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
</script>

<div class="rounded-lg bg-gray-800/50 overflow-hidden">
  <button
    class="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-700/50 transition-colors"
    on:click={() => isExpanded = !isExpanded}
  >
    <div class="flex items-center gap-2">
      <Icon name="list" size={20} />
      <span class="font-medium">Chapters</span>
      {#if chapters.some(c => c.aiGenerated)}
        <span class="px-1.5 py-0.5 text-xs bg-primary-500/20 text-primary-400 rounded">
          AI Enhanced
        </span>
      {/if}
    </div>
    <Icon 
      name="chevron-down"
      size={20}
      class="transform transition-transform duration-200"
      class:rotate-180={isExpanded}
    />
  </button>

  {#if isExpanded}
    <div class="divide-y divide-gray-700/50">
      {#each chapters as chapter, index}
        <button
          class="w-full p-3 flex items-start gap-3 hover:bg-gray-700/50 transition-colors"
          class:bg-primary-500/10={index === activeChapterIndex}
          on:click={() => handleChapterClick(chapter.timestamp)}
        >
          {#if chapter.thumbnail}
            <div class="relative flex-shrink-0 w-24 aspect-video rounded overflow-hidden">
              <img
                src={chapter.thumbnail}
                alt={chapter.title}
                class="w-full h-full object-cover"
                loading="lazy"
              />
              <div class="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <Icon name="play" size={24} />
              </div>
            </div>
          {/if}

          <div class="flex-1 text-left">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium">
                {formatTimestamp(chapter.timestamp)}
              </span>
              {#if chapter.aiGenerated}
                <Icon name="sparkles" size={16} class="text-primary-400" />
              {/if}
            </div>
            <p class="text-sm text-gray-400 line-clamp-2 mt-1">
              {chapter.title}
            </p>
          </div>

          <!-- Progress Indicator -->
          {#if index === activeChapterIndex}
            <div class="flex-shrink-0 w-1 h-1 rounded-full bg-primary-500 mt-2" />
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div> 