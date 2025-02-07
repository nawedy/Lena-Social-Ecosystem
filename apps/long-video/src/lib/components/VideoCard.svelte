<!-- VideoCard.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { Avatar } from '@lena/ui';
  import { formatDistance } from 'date-fns';

  export let video: {
    id: string;
    title: string;
    description: string;
    thumbnail: string;
    previewUrl?: string;
    duration: number;
    views: number;
    createdAt: Date;
    channel: {
      id: string;
      name: string;
      avatar: string;
      verified: boolean;
    };
  };

  let thumbnailElement: HTMLDivElement;
  let previewVideo: HTMLVideoElement;
  let previewTimeout: number;
  let isHovering = false;

  onMount(() => {
    if (video.previewUrl) {
      previewVideo = document.createElement('video');
      previewVideo.src = video.previewUrl;
      previewVideo.muted = true;
      previewVideo.loop = true;
      previewVideo.preload = 'none';
      previewVideo.className = 'absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-300';
    }
  });

  function handleMouseEnter() {
    isHovering = true;
    if (!video.previewUrl) return;

    previewTimeout = window.setTimeout(() => {
      thumbnailElement.appendChild(previewVideo);
      previewVideo.play()
        .then(() => {
          previewVideo.style.opacity = '1';
        })
        .catch(console.error);
    }, 500);
  }

  function handleMouseLeave() {
    isHovering = false;
    clearTimeout(previewTimeout);
    
    if (previewVideo && previewVideo.parentNode) {
      previewVideo.style.opacity = '0';
      setTimeout(() => {
        previewVideo.pause();
        previewVideo.currentTime = 0;
        previewVideo.remove();
      }, 300);
    }
  }

  function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function formatViews(views: number): string {
    if (views >= 1000000) {
      return `${(views / 1000000).toFixed(1)}M views`;
    }
    if (views >= 1000) {
      return `${(views / 1000).toFixed(1)}K views`;
    }
    return `${views} views`;
  }
</script>

<a 
  href="/watch/{video.id}"
  class="block group"
  on:mouseenter={handleMouseEnter}
  on:mouseleave={handleMouseLeave}
>
  <!-- Thumbnail -->
  <div 
    bind:this={thumbnailElement}
    class="relative aspect-video rounded-lg overflow-hidden bg-gray-900"
  >
    <img
      src={video.thumbnail}
      alt={video.title}
      class="w-full h-full object-cover transition-transform duration-300
             group-hover:scale-105"
      loading="lazy"
    />

    <!-- Duration Badge -->
    <div class="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-white text-xs font-medium">
      {formatDuration(video.duration)}
    </div>

    <!-- Progress Bar (if watched) -->
    <div class="absolute bottom-0 left-0 right-0 h-1 bg-gray-800">
      <div class="h-full bg-primary-500" style="width: 45%" />
    </div>
  </div>

  <div class="flex gap-3 mt-3">
    <!-- Channel Avatar -->
    <a 
      href="/channel/{video.channel.id}"
      class="flex-shrink-0"
      on:click|stopPropagation
    >
      <Avatar
        src={video.channel.avatar}
        alt={video.channel.name}
        size="md"
        verified={video.channel.verified}
      />
    </a>

    <!-- Video Info -->
    <div class="flex-1 min-w-0">
      <h3 
        class="font-medium line-clamp-2 group-hover:text-primary-400 
               transition-colors mb-1"
      >
        {video.title}
      </h3>
      
      <div class="text-sm text-gray-400">
        <a 
          href="/channel/{video.channel.id}"
          class="hover:text-white transition-colors"
          on:click|stopPropagation
        >
          {video.channel.name}
        </a>
        
        <div class="flex items-center gap-1">
          <span>{formatViews(video.views)}</span>
          <span>•</span>
          <span>{formatDistance(video.createdAt, new Date(), { addSuffix: true })}</span>
        </div>
      </div>
    </div>
  </div>
</a>

<style>
  /* Hover animation for the progress bar */
  .group:hover .bg-primary-500 {
    @apply bg-red-500;
  }
</style> 