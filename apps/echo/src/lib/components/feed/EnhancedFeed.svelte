<!-- EnhancedFeed.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import { Button, Input, Select, Alert } from '$lib/components/ui';
  import { supabase } from '$lib/supabaseClient';
  import { user } from '$lib/stores/auth';
  import { RichPostViewer } from '../posts/RichPostViewer.svelte';
  import { RichPostComposer } from '../posts/RichPostComposer.svelte';

  export let feedType: 'all' | 'following' | 'trending' | 'breaking' = 'all';
  export let initialTag: string | null = null;

  let posts: any[] = [];
  let loading = false;
  let error: string | null = null;
  let page = 1;
  let hasMore = true;
  let showComposer = false;
  let searchQuery = '';
  let selectedTag = initialTag;
  let sortBy: 'recent' | 'popular' | 'viral' = 'recent';
  let timeRange: '24h' | '7d' | '30d' | 'all' = '24h';
  let newPostsCount = 0;
  let lastFetchTime = new Date();

  const PAGE_SIZE = 20;

  $: queryParams = {
    feedType,
    searchQuery: searchQuery.trim(),
    tag: selectedTag,
    sortBy,
    timeRange
  };

  onMount(async () => {
    await loadPosts(true);
    setupRealtimeSubscription();
  });

  function setupRealtimeSubscription() {
    const channel = supabase
      .channel('feed_updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts'
        },
        (payload) => {
          handleNewPost(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  function handleNewPost(newPost: any) {
    // Check if post matches current feed criteria
    if (matchesFeedCriteria(newPost)) {
      newPostsCount++;
    }
  }

  function matchesFeedCriteria(post: any): boolean {
    if (feedType === 'following' && !post.user_id) return false;
    if (feedType === 'breaking' && !post.is_breaking_news) return false;
    if (selectedTag && !post.tags?.includes(selectedTag)) return false;
    if (searchQuery && !post.content.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }

  async function loadPosts(reset = false) {
    if (reset) {
      page = 1;
      posts = [];
      hasMore = true;
      lastFetchTime = new Date();
    }

    if (!hasMore || loading) return;

    try {
      loading = true;
      error = null;

      let query = supabase
        .from('posts')
        .select(`
          *,
          user:user_id (*),
          metrics:post_metrics (
            likes_count,
            reposts_count,
            replies_count,
            views_count
          )
        `)
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      // Apply filters
      if (feedType === 'following' && $user) {
        const { data: following } = await supabase
          .from('user_follows')
          .select('following_id')
          .eq('follower_id', $user.id);
        
        const followingIds = following?.map(f => f.following_id) || [];
        query = query.in('user_id', followingIds);
      }

      if (feedType === 'breaking') {
        query = query.eq('is_breaking_news', true);
      }

      if (selectedTag) {
        query = query.contains('tags', [selectedTag]);
      }

      if (searchQuery) {
        query = query.ilike('content', `%${searchQuery}%`);
      }

      // Apply sorting
      switch (sortBy) {
        case 'popular':
          query = query.order('metrics(likes_count)', { ascending: false });
          break;
        case 'viral':
          query = query.order('metrics(reposts_count)', { ascending: false });
          break;
        default:
          query = query.order('created_at', { ascending: false });
      }

      // Apply time range filter
      if (timeRange !== 'all') {
        const now = new Date();
        let startDate = new Date();
        
        switch (timeRange) {
          case '24h':
            startDate.setHours(startDate.getHours() - 24);
            break;
          case '7d':
            startDate.setDate(startDate.getDate() - 7);
            break;
          case '30d':
            startDate.setDate(startDate.getDate() - 30);
            break;
        }

        query = query.gte('created_at', startDate.toISOString());
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      posts = reset ? data : [...posts, ...data];
      hasMore = data.length === PAGE_SIZE;
      page++;
      newPostsCount = 0;
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function handleScroll(event: Event) {
    const target = event.target as HTMLElement;
    const bottom = target.scrollHeight - target.scrollTop - target.clientHeight < 100;

    if (bottom && !loading && hasMore) {
      loadPosts();
    }
  }

  function handleSearch() {
    loadPosts(true);
  }

  const sortOptions = [
    { value: 'recent', label: 'Most Recent' },
    { value: 'popular', label: 'Most Popular' },
    { value: 'viral', label: 'Trending' }
  ];

  const timeRangeOptions = [
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: 'all', label: 'All Time' }
  ];
</script>

<div class="space-y-4">
  <!-- Feed Header -->
  <div class="sticky top-0 bg-white dark:bg-gray-800 z-10 p-4 border-b border-gray-200 dark:border-gray-700">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div class="flex items-center space-x-4">
        <h2 class="text-2xl font-bold">
          {#if feedType === 'following'}
            Following
          {:else if feedType === 'trending'}
            Trending
          {:else if feedType === 'breaking'}
            Breaking News
          {:else}
            All Posts
          {/if}
        </h2>

        <Button
          variant="outline"
          on:click={() => showComposer = !showComposer}
        >
          New Post
        </Button>
      </div>

      <div class="flex items-center space-x-4">
        <Select
          options={sortOptions}
          bind:value={sortBy}
          on:change={() => loadPosts(true)}
          class="w-40"
        />

        <Select
          options={timeRangeOptions}
          bind:value={timeRange}
          on:change={() => loadPosts(true)}
          class="w-40"
        />
      </div>
    </div>

    <div class="mt-4 flex items-center space-x-4">
      <Input
        type="search"
        placeholder="Search posts..."
        bind:value={searchQuery}
        on:keydown={(e) => e.key === 'Enter' && handleSearch()}
        class="flex-1"
      />

      <Input
        type="text"
        placeholder="Filter by tag..."
        bind:value={selectedTag}
        on:keydown={(e) => e.key === 'Enter' && loadPosts(true)}
        class="w-48"
      />
    </div>
  </div>

  <!-- Post Composer -->
  {#if showComposer}
    <div class="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <RichPostComposer
        onSuccess={() => {
          showComposer = false;
          loadPosts(true);
        }}
      />
    </div>
  {/if}

  <!-- New Posts Notification -->
  {#if newPostsCount > 0}
    <div
      class="sticky top-20 z-20 flex justify-center"
      transition:fade
    >
      <button
        class="bg-emerald-500 text-white px-4 py-2 rounded-full shadow-lg hover:bg-emerald-600 transition-colors"
        on:click={() => loadPosts(true)}
      >
        {newPostsCount} new {newPostsCount === 1 ? 'post' : 'posts'}
      </button>
    </div>
  {/if}

  <!-- Feed Content -->
  <div
    class="space-y-4 overflow-y-auto"
    on:scroll={handleScroll}
    style="max-height: calc(100vh - 200px);"
  >
    {#if error}
      <Alert type="error" message={error} />
    {/if}

    {#each posts as post (post.id)}
      <div transition:fade>
        <RichPostViewer postId={post.id} />
      </div>
    {/each}

    {#if loading}
      <div class="flex justify-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    {/if}

    {#if !loading && posts.length === 0}
      <div class="text-center py-8 text-gray-500">
        No posts found
      </div>
    {/if}

    {#if !loading && !hasMore && posts.length > 0}
      <div class="text-center py-8 text-gray-500">
        No more posts to load
      </div>
    {/if}
  </div>
</div>

<style>
  /* Add any component-specific styles here */
</style> 