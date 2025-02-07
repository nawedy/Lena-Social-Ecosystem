<!-- Profile Page -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { DatabaseService } from '$lib/services/database';
  import { auth } from '$lib/stores/auth';
  import { toasts } from '@lena/ui';
  import type { Post, Profile } from '$lib/types/supabase';

  let profile: Profile | null = null;
  let posts: Post[] = [];
  let followers: Profile[] = [];
  let following: Profile[] = [];
  let activeTab: 'posts' | 'followers' | 'following' = 'posts';
  let isLoading = true;
  let isEditing = false;
  let editForm = {
    username: '',
    avatar_url: '',
    eth_address: ''
  };

  onMount(async () => {
    try {
      const userId = $auth.user?.id;
      if (!userId) throw new Error('User not authenticated');

      const [userProfile, userPosts, userFollowers, userFollowing] = await Promise.all([
        DatabaseService.getProfile(userId),
        DatabaseService.getUserPosts(userId),
        DatabaseService.getFollowers(userId),
        DatabaseService.getFollowing(userId)
      ]);

      profile = userProfile;
      posts = userPosts;
      followers = userFollowers;
      following = userFollowing;

      if (profile) {
        editForm = {
          username: profile.username || '',
          avatar_url: profile.avatar_url || '',
          eth_address: profile.eth_address || ''
        };
      }
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to load profile');
    } finally {
      isLoading = false;
    }
  });

  async function handleUpdateProfile() {
    try {
      if (!profile) return;

      const updatedProfile = await DatabaseService.updateProfile(editForm);
      profile = updatedProfile;
      isEditing = false;
      toasts.success('Profile updated successfully');
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to update profile');
    }
  }

  function formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
</script>

<svelte:head>
  <title>Profile | TikTokToe</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-8">
  {#if isLoading}
    <div class="animate-pulse space-y-8">
      <div class="flex items-center space-x-8">
        <div class="w-32 h-32 rounded-full bg-primary-900/50"></div>
        <div class="flex-1 space-y-4">
          <div class="h-8 bg-primary-900/50 rounded w-1/3"></div>
          <div class="h-4 bg-primary-900/50 rounded w-1/2"></div>
        </div>
      </div>
    </div>
  {:else if profile}
    <!-- Profile Header -->
    <div class="flex items-start space-x-8 mb-8">
      <img
        src={profile.avatar_url || `https://api.dicebear.com/7.x/shapes/svg?seed=${profile.id}`}
        alt={profile.username}
        class="w-32 h-32 rounded-full bg-primary-900/50"
      />
      <div class="flex-1">
        <div class="flex items-center justify-between mb-4">
          <h1 class="text-2xl font-bold">@{profile.username}</h1>
          <button
            class="btn-outline px-6"
            on:click={() => isEditing = !isEditing}
          >
            {isEditing ? 'Cancel' : 'Edit Profile'}
          </button>
        </div>

        {#if isEditing}
          <form
            class="space-y-4 mb-6"
            on:submit|preventDefault={handleUpdateProfile}
          >
            <div>
              <label for="username" class="block text-sm font-medium mb-1">Username</label>
              <input
                type="text"
                id="username"
                bind:value={editForm.username}
                class="w-full bg-black/50 border border-primary-900/50 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500/50 focus:border-transparent"
              />
            </div>
            <div>
              <label for="avatar_url" class="block text-sm font-medium mb-1">Avatar URL</label>
              <input
                type="url"
                id="avatar_url"
                bind:value={editForm.avatar_url}
                class="w-full bg-black/50 border border-primary-900/50 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500/50 focus:border-transparent"
              />
            </div>
            <div>
              <label for="eth_address" class="block text-sm font-medium mb-1">ETH Address</label>
              <input
                type="text"
                id="eth_address"
                bind:value={editForm.eth_address}
                class="w-full bg-black/50 border border-primary-900/50 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500/50 focus:border-transparent"
              />
            </div>
            <div class="flex justify-end">
              <button type="submit" class="btn-primary px-6">Save Changes</button>
            </div>
          </form>
        {:else}
          <div class="grid grid-cols-3 gap-8 text-center mb-6">
            <div>
              <div class="text-2xl font-bold">{posts.length}</div>
              <div class="text-sm text-gray-400">Posts</div>
            </div>
            <div>
              <div class="text-2xl font-bold">{followers.length}</div>
              <div class="text-sm text-gray-400">Followers</div>
            </div>
            <div>
              <div class="text-2xl font-bold">{following.length}</div>
              <div class="text-sm text-gray-400">Following</div>
            </div>
          </div>
          <div class="text-sm text-gray-400">
            <p>Joined {formatDate(profile.created_at)}</p>
            {#if profile.eth_address}
              <p class="mt-1">ETH: {profile.eth_address}</p>
            {/if}
          </div>
        {/if}
      </div>
    </div>

    <!-- Tabs -->
    <div class="border-b border-primary-900/50 mb-8">
      <div class="flex space-x-8">
        <button
          class="px-4 py-2 border-b-2 transition-colors"
          class:border-primary-500={activeTab === 'posts'}
          class:border-transparent={activeTab !== 'posts'}
          on:click={() => activeTab = 'posts'}
        >
          Posts
        </button>
        <button
          class="px-4 py-2 border-b-2 transition-colors"
          class:border-primary-500={activeTab === 'followers'}
          class:border-transparent={activeTab !== 'followers'}
          on:click={() => activeTab = 'followers'}
        >
          Followers
        </button>
        <button
          class="px-4 py-2 border-b-2 transition-colors"
          class:border-primary-500={activeTab === 'following'}
          class:border-transparent={activeTab !== 'following'}
          on:click={() => activeTab = 'following'}
        >
          Following
        </button>
      </div>
    </div>

    <!-- Tab Content -->
    {#if activeTab === 'posts'}
      <div class="grid grid-cols-1 gap-6">
        {#each posts as post (post.id)}
          <div class="bg-primary-900/20 rounded-lg p-6">
            <div class="mb-4">
              <p class="whitespace-pre-wrap">{post.content}</p>
              {#if post.media_url}
                <div class="mt-4">
                  {#if post.media_type?.startsWith('image')}
                    <img
                      src={post.media_url}
                      alt="Post media"
                      class="rounded-lg max-h-96 w-full object-cover"
                    />
                  {:else if post.media_type?.startsWith('video')}
                    <video
                      src={post.media_url}
                      controls
                      class="rounded-lg max-h-96 w-full"
                    ></video>
                  {/if}
                </div>
              {/if}
            </div>
            <div class="flex items-center justify-between text-sm text-gray-400">
              <div class="flex items-center space-x-4">
                <span>{post.likes} likes</span>
                <span>{post.comments} comments</span>
              </div>
              <time>{formatDate(post.created_at)}</time>
            </div>
          </div>
        {/each}
      </div>
    {:else if activeTab === 'followers'}
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
        {#each followers as follower (follower.id)}
          <div class="text-center">
            <img
              src={follower.avatar_url || `https://api.dicebear.com/7.x/shapes/svg?seed=${follower.id}`}
              alt={follower.username}
              class="w-24 h-24 rounded-full mx-auto mb-2 bg-primary-900/50"
            />
            <div class="font-medium">@{follower.username}</div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
        {#each following as follow (follow.id)}
          <div class="text-center">
            <img
              src={follow.avatar_url || `https://api.dicebear.com/7.x/shapes/svg?seed=${follow.id}`}
              alt={follow.username}
              class="w-24 h-24 rounded-full mx-auto mb-2 bg-primary-900/50"
            />
            <div class="font-medium">@{follow.username}</div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style lang="postcss">
  .btn-primary {
    @apply inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 bg-gradient-to-r from-primary-500 to-primary-600 text-black hover:from-primary-400 hover:to-primary-500 hover:shadow-neon disabled:opacity-50 disabled:cursor-not-allowed;
  }

  .btn-outline {
    @apply inline-flex items-center justify-center px-6 py-3 rounded-lg font-medium transition-all duration-200 border-2 border-primary-500 text-primary-500 hover:bg-primary-500/10 disabled:opacity-50 disabled:cursor-not-allowed;
  }
</style> 