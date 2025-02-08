<!-- +page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { page } from '$app/stores';
  import { auth } from '$lib/services/auth';
  import { posts } from '$lib/services/posts';
  import { analytics } from '$lib/services/analytics';
  import { config } from '$lib/services/config';
  import ImageGrid from '$lib/components/feed/ImageGrid.svelte';
  import AuthModal from '$lib/components/modals/AuthModal.svelte';
  import CommentModal from '$lib/components/modals/CommentModal.svelte';
  import type { Post } from '$lib/types';

  // State
  let activePost: Post | null = null;
  let showAuthModal = false;
  let showComments = false;
  let feedType: 'following' | 'explore' = 'following';
  let isLoading = true;

  // Computed
  $: currentUser = $auth.user;
  $: isAuthenticated = !!currentUser;

  // Lifecycle
  onMount(() => {
    // Track page view
    analytics.trackEvent({
      type: 'page_view',
      data: {
        page: 'feed',
        feedType
      }
    });

    // Check feed type from URL
    const params = new URLSearchParams($page.url.search);
    if (params.get('type') === 'explore') {
      feedType = 'explore';
    }

    isLoading = false;
  });

  // Methods
  function handlePostInteraction(event: CustomEvent) {
    const { type, post } = event.detail;
    activePost = post;

    switch (type) {
      case 'comment':
        if (!isAuthenticated) {
          showAuthModal = true;
        } else {
          showComments = true;
        }
        break;
      case 'userClick':
        const { user } = event.detail;
        goto(`/@${user.username}`);
        break;
      case 'hashtagClick':
        const { tag } = event.detail;
        goto(`/explore/tags/${tag}`);
        break;
    }
  }

  function handleFeedTypeChange(type: typeof feedType) {
    feedType = type;
    goto(`/feed${type === 'explore' ? '?type=explore' : ''}`, {
      replaceState: true
    });

    analytics.trackEvent({
      type: 'feed_type_change',
      data: { type }
    });
  }

  function handleAuthSuccess() {
    showAuthModal = false;
    if (activePost) {
      showComments = true;
    }
  }
</script>

<svelte:head>
  <title>Feed • Lens</title>
  <meta name="description" content="Discover and share amazing photos with your community" />
</svelte:head>

<div class="feed-page">
  <header class="feed-header">
    <div class="feed-tabs">
      <button
        class="tab-button"
        class:active={feedType === 'following'}
        on:click={() => handleFeedTypeChange('following')}
      >
        Following
      </button>
      <button
        class="tab-button"
        class:active={feedType === 'explore'}
        on:click={() => handleFeedTypeChange('explore')}
      >
        Explore
      </button>
    </div>
  </header>

  {#if isLoading}
    <div class="loading-state" transition:fade>
      <svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path 
          stroke-linecap="round" 
          stroke-linejoin="round" 
          stroke-width="2"
          d="M12 6v4m0 4v4m-4-8h8M6 12h12"
        />
      </svg>
      <span>Loading feed...</span>
    </div>
  {:else if feedType === 'following' && !isAuthenticated}
    <div class="empty-state" transition:fade>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path 
          stroke-linecap="round" 
          stroke-linejoin="round" 
          stroke-width="2"
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
      <h2>Follow creators to see their posts</h2>
      <p>Sign in to follow your favorite photographers and see their latest work.</p>
      <button
        class="primary-button"
        on:click={() => showAuthModal = true}
      >
        Sign In
      </button>
    </div>
  {:else}
    <ImageGrid
      on:interaction={handlePostInteraction}
    />
  {/if}
</div>

{#if showAuthModal}
  <AuthModal
    on:success={handleAuthSuccess}
    on:close={() => showAuthModal = false}
  />
{/if}

{#if showComments && activePost}
  <CommentModal
    post={activePost}
    on:close={() => {
      showComments = false;
      activePost = null;
    }}
  />
{/if}

<style lang="postcss">
  .feed-page {
    max-width: var(--content-width, 1280px);
    margin: 0 auto;
    padding: 24px;
  }

  .feed-header {
    margin-bottom: 24px;
  }

  .feed-tabs {
    display: flex;
    gap: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .tab-button {
    padding: 8px 16px;
    background: transparent;
    border: none;
    border-radius: 20px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      color: white;
      background: rgba(255, 255, 255, 0.05);
    }

    &.active {
      color: white;
      background: var(--primary-color, #00a8ff);
    }
  }

  .loading-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 64px 24px;
    text-align: center;
    color: rgba(255, 255, 255, 0.7);
  }

  .spinner {
    width: 32px;
    height: 32px;
    animation: spin 1s linear infinite;
  }

  .empty-state {
    svg {
      width: 48px;
      height: 48px;
      color: var(--primary-color, #00a8ff);
    }

    h2 {
      font-size: 24px;
      font-weight: 600;
      color: white;
      margin: 0;
    }

    p {
      font-size: 16px;
      max-width: 400px;
      margin: 0;
    }
  }

  .primary-button {
    padding: 12px 24px;
    background: var(--primary-color, #00a8ff);
    border: none;
    border-radius: 24px;
    color: white;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      filter: brightness(1.1);
    }
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @media (max-width: 640px) {
    .feed-page {
      padding: 16px;
    }

    .empty-state {
      h2 {
        font-size: 20px;
      }

      p {
        font-size: 14px;
      }
    }
  }
</style> 