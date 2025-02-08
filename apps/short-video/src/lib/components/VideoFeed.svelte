<script lang="ts">
  import { onMount } from 'svelte';
  import { VideoPlayer } from '$lib/components';
  import { Button } from '$lib/components/ui';
  import { Icon } from '$lib/components/ui';
  import { VideoService } from '$lib/services/VideoService';
  import type { Video } from '$lib/types';

  export let userId: string | undefined = undefined;
  export let category: string | undefined = undefined;
  export let tags: string[] | undefined = undefined;
  export let autoplay = true;

  let videos: Video[] = [];
  let currentIndex = 0;
  let loading = false;
  let error: string | null = null;
  let observer: IntersectionObserver;
  let page = 1;
  let hasMore = true;

  const videoService = new VideoService();

  onMount(() => {
    loadVideos();
    setupIntersectionObserver();
  });

  async function loadVideos() {
    if (loading || !hasMore) return;

    try {
      loading = true;
      error = null;

      const result = await videoService.listVideos(
        {
          userId,
          category,
          tags,
          status: 'published'
        },
        { field: 'created_at', direction: 'desc' },
        page
      );

      videos = [...videos, ...result.videos];
      hasMore = result.videos.length === 10; // Assuming page size is 10
      page++;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load videos';
    } finally {
      loading = false;
    }
  }

  function setupIntersectionObserver() {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            loadVideos();
          }
        });
      },
      { threshold: 0.5 }
    );
  }

  function handleVideoEnded() {
    if (currentIndex < videos.length - 1) {
      currentIndex++;
    }
  }

  async function handleLike(video: Video) {
    try {
      if (video.liked) {
        await videoService.unlikeVideo(video.id);
      } else {
        await videoService.likeVideo(video.id);
      }
      // Update video in the list
      videos = videos.map(v => 
        v.id === video.id
          ? {
              ...v,
              liked: !v.liked,
              likes_count: v.liked ? v.likes_count - 1 : v.likes_count + 1
            }
          : v
      );
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to like video';
    }
  }

  async function handleShare(video: Video) {
    try {
      if (navigator.share) {
        await navigator.share({
          title: video.title,
          text: video.description,
          url: `${window.location.origin}/video/${video.id}`
        });
      } else {
        await navigator.clipboard.writeText(
          `${window.location.origin}/video/${video.id}`
        );
        // TODO: Show toast notification
      }
      await videoService.shareVideo(video.id);
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        error = err.message;
      }
    }
  }

  function handleReport(video: Video) {
    // TODO: Implement report modal
  }
</script>

<div class="relative w-full h-full bg-black">
  {#if error}
    <div class="p-4 text-red-500 bg-red-100 rounded-lg">
      {error}
    </div>
  {/if}

  <div class="snap-y snap-mandatory h-full overflow-y-auto">
    {#each videos as video, index (video.id)}
      <div
        class="snap-start w-full h-full relative"
        class:hidden={index !== currentIndex}
      >
        <VideoPlayer
          src={video.video_url}
          poster={video.thumbnail_url}
          autoplay={autoplay && index === currentIndex}
          on:ended={handleVideoEnded}
        />

        <!-- Video Info Overlay -->
        <div class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
          <div class="flex items-start justify-between">
            <div class="flex-1 mr-4">
              <h3 class="text-white font-semibold text-lg line-clamp-2">
                {video.title}
              </h3>
              {#if video.description}
                <p class="text-white/80 text-sm mt-1 line-clamp-2">
                  {video.description}
                </p>
              {/if}
              <div class="flex items-center mt-2 space-x-2">
                <img
                  src={video.user.avatar_url}
                  alt={video.user.username}
                  class="w-8 h-8 rounded-full"
                />
                <div class="flex-1">
                  <p class="text-white font-medium">
                    {video.user.display_name || video.user.username}
                  </p>
                  <p class="text-white/60 text-sm">
                    {video.user.followers_count.toLocaleString()} followers
                  </p>
                </div>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex flex-col items-center space-y-4">
              <Button
                variant="ghost"
                size="icon"
                class="text-white hover:text-primary"
                on:click={() => handleLike(video)}
              >
                <Icon
                  name={video.liked ? 'heart-filled' : 'heart'}
                  class="h-6 w-6"
                />
                <span class="text-sm mt-1">
                  {video.likes_count.toLocaleString()}
                </span>
              </Button>

              <Button
                variant="ghost"
                size="icon"
                class="text-white hover:text-primary"
                on:click={() => handleShare(video)}
              >
                <Icon name="share" class="h-6 w-6" />
                <span class="text-sm mt-1">
                  {video.shares_count.toLocaleString()}
                </span>
              </Button>

              <Button
                variant="ghost"
                size="icon"
                class="text-white hover:text-primary"
                on:click={() => handleReport(video)}
              >
                <Icon name="flag" class="h-6 w-6" />
                <span class="text-sm mt-1">Report</span>
              </Button>
            </div>
          </div>

          {#if video.tags?.length}
            <div class="flex items-center mt-3 space-x-2 overflow-x-auto">
              {#each video.tags as tag}
                <a
                  href="/tag/{tag}"
                  class="text-white/80 text-sm hover:text-white"
                >
                  #{tag}
                </a>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/each}
  </div>

  {#if loading}
    <div class="p-4 text-center">
      <div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
    </div>
  {/if}

  {#if !loading && !hasMore}
    <div class="p-4 text-center text-white/60">
      No more videos
    </div>
  {/if}
</div>

<style>
  .snap-y {
    scroll-snap-type: y mandatory;
    -webkit-overflow-scrolling: touch;
  }

  .snap-start {
    scroll-snap-align: start;
  }

  /* Hide scrollbar */
  .overflow-y-auto {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .overflow-y-auto::-webkit-scrollbar {
    display: none;
  }
</style> 