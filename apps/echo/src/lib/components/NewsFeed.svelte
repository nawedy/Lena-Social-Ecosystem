<!-- NewsFeed.svelte -->
<script lang="ts">
  import { fade, slide } from 'svelte/transition';
  import { supabase } from '$lib/supabaseClient';
  import { onMount } from 'svelte';
  import type { User } from '@supabase/supabase-js';

  export let posts: any[] = [];
  export let selectedTab: 'following' | 'trending' | 'news' = 'following';
  export let user: User | null = null;

  let filteredPosts: any[] = [];
  let isLoading = false;
  let error: string | null = null;

  $: {
    filterPosts(selectedTab);
  }

  async function filterPosts(tab: string) {
    isLoading = true;
    error = null;

    try {
      switch (tab) {
        case 'following':
          if (!user) {
            filteredPosts = [];
            break;
          }
          const { data: followingData, error: followingError } = await supabase
            .from('user_follows')
            .select('following_id')
            .eq('follower_id', user.id);

          if (followingError) throw followingError;

          const followingIds = followingData.map(f => f.following_id);
          filteredPosts = posts.filter(post => followingIds.includes(post.user_id));
          break;

        case 'trending':
          filteredPosts = [...posts].sort((a, b) => b.trending_score - a.trending_score);
          break;

        case 'news':
          filteredPosts = posts.filter(post => post.is_breaking_news);
          break;

        default:
          filteredPosts = posts;
      }
    } catch (err) {
      error = err.message;
    } finally {
      isLoading = false;
    }
  }

  async function handleInteraction(postId: string, type: 'like' | 'repost' | 'reply') {
    if (!user) return;

    try {
      const { error: interactionError } = await supabase
        .from('post_interactions')
        .insert([
          {
            post_id: postId,
            user_id: user.id,
            interaction_type: type
          }
        ]);

      if (interactionError) throw interactionError;
    } catch (err) {
      console.error('Error handling interaction:', err);
    }
  }
</script>

<div class="space-y-4">
  {#if isLoading}
    <div class="flex justify-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
    </div>
  {:else if error}
    <div class="bg-red-50 dark:bg-red-900 p-4 rounded-lg" transition:fade>
      <p class="text-red-600 dark:text-red-400">{error}</p>
    </div>
  {:else if filteredPosts.length === 0}
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center" transition:fade>
      {#if selectedTab === 'following' && !user}
        <p class="text-gray-600 dark:text-gray-400">Please sign in to see posts from people you follow</p>
      {:else}
        <p class="text-gray-600 dark:text-gray-400">No posts found</p>
      {/if}
    </div>
  {:else}
    {#each filteredPosts as post (post.id)}
      <article
        class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4"
        transition:fade
      >
        <!-- Post Header -->
        <div class="flex items-start space-x-4">
          <img
            src={post.user?.avatar_url || '/default-avatar.png'}
            alt="User avatar"
            class="w-12 h-12 rounded-full object-cover"
          />
          <div class="flex-1 min-w-0">
            <div class="flex items-center space-x-2">
              <h3 class="text-sm font-medium text-gray-900 dark:text-white truncate">
                {post.user?.name || 'Anonymous'}
              </h3>
              {#if post.is_verified}
                <svg class="w-4 h-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                </svg>
              {/if}
              {#if post.is_breaking_news}
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                  Breaking News
                </span>
              {/if}
            </div>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {new Date(post.created_at).toLocaleString()}
            </p>
          </div>
        </div>

        <!-- Post Content -->
        <div class="space-y-4">
          <p class="text-gray-900 dark:text-white whitespace-pre-wrap">{post.content}</p>

          {#if post.media_urls && post.media_urls.length > 0}
            <div class="grid grid-cols-2 gap-2">
              {#each post.media_urls as url}
                <img
                  src={url}
                  alt="Post media"
                  class="rounded-lg object-cover w-full h-48"
                  loading="lazy"
                />
              {/each}
            </div>
          {/if}

          {#if post.tags && post.tags.length > 0}
            <div class="flex flex-wrap gap-2">
              {#each post.tags as tag}
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  #{tag}
                </span>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Post Actions -->
        <div class="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            class="flex items-center space-x-2 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
            on:click={() => handleInteraction(post.id, 'like')}
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <span class="text-sm">{post.likes}</span>
          </button>

          <button
            class="flex items-center space-x-2 text-gray-500 hover:text-green-500 dark:text-gray-400 dark:hover:text-green-400 transition-colors"
            on:click={() => handleInteraction(post.id, 'repost')}
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span class="text-sm">{post.reposts}</span>
          </button>

          <button
            class="flex items-center space-x-2 text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
            on:click={() => handleInteraction(post.id, 'reply')}
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span class="text-sm">{post.replies}</span>
          </button>
        </div>
      </article>
    {/each}
  {/if}
</div>

<style>
  /* Add any component-specific styles here */
</style> 