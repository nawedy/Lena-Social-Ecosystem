<!-- RichPostViewer.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { Button, Badge } from '$lib/components/ui';
  import { supabase } from '$lib/supabaseClient';
  import { user } from '$lib/stores/auth';
  import { ipfsService } from '$lib/services/ipfs';
  import { RichPostComposer } from './RichPostComposer.svelte';

  export let postId: string;
  export let showThread = false;

  let post: any = null;
  let threadPosts: any[] = [];
  let replies: any[] = [];
  let loading = false;
  let error: string | null = null;
  let showReplyForm = false;
  let isLiked = false;
  let isReposted = false;
  let isBookmarked = false;
  let mediaExpanded = false;
  let selectedMediaIndex = 0;

  onMount(async () => {
    await loadPost();
    if (showThread) {
      await loadThread();
    }
    await loadReplies();
    setupRealtimeSubscription();
  });

  function setupRealtimeSubscription() {
    const channel = supabase
      .channel(`post_${postId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts',
          filter: `id=eq.${postId}`
        },
        (payload) => {
          handlePostUpdate(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  function handlePostUpdate(payload: any) {
    const { eventType, new: newPost } = payload;
    if (eventType === 'UPDATE') {
      post = newPost;
    }
  }

  async function loadPost() {
    try {
      loading = true;
      error = null;

      const { data, error: fetchError } = await supabase
        .from('posts')
        .select(`
          *,
          user:user_id (*),
          metrics:post_metrics (
            likes_count,
            reposts_count,
            replies_count,
            views_count
          ),
          user_interactions:post_user_interactions (
            is_liked,
            is_reposted,
            is_bookmarked
          )
        `)
        .eq('id', postId)
        .single();

      if (fetchError) throw fetchError;
      post = data;

      // Set interaction states
      if (post.user_interactions) {
        isLiked = post.user_interactions.is_liked;
        isReposted = post.user_interactions.is_reposted;
        isBookmarked = post.user_interactions.is_bookmarked;
      }

      // Record view if authenticated
      if ($user) {
        await supabase
          .from('post_views')
          .insert({ post_id: postId, user_id: $user.id })
          .select();
      }
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function loadThread() {
    if (!post?.thread_parent_id) return;

    try {
      const { data, error: threadError } = await supabase
        .from('posts')
        .select(`
          *,
          user:user_id (*),
          metrics:post_metrics (*)
        `)
        .eq('thread_parent_id', post.thread_parent_id)
        .order('created_at', { ascending: true });

      if (threadError) throw threadError;
      threadPosts = data || [];
    } catch (e) {
      console.error('Error loading thread:', e);
    }
  }

  async function loadReplies() {
    try {
      const { data, error: repliesError } = await supabase
        .from('posts')
        .select(`
          *,
          user:user_id (*),
          metrics:post_metrics (*)
        `)
        .eq('in_reply_to', postId)
        .order('created_at', { ascending: true });

      if (repliesError) throw repliesError;
      replies = data || [];
    } catch (e) {
      console.error('Error loading replies:', e);
    }
  }

  async function handleLike() {
    if (!$user) return;

    try {
      const newState = !isLiked;
      isLiked = newState;

      await supabase
        .from('post_interactions')
        .upsert({
          post_id: postId,
          user_id: $user.id,
          is_liked: newState
        });

      // Update metrics optimistically
      post.metrics.likes_count += newState ? 1 : -1;
    } catch (e) {
      console.error('Error updating like:', e);
      isLiked = !isLiked; // Revert on error
    }
  }

  async function handleRepost() {
    if (!$user) return;

    try {
      const newState = !isReposted;
      isReposted = newState;

      await supabase
        .from('post_interactions')
        .upsert({
          post_id: postId,
          user_id: $user.id,
          is_reposted: newState
        });

      // Update metrics optimistically
      post.metrics.reposts_count += newState ? 1 : -1;
    } catch (e) {
      console.error('Error updating repost:', e);
      isReposted = !isReposted; // Revert on error
    }
  }

  async function handleBookmark() {
    if (!$user) return;

    try {
      const newState = !isBookmarked;
      isBookmarked = newState;

      await supabase
        .from('post_interactions')
        .upsert({
          post_id: postId,
          user_id: $user.id,
          is_bookmarked: newState
        });
    } catch (e) {
      console.error('Error updating bookmark:', e);
      isBookmarked = !isBookmarked; // Revert on error
    }
  }

  function formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatMetric(value: number): string {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  }

  function handleMediaClick(index: number) {
    selectedMediaIndex = index;
    mediaExpanded = true;
  }
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
  {#if error}
    <div class="p-4 bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-200">
      {error}
    </div>
  {/if}

  {#if loading && !post}
    <div class="p-8 flex justify-center">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
    </div>
  {:else if post}
    <!-- Thread Context -->
    {#if showThread && threadPosts.length > 0}
      <div class="border-b border-gray-200 dark:border-gray-700">
        {#each threadPosts as threadPost}
          <div class="p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
            <div class="flex space-x-3">
              <img
                src={threadPost.user.avatar_url}
                alt={threadPost.user.name}
                class="h-10 w-10 rounded-full"
              />
              <div class="flex-1 min-w-0">
                <div class="flex items-center space-x-2">
                  <span class="font-medium">{threadPost.user.name}</span>
                  <span class="text-gray-500">@{threadPost.user.username}</span>
                  <span class="text-gray-500">·</span>
                  <span class="text-gray-500">{formatDate(threadPost.created_at)}</span>
                </div>
                <p class="mt-1">{threadPost.content}</p>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Main Post -->
    <div class="p-4">
      <!-- Post Header -->
      <div class="flex items-start space-x-3">
        <img
          src={post.user.avatar_url}
          alt={post.user.name}
          class="h-12 w-12 rounded-full"
        />
        <div class="flex-1 min-w-0">
          <div class="flex items-center space-x-2">
            <span class="font-medium">{post.user.name}</span>
            <span class="text-gray-500">@{post.user.username}</span>
            <span class="text-gray-500">·</span>
            <span class="text-gray-500">{formatDate(post.created_at)}</span>
          </div>

          {#if post.is_breaking_news}
            <Badge
              variant="error"
              class="mt-1"
            >
              Breaking News
            </Badge>
          {/if}

          <!-- Post Content -->
          <p class="mt-2 whitespace-pre-wrap">{post.content}</p>

          <!-- Media -->
          {#if post.media_urls && post.media_urls.length > 0}
            <div class="mt-3">
              <div class="grid grid-cols-2 gap-2">
                {#each post.media_urls as url, index}
                  <div
                    class="relative cursor-pointer"
                    on:click={() => handleMediaClick(index)}
                  >
                    <img
                      src={url.replace('ipfs://', 'https://ipfs.io/ipfs/')}
                      alt="Post media"
                      class="rounded-lg object-cover w-full"
                      style="aspect-ratio: 16/9"
                    />
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Tags -->
          {#if post.tags && post.tags.length > 0}
            <div class="mt-3 flex flex-wrap gap-2">
              {#each post.tags as tag}
                <span class="text-emerald-600 dark:text-emerald-400 hover:underline">
                  #{tag}
                </span>
              {/each}
            </div>
          {/if}

          <!-- Metrics -->
          <div class="mt-4 flex items-center space-x-6 text-gray-500">
            <button
              class="flex items-center space-x-2 hover:text-emerald-600"
              on:click={() => showReplyForm = !showReplyForm}
            >
              <span>{formatMetric(post.metrics.replies_count)}</span>
              <span>Replies</span>
            </button>

            <button
              class="flex items-center space-x-2 hover:text-emerald-600"
              class:text-emerald-600={isReposted}
              on:click={handleRepost}
            >
              <span>{formatMetric(post.metrics.reposts_count)}</span>
              <span>Reposts</span>
            </button>

            <button
              class="flex items-center space-x-2 hover:text-emerald-600"
              class:text-emerald-600={isLiked}
              on:click={handleLike}
            >
              <span>{formatMetric(post.metrics.likes_count)}</span>
              <span>Likes</span>
            </button>

            <button
              class="flex items-center space-x-2 hover:text-emerald-600"
              class:text-emerald-600={isBookmarked}
              on:click={handleBookmark}
            >
              <span>Bookmark</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Reply Form -->
    {#if showReplyForm}
      <div class="p-4 border-t border-gray-200 dark:border-gray-700">
        <RichPostComposer
          inReplyTo={postId}
          onSuccess={() => {
            showReplyForm = false;
            loadReplies();
          }}
        />
      </div>
    {/if}

    <!-- Replies -->
    {#if replies.length > 0}
      <div class="border-t border-gray-200 dark:border-gray-700">
        {#each replies as reply}
          <div class="p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
            <div class="flex space-x-3">
              <img
                src={reply.user.avatar_url}
                alt={reply.user.name}
                class="h-10 w-10 rounded-full"
              />
              <div class="flex-1 min-w-0">
                <div class="flex items-center space-x-2">
                  <span class="font-medium">{reply.user.name}</span>
                  <span class="text-gray-500">@{reply.user.username}</span>
                  <span class="text-gray-500">·</span>
                  <span class="text-gray-500">{formatDate(reply.created_at)}</span>
                </div>
                <p class="mt-1">{reply.content}</p>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<!-- Media Modal -->
{#if mediaExpanded}
  <div
    class="fixed inset-0 bg-black/75 flex items-center justify-center z-50"
    on:click={() => mediaExpanded = false}
  >
    <div class="max-w-4xl w-full p-4">
      <img
        src={post.media_urls[selectedMediaIndex].replace('ipfs://', 'https://ipfs.io/ipfs/')}
        alt="Expanded media"
        class="w-full h-auto rounded-lg"
      />
    </div>
  </div>
{/if}

<style>
  /* Add any component-specific styles here */
</style> 