<!-- CommentActions.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  import type { Comment } from '$lib/types';
  import { auth } from '$lib/services/auth';
  import { posts } from '$lib/services/posts';

  const dispatch = createEventDispatcher();

  // Props
  export let comment: Comment;
  export let size: 'sm' | 'md' = 'md';
  export let showReply = true;

  // State
  let isOptionsOpen = false;
  let isLikeAnimating = false;

  // Computed
  $: currentUser = $auth.user;
  $: isOwnComment = currentUser?.id === comment.userId;
  $: isLiked = comment.likes?.includes(currentUser?.id || '');
  $: iconSize = size === 'sm' ? 16 : 20;

  // Event handlers
  function handleLike() {
    isLikeAnimating = true;
    setTimeout(() => isLikeAnimating = false, 1000);
    dispatch('like');
  }

  function handleReply() {
    dispatch('reply');
  }

  function handleDelete() {
    dispatch('delete');
  }

  function handleReport() {
    dispatch('report');
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

<div class="comment-actions" class:small={size === 'sm'}>
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
          d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
        />
      </svg>
      {#if comment.likeCount > 0}
        <span class="count">{formatCount(comment.likeCount)}</span>
      {/if}
    </button>

    {#if showReply}
      <button
        class="action-button reply"
        on:click={handleReply}
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
            d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
          />
        </svg>
        {#if comment.replyCount > 0}
          <span class="count">{formatCount(comment.replyCount)}</span>
        {/if}
      </button>
    {/if}
  </div>

  <div class="options">
    <button
      class="options-button"
      on:click={() => isOptionsOpen = !isOptionsOpen}
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
          d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
        />
      </svg>
    </button>

    {#if isOptionsOpen}
      <div 
        class="options-menu"
        transition:fade
        use:clickOutside
        on:clickoutside={() => isOptionsOpen = false}
      >
        {#if isOwnComment}
          <button 
            class="menu-item delete"
            on:click={() => {
              handleDelete();
              isOptionsOpen = false;
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path 
                stroke-linecap="round" 
                stroke-linejoin="round" 
                stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Delete
          </button>
        {:else}
          <button 
            class="menu-item report"
            on:click={() => {
              handleReport();
              isOptionsOpen = false;
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path 
                stroke-linecap="round" 
                stroke-linejoin="round" 
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            Report
          </button>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style lang="postcss">
  .comment-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;

    &.small {
      margin-top: 4px;

      .action-button {
        padding: 4px;
      }

      .count {
        font-size: 12px;
      }
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
    gap: 4px;
    padding: 6px;
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
  }

  .count {
    font-size: 14px;
    font-weight: 500;
  }

  .options {
    position: relative;
  }

  .options-button {
    padding: 6px;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    transition: color 0.2s;

    &:hover {
      color: white;
    }
  }

  .options-menu {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    background: var(--surface-color-light, #2a2a2a);
    border-radius: 8px;
    padding: 4px;
    min-width: 120px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    z-index: 10;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: white;
    font-size: 14px;
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    svg {
      width: 16px;
      height: 16px;
    }

    &.delete {
      color: #ff4444;
    }

    &.report {
      color: #ff9800;
    }
  }

  @keyframes like-bounce {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.3); }
  }
</style> 