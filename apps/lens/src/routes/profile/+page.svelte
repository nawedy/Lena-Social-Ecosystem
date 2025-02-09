<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { Button, Icon, Avatar, Tabs } from '@tiktok-toe/ui-shared/components/ui';
  import { ARFilterEditor } from '../../components/ARFilterEditor.svelte';
  import { userStore } from '@tiktok-toe/shared/stores/user';
  import { performanceService } from '@tiktok-toe/shared/services/optimization/PerformanceService';

  let loading = true;
  let error: string | null = null;
  let activeTab = 'filters';
  let filterEditorOpen = false;
  let selectedFilter = null;

  // User stats
  const stats = {
    filters: 24,
    followers: 12500,
    following: 350,
    likes: 45800,
    views: 128000
  };

  // Achievements
  const achievements = [
    {
      id: 'trending',
      icon: '🔥',
      title: 'Trending Creator',
      description: 'Had 3 filters in trending this month',
      progress: 100
    },
    {
      id: 'popular',
      icon: '⭐',
      title: 'Popular Filter',
      description: 'Filter used over 10,000 times',
      progress: 85
    },
    {
      id: 'creative',
      icon: '🎨',
      title: 'Creative Master',
      description: 'Created 20+ unique filters',
      progress: 75
    }
  ];

  // User's filters
  let filters = [];

  onMount(async () => {
    try {
      await loadFilters();
      performanceService.optimizeForInteraction();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load profile data';
    } finally {
      loading = false;
    }
  });

  async function loadFilters() {
    // Simulated API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    filters = Array(12).fill(null).map((_, i) => ({
      id: `filter-${i}`,
      name: `Filter ${i + 1}`,
      description: 'Amazing AR filter with stunning effects!',
      preview: `https://picsum.photos/seed/${i}/300/400`,
      thumbnail: `https://picsum.photos/seed/${i}/64`,
      stats: {
        uses: Math.floor(Math.random() * 10000),
        likes: Math.floor(Math.random() * 1000),
        shares: Math.floor(Math.random() * 500)
      },
      createdAt: new Date(Date.now() - Math.random() * 7776000000).toISOString() // Within 90 days
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

  function formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
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
</script>

<div class="container mx-auto px-4 py-6">
  <!-- Profile Header -->
  <div class="mb-8">
    <div class="flex items-start gap-6">
      <!-- Avatar -->
      <div class="relative">
        <Avatar
          src={$userStore.avatar}
          alt={$userStore.name}
          size="xl"
          class="ring-4 ring-primary-500 ring-offset-4 ring-offset-gray-50 dark:ring-offset-gray-900"
        />
        <button
          class="absolute bottom-0 right-0 p-2 bg-primary-500 rounded-full text-white shadow-lg"
        >
          <Icon name="camera" class="w-5 h-5" />
        </button>
      </div>

      <!-- Info -->
      <div class="flex-1">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h1 class="text-2xl font-bold">{$userStore.name}</h1>
            <p class="text-gray-500">@{$userStore.username}</p>
          </div>
          <Button variant="outline">Edit Profile</Button>
        </div>

        <div class="flex items-center gap-6 text-sm">
          <div class="text-center">
            <div class="font-semibold">{formatNumber(stats.filters)}</div>
            <div class="text-gray-500">Filters</div>
          </div>
          <div class="text-center">
            <div class="font-semibold">{formatNumber(stats.followers)}</div>
            <div class="text-gray-500">Followers</div>
          </div>
          <div class="text-center">
            <div class="font-semibold">{formatNumber(stats.following)}</div>
            <div class="text-gray-500">Following</div>
          </div>
          <div class="text-center">
            <div class="font-semibold">{formatNumber(stats.likes)}</div>
            <div class="text-gray-500">Likes</div>
          </div>
          <div class="text-center">
            <div class="font-semibold">{formatNumber(stats.views)}</div>
            <div class="text-gray-500">Views</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Achievements -->
  <div class="mb-8">
    <h2 class="text-lg font-semibold mb-4">Achievements</h2>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      {#each achievements as achievement}
        <div
          class="bg-white dark:bg-gray-900 rounded-lg p-4 shadow-lg"
          transition:fade
        >
          <div class="flex items-start gap-4">
            <div class="text-3xl">{achievement.icon}</div>
            <div class="flex-1">
              <h3 class="font-medium">{achievement.title}</h3>
              <p class="text-sm text-gray-500 mb-2">{achievement.description}</p>
              <div class="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  class="h-full bg-primary-500 rounded-full transition-all"
                  style="width: {achievement.progress}%"
                />
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Tabs -->
  <Tabs
    items={[
      { id: 'filters', label: 'Filters' },
      { id: 'liked', label: 'Liked' },
      { id: 'collections', label: 'Collections' }
    ]}
    bind:selected={activeTab}
  />

  <!-- Content -->
  <div class="mt-6">
    {#if activeTab === 'filters'}
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
            on:click={loadFilters}
          >
            Try Again
          </Button>
        </div>
      {:else}
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {#each filters as filter (filter.id)}
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
                    Edit Filter
                  </span>
                </button>
              </div>

              <!-- Info -->
              <div class="p-4">
                <div class="flex items-start justify-between mb-3">
                  <div>
                    <h3 class="font-medium">{filter.name}</h3>
                    <p class="text-xs text-gray-500">
                      Created {formatDate(filter.createdAt)}
                    </p>
                  </div>
                  <button class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                    <Icon name="more-vertical" class="w-5 h-5" />
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

          <!-- Create New Filter Button -->
          <button
            class="aspect-[3/4] rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 transition-colors flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-primary-500"
            on:click={() => openFilterEditor(null)}
          >
            <Icon name="plus-circle" class="w-12 h-12" />
            <span class="font-medium">Create New Filter</span>
          </button>
        </div>
      {/if}
    {:else if activeTab === 'liked'}
      <div class="flex items-center justify-center h-64 text-gray-500">
        <p>Liked filters will appear here</p>
      </div>
    {:else}
      <div class="flex items-center justify-center h-64 text-gray-500">
        <p>Your collections will appear here</p>
      </div>
    {/if}
  </div>
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