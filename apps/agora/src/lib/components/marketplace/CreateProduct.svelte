<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { supabase } from '$lib/supabaseClient';
  import { Button, Input, Select, Alert } from '$lib/components/ui';
  import { user } from '$lib/stores/auth';
  import { ipfsService } from '$lib/services/ipfs';
  import { TokenGateService } from '$lib/services/TokenGateService';
  import ImageUpload from './ImageUpload.svelte';
  import TokenGateConfig from './TokenGateConfig.svelte';

  export let onSuccess: (productId: string) => void = () => {};

  let loading = false;
  let error: string | null = null;
  let formData = {
    title: '',
    description: '',
    price: '',
    currency: 'USD',
    categories: [] as string[],
    images: [] as File[],
    stock: undefined as number | undefined,
    isDigital: false,
    digitalFileUrl: '',
    isNft: false,
    nftConfig: {
      contractAddress: '',
      chainId: 1,
      royaltyPercentage: 10,
      maxSupply: undefined as number | undefined
    },
    tokenGated: false,
    tokenGateConfig: {
      contractAddress: '',
      chainId: 1,
      minTokenBalance: '',
      requiredTokenIds: [] as string[]
    },
    paymentOptions: {
      crypto: true,
      fiat: true,
      acceptedTokens: ['ETH', 'USDC'] as string[],
      escrow: true
    },
    shipping: {
      enabled: false,
      domestic: {
        price: '',
        currency: 'USD',
        estimatedDays: ''
      },
      international: {
        price: '',
        currency: 'USD',
        estimatedDays: ''
      },
      dimensions: {
        length: '',
        width: '',
        height: '',
        unit: 'cm'
      },
      weight: {
        value: '',
        unit: 'kg'
      }
    },
    terms: {
      refundable: true,
      refundPeriod: 14,
      warranty: false,
      warrantyPeriod: 0,
      customTerms: ''
    },
    visibility: 'public' as 'public' | 'private' | 'unlisted',
    status: 'draft' as 'draft' | 'active' | 'paused'
  };

  let categoryInput = '';
  let uploadProgress = 0;

  const currencies = [
    { value: 'USD', label: 'USD' },
    { value: 'EUR', label: 'EUR' },
    { value: 'GBP', label: 'GBP' },
    { value: 'ETH', label: 'ETH' },
    { value: 'USDC', label: 'USDC' }
  ];

  const tokens = [
    { value: 'ETH', label: 'Ethereum (ETH)' },
    { value: 'USDC', label: 'USD Coin (USDC)' },
    { value: 'DAI', label: 'Dai Stablecoin (DAI)' },
    { value: 'WETH', label: 'Wrapped Ether (WETH)' }
  ];

  const chains = [
    { value: '1', label: 'Ethereum Mainnet' },
    { value: '137', label: 'Polygon' },
    { value: '10', label: 'Optimism' },
    { value: '42161', label: 'Arbitrum One' }
  ];

  const visibilityOptions = [
    { value: 'public', label: 'Public' },
    { value: 'private', label: 'Private' },
    { value: 'unlisted', label: 'Unlisted' }
  ];

  const statusOptions = [
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' }
  ];

  function handleCategoryInput(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      const category = categoryInput.trim();
      
      if (category && !formData.categories.includes(category)) {
        formData.categories = [...formData.categories, category];
      }
      
      categoryInput = '';
    }
  }

  function removeCategory(category: string) {
    formData.categories = formData.categories.filter(c => c !== category);
  }

  async function handleImageUpload(files: File[]) {
    formData.images = files;
  }

  async function handleSubmit() {
    if (!$user) return;

    try {
      loading = true;
      error = null;

      // Validate form data
      if (!formData.title || !formData.description || !formData.price) {
        throw new Error('Please fill in all required fields');
      }

      if (formData.images.length === 0) {
        throw new Error('Please upload at least one image');
      }

      // Upload images to IPFS
      const imageUrls = await Promise.all(
        formData.images.map(async (file) => {
          const result = await ipfsService.upload(file, {
            onProgress: (progress) => {
              uploadProgress = progress;
            }
          });
          return `ipfs://${result.cid}`;
        })
      );

      // Upload digital file if present
      let digitalFileHash = null;
      if (formData.isDigital && formData.digitalFileUrl) {
        const response = await fetch(formData.digitalFileUrl);
        const blob = await response.blob();
        const result = await ipfsService.upload(blob, {
          encrypt: true
        });
        digitalFileHash = result.cid;
      }

      // Create product
      const { data: product, error: productError } = await supabase
        .from('marketplace_products')
        .insert({
          seller_id: $user.id,
          title: formData.title,
          description: formData.description,
          price: parseFloat(formData.price),
          currency: formData.currency,
          categories: formData.categories,
          images: imageUrls,
          stock: formData.stock,
          is_digital: formData.isDigital,
          digital_file_hash: digitalFileHash,
          is_nft: formData.isNft,
          nft_contract: formData.isNft ? formData.nftConfig.contractAddress : null,
          nft_chain_id: formData.isNft ? formData.nftConfig.chainId : null,
          nft_royalty_percentage: formData.isNft ? formData.nftConfig.royaltyPercentage : null,
          nft_max_supply: formData.isNft ? formData.nftConfig.maxSupply : null,
          token_gated: formData.tokenGated,
          token_gate_config: formData.tokenGated ? formData.tokenGateConfig : null,
          payment_options: formData.paymentOptions,
          shipping_config: formData.shipping,
          terms: formData.terms,
          visibility: formData.visibility,
          status: formData.status
        })
        .select()
        .single();

      if (productError) throw productError;

      // Set up token gating if enabled
      if (formData.tokenGated) {
        const tokenGateService = new TokenGateService();
        await tokenGateService.createTokenGate(product.id, formData.tokenGateConfig);
      }

      onSuccess(product.id);
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
      uploadProgress = 0;
    }
  }
</script>

<div class="max-w-4xl mx-auto">
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
    <h2 class="text-2xl font-bold mb-6">Create Product</h2>

    {#if error}
      <Alert variant="error" title="Error" message={error} class="mb-6" />
    {/if}

    <form on:submit|preventDefault={handleSubmit} class="space-y-6">
      <!-- Basic Information -->
      <div class="space-y-4">
        <h3 class="text-lg font-medium">Basic Information</h3>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Title"
            bind:value={formData.title}
            placeholder="Product name"
            required
          />

          <div class="grid grid-cols-2 gap-4">
            <Input
              type="number"
              label="Price"
              bind:value={formData.price}
              min="0"
              step="0.01"
              required
            />

            <Select
              label="Currency"
              options={currencies}
              bind:value={formData.currency}
              required
            />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium mb-2">Description</label>
          <textarea
            bind:value={formData.description}
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-3 min-h-[200px]"
            placeholder="Describe your product..."
            required
          ></textarea>
        </div>
      </div>

      <!-- Categories -->
      <div class="space-y-4">
        <h3 class="text-lg font-medium">Categories</h3>
        
        <Input
          bind:value={categoryInput}
          placeholder="Add categories (press Enter)"
          on:keydown={handleCategoryInput}
        />
        
        {#if formData.categories.length > 0}
          <div class="flex flex-wrap gap-2">
            {#each formData.categories as category}
              <div class="inline-flex items-center bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 rounded-full px-3 py-1">
                <span class="text-sm">{category}</span>
                <button
                  type="button"
                  class="ml-2 text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200"
                  on:click={() => removeCategory(category)}
                >
                  ×
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Images -->
      <div class="space-y-4">
        <h3 class="text-lg font-medium">Images</h3>
        <ImageUpload
          files={formData.images}
          on:change={({ detail }) => handleImageUpload(detail)}
          maxFiles={5}
          maxSize={5 * 1024 * 1024}
        />
      </div>

      <!-- Digital Product -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-medium">Digital Product</h3>
          <label class="flex items-center space-x-2">
            <input
              type="checkbox"
              bind:checked={formData.isDigital}
              class="rounded border-gray-300 dark:border-gray-600"
            />
            <span>This is a digital product</span>
          </label>
        </div>

        {#if formData.isDigital}
          <Input
            label="Digital File URL"
            bind:value={formData.digitalFileUrl}
            placeholder="URL to your digital product"
            required
          />

          <div class="flex items-center justify-between">
            <label class="flex items-center space-x-2">
              <input
                type="checkbox"
                bind:checked={formData.isNft}
                class="rounded border-gray-300 dark:border-gray-600"
              />
              <span>Mint as NFT</span>
            </label>
          </div>

          {#if formData.isNft}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Contract Address"
                bind:value={formData.nftConfig.contractAddress}
                placeholder="0x..."
              />

              <Select
                label="Blockchain"
                options={chains}
                bind:value={formData.nftConfig.chainId}
              />

              <Input
                type="number"
                label="Royalty Percentage"
                bind:value={formData.nftConfig.royaltyPercentage}
                min="0"
                max="100"
              />

              <Input
                type="number"
                label="Max Supply"
                bind:value={formData.nftConfig.maxSupply}
                min="1"
              />
            </div>
          {/if}
        {/if}
      </div>

      <!-- Token Gating -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-medium">Token Gating</h3>
          <label class="flex items-center space-x-2">
            <input
              type="checkbox"
              bind:checked={formData.tokenGated}
              class="rounded border-gray-300 dark:border-gray-600"
            />
            <span>Enable token gating</span>
          </label>
        </div>

        {#if formData.tokenGated}
          <TokenGateConfig bind:config={formData.tokenGateConfig} />
        {/if}
      </div>

      <!-- Payment Options -->
      <div class="space-y-4">
        <h3 class="text-lg font-medium">Payment Options</h3>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-2">
            <label class="flex items-center space-x-2">
              <input
                type="checkbox"
                bind:checked={formData.paymentOptions.crypto}
                class="rounded border-gray-300 dark:border-gray-600"
              />
              <span>Accept Crypto Payments</span>
            </label>

            <label class="flex items-center space-x-2">
              <input
                type="checkbox"
                bind:checked={formData.paymentOptions.fiat}
                class="rounded border-gray-300 dark:border-gray-600"
              />
              <span>Accept Fiat Payments</span>
            </label>

            <label class="flex items-center space-x-2">
              <input
                type="checkbox"
                bind:checked={formData.paymentOptions.escrow}
                class="rounded border-gray-300 dark:border-gray-600"
              />
              <span>Use Escrow Service</span>
            </label>
          </div>

          {#if formData.paymentOptions.crypto}
            <div class="space-y-2">
              <label class="block text-sm font-medium">Accepted Tokens</label>
              {#each tokens as token}
                <label class="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.paymentOptions.acceptedTokens.includes(token.value)}
                    on:change={(e) => {
                      if (e.currentTarget.checked) {
                        formData.paymentOptions.acceptedTokens = [...formData.paymentOptions.acceptedTokens, token.value];
                      } else {
                        formData.paymentOptions.acceptedTokens = formData.paymentOptions.acceptedTokens.filter(t => t !== token.value);
                      }
                    }}
                    class="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span>{token.label}</span>
                </label>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <!-- Shipping -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-medium">Shipping</h3>
          <label class="flex items-center space-x-2">
            <input
              type="checkbox"
              bind:checked={formData.shipping.enabled}
              class="rounded border-gray-300 dark:border-gray-600"
            />
            <span>Physical product requiring shipping</span>
          </label>
        </div>

        {#if formData.shipping.enabled}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Domestic Shipping -->
            <div class="space-y-4">
              <h4 class="font-medium">Domestic Shipping</h4>
              <div class="grid grid-cols-2 gap-4">
                <Input
                  type="number"
                  label="Price"
                  bind:value={formData.shipping.domestic.price}
                  min="0"
                  step="0.01"
                />
                <Select
                  label="Currency"
                  options={currencies}
                  bind:value={formData.shipping.domestic.currency}
                />
              </div>
              <Input
                type="number"
                label="Estimated Days"
                bind:value={formData.shipping.domestic.estimatedDays}
                min="1"
              />
            </div>

            <!-- International Shipping -->
            <div class="space-y-4">
              <h4 class="font-medium">International Shipping</h4>
              <div class="grid grid-cols-2 gap-4">
                <Input
                  type="number"
                  label="Price"
                  bind:value={formData.shipping.international.price}
                  min="0"
                  step="0.01"
                />
                <Select
                  label="Currency"
                  options={currencies}
                  bind:value={formData.shipping.international.currency}
                />
              </div>
              <Input
                type="number"
                label="Estimated Days"
                bind:value={formData.shipping.international.estimatedDays}
                min="1"
              />
            </div>

            <!-- Package Details -->
            <div class="space-y-4 md:col-span-2">
              <h4 class="font-medium">Package Details</h4>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Input
                  type="number"
                  label="Length"
                  bind:value={formData.shipping.dimensions.length}
                  min="0"
                  step="0.1"
                />
                <Input
                  type="number"
                  label="Width"
                  bind:value={formData.shipping.dimensions.width}
                  min="0"
                  step="0.1"
                />
                <Input
                  type="number"
                  label="Height"
                  bind:value={formData.shipping.dimensions.height}
                  min="0"
                  step="0.1"
                />
                <Input
                  type="number"
                  label="Weight"
                  bind:value={formData.shipping.weight.value}
                  min="0"
                  step="0.1"
                />
              </div>
            </div>
          </div>
        {/if}
      </div>

      <!-- Terms & Conditions -->
      <div class="space-y-4">
        <h3 class="text-lg font-medium">Terms & Conditions</h3>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-2">
            <label class="flex items-center space-x-2">
              <input
                type="checkbox"
                bind:checked={formData.terms.refundable}
                class="rounded border-gray-300 dark:border-gray-600"
              />
              <span>Refundable</span>
            </label>

            {#if formData.terms.refundable}
              <Input
                type="number"
                label="Refund Period (days)"
                bind:value={formData.terms.refundPeriod}
                min="1"
              />
            {/if}
          </div>

          <div class="space-y-2">
            <label class="flex items-center space-x-2">
              <input
                type="checkbox"
                bind:checked={formData.terms.warranty}
                class="rounded border-gray-300 dark:border-gray-600"
              />
              <span>Includes Warranty</span>
            </label>

            {#if formData.terms.warranty}
              <Input
                type="number"
                label="Warranty Period (days)"
                bind:value={formData.terms.warrantyPeriod}
                min="1"
              />
            {/if}
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium mb-2">Custom Terms</label>
          <textarea
            bind:value={formData.terms.customTerms}
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-3 h-32"
            placeholder="Additional terms and conditions..."
          ></textarea>
        </div>
      </div>

      <!-- Visibility & Status -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="Visibility"
          options={visibilityOptions}
          bind:value={formData.visibility}
        />

        <Select
          label="Status"
          options={statusOptions}
          bind:value={formData.status}
        />
      </div>

      <!-- Submit -->
      <div class="flex justify-end space-x-4">
        <Button
          type="button"
          variant="outline"
          on:click={() => formData.status = 'draft'}
        >
          Save as Draft
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={loading}
        >
          {formData.status === 'draft' ? 'Save Draft' : 'List Product'}
        </Button>
      </div>
    </form>
  </div>
</div>

<style>
  textarea {
    @apply focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-gray-700 dark:text-white;
  }

  input[type="checkbox"] {
    @apply text-emerald-500 focus:ring-emerald-500;
  }
</style> 