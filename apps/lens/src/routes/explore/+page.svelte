&lt;script lang="ts">
  import { onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { Button, Icon, Avatar, Tabs } from '@tiktok-toe/ui-shared/components/ui';
  import { ARFilterEditor } from '../../components/ARFilterEditor.svelte';
  import { arFilterService } from '@tiktok-toe/shared/services/ar/ARFilterService';
  import { performanceService } from '@tiktok-toe/shared/services/optimization/PerformanceService';

  let filters = [];
  let loading = true;
  let error: string | null = null;
  let filterEditorOpen = false;
  let selectedFilter = null;
  let searchQuery = '';

  // Filter categories
  const categories = [
    { id: 'trending', label: 'Trending', icon: '🔥' },
    { id: 'beauty', label: 'Beauty', icon: '✨' },
    { id: 'fun', label: 'Fun', icon: '😄' },
    { id: 'artistic', label: 'Artistic', icon: '🎨' },
    { id: 'masks', label: 'Masks', icon: '🎭' }
  ];

  let selectedCategory = categories[0].id;

  // Filter collections
  const collections = [
    {
      id: 'featured',
      title: 'Featured Filters',
      description: 'Handpicked filters by our team'
    },
    {
      id: 'new',
      title: 'New & Fresh',
      description: 'Latest filter releases'
    },
    {
      id: 'popular',
      title: 'Most Popular',
      description: 'Trending in the community'
    }
  ];

  onMount(async () => {
    try {
      await loadFilters();
      performanceService.optimizeForInteraction();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load filters';
    } finally {
      loading = false;
    }
  });

  async function loadFilters() {
    // Simulated API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    filters = Array(20).fill(null).map((_, i) => ({
      id: `filter-${i}`,
      name: `Filter ${i + 1}`,
      description: 'Amazing AR filter with stunning effects!',
      category: categories[Math.floor(Math.random() * categories.length)].id,
      preview: `https://picsum.photos/seed/${i}/300/400`,
      thumbnail: `https://picsum.photos/seed/${i}/64`,
      creator: {
        id: `user-${i}`,
        name: `Creator ${i + 1}`,
        username: `creator${i + 1}`,
        avatar: `https://picsum.photos/seed/creator-${i}/64`
      },
      stats: {
        uses: Math.floor(Math.random() * 10000),
        likes: Math.floor(Math.random() * 1000),
        shares: Math.floor(Math.random() * 500)
      },
      assets: [
        {
          id: `model-${i}`,
          type: '3d_model',
          url: '/models/filter.glb',
          preload: true
        }
      ],
      settings: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        opacity: 1,
        blendMode: 'normal'
      }
    }));
  }

  function formatNumber(num: number): string {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  }

  function openFilterEditor(filter) {
    selectedFilter = filter;
    filterEditorOpen = true;
  }

  function handleFilterComplete(event) {
    const { filter } = event.detail;
    // Handle filter application
    filterEditorOpen = false;
    selectedFilter = null;
  }

  $: filteredFilters = filters
    .filter(filter => {
      const matchesCategory = selectedCategory === 'all' || filter.category === selectedCategory;
      const matchesSearch = !searchQuery || 
        filter.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        filter.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
</script>

<div class="container mx-auto px-4 py-6">
  <!-- Search Bar -->
  <div class="relative mb-8">
    <input
      type="text"
      placeholder="Search filters..."
      bind:value={searchQuery}
      class="w-full h-12 pl-12 pr-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
    />
    <Icon
      name="search"
      class="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400"
    />
  </div>

  <!-- Categories -->
  <div class="mb-8">
    <h2 class="text-lg font-semibold mb-4">Categories</h2>
    <div class="flex gap-4 overflow-x-auto pb-4">
      <button
        class="flex flex-col items-center min-w-[80px] p-3 rounded-lg transition-colors"
        class:bg-primary-500={selectedCategory === 'all'}
        class:text-white={selectedCategory === 'all'}
        class:bg-gray-100={selectedCategory !== 'all'}
        class:dark:bg-gray-800={selectedCategory !== 'all'}
        on:click={() => selectedCategory = 'all'}
      >
        <span class="text-2xl">🌟</span>
        <span class="text-xs mt-1">All</span>
      </button>

      {#each categories as category}
        <button
          class="flex flex-col items-center min-w-[80px] p-3 rounded-lg transition-colors"
          class:bg-primary-500={selectedCategory === category.id}
          class:text-white={selectedCategory === category.id}
          class:bg-gray-100={selectedCategory !== category.id}
          class:dark:bg-gray-800={selectedCategory !== category.id}
          on:click={() => selectedCategory = category.id}
        >
          <span class="text-2xl">{category.icon}</span>
          <span class="text-xs mt-1">{category.label}</span>
        </button>
      {/each}
    </div>
  </div>

  <!-- Collections -->
  {#each collections as collection}
    <div class="mb-12">
      <div class="flex items-end justify-between mb-4">
        <div>
          <h2 class="text-lg font-semibold">{collection.title}</h2>
          <p class="text-sm text-gray-500">{collection.description}</p>
        </div>
        <Button variant="text">View All</Button>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {#each filteredFilters.slice(0, 4) as filter (filter.id)}
          <div
            class="bg-white dark:bg-gray-900 rounded-lg shadow-lg overflow-hidden"
            transition:fade={{ duration: 200 }}
          >
            <!-- Preview -->
            <div class="relative aspect-[3/4]">
              <img
                src={filter.preview}
                alt={filter.name}
                class="w-full h-full object-cover"
                loading="lazy"
              />
              <button
                class="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity"
                on:click={() => openFilterEditor(filter)}
              >
                <span class="px-4 py-2 bg-white/20 backdrop-blur-lg rounded-full text-white">
                  Try Filter
                </span>
              </button>
            </div>

            <!-- Info -->
            <div class="p-4">
              <div class="flex items-start justify-between mb-3">
                <div>
                  <h3 class="font-medium">{filter.name}</h3>
                  <p class="text-sm text-gray-500">by @{filter.creator.username}</p>
                </div>
                <button class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                  <Icon name="bookmark" class="w-5 h-5" />
                </button>
              </div>

              <!-- Stats -->
              <div class="flex items-center gap-4 text-sm text-gray-500">
                <div class="flex items-center gap-1">
                  <Icon name="eye" class="w-4 h-4" />
                  <span>{formatNumber(filter.stats.uses)}</span>
                </div>
                <div class="flex items-center gap-1">
                  <Icon name="heart" class="w-4 h-4" />
                  <span>{formatNumber(filter.stats.likes)}</span>
                </div>
                <div class="flex items-center gap-1">
                  <Icon name="share" class="w-4 h-4" />
                  <span>{formatNumber(filter.stats.shares)}</span>
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/each}

  <!-- Loading State -->
  {#if loading}
    <div class="flex items-center justify-center h-64">
      <div class="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
    </div>
  {/if}

  <!-- Error State -->
  {#if error}
    <div class="flex flex-col items-center justify-center h-64 text-red-500">
      <Icon name="alert-circle" class="w-12 h-12 mb-4" />
      <p>{error}</p>
      <Button
        variant="outline"
        class="mt-4"
        on:click={loadFilters}
      >
        Try Again
      </Button>
    </div>
  {/if}
</div>

<!-- Filter Editor Modal -->
{#if filterEditorOpen}
  <ARFilterEditor
    initialFilter={selectedFilter}
    on:complete={handleFilterComplete}
    on:cancel={() => {
      filterEditorOpen = false;
      selectedFilter = null;
    }}
  />
{/if} 