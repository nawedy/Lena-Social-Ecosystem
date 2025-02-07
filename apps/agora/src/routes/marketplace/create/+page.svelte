<!-- Product Creation Page -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Button, Input, Select, Alert } from '$lib/components/ui';
  import { TokenGateService } from '$lib/services/TokenGateService';
  import { ipfsService } from '$lib/services/ipfs';
  import { supabase } from '$lib/supabaseClient';
  import ImageUpload from '$lib/components/marketplace/ImageUpload.svelte';
  import TokenGateConfig from '$lib/components/marketplace/TokenGateConfig.svelte';
  import { user } from '$lib/stores/auth';

  let loading = false;
  let error: string | null = null;
  let success: string | null = null;

  // Form state
  let title = '';
  let description = '';
  let price = '';
  let currency = 'USD';
  let categories: string[] = [];
  let selectedCategories: string[] = [];
  let images: File[] = [];
  let stock: string = '';
  let status: 'draft' | 'active' = 'draft';

  // Token gating state
  let tokenGated = false;
  let tokenGateConfig = {
    contractAddress: '',
    chainId: 1,
    minTokenBalance: '',
    requiredTokenIds: [] as string[]
  };

  // Available currencies
  const currencies = [
    { value: 'USD', label: 'USD' },
    { value: 'ETH', label: 'Ethereum' },
    { value: 'MATIC', label: 'Polygon' },
    { value: 'USDC', label: 'USDC' },
    { value: 'DAI', label: 'DAI' }
  ];

  // Load categories
  async function loadCategories() {
    try {
      const { data, error: fetchError } = await supabase
        .from('marketplace_categories')
        .select('name')
        .order('name');

      if (fetchError) throw fetchError;
      categories = data?.map(c => c.name) || [];
    } catch (e) {
      console.error('Failed to load categories:', e);
    }
  }

  // Handle form submission
  async function handleSubmit() {
    try {
      if (!$user) throw new Error('You must be logged in to create a listing');
      
      loading = true;
      error = null;
      success = null;

      // Upload images to IPFS
      const imageUrls = await Promise.all(
        images.map(async (file) => {
          const result = await ipfsService.upload(file, {
            encrypt: true,
            metadata: {
              type: 'marketplace_product',
              creator: $user.id
            }
          });
          return `ipfs://${result.cid}`;
        })
      );

      // Create product
      const { data: product, error: createError } = await supabase
        .from('marketplace_products')
        .insert([
          {
            seller_id: $user.id,
            title,
            description,
            price: parseFloat(price),
            currency,
            images: imageUrls,
            status,
            stock: stock ? parseInt(stock) : null,
            token_gated: tokenGated,
            ...(tokenGated ? {
              nft_contract: tokenGateConfig.contractAddress,
              chain_id: tokenGateConfig.chainId,
              min_token_balance: tokenGateConfig.minTokenBalance || null,
              required_token_ids: tokenGateConfig.requiredTokenIds.length > 0 
                ? tokenGateConfig.requiredTokenIds 
                : null
            } : {}),
            metadata: {
              createdAt: new Date().toISOString(),
              lastUpdated: new Date().toISOString()
            }
          }
        ])
        .select()
        .single();

      if (createError) throw createError;

      // Add categories
      if (selectedCategories.length > 0) {
        const { error: categoryError } = await supabase
          .from('marketplace_product_categories')
          .insert(
            selectedCategories.map(category => ({
              product_id: product.id,
              category_id: category
            }))
          );

        if (categoryError) throw categoryError;
      }

      success = 'Product created successfully';
      setTimeout(() => {
        goto(`/marketplace/products/${product.id}`);
      }, 1500);
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  onMount(loadCategories);
</script>

<div class="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-3xl mx-auto">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 md:p-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-8">
        Create New Listing
      </h1>

      {#if error}
        <Alert type="error" class="mb-6">{error}</Alert>
      {/if}

      {#if success}
        <Alert type="success" class="mb-6">{success}</Alert>
      {/if}

      <form on:submit|preventDefault={handleSubmit} class="space-y-6">
        <!-- Basic Information -->
        <div class="space-y-4">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
            Basic Information
          </h2>

          <Input
            label="Title"
            bind:value={title}
            required
            maxlength="100"
            placeholder="Enter your product title"
          />

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              type="number"
              label="Price"
              bind:value={price}
              required
              min="0"
              step="0.00000001"
              placeholder="0.00"
            />

            <Select
              label="Currency"
              options={currencies}
              bind:value={currency}
              required
            />
          </div>

          <Input
            type="textarea"
            label="Description"
            bind:value={description}
            required
            rows="4"
            placeholder="Describe your product..."
          />

          <Input
            type="number"
            label="Stock (Optional)"
            bind:value={stock}
            min="0"
            placeholder="Leave empty for unlimited"
          />

          <div>
            <label class="block text-sm font-medium mb-1">
              Categories
            </label>
            <div class="flex flex-wrap gap-2">
              {#each categories as category}
                <label class="inline-flex items-center">
                  <input
                    type="checkbox"
                    bind:group={selectedCategories}
                    value={category}
                    class="form-checkbox"
                  />
                  <span class="ml-2">{category}</span>
                </label>
              {/each}
            </div>
          </div>
        </div>

        <!-- Images -->
        <div class="space-y-4">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
            Images
          </h2>
          <ImageUpload
            bind:files={images}
            maxFiles={5}
            accept="image/*"
            maxSize={5 * 1024 * 1024} // 5MB
          />
        </div>

        <!-- Token Gating -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
              Token Gating
            </h2>
            <label class="flex items-center space-x-2">
              <input
                type="checkbox"
                bind:checked={tokenGated}
                class="form-checkbox"
              />
              <span>Enable Token Gating</span>
            </label>
          </div>

          {#if tokenGated}
            <TokenGateConfig bind:config={tokenGateConfig} />
          {/if}
        </div>

        <!-- Listing Status -->
        <div class="space-y-4">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
            Listing Status
          </h2>
          <div class="flex items-center space-x-4">
            <label class="flex items-center">
              <input
                type="radio"
                bind:group={status}
                value="draft"
                class="form-radio"
              />
              <span class="ml-2">Save as Draft</span>
            </label>
            <label class="flex items-center">
              <input
                type="radio"
                bind:group={status}
                value="active"
                class="form-radio"
              />
              <span class="ml-2">Publish Now</span>
            </label>
          </div>
        </div>

        <!-- Submit -->
        <div class="flex justify-end space-x-4 pt-6 border-t">
          <Button
            type="button"
            variant="outline"
            href="/marketplace"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            disabled={loading}
          >
            {status === 'draft' ? 'Save Draft' : 'Publish Listing'}
          </Button>
        </div>
      </form>
    </div>
  </div>
</div> 