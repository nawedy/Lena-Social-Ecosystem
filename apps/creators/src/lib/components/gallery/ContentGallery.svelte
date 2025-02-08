<!-- ContentGallery.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { Button, Input, Select, Alert } from '$lib/components/ui';
  import { supabase } from '$lib/supabaseClient';
  import { user } from '$lib/stores/auth';
  import { monetizationService } from '$lib/services/monetization';

  export let creatorId: string | null = null;
  export let category: string | null = null;
  export let initialTag: string | null = null;

  let content: any[] = [];
  let loading = false;
  let error: string | null = null;
  let page = 1;
  let hasMore = true;
  let searchQuery = '';
  let selectedTag = initialTag;
  let selectedCategory = category;
  let sortBy: 'recent' | 'popular' | 'price' = 'recent';
  let viewMode: 'grid' | 'masonry' | 'list' = 'masonry';
  let priceRange = { min: 0, max: 1000 };
  let showFilters = false;

  const PAGE_SIZE = 20;

  $: queryParams = {
    creatorId,
    searchQuery: searchQuery.trim(),
    tag: selectedTag,
    category: selectedCategory,
    sortBy,
    priceRange
  };

  onMount(async () => {
    await loadContent(true);
  });

  async function loadContent(reset = false) {
    if (reset) {
      page = 1;
      content = [];
      hasMore = true;
    }

    if (!hasMore || loading) return;

    try {
      loading = true;
      error = null;

      let query = supabase
        .from('creator_content')
        .select(`
          *,
          creator:user_id (*),
          metrics:content_metrics (
            views_count,
            likes_count,
            shares_count
          ),
          monetization:monetization_plan_id (*)
        `)
        .eq('is_draft', false)
        .lte('publish_at', new Date().toISOString())
        .gt('expires_at', new Date().toISOString())
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (creatorId) {
        query = query.eq('user_id', creatorId);
      }

      if (selectedCategory) {
        query = query.eq('category', selectedCategory);
      }

      if (selectedTag) {
        query = query.contains('tags', [selectedTag]);
      }

      if (searchQuery) {
        query = query.or(`
          title.ilike.%${searchQuery}%,
          description.ilike.%${searchQuery}%
        `);
      }

      if (priceRange.min > 0 || priceRange.max < 1000) {
        query = query.and(`
          monetization.price.gte.${priceRange.min},
          monetization.price.lte.${priceRange.max}
        `);
      }

      // Apply sorting
      switch (sortBy) {
        case 'popular':
          query = query.order('metrics(views_count)', { ascending: false });
          break;
        case 'price':
          query = query.order('monetization(price)', { ascending: true });
          break;
        default:
          query = query.order('created_at', { ascending: false });
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Process content for display
      const processedContent = await Promise.all(
        data.map(async (item) => {
          // Check access rights
          const hasAccess = await monetizationService.checkAccess(
            item.id,
            $user?.id
          );

          return {
            ...item,
            hasAccess,
            thumbnailUrl: item.media_urls[0]?.replace('ipfs://', 'https://ipfs.io/ipfs/')
          };
        })
      );

      content = reset ? processedContent : [...content, ...processedContent];
      hasMore = data.length === PAGE_SIZE;
      page++;
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
      loadContent();
    }
  }

  function handleSearch() {
    loadContent(true);
  }

  async function handlePurchase(item: any) {
    try {
      loading = true;
      error = null;

      await monetizationService.purchase(item.id);
      
      // Refresh content to update access status
      const index = content.findIndex(c => c.id === item.id);
      if (index !== -1) {
        content[index] = {
          ...content[index],
          hasAccess: true
        };
        content = [...content];
      }
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  const categories = [
    { value: '', label: 'All Categories' },
    { value: 'art', label: 'Art & Illustration' },
    { value: 'music', label: 'Music & Audio' },
    { value: 'video', label: 'Video & Animation' },
    { value: 'writing', label: 'Writing & Literature' },
    { value: 'photography', label: 'Photography' },
    { value: 'design', label: 'Design' },
    { value: 'education', label: 'Education' },
    { value: 'gaming', label: 'Gaming' }
  ];

  const sortOptions = [
    { value: 'recent', label: 'Most Recent' },
    { value: 'popular', label: 'Most Popular' },
    { value: 'price', label: 'Price: Low to High' }
  ];

  const viewOptions = [
    { value: 'grid', label: 'Grid' },
    { value: 'masonry', label: 'Masonry' },
    { value: 'list', label: 'List' }
  ];

  function formatPrice(item: any): string {
    if (!item.monetization) return 'Free';
    if (item.monetization.type === 'nft') return 'NFT Required';
    if (item.monetization.type === 'subscription') return 'Subscription';
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: item.monetization.currency
    }).format(item.monetization.price);
  }
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="sticky top-0 bg-white dark:bg-gray-800 z-10 p-4 border-b border-gray-200 dark:border-gray-700">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div class="flex items-center space-x-4">
        <Input
          type="search"
          placeholder="Search content..."
          bind:value={searchQuery}
          on:keydown={(e) => e.key === 'Enter' && handleSearch()}
          class="w-64"
        />

        <Button
          variant="outline"
          on:click={() => showFilters = !showFilters}
        >
          {showFilters ? 'Hide' : 'Show'} Filters
        </Button>
      </div>

      <div class="flex items-center space-x-4">
        <Select
          options={sortOptions}
          bind:value={sortBy}
          on:change={() => loadContent(true)}
          class="w-40"
        />

        <Select
          options={viewOptions}
          bind:value={viewMode}
          class="w-40"
        />
      </div>
    </div>

    {#if showFilters}
      <div class="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Select
            label="Category"
            options={categories}
            bind:value={selectedCategory}
            on:change={() => loadContent(true)}
          />

          <Input
            label="Tag"
            placeholder="Filter by tag..."
            bind:value={selectedTag}
            on:keydown={(e) => e.key === 'Enter' && loadContent(true)}
          />

          <div>
            <label class="block text-sm font-medium mb-2">
              Price Range
            </label>
            <div class="flex items-center space-x-2">
              <Input
                type="number"
                placeholder="Min"
                bind:value={priceRange.min}
                min="0"
                step="1"
              />
              <span>-</span>
              <Input
                type="number"
                placeholder="Max"
                bind:value={priceRange.max}
                min="0"
                step="1"
              />
            </div>
          </div>

          <div class="flex items-end">
            <Button
              variant="primary"
              on:click={() => loadContent(true)}
              class="w-full"
            >
              Apply Filters
            </Button>
          </div>
        </div>
      </div>
    {/if}
  </div>

  {#if error}
    <Alert type="error" message={error} />
  {/if}

  <!-- Content Grid -->
  <div
    class="overflow-y-auto"
    on:scroll={handleScroll}
    style="max-height: calc(100vh - 200px);"
  >
    {#if viewMode === 'masonry'}
      <div class="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
        {#each content as item}
          <div
            class="break-inside-avoid mb-4"
            transition:fade
          >
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
              {#if item.thumbnailUrl}
                <img
                  src={item.thumbnailUrl}
                  alt={item.title}
                  class="w-full object-cover"
                  style="aspect-ratio: 16/9"
                />
              {/if}

              <div class="p-4">
                <h3 class="text-lg font-medium mb-2">
                  {item.title}
                </h3>

                <p class="text-gray-500 dark:text-gray-400 text-sm line-clamp-2 mb-4">
                  {item.description}
                </p>

                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-2">
                    <img
                      src={item.creator.avatar_url}
                      alt={item.creator.name}
                      class="h-6 w-6 rounded-full"
                    />
                    <span class="text-sm">{item.creator.name}</span>
                  </div>

                  <div class="text-sm font-medium">
                    {formatPrice(item)}
                  </div>
                </div>

                {#if !item.hasAccess}
                  <Button
                    variant="primary"
                    on:click={() => handlePurchase(item)}
                    disabled={loading}
                    class="w-full mt-4"
                  >
                    Purchase Access
                  </Button>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else if viewMode === 'grid'}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {#each content as item}
          <div
            class="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden"
            transition:fade
          >
            {#if item.thumbnailUrl}
              <img
                src={item.thumbnailUrl}
                alt={item.title}
                class="w-full object-cover"
                style="aspect-ratio: 16/9"
              />
            {/if}

            <div class="p-4">
              <h3 class="text-lg font-medium mb-2">
                {item.title}
              </h3>

              <p class="text-gray-500 dark:text-gray-400 text-sm line-clamp-2 mb-4">
                {item.description}
              </p>

              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2">
                  <img
                    src={item.creator.avatar_url}
                    alt={item.creator.name}
                    class="h-6 w-6 rounded-full"
                  />
                  <span class="text-sm">{item.creator.name}</span>
                </div>

                <div class="text-sm font-medium">
                  {formatPrice(item)}
                </div>
              </div>

              {#if !item.hasAccess}
                <Button
                  variant="primary"
                  on:click={() => handlePurchase(item)}
                  disabled={loading}
                  class="w-full mt-4"
                >
                  Purchase Access
                </Button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="space-y-4">
        {#each content as item}
          <div
            class="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden"
            transition:fade
          >
            <div class="flex">
              {#if item.thumbnailUrl}
                <div class="w-48 flex-shrink-0">
                  <img
                    src={item.thumbnailUrl}
                    alt={item.title}
                    class="w-full h-full object-cover"
                  />
                </div>
              {/if}

              <div class="flex-1 p-4">
                <div class="flex items-start justify-between">
                  <div>
                    <h3 class="text-lg font-medium mb-2">
                      {item.title}
                    </h3>

                    <p class="text-gray-500 dark:text-gray-400 text-sm mb-4">
                      {item.description}
                    </p>

                    <div class="flex items-center space-x-2">
                      <img
                        src={item.creator.avatar_url}
                        alt={item.creator.name}
                        class="h-6 w-6 rounded-full"
                      />
                      <span class="text-sm">{item.creator.name}</span>
                    </div>
                  </div>

                  <div class="text-right">
                    <div class="text-sm font-medium mb-2">
                      {formatPrice(item)}
                    </div>

                    {#if !item.hasAccess}
                      <Button
                        variant="primary"
                        on:click={() => handlePurchase(item)}
                        disabled={loading}
                      >
                        Purchase Access
                      </Button>
                    {/if}
                  </div>
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    {#if loading}
      <div class="flex justify-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    {/if}

    {#if !loading && content.length === 0}
      <div class="text-center py-8 text-gray-500">
        No content found
      </div>
    {/if}

    {#if !loading && !hasMore && content.length > 0}
      <div class="text-center py-8 text-gray-500">
        No more content to load
      </div>
    {/if}
  </div>
</div>

<style>
  /* Add any component-specific styles here */
</style> 