&lt;script lang="ts">
  import { onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { Button, Icon, Avatar } from '@tiktok-toe/ui-shared/components/ui';
  import { ARFilterEditor } from '../components/ARFilterEditor.svelte';
  import { arFilterService } from '@tiktok-toe/shared/services/ar/ARFilterService';
  import { performanceService } from '@tiktok-toe/shared/services/optimization/PerformanceService';

  let posts = [];
  let loading = true;
  let error: string | null = null;
  let filterEditorOpen = false;
  let selectedPost = null;

  // Infinite scroll
  let loadingMore = false;
  let hasMore = true;
  let page = 1;
  const PAGE_SIZE = 10;

  // Filter categories for stories
  const filterCategories = [
    { id: 'trending', name: 'Trending', icon: '🔥' },
    { id: 'new', name: 'New', icon: '✨' },
    { id: 'following', name: 'Following', icon: '👥' }
  ];

  let selectedCategory = filterCategories[0].id;

  onMount(async () => {
    try {
      await loadPosts();
      performanceService.optimizeForMedia();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load posts';
    } finally {
      loading = false;
    }

    // Set up intersection observer for infinite scroll
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !loadingMore && hasMore) {
            loadMorePosts();
          }
        });
      },
      { rootMargin: '100px' }
    );

    const sentinel = document.querySelector('#scroll-sentinel');
    if (sentinel) observer.observe(sentinel);

    return () => observer.disconnect();
  });

  async function loadPosts() {
    // Simulated API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    posts = Array(PAGE_SIZE).fill(null).map((_, i) => ({
      id: `post-${i}`,
      user: {
        id: `user-${i}`,
        name: `User ${i + 1}`,
        username: `user${i + 1}`,
        avatar: `https://picsum.photos/seed/${i}/64`
      },
      image: `https://picsum.photos/seed/${i}/800/1000`,
      description: 'Amazing photo with AR filters! #photography #ar #filters',
      likes: Math.floor(Math.random() * 1000),
      comments: Math.floor(Math.random() * 100),
      shares: Math.floor(Math.random() * 50),
      filter: {
        id: `filter-${i}`,
        name: 'Glamour Filter',
        preview: `https://picsum.photos/seed/${i}-filter/64`
      },
      createdAt: new Date(Date.now() - Math.random() * 86400000).toISOString()
    }));
  }

  async function loadMorePosts() {
    if (loadingMore || !hasMore) return;

    loadingMore = true;
    page++;

    try {
      // Simulated API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      const newPosts = Array(PAGE_SIZE).fill(null).map((_, i) => ({
        id: `post-${(page - 1) * PAGE_SIZE + i}`,
        user: {
          id: `user-${(page - 1) * PAGE_SIZE + i}`,
          name: `User ${(page - 1) * PAGE_SIZE + i + 1}`,
          username: `user${(page - 1) * PAGE_SIZE + i + 1}`,
          avatar: `https://picsum.photos/seed/${(page - 1) * PAGE_SIZE + i}/64`
        },
        image: `https://picsum.photos/seed/${(page - 1) * PAGE_SIZE + i}/800/1000`,
        description: 'Another amazing photo with AR filters! #photography #ar #filters',
        likes: Math.floor(Math.random() * 1000),
        comments: Math.floor(Math.random() * 100),
        shares: Math.floor(Math.random() * 50),
        filter: {
          id: `filter-${(page - 1) * PAGE_SIZE + i}`,
          name: 'Glamour Filter',
          preview: `https://picsum.photos/seed/${(page - 1) * PAGE_SIZE + i}-filter/64`
        },
        createdAt: new Date(Date.now() - Math.random() * 86400000).toISOString()
      }));

      posts = [...posts, ...newPosts];
      hasMore = page < 5; // Limit to 5 pages for demo
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load more posts';
    } finally {
      loadingMore = false;
    }
  }

  function formatTimestamp(timestamp: string) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return 'now';
  }

  function openFilterEditor(post) {
    selectedPost = post;
    filterEditorOpen = true;
  }

  function handleFilterComplete(event) {
    const { filter } = event.detail;
    // Handle filter application
    filterEditorOpen = false;
    selectedPost = null;
  }
</script>

<div class="container mx-auto px-4 py-6">
  <!-- Stories/Filters Bar -->
  <div class="mb-8 overflow-x-auto">
    <div class="flex gap-4 pb-4">
      {#each filterCategories as category}
        <button
          class="flex flex-col items-center min-w-[64px] p-2 rounded-lg transition-colors"
          class:bg-primary-500={selectedCategory === category.id}
          class:text-white={selectedCategory === category.id}
          class:bg-gray-100={selectedCategory !== category.id}
          class:dark:bg-gray-800={selectedCategory !== category.id}
          on:click={() => selectedCategory = category.id}
        >
          <span class="text-2xl">{category.icon}</span>
          <span class="text-xs mt-1">{category.name}</span>
        </button>
      {/each}
    </div>
  </div>

  <!-- Feed -->
  {#if loading}
    <div class="flex items-center justify-center h-64">
      <div class="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
    </div>
  {:else if error}
    <div class="flex flex-col items-center justify-center h-64 text-red-500">
      <Icon name="alert-circle" class="w-12 h-12 mb-4" />
      <p>{error}</p>
      <Button
        variant="outline"
        class="mt-4"
        on:click={loadPosts}
      >
        Try Again
      </Button>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each posts as post (post.id)}
        <div
          class="bg-white dark:bg-gray-900 rounded-lg shadow-lg overflow-hidden"
          transition:fade={{ duration: 200 }}
        >
          <!-- Post Header -->
          <div class="p-4 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <Avatar
                src={post.user.avatar}
                alt={post.user.name}
                size="sm"
              />
              <div>
                <p class="font-medium">{post.user.name}</p>
                <p class="text-sm text-gray-500">@{post.user.username}</p>
              </div>
            </div>
            <button class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
              <Icon name="more-horizontal" class="w-5 h-5" />
            </button>
          </div>

          <!-- Post Image -->
          <div class="relative aspect-[4/5]">
            <img
              src={post.image}
              alt="Post"
              class="w-full h-full object-cover"
              loading="lazy"
            />
            <!-- Filter Badge -->
            <button
              class="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-2 bg-black/50 backdrop-blur-lg rounded-full text-white text-sm hover:bg-black/60 transition-colors"
              on:click={() => openFilterEditor(post)}
            >
              <img
                src={post.filter.preview}
                alt={post.filter.name}
                class="w-6 h-6 rounded-full"
              />
              <span>{post.filter.name}</span>
            </button>
          </div>

          <!-- Post Actions -->
          <div class="p-4">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-4">
                <button class="flex items-center gap-2 hover:text-red-500">
                  <Icon name="heart" class="w-6 h-6" />
                  <span>{post.likes}</span>
                </button>
                <button class="flex items-center gap-2 hover:text-primary-500">
                  <Icon name="message-circle" class="w-6 h-6" />
                  <span>{post.comments}</span>
                </button>
                <button class="flex items-center gap-2 hover:text-primary-500">
                  <Icon name="share" class="w-6 h-6" />
                  <span>{post.shares}</span>
                </button>
              </div>
              <button class="p-2 hover:text-primary-500">
                <Icon name="bookmark" class="w-6 h-6" />
              </button>
            </div>

            <!-- Post Description -->
            <p class="text-sm">
              <span class="font-medium">{post.user.name}</span>
              {' '}{post.description}
            </p>
            <p class="text-xs text-gray-500 mt-1">
              {formatTimestamp(post.createdAt)}
            </p>
          </div>
        </div>
      {/each}
    </div>

    <!-- Infinite Scroll Sentinel -->
    <div
      id="scroll-sentinel"
      class="h-4 mt-8 flex items-center justify-center"
    >
      {#if loadingMore}
        <div class="animate-spin rounded-full h-6 w-6 border-2 border-primary-500 border-t-transparent" />
      {/if}
    </div>
  {/if}
</div>

<!-- Filter Editor Modal -->
{#if filterEditorOpen}
  <ARFilterEditor
    initialFilter={selectedPost?.filter}
    on:complete={handleFilterComplete}
    on:cancel={() => {
      filterEditorOpen = false;
      selectedPost = null;
    }}
  />
{/if} 