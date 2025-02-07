<!-- SearchComponent.svelte -->
<script lang="ts">
  import { fade, slide } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { writable, derived } from 'svelte/store';
  import { supabase } from '$lib/supabaseClient';
  import debounce from 'lodash/debounce';

  // Props
  export let onSearch: (results: any[]) => void;

  // Types
  interface SearchFilters {
    type: 'posts' | 'users' | 'tags';
    timeRange: 'day' | 'week' | 'month' | 'year' | 'all';
    sortBy: 'recent' | 'relevant' | 'trending';
    verified: boolean;
    hasMedia: boolean;
    minEngagement: number;
  }

  // Stores
  const searchQuery = writable('');
  const searchResults = writable<any[]>([]);
  const suggestions = writable<string[]>([]);
  const isLoading = writable(false);
  const showFilters = writable(false);
  const filters = writable<SearchFilters>({
    type: 'posts',
    timeRange: 'all',
    sortBy: 'relevant',
    verified: false,
    hasMedia: false,
    minEngagement: 0
  });

  // Derived store for filtered results
  const filteredResults = derived(
    [searchResults, filters],
    ([$searchResults, $filters]) => {
      let results = [...$searchResults];

      // Apply filters
      if ($filters.verified) {
        results = results.filter(r => r.is_verified);
      }
      if ($filters.hasMedia) {
        results = results.filter(r => r.media_urls?.length > 0);
      }
      if ($filters.minEngagement > 0) {
        results = results.filter(r => 
          (r.likes + r.reposts + r.replies) >= $filters.minEngagement
        );
      }

      // Apply time range filter
      if ($filters.timeRange !== 'all') {
        const now = new Date();
        const ranges = {
          day: 24 * 60 * 60 * 1000,
          week: 7 * 24 * 60 * 60 * 1000,
          month: 30 * 24 * 60 * 60 * 1000,
          year: 365 * 24 * 60 * 60 * 1000
        };
        results = results.filter(r => 
          new Date(r.created_at).getTime() > now.getTime() - ranges[$filters.timeRange]
        );
      }

      // Apply sorting
      switch ($filters.sortBy) {
        case 'recent':
          results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          break;
        case 'trending':
          results.sort((a, b) => b.trending_score - a.trending_score);
          break;
        case 'relevant':
          // Relevance is calculated based on multiple factors
          results.sort((a, b) => {
            const scoreA = calculateRelevanceScore(a);
            const scoreB = calculateRelevanceScore(b);
            return scoreB - scoreA;
          });
          break;
      }

      return results;
    }
  );

  // Search function with debounce
  const performSearch = debounce(async (query: string) => {
    if (!query.trim()) {
      searchResults.set([]);
      return;
    }

    isLoading.set(true);
    try {
      const { data, error } = await supabase
        .from($filters.type)
        .select('*')
        .textSearch('content', query)
        .limit(20);

      if (error) throw error;
      searchResults.set(data);
      onSearch(data);
    } catch (err) {
      console.error('Search error:', err);
      searchResults.set([]);
    } finally {
      isLoading.set(false);
    }
  }, 300);

  // Update suggestions as user types
  const updateSuggestions = debounce(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      suggestions.set([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('search_suggestions')
        .select('suggestion')
        .ilike('suggestion', `${query}%`)
        .limit(5);

      if (error) throw error;
      suggestions.set(data.map(d => d.suggestion));
    } catch (err) {
      console.error('Suggestion error:', err);
      suggestions.set([]);
    }
  }, 200);

  function calculateRelevanceScore(item: any): number {
    const age = new Date().getTime() - new Date(item.created_at).getTime();
    const engagement = item.likes + item.reposts * 2 + item.replies * 1.5;
    const verifiedBonus = item.is_verified ? 1.2 : 1;
    const mediaBonus = item.media_urls?.length > 0 ? 1.1 : 1;
    
    return (engagement / Math.log2(age)) * verifiedBonus * mediaBonus;
  }

  // Handle input changes
  function handleInput(event: Event) {
    const query = (event.target as HTMLInputElement).value;
    searchQuery.set(query);
    updateSuggestions(query);
    performSearch(query);
  }

  // Handle suggestion click
  function handleSuggestionClick(suggestion: string) {
    searchQuery.set(suggestion);
    suggestions.set([]);
    performSearch(suggestion);
  }
</script>

<div class="search-container">
  <div class="search-bar">
    <div class="relative">
      <input
        type="text"
        class="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg
               border border-gray-200 dark:border-gray-600
               focus:ring-2 focus:ring-blue-500 focus:border-transparent
               text-gray-900 dark:text-white placeholder-gray-500"
        placeholder="Search posts, users, or tags..."
        bind:value={$searchQuery}
        on:input={handleInput}
      />

      {#if $isLoading}
        <div class="absolute right-3 top-2.5">
          <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
        </div>
      {/if}

      <!-- Suggestions Dropdown -->
      {#if $suggestions.length > 0}
        <div
          class="absolute w-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg
                 border border-gray-200 dark:border-gray-700 z-50"
          transition:slide|local
        >
          {#each $suggestions as suggestion}
            <button
              class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700
                     text-gray-900 dark:text-white"
              on:click={() => handleSuggestionClick(suggestion)}
            >
              {suggestion}
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <button
      class="ml-2 p-2 text-gray-500 hover:text-blue-500 dark:text-gray-400
             dark:hover:text-blue-400"
      on:click={() => showFilters.update(v => !v)}
    >
      <svg class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clip-rule="evenodd" />
      </svg>
    </button>
  </div>

  <!-- Advanced Filters -->
  {#if $showFilters}
    <div class="filters-panel" transition:slide|local>
      <div class="grid grid-cols-2 md:grid-cols-3 gap-4 p-4">
        <!-- Search Type -->
        <div class="filter-group">
          <label>Search Type</label>
          <select bind:value={$filters.type}>
            <option value="posts">Posts</option>
            <option value="users">Users</option>
            <option value="tags">Tags</option>
          </select>
        </div>

        <!-- Time Range -->
        <div class="filter-group">
          <label>Time Range</label>
          <select bind:value={$filters.timeRange}>
            <option value="all">All Time</option>
            <option value="day">Last 24 Hours</option>
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
            <option value="year">Last Year</option>
          </select>
        </div>

        <!-- Sort By -->
        <div class="filter-group">
          <label>Sort By</label>
          <select bind:value={$filters.sortBy}>
            <option value="relevant">Most Relevant</option>
            <option value="recent">Most Recent</option>
            <option value="trending">Trending</option>
          </select>
        </div>

        <!-- Toggle Filters -->
        <div class="filter-group">
          <label class="flex items-center space-x-2">
            <input
              type="checkbox"
              bind:checked={$filters.verified}
              class="form-checkbox"
            />
            <span>Verified Only</span>
          </label>
        </div>

        <div class="filter-group">
          <label class="flex items-center space-x-2">
            <input
              type="checkbox"
              bind:checked={$filters.hasMedia}
              class="form-checkbox"
            />
            <span>Has Media</span>
          </label>
        </div>

        <!-- Engagement Slider -->
        <div class="filter-group">
          <label>Min. Engagement</label>
          <input
            type="range"
            bind:value={$filters.minEngagement}
            min="0"
            max="1000"
            step="50"
            class="w-full"
          />
          <span class="text-sm text-gray-500">{$filters.minEngagement}+ interactions</span>
        </div>
      </div>
    </div>
  {/if}
</div>

<style lang="postcss">
  .search-container {
    @apply w-full;
  }

  .search-bar {
    @apply flex items-center mb-4;
  }

  .filters-panel {
    @apply bg-white dark:bg-gray-800 rounded-lg shadow-lg
           border border-gray-200 dark:border-gray-700 mb-4;
  }

  .filter-group {
    @apply flex flex-col space-y-1;
  }

  .filter-group label {
    @apply text-sm text-gray-700 dark:text-gray-300;
  }

  .filter-group select {
    @apply bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600
           rounded-md px-2 py-1 text-sm text-gray-900 dark:text-white
           focus:ring-2 focus:ring-blue-500 focus:border-transparent;
  }

  .form-checkbox {
    @apply rounded border-gray-300 text-blue-500 shadow-sm
           focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50;
  }

  input[type="range"] {
    @apply rounded-lg overflow-hidden appearance-none bg-gray-200 dark:bg-gray-700
           h-3 w-full;
  }

  input[type="range"]::-webkit-slider-thumb {
    @apply appearance-none w-4 h-4 cursor-pointer
           bg-blue-500 rounded-full shadow;
    -webkit-appearance: none;
  }
</style> 