<!-- UserProfile.svelte -->
<script lang="ts">
  import { fade, slide } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { supabase } from '$lib/supabaseClient';
  import type { User } from '@supabase/supabase-js';
  import { onMount } from 'svelte';

  export let user: User | null = null;

  interface ProfileStats {
    posts: number;
    followers: number;
    following: number;
    verified: boolean;
  }

  let profileStats: ProfileStats = {
    posts: 0,
    followers: 0,
    following: 0,
    verified: false
  };

  let isLoading = true;
  let error: string | null = null;

  async function loadProfileStats() {
    if (!user) return;

    try {
      // Load post count
      const { count: postsCount, error: postsError } = await supabase
        .from('posts')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id);

      if (postsError) throw postsError;

      // Load follower count
      const { count: followersCount, error: followersError } = await supabase
        .from('user_follows')
        .select('id', { count: 'exact' })
        .eq('following_id', user.id);

      if (followersError) throw followersError;

      // Load following count
      const { count: followingCount, error: followingError } = await supabase
        .from('user_follows')
        .select('id', { count: 'exact' })
        .eq('follower_id', user.id);

      if (followingError) throw followingError;

      // Load verification status
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('is_verified')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      profileStats = {
        posts: postsCount || 0,
        followers: followersCount || 0,
        following: followingCount || 0,
        verified: profile?.is_verified || false
      };
    } catch (err) {
      error = err.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    loadProfileStats();
  });

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

{#if user}
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
    <!-- Cover Image -->
    <div class="h-32 bg-gradient-to-r from-blue-500 to-purple-600"></div>

    <!-- Profile Info -->
    <div class="relative px-4 pb-4">
      <!-- Avatar -->
      <div class="absolute -top-12 left-4">
        <div class="relative">
          <img
            src={user.user_metadata?.avatar_url || '/default-avatar.png'}
            alt="Profile"
            class="w-24 h-24 rounded-full border-4 border-white dark:border-gray-800 object-cover"
          />
          {#if profileStats.verified}
            <div class="absolute bottom-0 right-0 bg-blue-500 text-white p-1 rounded-full">
              <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
            </div>
          {/if}
        </div>
      </div>

      <!-- User Info -->
      <div class="pt-14">
        <div class="flex items-center space-x-2">
          <h2 class="text-xl font-bold text-gray-900 dark:text-white">
            {user.user_metadata?.full_name || 'Anonymous'}
          </h2>
          {#if profileStats.verified}
            <svg class="w-5 h-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
          {/if}
        </div>
        <p class="text-gray-500 dark:text-gray-400">@{user.email?.split('@')[0]}</p>
      </div>

      <!-- Bio -->
      <p class="mt-4 text-gray-600 dark:text-gray-300">
        {user.user_metadata?.bio || 'No bio available'}
      </p>

      <!-- Stats -->
      {#if isLoading}
        <div class="mt-4 flex justify-center">
          <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>
      {:else if error}
        <div class="mt-4 text-red-500 text-sm text-center">
          {error}
        </div>
      {:else}
        <div class="mt-4 grid grid-cols-3 gap-4 text-center">
          <div class="p-2">
            <div class="text-xl font-bold text-gray-900 dark:text-white">
              {formatCount(profileStats.posts)}
            </div>
            <div class="text-sm text-gray-500 dark:text-gray-400">Posts</div>
          </div>
          <div class="p-2">
            <div class="text-xl font-bold text-gray-900 dark:text-white">
              {formatCount(profileStats.followers)}
            </div>
            <div class="text-sm text-gray-500 dark:text-gray-400">Followers</div>
          </div>
          <div class="p-2">
            <div class="text-xl font-bold text-gray-900 dark:text-white">
              {formatCount(profileStats.following)}
            </div>
            <div class="text-sm text-gray-500 dark:text-gray-400">Following</div>
          </div>
        </div>
      {/if}

      <!-- Edit Profile Button -->
      <div class="mt-4">
        <button
          class="w-full px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border border-blue-600 dark:border-blue-400 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          Edit Profile
        </button>
      </div>
    </div>
  </div>
{:else}
  <!-- Sign In Prompt -->
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
    <div class="flex flex-col items-center space-y-4">
      <div class="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
        <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>
      <h3 class="text-lg font-medium text-gray-900 dark:text-white">
        Welcome to Echo
      </h3>
      <p class="text-gray-500 dark:text-gray-400">
        Sign in to join the conversation
      </p>
      <button
        class="px-6 py-2 text-sm font-medium text-white bg-blue-500 rounded-full hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Sign In
      </button>
    </div>
  </div>
{/if}

<style>
  /* Add any component-specific styles here */
</style> 