<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { Button, Input, Alert, Select } from '$lib/components/ui';
  import { supabase } from '$lib/supabaseClient';
  import { user } from '$lib/stores/auth';
  import { ipfsService } from '$lib/services/ipfs';
  import { ethers } from 'ethers';
  import type { Web3Provider } from '@ethersproject/providers';

  export let onSuccess: (contentId: string) => void = () => {};

  let loading = false;
  let error: string | null = null;
  let mediaFile: File | null = null;
  let mediaPreview: string | null = null;
  let uploadProgress = 0;
  let categories: any[] = [];
  let web3Provider: Web3Provider | null = null;

  let formData = {
    title: '',
    description: '',
    category: '',
    tags: [] as string[],
    price: '',
    isNFT: false,
    isPremium: false,
    royaltyPercentage: '10',
    allowDownloads: true,
    licenseType: 'standard'
  };

  let tagInput = '';

  onMount(async () => {
    loadCategories();
    initializeWeb3();
  });

  async function loadCategories() {
    try {
      const { data, error: fetchError } = await supabase
        .from('creator_categories')
        .select('*')
        .order('name');

      if (fetchError) throw fetchError;
      categories = data || [];
    } catch (e) {
      console.error('Error loading categories:', e);
    }
  }

  async function initializeWeb3() {
    if (window.ethereum) {
      web3Provider = new ethers.providers.Web3Provider(window.ethereum);
    }
  }

  async function handleMediaSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (!file) return;

    // Validate file
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      error = 'File size must be less than 100MB';
      return;
    }

    const validTypes = ['image', 'video', 'audio', 'model'];
    const fileType = file.type.split('/')[0];
    if (!validTypes.includes(fileType)) {
      error = 'Invalid file type. Supported types: images, videos, audio, and 3D models';
      return;
    }

    mediaFile = file;
    mediaPreview = URL.createObjectURL(file);
  }

  function handleTagInput(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      const tag = tagInput.trim().replace(/^#/, '');
      
      if (tag && !formData.tags.includes(tag) && formData.tags.length < 5) {
        formData.tags = [...formData.tags, tag];
      }
      
      tagInput = '';
    }
  }

  function removeTag(tag: string) {
    formData.tags = formData.tags.filter(t => t !== tag);
  }

  async function mintNFT(ipfsHash: string): Promise<string> {
    if (!web3Provider) throw new Error('Web3 provider not available');

    try {
      const signer = web3Provider.getSigner();
      const address = await signer.getAddress();

      // Deploy NFT contract if needed
      const contractAddress = ''; // Add your NFT contract address
      const contract = new ethers.Contract(
        contractAddress,
        ['function mint(address to, string memory tokenURI) public returns (uint256)'],
        signer
      );

      // Mint NFT
      const tx = await contract.mint(
        address,
        `ipfs://${ipfsHash}`
      );
      await tx.wait();

      // Get token ID from event
      const receipt = await web3Provider.getTransactionReceipt(tx.hash);
      const event = receipt.logs[0];
      const tokenId = ethers.BigNumber.from(event.topics[3]).toString();

      return tokenId;
    } catch (e) {
      console.error('Error minting NFT:', e);
      throw new Error('Failed to mint NFT');
    }
  }

  async function handleSubmit() {
    if (!$user) return;
    if (!mediaFile) {
      error = 'Please select a file to upload';
      return;
    }

    try {
      loading = true;
      error = null;
      
      // Upload media to IPFS
      const mediaResult = await ipfsService.upload(mediaFile, {
        onProgress: (progress) => {
          uploadProgress = progress;
        }
      });

      // Create metadata
      const metadata = {
        name: formData.title,
        description: formData.description,
        image: `ipfs://${mediaResult.cid}`,
        attributes: [
          { trait_type: 'Category', value: formData.category },
          { trait_type: 'License', value: formData.licenseType },
          ...formData.tags.map(tag => ({
            trait_type: 'Tag',
            value: tag
          }))
        ]
      };

      // Upload metadata to IPFS
      const metadataResult = await ipfsService.upload(
        new Blob([JSON.stringify(metadata)], { type: 'application/json' })
      );

      let tokenId: string | undefined;
      if (formData.isNFT) {
        tokenId = await mintNFT(metadataResult.cid);
      }

      // Create content record
      const { data: content, error: contentError } = await supabase
        .from('creative_content')
        .insert({
          creator_id: $user.id,
          title: formData.title,
          description: formData.description,
          category: formData.category,
          tags: formData.tags,
          media_url: `ipfs://${mediaResult.cid}`,
          metadata_url: `ipfs://${metadataResult.cid}`,
          media_type: mediaFile.type.split('/')[0],
          is_nft: formData.isNFT,
          is_premium: formData.isPremium,
          price: formData.price ? parseFloat(formData.price) : null,
          token_id: tokenId,
          license_type: formData.licenseType,
          allow_downloads: formData.allowDownloads,
          royalty_percentage: parseInt(formData.royaltyPercentage)
        })
        .select()
        .single();

      if (contentError) throw contentError;

      onSuccess(content.id);
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
      uploadProgress = 0;
    }
  }
</script>

<div class="max-w-4xl mx-auto">
  <div class="bg-gradient-to-br from-purple-900 via-pink-900 to-yellow-900 rounded-xl p-1">
    <div class="bg-gray-900 rounded-lg p-6 space-y-6">
      {#if error}
        <Alert variant="error" title="Error" message={error} />
      {/if}

      <form on:submit|preventDefault={handleSubmit} class="space-y-6">
        <!-- Media Upload -->
        <div class="space-y-4">
          <label class="block text-lg font-medium text-white">Media</label>
          
          {#if mediaPreview}
            <div class="relative aspect-video rounded-lg overflow-hidden bg-black">
              {#if mediaFile?.type.startsWith('video/')}
                <video
                  src={mediaPreview}
                  class="w-full h-full object-contain"
                  controls
                ></video>
              {:else if mediaFile?.type.startsWith('audio/')}
                <div class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-900 to-pink-900">
                  <audio
                    src={mediaPreview}
                    class="w-full"
                    controls
                  ></audio>
                </div>
              {:else if mediaFile?.type.includes('model')}
                <model-viewer
                  src={mediaPreview}
                  auto-rotate
                  camera-controls
                  class="w-full h-full"
                ></model-viewer>
              {:else}
                <img
                  src={mediaPreview}
                  alt="Preview"
                  class="w-full h-full object-contain"
                />
              {/if}

              <button
                type="button"
                class="absolute top-2 right-2 p-2 bg-black bg-opacity-50 rounded-full text-white hover:bg-opacity-75"
                on:click={() => {
                  URL.revokeObjectURL(mediaPreview);
                  mediaPreview = null;
                  mediaFile = null;
                }}
              >
                <svg class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
          {:else}
            <label class="relative block">
              <input
                type="file"
                accept="image/*,video/*,audio/*,.glb,.gltf"
                class="hidden"
                on:change={handleMediaSelect}
              />
              <div class="h-64 border-2 border-dashed border-gray-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-purple-500 transition-colors">
                <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p class="mt-2 text-sm text-gray-400">
                  Drag and drop or click to upload
                </p>
                <p class="mt-1 text-xs text-gray-500">
                  Supports images, videos, audio, and 3D models up to 100MB
                </p>
              </div>
            </label>
          {/if}

          {#if loading && uploadProgress > 0}
            <div class="relative pt-1">
              <div class="flex mb-2 items-center justify-between">
                <div>
                  <span class="text-xs font-semibold inline-block text-purple-500">
                    Uploading
                  </span>
                </div>
                <div class="text-right">
                  <span class="text-xs font-semibold inline-block text-purple-500">
                    {uploadProgress}%
                  </span>
                </div>
              </div>
              <div class="overflow-hidden h-2 mb-4 text-xs flex rounded bg-purple-200">
                <div
                  style="width:{uploadProgress}%"
                  class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-purple-500 to-pink-500"
                ></div>
              </div>
            </div>
          {/if}
        </div>

        <!-- Basic Info -->
        <div class="grid grid-cols-1 gap-6">
          <Input
            label="Title"
            bind:value={formData.title}
            required
            class="bg-gray-800 border-gray-700 text-white"
          />

          <div>
            <label class="block text-sm font-medium text-white mb-1">
              Description
            </label>
            <textarea
              bind:value={formData.description}
              class="w-full bg-gray-800 border-gray-700 rounded-lg p-3 text-white"
              rows="4"
              required
            ></textarea>
          </div>

          <Select
            label="Category"
            bind:value={formData.category}
            options={categories.map(c => ({
              value: c.id,
              label: c.name
            }))}
            required
            class="bg-gray-800 border-gray-700 text-white"
          />
        </div>

        <!-- Tags -->
        <div>
          <label class="block text-sm font-medium text-white mb-2">Tags</label>
          <div class="flex flex-wrap gap-2 mb-2">
            {#each formData.tags as tag}
              <span class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-900 text-white">
                #{tag}
                <button
                  type="button"
                  class="ml-2 text-purple-300 hover:text-white"
                  on:click={() => removeTag(tag)}
                >
                  ×
                </button>
              </span>
            {/each}
          </div>
          <Input
            type="text"
            placeholder="Add tags (press Enter)"
            bind:value={tagInput}
            on:keydown={handleTagInput}
            disabled={formData.tags.length >= 5}
            class="bg-gray-800 border-gray-700 text-white"
          />
        </div>

        <!-- Monetization -->
        <div class="space-y-4">
          <h3 class="text-lg font-medium text-white">Monetization</h3>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="flex items-center space-x-3">
                <input
                  type="checkbox"
                  bind:checked={formData.isNFT}
                  class="form-checkbox h-5 w-5 text-purple-500"
                />
                <span class="text-white">Mint as NFT</span>
              </label>
              {#if formData.isNFT}
                <Input
                  type="number"
                  label="Royalty Percentage"
                  bind:value={formData.royaltyPercentage}
                  min="0"
                  max="100"
                  class="mt-2 bg-gray-800 border-gray-700 text-white"
                />
              {/if}
            </div>

            <div>
              <label class="flex items-center space-x-3">
                <input
                  type="checkbox"
                  bind:checked={formData.isPremium}
                  class="form-checkbox h-5 w-5 text-purple-500"
                />
                <span class="text-white">Premium Content</span>
              </label>
              {#if formData.isPremium}
                <Input
                  type="number"
                  label="Price"
                  bind:value={formData.price}
                  min="0"
                  step="0.01"
                  class="mt-2 bg-gray-800 border-gray-700 text-white"
                />
              {/if}
            </div>
          </div>
        </div>

        <!-- License -->
        <div class="space-y-4">
          <h3 class="text-lg font-medium text-white">License</h3>

          <Select
            label="License Type"
            bind:value={formData.licenseType}
            options={[
              { value: 'standard', label: 'Standard License' },
              { value: 'commercial', label: 'Commercial License' },
              { value: 'exclusive', label: 'Exclusive License' }
            ]}
            class="bg-gray-800 border-gray-700 text-white"
          />

          <label class="flex items-center space-x-3">
            <input
              type="checkbox"
              bind:checked={formData.allowDownloads}
              class="form-checkbox h-5 w-5 text-purple-500"
            />
            <span class="text-white">Allow Downloads</span>
          </label>
        </div>

        <!-- Submit -->
        <div class="flex justify-end">
          <Button
            type="submit"
            variant="gradient"
            loading={loading}
            disabled={!mediaFile}
          >
            {formData.isNFT ? 'Mint & Upload' : 'Upload'}
          </Button>
        </div>
      </form>
    </div>
  </div>
</div>

<style lang="postcss">
  :global(.form-checkbox) {
    @apply rounded border-gray-600 text-purple-500 focus:ring-purple-500;
  }

  :global(.btn-gradient) {
    @apply bg-gradient-to-r from-purple-500 via-pink-500 to-yellow-500 text-white;
  }
</style> 