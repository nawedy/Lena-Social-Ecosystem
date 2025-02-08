<!-- ContentStudio.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { Button, Input, Select, Alert, Badge } from '$lib/components/ui';
  import { supabase } from '$lib/supabaseClient';
  import { user } from '$lib/stores/auth';
  import { ipfsService } from '$lib/services/ipfs';
  import { nftService } from '$lib/services/nft';
  import { monetizationService } from '$lib/services/monetization';

  let content = {
    title: '',
    description: '',
    mediaFiles: [] as File[],
    previewUrls: [] as string[],
    tags: [] as string[],
    category: '',
    visibility: 'public',
    monetization: {
      type: 'free',
      price: 0,
      currency: 'USD',
      subscriptionRequired: false,
      nftGated: false,
      nftContractAddress: '',
      nftTokenId: ''
    },
    schedule: {
      publishAt: null as Date | null,
      expiresAt: null as Date | null
    }
  };

  let loading = false;
  let error: string | null = null;
  let tagInput = '';
  let isDraft = true;
  let showAdvancedSettings = false;
  let uploadProgress = 0;

  const categories = [
    { value: 'art', label: 'Art & Illustration' },
    { value: 'music', label: 'Music & Audio' },
    { value: 'video', label: 'Video & Animation' },
    { value: 'writing', label: 'Writing & Literature' },
    { value: 'photography', label: 'Photography' },
    { value: 'design', label: 'Design' },
    { value: 'education', label: 'Education' },
    { value: 'gaming', label: 'Gaming' }
  ];

  const visibilityOptions = [
    { value: 'public', label: 'Public' },
    { value: 'unlisted', label: 'Unlisted' },
    { value: 'private', label: 'Private' },
    { value: 'premium', label: 'Premium Members Only' }
  ];

  const monetizationTypes = [
    { value: 'free', label: 'Free' },
    { value: 'one-time', label: 'One-time Purchase' },
    { value: 'subscription', label: 'Subscription Required' },
    { value: 'nft', label: 'NFT Gated' }
  ];

  async function handleMediaUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    
    if (files.length + content.mediaFiles.length > 10) {
      error = 'Maximum 10 media files allowed';
      return;
    }

    for (const file of files) {
      if (file.size > 100 * 1024 * 1024) { // 100MB limit
        error = 'File size must be less than 100MB';
        return;
      }

      const url = URL.createObjectURL(file);
      content.previewUrls = [...content.previewUrls, url];
      content.mediaFiles = [...content.mediaFiles, file];
    }
  }

  function removeMedia(index: number) {
    content.mediaFiles = content.mediaFiles.filter((_, i) => i !== index);
    content.previewUrls = content.previewUrls.filter((_, i) => i !== index);
  }

  function addTag() {
    const tag = tagInput.trim().replace(/^#/, '');
    if (tag && !content.tags.includes(tag)) {
      content.tags = [...content.tags, tag];
    }
    tagInput = '';
  }

  function removeTag(tag: string) {
    content.tags = content.tags.filter(t => t !== tag);
  }

  async function uploadContent() {
    if (!$user) return;
    
    try {
      loading = true;
      error = null;
      uploadProgress = 0;

      // Upload media files to IPFS
      const mediaUrls = await Promise.all(
        content.mediaFiles.map(async (file, index) => {
          const { cid } = await ipfsService.upload(file, {
            encrypt: content.visibility !== 'public',
            onProgress: (progress) => {
              uploadProgress = (index / content.mediaFiles.length) + (progress / content.mediaFiles.length);
            }
          });
          return `ipfs://${cid}`;
        })
      );

      // Handle NFT gating if enabled
      if (content.monetization.nftGated) {
        const isValid = await nftService.validateNFTContract(
          content.monetization.nftContractAddress
        );
        if (!isValid) {
          throw new Error('Invalid NFT contract address');
        }
      }

      // Create monetization plan if needed
      let monetizationPlan = null;
      if (content.monetization.type !== 'free') {
        monetizationPlan = await monetizationService.createPlan({
          type: content.monetization.type,
          price: content.monetization.price,
          currency: content.monetization.currency,
          nftContract: content.monetization.nftContractAddress,
          nftTokenId: content.monetization.nftTokenId
        });
      }

      // Insert content into database
      const { data, error: insertError } = await supabase
        .from('creator_content')
        .insert({
          user_id: $user.id,
          title: content.title,
          description: content.description,
          media_urls: mediaUrls,
          tags: content.tags,
          category: content.category,
          visibility: content.visibility,
          monetization_plan_id: monetizationPlan?.id,
          is_draft: isDraft,
          publish_at: content.schedule.publishAt,
          expires_at: content.schedule.expiresAt,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Reset form
      content = {
        title: '',
        description: '',
        mediaFiles: [],
        previewUrls: [],
        tags: [],
        category: '',
        visibility: 'public',
        monetization: {
          type: 'free',
          price: 0,
          currency: 'USD',
          subscriptionRequired: false,
          nftGated: false,
          nftContractAddress: '',
          nftTokenId: ''
        },
        schedule: {
          publishAt: null,
          expiresAt: null
        }
      };
      isDraft = true;
      showAdvancedSettings = false;
      uploadProgress = 0;

    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }
</script>

<div class="max-w-4xl mx-auto">
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-8">
    {#if error}
      <Alert type="error" message={error} />
    {/if}

    <!-- Title -->
    <div>
      <Input
        type="text"
        label="Title"
        placeholder="Enter a title for your content"
        bind:value={content.title}
        required
      />
    </div>

    <!-- Description -->
    <div>
      <label class="block text-sm font-medium mb-2">
        Description
      </label>
      <textarea
        class="w-full min-h-[200px] p-4 rounded-lg border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary-500"
        placeholder="Describe your content..."
        bind:value={content.description}
      />
    </div>

    <!-- Media Upload -->
    <div class="space-y-4">
      <label class="block text-sm font-medium mb-2">
        Media Files
      </label>
      
      <input
        type="file"
        accept="image/*,video/*,audio/*"
        multiple
        on:change={handleMediaUpload}
        class="hidden"
        id="media-upload"
      />
      
      <label
        for="media-upload"
        class="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
      >
        Upload Media
      </label>

      {#if content.previewUrls.length > 0}
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
          {#each content.previewUrls as url, index}
            <div class="relative aspect-video">
              <img
                src={url}
                alt="Preview"
                class="rounded-lg object-cover w-full h-full"
              />
              <button
                class="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/75"
                on:click={() => removeMedia(index)}
              >
                ×
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Category -->
    <div>
      <Select
        label="Category"
        options={categories}
        bind:value={content.category}
        required
      />
    </div>

    <!-- Tags -->
    <div class="space-y-2">
      <Input
        label="Tags"
        placeholder="Add tags (press Enter)"
        bind:value={tagInput}
        on:keydown={(e) => e.key === 'Enter' && addTag()}
      />
      
      {#if content.tags.length > 0}
        <div class="flex flex-wrap gap-2">
          {#each content.tags as tag}
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              #{tag}
              <button
                class="ml-1 text-blue-600 dark:text-blue-300"
                on:click={() => removeTag(tag)}
              >
                ×
              </button>
            </span>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Advanced Settings -->
    <div>
      <button
        class="text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
        on:click={() => showAdvancedSettings = !showAdvancedSettings}
      >
        {showAdvancedSettings ? 'Hide' : 'Show'} Advanced Settings
      </button>

      {#if showAdvancedSettings}
        <div class="mt-4 space-y-6">
          <!-- Visibility -->
          <div>
            <Select
              label="Visibility"
              options={visibilityOptions}
              bind:value={content.visibility}
            />
          </div>

          <!-- Monetization -->
          <div class="space-y-4">
            <Select
              label="Monetization"
              options={monetizationTypes}
              bind:value={content.monetization.type}
            />

            {#if content.monetization.type === 'one-time'}
              <div class="grid grid-cols-2 gap-4">
                <Input
                  type="number"
                  label="Price"
                  bind:value={content.monetization.price}
                  min="0"
                  step="0.01"
                />
                <Select
                  label="Currency"
                  options={[
                    { value: 'USD', label: 'USD' },
                    { value: 'ETH', label: 'ETH' }
                  ]}
                  bind:value={content.monetization.currency}
                />
              </div>
            {/if}

            {#if content.monetization.type === 'nft'}
              <div class="space-y-4">
                <Input
                  label="NFT Contract Address"
                  bind:value={content.monetization.nftContractAddress}
                  placeholder="0x..."
                />
                <Input
                  label="Token ID (optional)"
                  bind:value={content.monetization.nftTokenId}
                  placeholder="Leave empty to allow any token from the collection"
                />
              </div>
            {/if}
          </div>

          <!-- Scheduling -->
          <div class="grid grid-cols-2 gap-4">
            <Input
              type="datetime-local"
              label="Publish At"
              bind:value={content.schedule.publishAt}
            />
            <Input
              type="datetime-local"
              label="Expires At"
              bind:value={content.schedule.expiresAt}
            />
          </div>
        </div>
      {/if}
    </div>

    <!-- Upload Progress -->
    {#if loading && uploadProgress > 0}
      <div class="space-y-2">
        <div class="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            class="h-full bg-emerald-500 transition-all duration-300"
            style="width: {uploadProgress * 100}%"
          />
        </div>
        <div class="text-sm text-gray-500 text-center">
          Uploading... {Math.round(uploadProgress * 100)}%
        </div>
      </div>
    {/if}

    <!-- Actions -->
    <div class="flex justify-end space-x-4">
      <Button
        variant="outline"
        on:click={() => {
          isDraft = true;
          uploadContent();
        }}
        disabled={loading}
      >
        Save as Draft
      </Button>

      <Button
        variant="primary"
        on:click={() => {
          isDraft = false;
          uploadContent();
        }}
        disabled={loading || !content.title}
      >
        {content.schedule.publishAt ? 'Schedule' : 'Publish'} Content
      </Button>
    </div>
  </div>
</div>

<style>
  /* Add any component-specific styles here */
</style> 