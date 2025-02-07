<!-- Feed Page -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth';
  import { DatabaseService } from '$lib/services/database';
  import { ContentProcessor } from '@lena/content';
  import { Button, Card, Avatar } from '@lena/ui';
  import VideoPlayer from '$lib/components/VideoPlayer.svelte';
  import VideoActions from '$lib/components/VideoActions.svelte';
  import VideoUploadModal from '$lib/components/VideoUploadModal.svelte';

  let videos: any[] = [];
  let currentVideoIndex = 0;
  let loading = true;
  let loadingMore = false;
  let hasMore = true;
  let isUploadModalOpen = false;

  // Initialize content processor
  const contentProcessor = new ContentProcessor({
    perspectiveApiKey: import.meta.env.VITE_PERSPECTIVE_API_KEY,
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
    supabaseKey: import.meta.env.VITE_SUPABASE_KEY
  }, {
    provider: 'web3.storage',
    web3StorageToken: import.meta.env.VITE_WEB3_STORAGE_TOKEN
  });

  onMount(async () => {
    await loadVideos();
    loading = false;

    // Initialize Intersection Observer for infinite scroll
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !loadingMore && hasMore) {
            loadMoreVideos();
          }
        });
      },
      { threshold: 0.5 }
    );

    // Observe the last video element
    const lastVideo = document.querySelector('.video-container:last-child');
    if (lastVideo) observer.observe(lastVideo);

    return () => observer.disconnect();
  });

  async function loadVideos() {
    try {
      const newVideos = await DatabaseService.getFeedPosts(10);
      videos = newVideos;
      hasMore = newVideos.length === 10;
    } catch (error) {
      console.error('Error loading videos:', error);
    }
  }

  async function loadMoreVideos() {
    if (loadingMore || !hasMore) return;

    loadingMore = true;
    try {
      const newVideos = await DatabaseService.getFeedPosts(10, videos.length);
      videos = [...videos, ...newVideos];
      hasMore = newVideos.length === 10;
    } catch (error) {
      console.error('Error loading more videos:', error);
    } finally {
      loadingMore = false;
    }
  }

  async function handleVideoUpload(event: CustomEvent) {
    const { file } = event.detail;
    try {
      const result = await contentProcessor.processContent(file, {
        type: 'video',
        generateThumbnail: true,
        thumbnailOptions: {
          width: 320,
          height: 180,
          quality: 70
        }
      });

      if (result.status === 'success') {
        await DatabaseService.createPost('', result.processedUrl, 'video');
        await loadVideos();
        isUploadModalOpen = false;
      }
    } catch (error) {
      console.error('Error uploading video:', error);
    }
  }

  function handleScroll(event: WheelEvent) {
    // Prevent default scroll behavior
    event.preventDefault();

    // Calculate new index based on scroll direction
    if (event.deltaY > 0 && currentVideoIndex < videos.length - 1) {
      currentVideoIndex++;
    } else if (event.deltaY < 0 && currentVideoIndex > 0) {
      currentVideoIndex--;
    }
  }
</script>

<svelte:window on:wheel={handleScroll} />

<div class="relative min-h-screen bg-black">
  {#if loading}
    <div class="flex items-center justify-center min-h-screen">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500" />
    </div>
  {:else}
    <!-- Upload Button -->
    <button
      class="fixed top-4 right-4 z-50 bg-primary-500 text-black rounded-full p-4 shadow-lg hover:bg-primary-400 transition-colors"
      on:click={() => isUploadModalOpen = true}
    >
      <span class="text-2xl">📹</span>
    </button>

    <!-- Videos Feed -->
    <div class="snap-y snap-mandatory h-screen overflow-y-scroll">
      {#each videos as video, index (video.id)}
        <div
          class="video-container snap-start h-screen w-full relative"
          class:opacity-0={index !== currentVideoIndex}
          class:pointer-events-none={index !== currentVideoIndex}
        >
          <VideoPlayer
            src={video.media_url}
            autoplay={index === currentVideoIndex}
            loop
            muted={false}
          />

          <!-- Video Info Overlay -->
          <div class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
            <div class="flex items-start gap-4">
              <Avatar
                src={video.profiles.avatar_url}
                alt={video.profiles.username}
                size="md"
              />
              <div class="flex-1">
                <h3 class="font-bold">{video.profiles.username}</h3>
                <p class="text-sm text-gray-300">{video.content}</p>
              </div>
            </div>
          </div>

          <!-- Video Actions -->
          <VideoActions
            likes={video.likes}
            comments={video.comments}
            shares={0}
            onLike={() => DatabaseService.likePost(video.id)}
            onComment={() => {/* Open comments modal */}}
            onShare={() => {/* Open share modal */}}
          />
        </div>
      {/each}

      {#if loadingMore}
        <div class="flex items-center justify-center h-20">
          <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500" />
        </div>
      {/if}
    </div>

    <!-- Upload Modal -->
    <VideoUploadModal
      bind:isOpen={isUploadModalOpen}
      on:upload={handleVideoUpload}
    />
  {/if}
</div>

<style>
  .video-container {
    transition: opacity 0.3s ease-in-out;
  }
</style> 