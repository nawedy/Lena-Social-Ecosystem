<!-- (protected)/create/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/auth/store';
  import { supabase } from '$lib/supabaseClient';
  import { ipfsService } from '$lib/services/ipfs';
  import Button from '$lib/components/ui/Button.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Alert from '$lib/components/ui/Alert.svelte';
  import { ethers } from 'ethers';

  let loading = false;
  let error: string | null = null;
  let success: string | null = null;

  // Content data
  let content = '';
  let title = '';
  let selectedFiles: File[] = [];
  let tags: string[] = [];
  let tagInput = '';
  let visibility: 'public' | 'private' | 'encrypted' = 'public';
  let encryptContent = false;
  let signContent = false;
  let mintAsNFT = false;
  let selectedChain = 'ethereum';
  let royaltyPercentage = 10;

  // Web3 state
  let web3Connected = false;
  let web3Address = '';
  let provider: ethers.providers.Web3Provider | null = null;

  onMount(async () => {
    // Check if Web3 is available
    if (window.ethereum) {
      provider = new ethers.providers.Web3Provider(window.ethereum);
      try {
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) {
          web3Connected = true;
          web3Address = accounts[0];
        }
      } catch (e) {
        console.error('Error checking Web3:', e);
      }
    }

    // Get user's default privacy settings
    try {
      const { data: settings } = await supabase
        .from('user_security_settings')
        .select('encryption_enabled, ipfs_encryption')
        .eq('user_id', auth.user?.id)
        .single();

      if (settings) {
        encryptContent = settings.encryption_enabled;
      }
    } catch (e) {
      console.error('Error loading settings:', e);
    }
  });

  async function connectWeb3() {
    if (!provider) return;

    try {
      const accounts = await provider.send('eth_requestAccounts', []);
      web3Connected = true;
      web3Address = accounts[0];
    } catch (e) {
      error = 'Failed to connect Web3 wallet';
    }
  }

  async function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const files = Array.from(input.files);
    selectedFiles = [...selectedFiles, ...files];
  }

  function removeFile(index: number) {
    selectedFiles = selectedFiles.filter((_, i) => i !== index);
  }

  function addTag() {
    if (tagInput && !tags.includes(tagInput)) {
      tags = [...tags, tagInput];
      tagInput = '';
    }
  }

  function removeTag(tag: string) {
    tags = tags.filter(t => t !== tag);
  }

  async function handleSubmit() {
    loading = true;
    error = null;
    success = null;

    try {
      // Upload files to IPFS
      const mediaUrls = [];
      for (const file of selectedFiles) {
        const result = await ipfsService.upload(file, {
          encrypt: encryptContent,
          metadata: {
            type: 'content',
            userId: auth.user?.id,
            visibility
          }
        });
        mediaUrls.push(result.url);
      }

      // Create content signature if requested
      let signature = null;
      if (signContent && web3Connected && provider) {
        const signer = provider.getSigner();
        const message = ethers.utils.id(content + mediaUrls.join(','));
        signature = await signer.signMessage(message);
      }

      // Mint NFT if requested
      let nftMetadata = null;
      if (mintAsNFT && web3Connected && provider) {
        // This would be implemented based on your NFT contract
        nftMetadata = {
          chain: selectedChain,
          royalty: royaltyPercentage,
          signature
        };
      }

      // Create post
      const { error: postError } = await supabase
        .from('posts')
        .insert({
          user_id: auth.user?.id,
          title,
          content,
          media_urls: mediaUrls,
          tags,
          visibility,
          is_encrypted: encryptContent,
          web3_signature: signature,
          nft_metadata: nftMetadata,
          metadata: {
            encrypted: encryptContent,
            signed: !!signature,
            nft: !!nftMetadata
          }
        });

      if (postError) throw postError;

      success = 'Content created successfully';
      // Reset form
      content = '';
      title = '';
      selectedFiles = [];
      tags = [];
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }
</script>

<div class="container mx-auto px-4 py-8">
  <div class="max-w-4xl mx-auto">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <div class="p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
          Create Content
        </h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Share your thoughts securely and privately
        </p>
      </div>

      <form class="p-6 space-y-6" on:submit|preventDefault={handleSubmit}>
        {#if error}
          <Alert type="error" dismissible>{error}</Alert>
        {/if}

        {#if success}
          <Alert type="success" dismissible>{success}</Alert>
        {/if}

        <!-- Basic Content -->
        <div class="space-y-4">
          <Input
            label="Title"
            bind:value={title}
            placeholder="Give your post a title"
          />

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Content
            </label>
            <textarea
              bind:value={content}
              rows="4"
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="What's on your mind?"
            ></textarea>
          </div>
        </div>

        <!-- Media Upload -->
        <div class="space-y-4">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">
            Media
          </h3>

          <div class="space-y-2">
            <Input
              type="file"
              multiple
              accept="image/*,video/*"
              on:change={handleFileSelect}
            />

            {#if selectedFiles.length > 0}
              <div class="grid grid-cols-2 gap-4">
                {#each selectedFiles as file, i}
                  <div class="relative group">
                    <div class="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <p class="text-sm truncate">{file.name}</p>
                      <button
                        type="button"
                        class="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        on:click={() => removeFile(i)}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>

        <!-- Tags -->
        <div class="space-y-4">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">
            Tags
          </h3>

          <div class="flex flex-wrap gap-2">
            {#each tags as tag}
              <span class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                #{tag}
                <button
                  type="button"
                  class="ml-2 text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100"
                  on:click={() => removeTag(tag)}
                >
                  ×
                </button>
              </span>
            {/each}

            <Input
              placeholder="Add tags..."
              bind:value={tagInput}
              on:keydown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
            >
              <Button
                slot="suffix"
                variant="ghost"
                size="sm"
                on:click={addTag}
                disabled={!tagInput}
              >
                Add
              </Button>
            </Input>
          </div>
        </div>

        <!-- Privacy & Security -->
        <div class="space-y-4">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">
            Privacy & Security
          </h3>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Visibility
              </label>
              <select
                bind:value={visibility}
                class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
                <option value="encrypted">Encrypted</option>
              </select>
            </div>

            <div class="flex items-center space-x-2">
              <input
                type="checkbox"
                id="encrypt"
                bind:checked={encryptContent}
                class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label for="encrypt" class="text-sm text-gray-700 dark:text-gray-300">
                Encrypt content
              </label>
            </div>
          </div>
        </div>

        <!-- Web3 Features -->
        <div class="space-y-4">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">
            Web3 Features
          </h3>

          {#if !web3Connected}
            <Button
              type="button"
              variant="outline"
              on:click={connectWeb3}
            >
              Connect Web3 Wallet
            </Button>
          {:else}
            <div class="space-y-4">
              <div class="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="sign"
                  bind:checked={signContent}
                  class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label for="sign" class="text-sm text-gray-700 dark:text-gray-300">
                  Sign content with Web3 wallet
                </label>
              </div>

              <div class="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="nft"
                  bind:checked={mintAsNFT}
                  class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label for="nft" class="text-sm text-gray-700 dark:text-gray-300">
                  Mint as NFT
                </label>
              </div>

              {#if mintAsNFT}
                <div class="pl-6 space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Blockchain
                    </label>
                    <select
                      bind:value={selectedChain}
                      class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    >
                      <option value="ethereum">Ethereum</option>
                      <option value="polygon">Polygon</option>
                      <option value="optimism">Optimism</option>
                      <option value="arbitrum">Arbitrum</option>
                    </select>
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Royalty Percentage
                    </label>
                    <input
                      type="number"
                      bind:value={royaltyPercentage}
                      min="0"
                      max="100"
                      class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Submit -->
        <div class="flex justify-end pt-6">
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            disabled={loading || !content}
          >
            Create Post
          </Button>
        </div>
      </form>
    </div>
  </div>
</div> 