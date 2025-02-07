<!-- Feed Page -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth';
  import { DatabaseService } from '$lib/services/database';
  import { StorageService } from '$lib/services/storage';
  import { FileUpload, toasts } from '@lena/ui';
  import type { Post } from '$lib/types/supabase';
  import type { FileSelectEvent, FileErrorEvent, ProgressEvent } from '$lib/types/events';
  import PostComponent from '$lib/components/Post.svelte';

  let posts: Post[] = [];
  let isLoading = true;
  let isLoadingMore = false;
  let hasMore = true;
  let content = '';
  let mediaFile: File | null = null;
  let uploadProgress = 0;
  let isUploading = false;

  // Initialize storage service
  const storage = new StorageService(
    import.meta.env.VITE_WEB3_STORAGE_TOKEN,
    import.meta.env.VITE_IPFS_GATEWAY
  );

  onMount(async () => {
    try {
      posts = await DatabaseService.getFeedPosts();
      isLoading = false;
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to load posts');
    }
  });

  async function loadMore() {
    if (isLoadingMore || !hasMore) return;

    try {
      isLoadingMore = true;
      const lastPost = posts[posts.length - 1];
      const newPosts = await DatabaseService.getFeedPosts(10, posts.length);
      
      if (newPosts.length < 10) {
        hasMore = false;
      }

      posts = [...posts, ...newPosts];
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to load more posts');
    } finally {
      isLoadingMore = false;
    }
  }

  async function handlePost() {
    if (!content.trim() && !mediaFile) {
      toasts.error('Please add some content or media to your post');
      return;
    }

    try {
      isUploading = true;
      let mediaUrl: string | undefined;
      let mediaType: string | undefined;

      if (mediaFile) {
        mediaUrl = await storage.uploadFile(mediaFile, progress => {
          uploadProgress = progress;
        });
        mediaType = mediaFile.type;
      }

      const post = await DatabaseService.createPost(content, mediaUrl, mediaType);
      posts = [post, ...posts];
      content = '';
      mediaFile = null;
      uploadProgress = 0;

      toasts.success('Post created successfully');
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to create post');
    } finally {
      isUploading = false;
    }
  }

  function handleFileSelect(event: CustomEvent<FileSelectEvent['detail']>) {
    mediaFile = event.detail.files[0];
  }

  function handleFileError(event: CustomEvent<FileErrorEvent['detail']>) {
    toasts.error(event.detail.message);
  }
</script>

<svelte:head>
  <title>Feed | TikTokToe</title>
</svelte:head>

<div class="max-w-2xl mx-auto px-4 py-6 space-y-6">
  <!-- Create Post -->
  <div class="card p-4 space-y-4">
    <div class="flex items-start space-x-4">
      <img
        src={$auth.user?.avatar_url || `https://api.dicebear.com/7.x/shapes/svg?seed=${$auth.user?.id}`}
        alt="Your avatar"
        class="w-10 h-10 rounded-full bg-primary-900/50"
      />
      <textarea
        bind:value={content}
        class="flex-1 bg-black/50 border border-primary-900/50 rounded-lg p-3 min-h-[100px] resize-none focus:ring-2 focus:ring-primary-500/50 focus:border-transparent"
        placeholder="What's on your mind?"
      />
    </div>

    {#if mediaFile}
      <div class="relative">
        {#if mediaFile.type.startsWith('image/')}
          <img
            src={URL.createObjectURL(mediaFile)}
            alt="Upload preview"
            class="w-full h-48 object-cover rounded-lg"
          />
        {:else if mediaFile.type.startsWith('video/')}
          <video
            src={URL.createObjectURL(mediaFile)}
            class="w-full h-48 object-cover rounded-lg"
            controls
          />
        {/if}
        <button
          class="absolute top-2 right-2 p-1 bg-black/50 rounded-full hover:bg-black/75 transition-colors"
          on:click={() => mediaFile = null}
        >
          ❌
        </button>
      </div>
    {/if}

    <div class="flex justify-between items-center">
      <FileUpload
        accept="image/*,video/*"
        on:select={handleFileSelect}
        on:error={handleFileError}
        disabled={isUploading}
        {isUploading}
        {uploadProgress}
      />
      <button
        class="btn-primary"
        on:click={handlePost}
        disabled={isUploading || (!content.trim() && !mediaFile)}
      >
        Post
      </button>
    </div>
  </div>

  <!-- Posts -->
  {#if isLoading}
    <div class="space-y-4">
      {#each Array(3) as _}
        <div class="card p-4 animate-pulse">
          <div class="flex items-center space-x-4 mb-4">
            <div class="w-10 h-10 rounded-full bg-primary-900/50" />
            <div class="flex-1 space-y-2">
              <div class="h-4 bg-primary-900/50 rounded w-1/4" />
              <div class="h-3 bg-primary-900/50 rounded w-1/6" />
            </div>
          </div>
          <div class="space-y-2">
            <div class="h-4 bg-primary-900/50 rounded w-3/4" />
            <div class="h-4 bg-primary-900/50 rounded w-1/2" />
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="space-y-4">
      {#each posts as post (post.id)}
        <PostComponent {post} />
      {/each}

      {#if hasMore}
        <div class="text-center">
          <button
            class="btn-outline"
            on:click={loadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? 'Loading...' : 'Load More'}
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style lang="postcss">
  .card {
    @apply bg-black/50 backdrop-blur-lg border border-primary-900/50 rounded-xl;
  }

  .btn-primary {
    @apply inline-flex items-center justify-center px-6 py-3 rounded-lg font-medium transition-all duration-200 bg-gradient-to-r from-primary-500 to-primary-600 text-black hover:from-primary-400 hover:to-primary-500 hover:shadow-neon disabled:opacity-50 disabled:cursor-not-allowed;
  }

  .btn-outline {
    @apply inline-flex items-center justify-center px-6 py-3 rounded-lg font-medium transition-all duration-200 border-2 border-primary-500 text-primary-500 hover:bg-primary-500/10 disabled:opacity-50 disabled:cursor-not-allowed;
  }
</style> 