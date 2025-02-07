<!-- PostActions.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { auth } from '$lib/stores/auth';
  import { Icon } from '@lena/ui';

  export let likes: number = 0;
  export let comments: number = 0;
  export let shares: number = 0;
  export let isLiked: boolean = false;

  const dispatch = createEventDispatcher();

  function handleLike() {
    if (!$auth.user) return;
    dispatch('like');
  }

  function handleComment() {
    if (!$auth.user) return;
    dispatch('comment');
  }

  function handleShare() {
    if (!$auth.user) return;
    dispatch('share');
  }

  function handleBookmark() {
    if (!$auth.user) return;
    dispatch('bookmark');
  }
</script>

<div class="flex flex-col gap-2">
  <!-- Action Buttons -->
  <div class="flex items-center gap-4">
    <div class="flex items-center gap-4 flex-1">
      <button
        on:click={handleLike}
        class="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-800 transition-colors"
        aria-label={isLiked ? 'Unlike post' : 'Like post'}
      >
        <Icon
          name={isLiked ? 'heart-filled' : 'heart'}
          class={isLiked ? 'text-red-500' : 'text-white'}
          size={24}
        />
      </button>

      <button
        on:click={handleComment}
        class="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-800 transition-colors"
        aria-label="Comment on post"
      >
        <Icon name="message-circle" size={24} />
      </button>

      <button
        on:click={handleShare}
        class="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-800 transition-colors"
        aria-label="Share post"
      >
        <Icon name="share" size={24} />
      </button>
    </div>

    <button
      on:click={handleBookmark}
      class="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-800 transition-colors"
      aria-label="Save post"
    >
      <Icon name="bookmark" size={24} />
    </button>
  </div>

  <!-- Stats -->
  <div class="space-y-1">
    {#if likes > 0}
      <p class="font-medium">{likes.toLocaleString()} {likes === 1 ? 'like' : 'likes'}</p>
    {/if}
  </div>
</div> 