<!-- PhotoPostCard.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import type { Post } from '$lib/types';
  import { auth } from '$lib/services/auth';
  import { analytics } from '$lib/services/analytics';
  import { config } from '$lib/services/config';
  import UserAvatar from '../shared/UserAvatar.svelte';
  import ImageViewer from '../shared/ImageViewer.svelte';
  import ActionBar from './ActionBar.svelte';
  import ShareModal from '../modals/ShareModal.svelte';
  import SaveModal from '../modals/SaveModal.svelte';
  import ReportModal from '../modals/ReportModal.svelte';

  const dispatch = createEventDispatcher();

  // Props
  export let post: Post;
  export let showComments = true;
  export let showDetails = true;

  // State
  let isLiked = false;
  let isSaved = false;
  let isOptionsOpen = false;
  let activeModal: 'share' | 'save' | 'report' | null = null;
  let currentImageIndex = 0;
  let isDoubleTapLiking = false;
  let lastTapTime = 0;

  // Computed
  $: currentUser = $auth.user;
  $: isOwnPost = currentUser?.id === post.userId;
  $: formattedDate = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric'
  }).format(new Date(post.createdAt));

  // Lifecycle
  onMount(async () => {
    // Check if post is liked/saved
    if (currentUser) {
      isLiked = await posts.isLiked(post.id);
      isSaved = await posts.isSaved(post.id);
    }

    // Track view
    analytics.trackEvent({
      type: 'post_view',
      contentId: post.id,
      contentType: 'photo',
      data: {
        source: 'feed',
        timestamp: Date.now()
      }
    });
  });

  // Methods
  async function handleLike() {
    if (!currentUser) {
      dispatch('requireAuth');
      return;
    }

    const wasLiked = isLiked;
    isLiked = !isLiked;

    try {
      if (isLiked) {
        await posts.like(post.id);
        analytics.trackEvent({
          type: 'post_like',
          contentId: post.id,
          contentType: 'photo'
        });
      } else {
        await posts.unlike(post.id);
      }

      dispatch('interaction', { type: 'like', post });
    } catch (error) {
      console.error('Failed to like/unlike post:', error);
      isLiked = wasLiked;
    }
  }

  async function handleSave() {
    if (!currentUser) {
      dispatch('requireAuth');
      return;
    }

    activeModal = 'save';
  }

  function handleShare() {
    activeModal = 'share';
  }

  function handleReport() {
    if (!currentUser) {
      dispatch('requireAuth');
      return;
    }

    activeModal = 'report';
  }

  async function handleDelete() {
    if (!isOwnPost) return;

    try {
      await posts.delete(post.id);
      dispatch('delete', { post });
    } catch (error) {
      console.error('Failed to delete post:', error);
    }
  }

  function handleImageTap(event: MouseEvent) {
    const now = Date.now();
    if (now - lastTapTime < 300) {
      // Double tap
      handleDoubleTapLike(event);
    }
    lastTapTime = now;
  }

  async function handleDoubleTapLike(event: MouseEvent) {
    if (isLiked) return;

    // Show heart animation
    isDoubleTapLiking = true;
    setTimeout(() => {
      isDoubleTapLiking = false;
    }, 1000);

    await handleLike();
  }

  function handleImageChange(index: number) {
    currentImageIndex = index;
    analytics.trackEvent({
      type: 'post_image_view',
      contentId: post.id,
      contentType: 'photo',
      data: {
        imageIndex: index
      }
    });
  }
</script>

<article class="post-card">
  <header class="post-header">
    <div class="user-info">
      <UserAvatar 
        user={post.user}
        size="sm"
        showVerified
        isLink
        on:click={() => dispatch('userClick', { user: post.user })}
      />
      <div class="user-details">
        <button 
          class="username"
          on:click={() => dispatch('userClick', { user: post.user })}
        >
          {post.user.username}
        </button>
        {#if post.locationName}
          <span class="location">{post.locationName}</span>
        {/if}
      </div>
    </div>

    <button
      class="options-button"
      on:click={() => isOptionsOpen = !isOptionsOpen}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
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
        {#if isOwnPost}
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
            Delete Post
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
            Report Post
          </button>
        {/if}
      </div>
    {/if}
  </header>

  <div 
    class="post-media"
    on:dblclick={handleDoubleTapLike}
    on:click={handleImageTap}
  >
    {#if post.media.length > 1}
      <div class="image-carousel">
        {#each post.media as media, index}
          <div 
            class="carousel-item"
            class:active={currentImageIndex === index}
          >
            <ImageViewer
              src={media.url}
              alt={media.metadata?.alt || ''}
              objectFit="cover"
            />
          </div>
        {/each}

        <div class="carousel-indicators">
          {#each post.media as _, index}
            <button
              class="indicator"
              class:active={currentImageIndex === index}
              on:click={() => handleImageChange(index)}
            />
          {/each}
        </div>

        {#if currentImageIndex > 0}
          <button
            class="carousel-button prev"
            on:click={() => handleImageChange(currentImageIndex - 1)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path 
                stroke-linecap="round" 
                stroke-linejoin="round" 
                stroke-width="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        {/if}

        {#if currentImageIndex < post.media.length - 1}
          <button
            class="carousel-button next"
            on:click={() => handleImageChange(currentImageIndex + 1)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path 
                stroke-linecap="round" 
                stroke-linejoin="round" 
                stroke-width="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        {/if}
      </div>
    {:else}
      <ImageViewer
        src={post.media[0].url}
        alt={post.media[0].metadata?.alt || ''}
        objectFit="cover"
      />
    {/if}

    {#if isDoubleTapLiking}
      <div class="like-animation" transition:fade>
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
      </div>
    {/if}
  </div>

  <ActionBar
    {post}
    {isLiked}
    {isSaved}
    on:like={handleLike}
    on:comment={() => dispatch('comment')}
    on:save={handleSave}
    on:share={handleShare}
  />

  {#if showDetails}
    <div class="post-details">
      {#if post.caption}
        <p class="caption">
          <button 
            class="username"
            on:click={() => dispatch('userClick', { user: post.user })}
          >
            {post.user.username}
          </button>
          {post.caption}
        </p>
      {/if}

      {#if post.hashtags?.length > 0}
        <div class="hashtags">
          {#each post.hashtags as tag}
            <button
              class="hashtag"
              on:click={() => dispatch('hashtagClick', { tag })}
            >
              #{tag}
            </button>
          {/each}
        </div>
      {/if}

      {#if showComments && post.commentCount > 0}
        <button
          class="view-comments"
          on:click={() => dispatch('viewComments')}
        >
          View all {post.commentCount} comments
        </button>
      {/if}

      <time class="timestamp">{formattedDate}</time>
    </div>
  {/if}
</article>

{#if activeModal === 'share'}
  <ShareModal
    {post}
    on:close={() => activeModal = null}
  />
{:else if activeModal === 'save'}
  <SaveModal
    {post}
    on:close={() => activeModal = null}
  />
{:else if activeModal === 'report'}
  <ReportModal
    {post}
    on:close={() => activeModal = null}
  />
{/if}

<style lang="postcss">
  .post-card {
    background: var(--surface-color, #1a1a1a);
    border-radius: 8px;
    overflow: hidden;
  }

  .post-header {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .user-details {
    display: flex;
    flex-direction: column;
  }

  .username {
    background: none;
    border: none;
    padding: 0;
    color: white;
    font-weight: 600;
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  }

  .location {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
  }

  .options-button {
    padding: 8px;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    transition: color 0.2s;

    &:hover {
      color: white;
    }

    svg {
      width: 20px;
      height: 20px;
    }
  }

  .options-menu {
    position: absolute;
    top: 100%;
    right: 12px;
    background: var(--surface-color-light, #2a2a2a);
    border-radius: 8px;
    padding: 4px;
    min-width: 180px;
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

  .post-media {
    position: relative;
    aspect-ratio: 1;
    background: var(--surface-color-light, #2a2a2a);
    overflow: hidden;
  }

  .image-carousel {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .carousel-item {
    position: absolute;
    inset: 0;
    opacity: 0;
    transition: opacity 0.3s;

    &.active {
      opacity: 1;
      z-index: 1;
    }
  }

  .carousel-indicators {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 4px;
    z-index: 2;
  }

  .indicator {
    width: 6px;
    height: 6px;
    background: rgba(255, 255, 255, 0.3);
    border: none;
    border-radius: 50%;
    padding: 0;
    cursor: pointer;
    transition: all 0.2s;

    &.active {
      background: var(--primary-color, #00a8ff);
      transform: scale(1.2);
    }
  }

  .carousel-button {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    padding: 12px 8px;
    background: rgba(0, 0, 0, 0.5);
    border: none;
    color: white;
    cursor: pointer;
    transition: all 0.2s;
    z-index: 2;

    &:hover {
      background: rgba(0, 0, 0, 0.7);
    }

    svg {
      width: 24px;
      height: 24px;
    }

    &.prev {
      left: 0;
      border-radius: 0 4px 4px 0;
    }

    &.next {
      right: 0;
      border-radius: 4px 0 0 4px;
    }
  }

  .like-animation {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.3);
    color: white;
    z-index: 3;

    svg {
      width: 80px;
      height: 80px;
      animation: like-bounce 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
  }

  .post-details {
    padding: 12px;
  }

  .caption {
    margin: 0 0 8px;
    font-size: 14px;
    line-height: 1.4;
    color: rgba(255, 255, 255, 0.9);
    word-break: break-word;
  }

  .hashtags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 8px;
  }

  .hashtag {
    background: none;
    border: none;
    padding: 0;
    color: var(--primary-color, #00a8ff);
    font-size: 14px;
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  }

  .view-comments {
    display: block;
    width: 100%;
    padding: 0;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    text-align: left;
    cursor: pointer;
    margin-bottom: 8px;

    &:hover {
      color: white;
    }
  }

  .timestamp {
    display: block;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
  }

  @keyframes like-bounce {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.3); }
  }
</style> 