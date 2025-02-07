<!-- TranscriptSearch.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Input, Icon } from '@lena/ui';
  import { debounce } from 'lodash-es';

  export let transcript: Array<{
    text: string;
    start: number;
    end: number;
    speaker?: string;
    confidence: number;
  }>;

  const dispatch = createEventDispatcher();
  let searchQuery = '';
  let activeSegmentIndex = -1;
  let isExpanded = false;
  let searchResults: Array<{
    segmentIndex: number;
    text: string;
    start: number;
    relevance: number;
    context: string;
  }> = [];

  $: if (searchQuery) {
    performSearch(searchQuery);
  } else {
    searchResults = [];
  }

  const performSearch = debounce((query: string) => {
    // Simple search implementation - in production, use a proper search algorithm
    const results = transcript
      .map((segment, index) => {
        const text = segment.text.toLowerCase();
        const queryLower = query.toLowerCase();
        
        if (text.includes(queryLower)) {
          // Get surrounding context
          const prevSegment = transcript[index - 1]?.text || '';
          const nextSegment = transcript[index + 1]?.text || '';
          
          return {
            segmentIndex: index,
            text: segment.text,
            start: segment.start,
            relevance: calculateRelevance(text, queryLower),
            context: `...${prevSegment} ${segment.text} ${nextSegment}...`
          };
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 5);

    searchResults = results;
  }, 300);

  function calculateRelevance(text: string, query: string): number {
    const occurrences = (text.match(new RegExp(query, 'gi')) || []).length;
    const proximity = text.indexOf(query) / text.length;
    return occurrences * (1 - proximity);
  }

  function handleResultClick(start: number) {
    dispatch('seek', { timestamp: start });
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

  function highlightText(text: string, query: string): string {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark class="bg-primary-500/30 text-white">$1</mark>');
  }
</script>

<div class="rounded-lg bg-gray-800/50 overflow-hidden">
  <button
    class="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-700/50 transition-colors"
    on:click={() => isExpanded = !isExpanded}
  >
    <div class="flex items-center gap-2">
      <Icon name="search" size={20} />
      <span class="font-medium">Search Transcript</span>
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
      <!-- Search Input -->
      <Input
        type="search"
        bind:value={searchQuery}
        placeholder="Search in video transcript..."
        icon="search"
      />

      <!-- Search Results -->
      {#if searchResults.length > 0}
        <div class="space-y-3">
          {#each searchResults as result}
            <button
              class="w-full text-left p-3 rounded-lg hover:bg-gray-700/50 transition-colors"
              on:click={() => handleResultClick(result.start)}
            >
              <div class="flex items-center gap-2 mb-1">
                <span class="text-sm font-medium">
                  {formatTimestamp(result.start)}
                </span>
                <div class="flex-1 h-px bg-gray-700" />
                <span class="text-xs text-gray-400">
                  Click to jump
                </span>
              </div>
              <p 
                class="text-sm text-gray-300"
                >{@html highlightText(result.context, searchQuery)}
              </p>
            </button>
          {/each}
        </div>
      {:else if searchQuery}
        <div class="text-center text-gray-400 py-4">
          No results found for "{searchQuery}"
        </div>
      {/if}

      <!-- Full Transcript -->
      <div class="mt-6 pt-6 border-t border-gray-700">
        <h3 class="text-sm font-medium mb-3">Full Transcript</h3>
        <div class="space-y-4 max-h-96 overflow-y-auto">
          {#each transcript as segment, index}
            <div 
              class="flex gap-4"
              class:bg-primary-500/10={index === activeSegmentIndex}
            >
              {#if segment.speaker}
                <div class="flex-shrink-0 w-24 text-sm text-gray-400">
                  {segment.speaker}
                </div>
              {/if}
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <button
                    class="text-sm text-gray-400 hover:text-white transition-colors"
                    on:click={() => handleResultClick(segment.start)}
                  >
                    {formatTimestamp(segment.start)}
                  </button>
                  {#if segment.confidence < 0.8}
                    <span class="text-xs text-yellow-500">
                      Low confidence
                    </span>
                  {/if}
                </div>
                <p class="text-sm">
                  {@html highlightText(segment.text, searchQuery)}
                </p>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  :global(mark) {
    background: none;
    color: inherit;
  }
</style> 