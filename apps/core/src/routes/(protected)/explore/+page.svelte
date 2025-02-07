<!-- Explore Page -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { DatabaseService } from '$lib/services/database';
  import { toasts } from '@lena/ui';
  import type { Post, Profile } from '$lib/types/supabase';
  import PostComponent from '$lib/components/Post.svelte';

  interface TrendingTopic {
    id: string;
    name: string;
    posts: number;
  }

  let trendingTopics: TrendingTopic[] = [];
  let suggestedUsers: Profile[] = [];
  let trendingPosts: Post[] = [];
  let isLoading = true;
  let searchQuery = '';
  let searchResults: (Post | Profile)[] = [];
  let isSearching = false;
  let activeTab: 'trending' | 'discover' | 'search' = 'trending';

  onMount(async () => {
    try {
      // Load trending topics
      trendingTopics = [
        { id: '1', name: '#Web3', posts: 12453 },
        { id: '2', name: '#Privacy', posts: 8721 },
        { id: '3', name: '#DeFi', posts: 6543 },
        { id: '4', name: '#NFT', posts: 5432 },
        { id: '5', name: '#Blockchain', posts: 4321 }
      ];

      // Load suggested users
      const users = await DatabaseService.getSuggestedUsers();
      suggestedUsers = users;

      // Load trending posts
      const posts = await DatabaseService.getTrendingPosts();
      trendingPosts = posts;

      isLoading = false;
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to load explore page');
    }
  });

  async function handleSearch() {
    if (!searchQuery.trim()) return;

    try {
      isSearching = true;
      const results = await DatabaseService.search(searchQuery);
      searchResults = results;
      activeTab = 'search';
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to search');
    } finally {
      isSearching = false;
    }
  }

  async function handleFollow(userId: string) {
    try {
      await DatabaseService.followUser(userId);
      suggestedUsers = suggestedUsers.filter(user => user.id !== userId);
      toasts.success('User followed successfully');
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to follow user');
    }
  }

  function formatNumber(num: number): string {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  }

  const tabs = ['trending', 'discover', 'search'] as const;
  type TabType = typeof tabs[number];
</script>

<svelte:head>
  <title>Explore | TikTokToe</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 py-6">
  <!-- Search -->
  <div class="max-w-2xl mx-auto mb-8">
    <div class="relative">
      <input
        type="search"
        bind:value={searchQuery}
        on:input={handleSearch}
        placeholder="Search posts, topics, or users..."
        class="w-full bg-black/50 border border-primary-900/50 rounded-lg pl-12 pr-4 py-3 focus:ring-2 focus:ring-primary-500/50 focus:border-transparent"
      />
      <span class="absolute left-4 top-1/2 -translate-y-1/2 text-xl">
        🔍
      </span>
    </div>
  </div>

  <!-- Tabs -->
  <div class="flex justify-center mb-8 space-x-4">
    {#each tabs as tab}
      <button
        class="px-4 py-2 rounded-lg font-medium transition-colors {activeTab === tab ? 'bg-primary-500 text-black' : 'text-gray-400 hover:text-white'}"
        on:click={() => (activeTab = tab)}
      >
        {tab.charAt(0).toUpperCase() + tab.slice(1)}
      </button>
    {/each}
  </div>

  {#if isLoading}
    <div class="grid md:grid-cols-3 gap-8">
      {#each Array(3) as _}
        <div class="card p-4 animate-pulse">
          <div class="h-6 bg-primary-900/50 rounded w-1/2 mb-4"></div>
          <div class="space-y-2">
            {#each Array(4) as _}
              <div class="h-4 bg-primary-900/50 rounded w-3/4"></div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {:else}
    {#if activeTab === 'trending'}
      <div class="grid md:grid-cols-3 gap-8">
        <!-- Trending Topics -->
        <div class="space-y-6">
          <h2 class="text-2xl font-display font-bold">Trending Topics</h2>
          <div class="space-y-4">
            {#each trendingTopics as topic (topic.id)}
              <div class="card p-4 hover:border-primary-500/50 transition-colors cursor-pointer">
                <h3 class="font-medium text-lg">{topic.name}</h3>
                <p class="text-sm text-gray-400">
                  {formatNumber(topic.posts)} posts
                </p>
              </div>
            {/each}
          </div>
        </div>

        <!-- Trending Posts -->
        <div class="md:col-span-2 space-y-6">
          <h2 class="text-2xl font-display font-bold">Trending Posts</h2>
          <div class="space-y-4">
            {#each trendingPosts as post (post.id)}
              <PostComponent {post} />
            {/each}
          </div>
        </div>
      </div>
    {:else if activeTab === 'discover'}
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {#each suggestedUsers as user (user.id)}
          <div class="card p-4 hover:border-primary-500/50 transition-colors">
            <div class="flex items-center space-x-4 mb-4">
              <img
                src={user.avatar_url || `https://api.dicebear.com/7.x/shapes/svg?seed=${user.id}`}
                alt={`${user.username}'s avatar`}
                class="w-12 h-12 rounded-full bg-primary-900/50"
              />
              <div>
                <h3 class="font-medium">@{user.username}</h3>
                <p class="text-sm text-gray-400">
                  {formatNumber(user.followers || 0)} followers
                </p>
              </div>
            </div>
            <button
              class="btn-primary w-full"
              on:click={() => handleFollow(user.id)}
            >
              Follow
            </button>
          </div>
        {/each}
      </div>
    {:else if activeTab === 'search' && searchResults.length > 0}
      <div class="space-y-4">
        {#each searchResults as result (result.id)}
          {#if 'content' in result}
            <PostComponent post={result} />
          {:else}
            <div class="card p-4 hover:border-primary-500/50 transition-colors">
              <div class="flex items-center space-x-4">
                <img
                  src={result.avatar_url || `https://api.dicebear.com/7.x/shapes/svg?seed=${result.id}`}
                  alt={`${result.username}'s avatar`}
                  class="w-12 h-12 rounded-full bg-primary-900/50"
                />
                <div>
                  <h3 class="font-medium">@{result.username}</h3>
                  <button
                    class="btn-primary mt-2"
                    on:click={() => handleFollow(result.id)}
                  >
                    Follow
                  </button>
                </div>
              </div>
            </div>
          {/if}
        {/each}
      </div>
    {:else if activeTab === 'search'}
      <div class="text-center text-gray-400">
        {isSearching ? 'Searching...' : 'No results found'}
      </div>
    {/if}
  {/if}
</div>

<style lang="postcss">
  .card {
    @apply bg-black/50 backdrop-blur-lg border border-primary-900/50 rounded-xl;
  }

  .btn-primary {
    @apply inline-flex items-center justify-center px-6 py-3 rounded-lg font-medium transition-all duration-200 bg-gradient-to-r from-primary-500 to-primary-600 text-black hover:from-primary-400 hover:to-primary-500 hover:shadow-neon disabled:opacity-50 disabled:cursor-not-allowed;
  }
</style> 