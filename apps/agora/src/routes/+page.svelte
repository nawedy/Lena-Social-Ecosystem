<!-- Marketplace Home Page -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { Button, Input, Select } from '$lib/components/ui';
  import { isAuthenticated } from '$lib/auth/store';
  import ProductCard from '$lib/components/marketplace/ProductCard.svelte';
  import CategoryFilter from '$lib/components/marketplace/CategoryFilter.svelte';
  import SearchBar from '$lib/components/marketplace/SearchBar.svelte';
  import { supabase } from '$lib/supabaseClient';

  let loading = true;
  let error: string | null = null;
  let products: any[] = [];
  let categories: string[] = [];
  let selectedCategory = 'all';
  let searchQuery = '';
  let sortBy = 'newest';

  // Fetch products with filters
  async function fetchProducts() {
    try {
      loading = true;
      let query = supabase
        .from('marketplace_products')
        .select(`
          *,
          seller:seller_id(id, username, avatar_url, reputation),
          categories:marketplace_product_categories(category_id)
        `)
        .eq('status', 'active');

      if (selectedCategory !== 'all') {
        query = query.contains('categories', [selectedCategory]);
      }

      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      switch (sortBy) {
        case 'price-low':
          query = query.order('price');
          break;
        case 'price-high':
          query = query.order('price', { ascending: false });
          break;
        case 'popular':
          query = query.order('views', { ascending: false });
          break;
        default:
          query = query.order('created_at', { ascending: false });
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      products = data || [];
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  // Fetch categories
  async function fetchCategories() {
    try {
      const { data, error: fetchError } = await supabase
        .from('marketplace_categories')
        .select('*')
        .order('name');

      if (fetchError) throw fetchError;
      categories = data?.map(c => c.name) || [];
    } catch (e) {
      console.error('Failed to fetch categories:', e);
    }
  }

  // Handle filter changes
  function handleCategoryChange(category: string) {
    selectedCategory = category;
    fetchProducts();
  }

  function handleSearch(query: string) {
    searchQuery = query;
    fetchProducts();
  }

  function handleSort(value: string) {
    sortBy = value;
    fetchProducts();
  }

  onMount(() => {
    fetchCategories();
    fetchProducts();
  });
</script>

<div class="min-h-screen bg-gradient-to-b from-emerald-50 to-white dark:from-gray-900 dark:to-gray-800">
  <div class="container mx-auto px-4 py-8">
    <!-- Hero Section -->
    <div class="text-center mb-12" in:fade={{ duration: 300, delay: 150 }}>
      <h1 class="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-4">
        Lena Agora Marketplace
      </h1>
      <p class="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
        A decentralized marketplace for digital goods and services, powered by blockchain technology
      </p>
    </div>

    <!-- Search and Filters -->
    <div class="mb-8 space-y-4">
      <div class="flex flex-col md:flex-row gap-4">
        <div class="flex-1">
          <SearchBar
            value={searchQuery}
            onSearch={handleSearch}
            placeholder="Search products, services, or sellers..."
          />
        </div>
        <div class="flex gap-4">
          <Select
            options={[
              { value: 'newest', label: 'Newest First' },
              { value: 'popular', label: 'Most Popular' },
              { value: 'price-low', label: 'Price: Low to High' },
              { value: 'price-high', label: 'Price: High to Low' }
            ]}
            value={sortBy}
            onChange={handleSort}
          />
          {#if $isAuthenticated}
            <Button
              variant="primary"
              href="/marketplace/create"
            >
              List Item
            </Button>
          {/if}
        </div>
      </div>
      <CategoryFilter
        categories={categories}
        selected={selectedCategory}
        onChange={handleCategoryChange}
      />
    </div>

    <!-- Products Grid -->
    {#if loading}
      <div class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    {:else if error}
      <div class="bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-200 p-4 rounded-lg text-center">
        {error}
      </div>
    {:else if products.length === 0}
      <div class="text-center py-12">
        <h3 class="text-xl text-gray-600 dark:text-gray-400">
          No products found
        </h3>
        <p class="text-gray-500 dark:text-gray-500 mt-2">
          Try adjusting your filters or search query
        </p>
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {#each products as product (product.id)}
          <div in:fade={{ duration: 300 }}>
            <ProductCard {product} />
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  :global(.dark) {
    color-scheme: dark;
  }
</style> 