{#if post}
  <article class="card p-4 space-y-4">
    <!-- Post Header -->
    <div class="flex items-center space-x-4">
      <img
        src={post.profiles?.avatar_url || `https://api.dicebear.com/7.x/shapes/svg?seed=${post.author_id}`}
        alt={post.profiles?.username || 'User avatar'}
        class="w-10 h-10 rounded-full bg-primary-900/50"
      />
      <div>
        <h3 class="font-medium">@{post.profiles?.username || 'User'}</h3>
        <time class="text-sm text-gray-400">{formatTimestamp(post.created_at)}</time>
      </div>
    </div>
    
    <!-- Post Content -->
    <p class="whitespace-pre-wrap">{post.content}</p>
    
    {#if post.media_url}
      {#if post.media_type?.startsWith('image/')}
        <img
          src={post.media_url}
          alt="Post media"
          class="rounded-lg w-full h-auto"
          loading="lazy"
        />
      {:else if post.media_type?.startsWith('video/')}
        <video
          src={post.media_url}
          class="rounded-lg w-full h-auto"
          controls
          preload="metadata"
        />
      {/if}
    {/if}
    
    <!-- Post Actions -->
    <div class="flex items-center space-x-6 text-gray-400">
      <button
        class="flex items-center space-x-2 hover:text-primary-400"
        on:click={() => handleLike(post.id)}
      >
        <span class="text-xl">❤️</span>
        <span>{post.likes || 0}</span>
      </button>
      <button
        class="flex items-center space-x-2 hover:text-primary-400"
        on:click={() => handleComment(post.id)}
      >
        <span class="text-xl">💬</span>
        <span>{post.comments || 0}</span>
      </button>
      <button class="flex items-center space-x-2 hover:text-primary-400">
        <span class="text-xl">🔄</span>
      </button>
      <button class="flex items-center space-x-2 hover:text-primary-400">
        <span class="text-xl">📤</span>
      </button>
    </div>

    <!-- Comments Section -->
    {#if showComments}
      <div class="space-y-4 mt-4 pt-4 border-t border-primary-900/50">
        {#if isLoadingComments}
          <div class="animate-pulse space-y-4">
            {#each Array(3) as _}
              <div class="flex space-x-3">
                <div class="w-8 h-8 rounded-full bg-primary-900/50"></div>
                <div class="flex-1 space-y-2">
                  <div class="h-4 bg-primary-900/50 rounded w-1/4"></div>
                  <div class="h-3 bg-primary-900/50 rounded w-3/4"></div>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          {#each comments as comment (comment.id)}
            <div class="flex space-x-3">
              <img
                src={comment.profiles?.avatar_url || `https://api.dicebear.com/7.x/shapes/svg?seed=${comment.author_id}`}
                alt={comment.profiles?.username || 'User avatar'}
                class="w-8 h-8 rounded-full bg-primary-900/50"
              />
              <div>
                <div class="bg-primary-900/20 rounded-lg p-3">
                  <p class="font-medium text-sm">@{comment.profiles?.username || 'User'}</p>
                  <p class="text-sm">{comment.content}</p>
                </div>
                <time class="text-xs text-gray-400 mt-1">
                  {formatTimestamp(comment.created_at)}
                </time>
              </div>
            </div>
          {/each}
        {/if}

        <!-- Comment Input -->
        <form class="flex space-x-2" on:submit|preventDefault={handleSubmitComment}>
          <input
            type="text"
            bind:value={newComment}
            placeholder="Write a comment..."
            class="flex-1 bg-black/50 border border-primary-900/50 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500/50 focus:border-transparent"
          />
          <button
            type="submit"
            class="btn-primary px-4"
            disabled={!newComment.trim() || isSubmittingComment}
          >
            {isSubmittingComment ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    {/if}
  </article>
{/if}

<script lang="ts">
  import { DatabaseService } from '$lib/services/database';
  import type { Post, PostComment } from '$lib/types/supabase';
  import { toasts } from '@lena/ui';

  export let post: Post;

  let showComments = false;
  let comments: PostComment[] = [];
  let isLoadingComments = false;
  let newComment = '';
  let isSubmittingComment = false;

  async function handleLike(postId: string) {
    try {
      await DatabaseService.likePost(postId);
      post = { ...post, likes: (post.likes || 0) + 1 };
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to like post');
    }
  }

  async function handleComment(postId: string) {
    if (!showComments) {
      showComments = true;
      loadComments(postId);
    }
  }

  async function loadComments(postId: string) {
    try {
      isLoadingComments = true;
      comments = await DatabaseService.getPostComments(postId);
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to load comments');
    } finally {
      isLoadingComments = false;
    }
  }

  async function handleSubmitComment() {
    if (!newComment.trim() || isSubmittingComment) return;

    try {
      isSubmittingComment = true;
      const comment = await DatabaseService.createComment(post.id, newComment);
      comments = [...comments, comment];
      post = { ...post, comments: (post.comments || 0) + 1 };
      newComment = '';
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to post comment');
    } finally {
      isSubmittingComment = false;
    }
  }

  function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    
    return date.toLocaleDateString();
  }
</script>

<style lang="postcss">
  .card {
    @apply bg-black/50 backdrop-blur-lg border border-primary-900/50 rounded-xl;
  }

  .btn-primary {
    @apply inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 bg-gradient-to-r from-primary-500 to-primary-600 text-black hover:from-primary-400 hover:to-primary-500 hover:shadow-neon disabled:opacity-50 disabled:cursor-not-allowed;
  }
</style> 