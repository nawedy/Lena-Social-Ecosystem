<!-- Feed Page -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth';
  import { DatabaseService } from '$lib/services/database';
  import { Avatar, Card } from '@lena/ui';
  import ImageCarousel from '$lib/components/ImageCarousel.svelte';
  import PostActions from '$lib/components/PostActions.svelte';
  import StoryBar from '$lib/components/StoryBar.svelte';

  let posts: any[] = [];
  let stories: any[] = [];
  let loading = true;
  let loadingMore = false;
  let hasMore = true;

  onMount(async () => {
    await Promise.all([
      loadPosts(),
      loadStories()
    ]);
    loading = false;

    // Initialize Intersection Observer for infinite scroll
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !loadingMore && hasMore) {
            loadMorePosts();
          }
        });
      },
      { threshold: 0.5 }
    );

    // Observe the last post element
    const lastPost = document.querySelector('.post-container:last-child');
    if (lastPost) observer.observe(lastPost);

    return () => observer.disconnect();
  });

  async function loadPosts() {
    try {
      const newPosts = await DatabaseService.getFeedPosts(10);
      posts = newPosts;
      hasMore = newPosts.length === 10;
    } catch (error) {
      console.error('Error loading posts:', error);
    }
  }

  async function loadMorePosts() {
    if (loadingMore || !hasMore) return;

    loadingMore = true;
    try {
      const newPosts = await DatabaseService.getFeedPosts(10, posts.length);
      posts = [...posts, ...newPosts];
      hasMore = newPosts.length === 10;
    } catch (error) {
      console.error('Error loading more posts:', error);
    } finally {
      loadingMore = false;
    }
  }

  async function loadStories() {
    try {
      // TODO: Implement story loading from database
      stories = [
        { id: 1, username: 'user1', avatar: null, hasUnseenStories: true },
        { id: 2, username: 'user2', avatar: null, hasUnseenStories: true },
        { id: 3, username: 'user3', avatar: null, hasUnseenStories: false }
      ];
    } catch (error) {
      console.error('Error loading stories:', error);
    }
  }

  function handleLike(postId: string) {
    DatabaseService.likePost(postId);
  }

  function handleComment(postId: string) {
    // TODO: Open comment modal
  }

  function handleShare(postId: string) {
    // TODO: Open share modal
  }
</script>

<div class="max-w-2xl mx-auto px-4 py-4">
  {#if loading}
    <div class="flex items-center justify-center min-h-[50vh]">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500" />
    </div>
  {:else}
    <!-- Stories -->
    <div class="mb-6">
      <StoryBar {stories} />
    </div>

    <!-- Posts Feed -->
    <div class="space-y-6">
      {#each posts as post (post.id)}
        <Card variant="hover" class="post-container">
          <!-- Post Header -->
          <div class="flex items-center gap-3 mb-3">
            <Avatar
              src={post.profiles.avatar_url}
              alt={post.profiles.username}
              size="sm"
            />
            <div class="flex-1">
              <h3 class="font-medium">{post.profiles.username}</h3>
              {#if post.location}
                <p class="text-sm text-gray-400">{post.location}</p>
              {/if}
            </div>
            <button class="text-gray-400 hover:text-white">⋮</button>
          </div>

          <!-- Post Content -->
          <div class="relative aspect-square rounded-lg overflow-hidden mb-3">
            <ImageCarousel
              images={post.media_url.split(',')}
              alt={post.content}
            />
          </div>

          <!-- Post Actions -->
          <PostActions
            likes={post.likes}
            comments={post.comments}
            shares={0}
            onLike={() => handleLike(post.id)}
            onComment={() => handleComment(post.id)}
            onShare={() => handleShare(post.id)}
          />

          <!-- Post Caption -->
          {#if post.content}
            <p class="mt-3">
              <span class="font-medium">{post.profiles.username}</span>
              <span class="ml-2">{post.content}</span>
            </p>
          {/if}

          <!-- Comments Preview -->
          {#if post.comments > 0}
            <button class="mt-2 text-sm text-gray-400">
              View all {post.comments} comments
            </button>
          {/if}

          <!-- Timestamp -->
          <p class="mt-2 text-xs text-gray-500">
            {new Date(post.created_at).toLocaleDateString()}
          </p>
        </Card>
      {/each}

      {#if loadingMore}
        <div class="flex items-center justify-center h-20">
          <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500" />
        </div>
      {/if}
    </div>
  {/if}
</div> 