<!-- CommentSection.svelte -->
<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import type { Post, Comment } from '$lib/types';
  import { posts } from '$lib/services/posts';
  import { auth } from '$lib/services/auth';
  import { analytics } from '$lib/services/analytics';
  import UserAvatar from '../shared/UserAvatar.svelte';
  import CommentActions from './CommentActions.svelte';
  import ReplyInput from './ReplyInput.svelte';
  import ReportModal from '../modals/ReportModal.svelte';

  const dispatch = createEventDispatcher();

  // Props
  export let post: Post;
  export let maxComments = 3;
  export let showLoadMore = true;

  // State
  let comments: Comment[] = [];
  let isLoading = true;
  let isLoadingMore = false;
  let hasMore = false;
  let page = 1;
  let perPage = maxComments;
  let commentInput = '';
  let replyingTo: Comment | null = null;
  let reportingComment: Comment | null = null;
  let error: string | null = null;

  // Computed
  $: currentUser = $auth.user;
  $: sortedComments = comments.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  onMount(async () => {
    await loadComments();
  });

  async function loadComments() {
    isLoading = true;
    error = null;

    try {
      const response = await posts.getComments(post.id, { page, perPage });
      comments = response.items;
      hasMore = response.hasMore;
    } catch (err) {
      console.error('Failed to load comments:', err);
      error = 'Failed to load comments. Please try again.';
    } finally {
      isLoading = false;
    }
  }

  async function loadMoreComments() {
    if (isLoadingMore || !hasMore) return;
    isLoadingMore = true;
    error = null;

    try {
      const response = await posts.getComments(post.id, { 
        page: page + 1, 
        perPage 
      });
      comments = [...comments, ...response.items];
      hasMore = response.hasMore;
      page++;
    } catch (err) {
      console.error('Failed to load more comments:', err);
      error = 'Failed to load more comments. Please try again.';
    } finally {
      isLoadingMore = false;
    }
  }

  async function handleComment() {
    if (!currentUser || !commentInput.trim()) return;
    error = null;

    try {
      const comment = await posts.comment(post.id, commentInput.trim());
      comments = [comment, ...comments];
      commentInput = '';
      post.commentCount++;

      analytics.trackEvent({
        type: 'post_comment',
        contentId: post.id,
        contentType: 'post',
        data: { commentId: comment.id }
      });
    } catch (err) {
      console.error('Failed to add comment:', err);
      error = 'Failed to add comment. Please try again.';
    }
  }

  async function handleReply(comment: Comment) {
    if (!currentUser) {
      dispatch('requireAuth');
      return;
    }
    replyingTo = comment;
  }

  async function handleReplySubmit(event: CustomEvent) {
    if (!replyingTo) return;
    error = null;

    try {
      const reply = await posts.reply(post.id, replyingTo.id, event.detail.content);
      comments = comments.map(c => 
        c.id === replyingTo?.id 
          ? { ...c, replies: [...(c.replies || []), reply], replyCount: c.replyCount + 1 }
          : c
      );
      replyingTo = null;
      post.commentCount++;

      analytics.trackEvent({
        type: 'comment_reply',
        contentId: post.id,
        contentType: 'post',
        data: { 
          commentId: replyingTo.id,
          replyId: reply.id
        }
      });
    } catch (err) {
      console.error('Failed to add reply:', err);
      error = 'Failed to add reply. Please try again.';
    }
  }

  async function handleLike(comment: Comment) {
    if (!currentUser) {
      dispatch('requireAuth');
      return;
    }

    try {
      const isLiked = await posts.toggleCommentLike(comment.id);
      comments = comments.map(c => 
        c.id === comment.id 
          ? { ...c, likeCount: c.likeCount + (isLiked ? 1 : -1) }
          : c
      );

      analytics.trackEvent({
        type: isLiked ? 'comment_like' : 'comment_unlike',
        contentId: post.id,
        contentType: 'post',
        data: { commentId: comment.id }
      });
    } catch (err) {
      console.error('Failed to like comment:', err);
    }
  }

  async function handleDelete(comment: Comment) {
    if (!currentUser || currentUser.id !== comment.userId) return;

    try {
      await posts.deleteComment(comment.id);
      comments = comments.filter(c => c.id !== comment.id);
      post.commentCount--;

      analytics.trackEvent({
        type: 'comment_delete',
        contentId: post.id,
        contentType: 'post',
        data: { commentId: comment.id }
      });
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  }

  function handleReport(comment: Comment) {
    if (!currentUser) {
      dispatch('requireAuth');
      return;
    }
    reportingComment = comment;
  }

  function formatTimeAgo(date: string): string {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
    return new Date(date).toLocaleDateString();
  }
</script>

<div class="comment-section" transition:slide>
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
      <span>Loading comments...</span>
    </div>
  {:else}
    <div class="comment-input">
      {#if currentUser}
        <UserAvatar user={currentUser} size="sm" />
        <div class="input-wrapper">
          <input
            type="text"
            placeholder="Add a comment..."
            bind:value={commentInput}
            on:keydown={(e) => e.key === 'Enter' && handleComment()}
          />
          <button
            class="post-button"
            disabled={!commentInput.trim()}
            on:click={handleComment}
          >
            Post
          </button>
        </div>
      {:else}
        <button
          class="auth-prompt"
          on:click={() => dispatch('requireAuth')}
        >
          Sign in to comment
        </button>
      {/if}
    </div>

    {#if error}
      <div class="error-message" transition:fade>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>{error}</span>
      </div>
    {/if}

    <div class="comments-list">
      {#each sortedComments as comment (comment.id)}
        <div class="comment" transition:fade>
          <UserAvatar 
            user={comment.user} 
            size="sm"
            on:click={() => goto(`/profile/${comment.user.id}`)}
          />
          <div class="comment-content">
            <div class="comment-header">
              <span class="username">{comment.user.username}</span>
              <span class="timestamp">{formatTimeAgo(comment.createdAt)}</span>
            </div>
            <p class="comment-text">{comment.content}</p>
            <CommentActions
              {comment}
              on:like={() => handleLike(comment)}
              on:reply={() => handleReply(comment)}
              on:delete={() => handleDelete(comment)}
              on:report={() => handleReport(comment)}
            />

            {#if replyingTo?.id === comment.id}
              <ReplyInput
                on:submit={handleReplySubmit}
                on:cancel={() => replyingTo = null}
              />
            {/if}

            {#if comment.replies?.length}
              <div class="replies">
                {#each comment.replies as reply}
                  <div class="reply" transition:fade>
                    <UserAvatar 
                      user={reply.user} 
                      size="xs"
                      on:click={() => goto(`/profile/${reply.user.id}`)}
                    />
                    <div class="reply-content">
                      <div class="comment-header">
                        <span class="username">{reply.user.username}</span>
                        <span class="timestamp">{formatTimeAgo(reply.createdAt)}</span>
                      </div>
                      <p class="comment-text">{reply.content}</p>
                      <CommentActions
                        comment={reply}
                        size="sm"
                        on:like={() => handleLike(reply)}
                        on:delete={() => handleDelete(reply)}
                        on:report={() => handleReport(reply)}
                      />
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      {/each}

      {#if showLoadMore && hasMore}
        <button
          class="load-more"
          on:click={loadMoreComments}
          disabled={isLoadingMore}
        >
          {isLoadingMore ? 'Loading...' : 'Load more comments'}
        </button>
      {/if}
    </div>
  {/if}
</div>

{#if reportingComment}
  <ReportModal
    contentId={reportingComment.id}
    contentType="comment"
    on:close={() => reportingComment = null}
  />
{/if}

<style lang="postcss">
  .comment-section {
    padding: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 24px;
    color: rgba(255, 255, 255, 0.7);

    .spinner {
      width: 32px;
      height: 32px;
      animation: spin 1s linear infinite;
    }
  }

  .comment-input {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;

    .input-wrapper {
      flex: 1;
      display: flex;
      gap: 8px;
    }

    input {
      flex: 1;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.1);
      border: none;
      border-radius: 20px;
      color: white;
      font-size: 14px;

      &:focus {
        outline: none;
        background: rgba(255, 255, 255, 0.15);
      }

      &::placeholder {
        color: rgba(255, 255, 255, 0.5);
      }
    }

    .post-button {
      padding: 6px 16px;
      background: var(--primary-color, #00a8ff);
      border: none;
      border-radius: 16px;
      color: white;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;

      &:hover:not(:disabled) {
        filter: brightness(1.1);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
  }

  .auth-prompt {
    width: 100%;
    padding: 12px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 20px;
    color: var(--primary-color, #00a8ff);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.15);
    }
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: rgba(255, 68, 68, 0.1);
    border-radius: 8px;
    color: #ff4444;
    margin-bottom: 16px;

    svg {
      width: 20px;
      height: 20px;
    }
  }

  .comments-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .comment {
    display: flex;
    gap: 12px;
  }

  .comment-content {
    flex: 1;
  }

  .comment-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .username {
    font-size: 14px;
    font-weight: 500;
    color: white;
  }

  .timestamp {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
  }

  .comment-text {
    margin: 0;
    font-size: 14px;
    color: white;
    white-space: pre-wrap;
  }

  .replies {
    margin-top: 8px;
    padding-left: 24px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .reply {
    display: flex;
    gap: 8px;
  }

  .reply-content {
    flex: 1;
  }

  .load-more {
    padding: 12px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 8px;
    color: var(--primary-color, #00a8ff);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.15);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style> 