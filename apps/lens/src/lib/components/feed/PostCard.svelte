<!-- PostCard.svelte -->
<script lang="ts">
  import { fade, slide } from 'svelte/transition';
  import { posts } from '$lib/services/posts';
  import { collections } from '$lib/services/collections';
  import { analytics } from '$lib/services/analytics';
  import { auth } from '$lib/services/auth';
  import type { Post, UserProfile } from '$lib/types';
  import MediaGallery from './MediaGallery.svelte';
  import UserAvatar from '../shared/UserAvatar.svelte';
  import ActionBar from './ActionBar.svelte';
  import CommentSection from './CommentSection.svelte';
  import ShareModal from '../modals/ShareModal.svelte';
  import SaveToCollectionModal from '../modals/SaveToCollectionModal.svelte';
  import ReportModal from '../modals/ReportModal.svelte';

  // Props
  export let post: Post;
  export let showComments = false;
  export let isDetailView = false;

  // State
  let isLiked = false;
  let isSaved = false;
  let isCommenting = false;
  let isShareModalOpen = false;
  let isSaveModalOpen = false;
  let isReportModalOpen = false;
  let isOptionsMenuOpen = false;
  let isLoadingAction = false;

  // Reactive statements
  $: currentUser = $auth.user;
  $: isOwnPost = currentUser?.id === post.userId;
  $: formattedDate = new Date(post.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  // Lifecycle
  onMount(async () => {
    if (currentUser) {
      // Check if post is liked/saved by current user
      const [likeStatus, saveStatus] = await Promise.all([
        posts.checkLikeStatus(post.id),
        collections.checkSaveStatus(post.id)
      ]);
      isLiked = likeStatus;
      isSaved = saveStatus;
    }

    // Track post view
    analytics.trackEvent({
      type: 'post_view',
      contentId: post.id,
      contentType: 'post'
    });
  });

  // Event handlers
  async function handleLike() {
    if (!currentUser || isLoadingAction) return;
    isLoadingAction = true;

    try {
      if (isLiked) {
        await posts.unlike(post.id);
        post.likeCount--;
      } else {
        await posts.like(post.id);
        post.likeCount++;
      }
      isLiked = !isLiked;

      analytics.trackEvent({
        type: isLiked ? 'post_like' : 'post_unlike',
        contentId: post.id,
        contentType: 'post'
      });
    } catch (error) {
      console.error('Failed to like/unlike post:', error);
    } finally {
      isLoadingAction = false;
    }
  }

  async function handleSave() {
    if (!currentUser || isLoadingAction) return;
    isSaveModalOpen = true;
  }

  async function handleShare() {
    isShareModalOpen = true;
    analytics.trackEvent({
      type: 'post_share',
      contentId: post.id,
      contentType: 'post'
    });
  }

  async function handleReport() {
    if (!currentUser) return;
    isReportModalOpen = true;
  }

  async function handleDelete() {
    if (!isOwnPost || isLoadingAction) return;
    isLoadingAction = true;

    try {
      await posts.delete(post.id);
      dispatch('delete', { postId: post.id });
    } catch (error) {
      console.error('Failed to delete post:', error);
    } finally {
      isLoadingAction = false;
    }
  }

  function handleUserClick(userId: string) {
    goto(`/profile/${userId}`);
  }

  function handlePostClick() {
    if (!isDetailView) {
      goto(`/post/${post.id}`);
    }
  }
</script>

<article 
  class="post-card"
  class:detail-view={isDetailView}
  transition:fade
>
  <header class="post-header">
    <div class="user-info" on:click={() => handleUserClick(post.userId)}>
      <UserAvatar 
        user={post.user} 
        size="md"
      />
      <div class="user-details">
        <h3 class="username">{post.user.username}</h3>
        <span class="post-date">{formattedDate}</span>
      </div>
    </div>

    <button 
      class="options-button"
      on:click={() => isOptionsMenuOpen = !isOptionsMenuOpen}
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

    {#if isOptionsMenuOpen}
      <div 
        class="options-menu"
        transition:slide
        use:clickOutside
        on:clickoutside={() => isOptionsMenuOpen = false}
      >
        {#if isOwnPost}
          <button on:click={handleDelete}>
            Delete Post
          </button>
          <button on:click={() => goto(`/post/${post.id}/edit`)}>
            Edit Post
          </button>
        {:else}
          <button on:click={handleReport}>
            Report Post
          </button>
        {/if}
      </div>
    {/if}
  </header>

  <div class="post-content" on:click={handlePostClick}>
    {#if post.caption}
      <p class="caption">{post.caption}</p>
    {/if}

    <MediaGallery 
      media={post.media}
      aspectRatio={isDetailView ? 'original' : '4:5'}
    />
  </div>

  <ActionBar
    {post}
    {isLiked}
    {isSaved}
    on:like={handleLike}
    on:comment={() => isCommenting = true}
    on:save={handleSave}
    on:share={handleShare}
  />

  {#if showComments || isCommenting}
    <CommentSection
      {post}
      on:close={() => isCommenting = false}
    />
  {/if}
</article>

{#if isShareModalOpen}
  <ShareModal
    {post}
    on:close={() => isShareModalOpen = false}
  />
{/if}

{#if isSaveModalOpen}
  <SaveToCollectionModal
    {post}
    on:close={() => isSaveModalOpen = false}
    on:save={(event) => {
      isSaved = true;
      post.saveCount++;
      analytics.trackEvent({
        type: 'post_save',
        contentId: post.id,
        contentType: 'post',
        data: { collectionId: event.detail.collectionId }
      });
    }}
  />
{/if}

{#if isReportModalOpen}
  <ReportModal
    contentId={post.id}
    contentType="post"
    on:close={() => isReportModalOpen = false}
  />
{/if}

<style lang="postcss">
  .post-card {
    background: var(--surface-color, #1a1a1a);
    border-radius: 8px;
    overflow: hidden;
    transition: transform 0.2s;

    &:not(.detail-view):hover {
      transform: translateY(-2px);
    }
  }

  .post-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;

    &:hover .username {
      color: var(--primary-color, #00a8ff);
    }
  }

  .user-details {
    display: flex;
    flex-direction: column;
  }

  .username {
    font-size: 14px;
    font-weight: 600;
    color: white;
    margin: 0;
  }

  .post-date {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
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
    right: 16px;
    background: var(--surface-color-light, #2a2a2a);
    border-radius: 8px;
    padding: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    z-index: 10;

    button {
      display: block;
      width: 100%;
      padding: 8px 16px;
      background: transparent;
      border: none;
      color: white;
      font-size: 14px;
      text-align: left;
      cursor: pointer;
      transition: background-color 0.2s;

      &:hover {
        background: rgba(255, 255, 255, 0.1);
      }

      &:not(:last-child) {
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }
    }
  }

  .post-content {
    cursor: pointer;
  }

  .caption {
    padding: 16px;
    margin: 0;
    font-size: 14px;
    color: white;
    white-space: pre-wrap;
  }
</style> 