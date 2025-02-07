<!-- PostComments.svelte -->
<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { Avatar, Button, TextArea } from '@lena/ui';
  import { auth } from '$lib/stores/auth';
  import { DatabaseService } from '$lib/services/database';

  export let postId: string;
  export let initialComments: any[] = [];
  export let maxDisplayed = 3;

  const dispatch = createEventDispatcher();
  let comments = initialComments;
  let newComment = '';
  let loading = false;
  let showAllComments = false;

  $: displayedComments = showAllComments 
    ? comments 
    : comments.slice(0, maxDisplayed);

  onMount(async () => {
    // Subscribe to real-time comment updates
    const subscription = DatabaseService
      .subscribeToComments(postId, (newComments) => {
        comments = newComments;
      });

    return () => subscription.unsubscribe();
  });

  async function handleSubmit() {
    if (!newComment.trim() || !$auth.user) return;
    
    loading = true;
    try {
      await DatabaseService.addComment(postId, newComment.trim());
      newComment = '';
      dispatch('comment');
    } catch (error) {
      console.error('Error posting comment:', error);
    } finally {
      loading = false;
    }
  }

  function handleLikeComment(commentId: string) {
    if (!$auth.user) return;
    DatabaseService.likeComment(commentId);
  }
</script>

<div class="space-y-4">
  <!-- Comment List -->
  <div class="space-y-3">
    {#each displayedComments as comment (comment.id)}
      <div class="flex gap-3">
        <Avatar
          src={comment.profiles.avatar_url}
          alt={comment.profiles.username}
          size="sm"
        />
        <div class="flex-1">
          <div class="bg-gray-800 rounded-lg p-3">
            <p class="font-medium text-sm">{comment.profiles.username}</p>
            <p class="text-gray-300">{comment.content}</p>
          </div>
          <div class="flex items-center gap-4 mt-1 text-sm text-gray-400">
            <button 
              class="hover:text-white transition-colors"
              on:click={() => handleLikeComment(comment.id)}
            >
              Like
            </button>
            <span>{new Date(comment.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    {/each}
  </div>

  {#if comments.length > maxDisplayed && !showAllComments}
    <button
      class="text-sm text-primary-400 hover:text-primary-300 transition-colors"
      on:click={() => showAllComments = true}
    >
      View all {comments.length} comments
    </button>
  {/if}

  <!-- Comment Input -->
  {#if $auth.user}
    <form 
      class="flex gap-3 items-start"
      on:submit|preventDefault={handleSubmit}
    >
      <Avatar
        src={$auth.user.avatar_url}
        alt={$auth.user.username}
        size="sm"
      />
      <div class="flex-1">
        <TextArea
          bind:value={newComment}
          placeholder="Add a comment..."
          rows={1}
          maxRows={5}
          class="w-full"
        />
      </div>
      <Button
        type="submit"
        variant="primary"
        disabled={!newComment.trim() || loading}
        loading={loading}
      >
        Post
      </Button>
    </form>
  {/if}
</div> 