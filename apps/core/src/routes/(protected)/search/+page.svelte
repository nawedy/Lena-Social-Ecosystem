<!-- Search Page -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { DatabaseService } from '$lib/services/database';
  import { toasts } from '@lena/ui';
  import type { Post, Profile } from '$lib/types/supabase';
  import PostComponent from '$lib/components/Post.svelte';

  interface SearchFilters {
    type: 'all' | 'posts' | 'users' | 'hashtags' | 'locations';
    sortBy: 'recent' | 'popular' | 'relevant';
    timeRange: 'all' | 'day' | 'week' | 'month' | 'year';
    mediaType: 'all' | 'image' | 'video' | 'text';
    verified: boolean;
    location?: {
      latitude: number;
      longitude: number;
      radius: number;
    };
  }

  let searchQuery = '';
  let results: (Post | Profile | { tag: string; count: number })[] = [];
  let trendingHashtags: { tag: string; count: number }[] = [];
  let isLoading = false;
  let isLoadingLocation = false;
  let debouncedSearch: NodeJS.Timeout;

  let filters: SearchFilters = {
    type: 'all',
    sortBy: 'relevant',
    timeRange: 'all',
    mediaType: 'all',
    verified: false
  };

  let locationEnabled = false;
  let locationRadius = 10; // kilometers

  onMount(async () => {
    try {
      // Load trending hashtags
      trendingHashtags = await DatabaseService.getTrendingHashtags();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to load trending hashtags');
    }
  });

  $: if (searchQuery) {
    clearTimeout(debouncedSearch);
    debouncedSearch = setTimeout(() => {
      performSearch();
    }, 300);
  }

  async function performSearch() {
    if (!searchQuery.trim()) {
      results = [];
      return;
    }

    try {
      isLoading = true;
      const searchResults = await DatabaseService.search(searchQuery, filters);
      results = searchResults;
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to perform search');
    } finally {
      isLoading = false;
    }
  }

  async function enableLocationSearch() {
    try {
      isLoadingLocation = true;
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });

      filters = {
        ...filters,
        location: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          radius: locationRadius
        }
      };

      locationEnabled = true;
      performSearch();
    } catch (error) {
      toasts.error('Failed to get your location. Please enable location services.');
    } finally {
      isLoadingLocation = false;
    }
  }

  function disableLocationSearch() {
    filters = {
      ...filters,
      location: undefined
    };
    locationEnabled = false;
    performSearch();
  }

  function handleHashtagClick(tag: string) {
    searchQuery = tag;
    filters = {
      ...filters,
      type: 'posts'
    };
    performSearch();
  }

  function isPost(result: Post | Profile | { tag: string; count: number }): result is Post {
    return 'content' in result;
  }

  function isHashtag(result: Post | Profile | { tag: string; count: number }): result is { tag: string; count: number } {
    return 'tag' in result;
  }

  function formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  function formatCount(count: number): string {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  }
</script>

<svelte:head>
  <title>Search | TikTokToe</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 py-8">
  <!-- Search Header -->
  <div class="max-w-2xl mx-auto mb-8">
    <div class="relative">
      <input
        type="search"
        bind:value={searchQuery}
        placeholder="Search posts, users, hashtags, or nearby content..."
        class="w-full bg-black/50 border border-primary-900/50 rounded-lg pl-12 pr-4 py-3 focus:ring-2 focus:ring-primary-500/50 focus:border-transparent"
      />
      <span class="absolute left-4 top-1/2 -translate-y-1/2 text-xl">
        🔍
      </span>
    </div>

    <!-- Trending Hashtags -->
    {#if trendingHashtags.length > 0}
      <div class="mt-4 flex flex-wrap gap-2">
        {#each trendingHashtags as { tag, count } (tag)}
          <button
            class="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-primary-900/20 hover:bg-primary-900/40 transition-colors"
            on:click={() => handleHashtagClick(tag)}
          >
            <span>{tag}</span>
            <span class="text-sm text-gray-400">{formatCount(count)}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Filters -->
  <div class="max-w-2xl mx-auto mb-8">
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
      <!-- Type Filter -->
      <div>
        <label class="block text-sm font-medium mb-2">Type</label>
        <select
          bind:value={filters.type}
          class="w-full bg-black/50 border border-primary-900/50 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500/50 focus:border-transparent"
        >
          <option value="all">All</option>
          <option value="posts">Posts</option>
          <option value="users">Users</option>
          <option value="hashtags">Hashtags</option>
          <option value="locations">Nearby</option>
        </select>
      </div>

      <!-- Sort By Filter -->
      <div>
        <label class="block text-sm font-medium mb-2">Sort By</label>
        <select
          bind:value={filters.sortBy}
          class="w-full bg-black/50 border border-primary-900/50 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500/50 focus:border-transparent"
        >
          <option value="relevant">Relevant</option>
          <option value="recent">Recent</option>
          <option value="popular">Popular</option>
        </select>
      </div>

      <!-- Time Range Filter -->
      <div>
        <label class="block text-sm font-medium mb-2">Time Range</label>
        <select
          bind:value={filters.timeRange}
          class="w-full bg-black/50 border border-primary-900/50 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500/50 focus:border-transparent"
        >
          <option value="all">All Time</option>
          <option value="day">Past 24h</option>
          <option value="week">Past Week</option>
          <option value="month">Past Month</option>
          <option value="year">Past Year</option>
        </select>
      </div>

      <!-- Media Type Filter -->
      <div>
        <label class="block text-sm font-medium mb-2">Media Type</label>
        <select
          bind:value={filters.mediaType}
          class="w-full bg-black/50 border border-primary-900/50 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500/50 focus:border-transparent"
        >
          <option value="all">All</option>
          <option value="image">Images</option>
          <option value="video">Videos</option>
          <option value="text">Text Only</option>
        </select>
      </div>

      <!-- Location Radius -->
      <div>
        <label class="block text-sm font-medium mb-2">Radius (km)</label>
        <input
          type="number"
          bind:value={locationRadius}
          min="1"
          max="100"
          class="w-full bg-black/50 border border-primary-900/50 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500/50 focus:border-transparent"
          disabled={!locationEnabled}
        />
      </div>

      <!-- Location Toggle -->
      <div class="flex items-end">
        {#if locationEnabled}
          <button
            class="btn-outline w-full"
            on:click={disableLocationSearch}
          >
            Disable Location
          </button>
        {:else}
          <button
            class="btn-primary w-full"
            on:click={enableLocationSearch}
            disabled={isLoadingLocation}
          >
            {isLoadingLocation ? 'Getting Location...' : 'Enable Location'}
          </button>
        {/if}
      </div>
    </div>

    <!-- Verified Filter -->
    <div class="mt-4">
      <label class="flex items-center space-x-2">
        <input
          type="checkbox"
          bind:checked={filters.verified}
          class="form-checkbox rounded border-primary-900/50 bg-black/50 text-primary-500 focus:ring-primary-500/50"
        />
        <span>Verified Only</span>
      </label>
    </div>
  </div>

  <!-- Search Results -->
  {#if isLoading}
    <div class="max-w-2xl mx-auto space-y-6">
      {#each Array(3) as _}
        <div class="animate-pulse">
          <div class="h-32 bg-primary-900/20 rounded-lg"></div>
        </div>
      {/each}
    </div>
  {:else if results.length > 0}
    <div class="max-w-2xl mx-auto space-y-6">
      {#each results as result (isHashtag(result) ? result.tag : result.id)}
        {#if isPost(result)}
          <PostComponent post={result} />
        {:else if isHashtag(result)}
          <!-- Hashtag Card -->
          <div class="bg-primary-900/20 rounded-lg p-6">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-xl font-medium">{result.tag}</h3>
                <p class="text-sm text-gray-400">
                  {formatCount(result.count)} posts
                </p>
              </div>
              <button
                class="btn-primary"
                on:click={() => handleHashtagClick(result.tag)}
              >
                View Posts
              </button>
            </div>
          </div>
        {:else}
          <!-- User Card -->
          <div class="bg-primary-900/20 rounded-lg p-6">
            <div class="flex items-center space-x-4">
              <img
                src={result.avatar_url || `https://api.dicebear.com/7.x/shapes/svg?seed=${result.id}`}
                alt={result.username}
                class="w-16 h-16 rounded-full bg-primary-900/50"
              />
              <div>
                <h3 class="font-medium text-lg">@{result.username}</h3>
                <p class="text-sm text-gray-400">
                  Joined {formatDate(result.created_at)}
                </p>
              </div>
              <button class="btn-primary ml-auto">
                Follow
              </button>
            </div>
          </div>
        {/if}
      {/each}
    </div>
  {:else if searchQuery}
    <div class="max-w-2xl mx-auto text-center py-12">
      <p class="text-2xl mb-2">🔍</p>
      <p class="text-gray-400">No results found for "{searchQuery}"</p>
    </div>
  {/if}
</div>

<style lang="postcss">
  .btn-primary {
    @apply inline-flex items-center justify-center px-6 py-2 rounded-lg font-medium transition-all duration-200 bg-gradient-to-r from-primary-500 to-primary-600 text-black hover:from-primary-400 hover:to-primary-500 hover:shadow-neon disabled:opacity-50 disabled:cursor-not-allowed;
  }

  .btn-outline {
    @apply inline-flex items-center justify-center px-6 py-2 rounded-lg font-medium transition-all duration-200 border-2 border-primary-500 text-primary-500 hover:bg-primary-500/10 disabled:opacity-50 disabled:cursor-not-allowed;
  }

  .form-checkbox {
    @apply rounded border-primary-900/50 bg-black/50 text-primary-500 focus:ring-primary-500/50;
  }
</style> 