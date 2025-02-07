<!-- VideoDescription.svelte -->
<script lang="ts">
  import { Avatar, Button, Icon } from '@lena/ui';
  import { formatDistance } from 'date-fns';
  import { auth } from '$lib/stores/auth';

  export let video: {
    id: string;
    title: string;
    description: string;
    views: number;
    likes: number;
    createdAt: Date;
    channel: {
      id: string;
      name: string;
      avatar: string;
      verified: boolean;
      subscribers: number;
      description: string;
    };
    tags: string[];
  };

  let isDescriptionExpanded = false;
  let isSubscribed = false; // TODO: Get from API
  let hasLiked = false; // TODO: Get from API

  function formatNumber(num: number): string {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  }

  function handleSubscribe() {
    if (!$auth.user) return;
    isSubscribed = !isSubscribed;
    // TODO: Call API to subscribe/unsubscribe
  }

  function handleLike() {
    if (!$auth.user) return;
    hasLiked = !hasLiked;
    // TODO: Call API to like/unlike
  }

  function handleShare() {
    if (navigator.share) {
      navigator.share({
        title: video.title,
        text: `Check out "${video.title}" by ${video.channel.name}`,
        url: window.location.href
      });
    }
  }
</script>

<div class="space-y-4">
  <!-- Title and Stats -->
  <div>
    <h1 class="text-2xl font-medium mb-2">{video.title}</h1>
    <div class="flex items-center justify-between">
      <div class="text-gray-400">
        {formatNumber(video.views)} views
        <span class="mx-1">•</span>
        {formatDistance(video.createdAt, new Date(), { addSuffix: true })}
      </div>

      <div class="flex items-center gap-4">
        <!-- Like Button -->
        <button
          class="flex items-center gap-2 hover:text-white transition-colors"
          class:text-primary-400={hasLiked}
          on:click={handleLike}
        >
          <Icon name={hasLiked ? 'thumbs-up-filled' : 'thumbs-up'} size={20} />
          <span>{formatNumber(video.likes)}</span>
        </button>

        <!-- Share Button -->
        <button
          class="flex items-center gap-2 hover:text-white transition-colors"
          on:click={handleShare}
        >
          <Icon name="share" size={20} />
          <span>Share</span>
        </button>

        <!-- More Options -->
        <button
          class="hover:text-white transition-colors"
          aria-label="More options"
        >
          <Icon name="more-horizontal" size={20} />
        </button>
      </div>
    </div>
  </div>

  <!-- Channel Info -->
  <div class="flex items-start justify-between p-4 rounded-lg bg-gray-800/50">
    <div class="flex items-start gap-4">
      <a href="/channel/{video.channel.id}" class="flex-shrink-0">
        <Avatar
          src={video.channel.avatar}
          alt={video.channel.name}
          size="lg"
          verified={video.channel.verified}
        />
      </a>

      <div>
        <a 
          href="/channel/{video.channel.id}"
          class="font-medium hover:text-primary-400 transition-colors"
        >
          {video.channel.name}
        </a>
        <p class="text-sm text-gray-400">
          {formatNumber(video.channel.subscribers)} subscribers
        </p>
        <p class="text-sm text-gray-400 line-clamp-1 mt-1">
          {video.channel.description}
        </p>
      </div>
    </div>

    <Button
      variant={isSubscribed ? 'secondary' : 'primary'}
      on:click={handleSubscribe}
    >
      {isSubscribed ? 'Subscribed' : 'Subscribe'}
    </Button>
  </div>

  <!-- Description -->
  <div 
    class="p-4 rounded-lg bg-gray-800/50"
    class:cursor-pointer={!isDescriptionExpanded}
    on:click={() => isDescriptionExpanded = !isDescriptionExpanded}
  >
    <div class={!isDescriptionExpanded ? 'line-clamp-3' : ''}>
      <p class="whitespace-pre-wrap">{video.description}</p>

      {#if video.tags.length > 0}
        <div class="flex flex-wrap gap-2 mt-4">
          {#each video.tags as tag}
            <a
              href="/search?q={encodeURIComponent(tag)}"
              class="text-sm text-primary-400 hover:text-primary-300 transition-colors"
              on:click|stopPropagation
            >
              #{tag}
            </a>
          {/each}
        </div>
      {/if}
    </div>

    {#if !isDescriptionExpanded}
      <button
        class="text-sm text-gray-400 hover:text-white transition-colors mt-2"
      >
        Show more
      </button>
    {/if}
  </div>
</div> 