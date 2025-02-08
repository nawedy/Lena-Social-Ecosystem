<!-- ActionBar.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  import type { Post } from '$lib/types';
  import { auth } from '$lib/services/auth';

  const dispatch = createEventDispatcher();

  // Props
  export let post: Post;
  export let isLiked = false;
  export let isSaved = false;
  export let showCounts = true;
  export let size: 'sm' | 'md' | 'lg' = 'md';

  // State
  let isLikeAnimating = false;

  // Computed
  $: currentUser = $auth.user;
  $: iconSize = {
    sm: 16,
    md: 24,
    lg: 32
  }[size];

  // Event handlers
  function handleLike() {
    if (!currentUser) {
      dispatch('requireAuth');
      return;
    }

    isLikeAnimating = true;
    setTimeout(() => isLikeAnimating = false, 1000);
    dispatch('like');
  }

  function handleComment() {
    if (!currentUser) {
      dispatch('requireAuth');
      return;
    }

    dispatch('comment');
  }

  function handleSave() {
    if (!currentUser) {
      dispatch('requireAuth');
      return;
    }

    dispatch('save');
  }

  function handleShare() {
    dispatch('share');
  }

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

<div class="action-bar" class:small={size === 'sm'}>
  <div class="action-group">
    <button
      class="action-button like"
      class:liked={isLiked}
      class:animating={isLikeAnimating}
      on:click={handleLike}
    >
      <svg 
        width={iconSize} 
        height={iconSize} 
        viewBox="0 0 24 24" 
        fill={isLiked ? 'currentColor' : 'none'} 
        stroke="currentColor"
      >
        <path 
          stroke-linecap="round" 
          stroke-linejoin="round" 
          stroke-width="2"
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
      {#if showCounts}
        <span class="count">{formatCount(post.likeCount)}</span>
      {/if}
    </button>

    <button
      class="action-button comment"
      on:click={handleComment}
    >
      <svg 
        width={iconSize} 
        height={iconSize} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor"
      >
        <path 
          stroke-linecap="round" 
          stroke-linejoin="round" 
          stroke-width="2"
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
      {#if showCounts}
        <span class="count">{formatCount(post.commentCount)}</span>
      {/if}
    </button>

    <button
      class="action-button share"
      on:click={handleShare}
    >
      <svg 
        width={iconSize} 
        height={iconSize} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor"
      >
        <path 
          stroke-linecap="round" 
          stroke-linejoin="round" 
          stroke-width="2"
          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
        />
      </svg>
      {#if showCounts}
        <span class="count">{formatCount(post.shareCount)}</span>
      {/if}
    </button>
  </div>

  <button
    class="action-button save"
    class:saved={isSaved}
    on:click={handleSave}
  >
    <svg 
      width={iconSize} 
      height={iconSize} 
      viewBox="0 0 24 24" 
      fill={isSaved ? 'currentColor' : 'none'} 
      stroke="currentColor"
    >
      <path 
        stroke-linecap="round" 
        stroke-linejoin="round" 
        stroke-width="2"
        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
      />
    </svg>
    {#if showCounts && post.saveCount > 0}
      <span class="count">{formatCount(post.saveCount)}</span>
    {/if}
  </button>
</div>

<style lang="postcss">
  .action-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);

    &.small {
      padding: 4px 8px;
    }
  }

  .action-group {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .action-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      color: white;
    }

    &.like {
      &.liked {
        color: #ff4b4b;
      }

      &.animating svg {
        animation: like-bounce 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
    }

    &.saved {
      color: var(--primary-color, #00a8ff);
    }
  }

  .count {
    font-size: 14px;
    font-weight: 500;
  }

  @keyframes like-bounce {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.3); }
  }
</style> 