<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { Button, Input, Alert } from '$lib/components/ui';
  import { supabase } from '$lib/supabaseClient';
  import { user } from '$lib/stores/auth';
  import { ipfsService } from '$lib/services/ipfs';

  export let onSuccess: (postId: string) => void = () => {};

  const dispatch = createEventDispatcher();
  let loading = false;
  let error: string | null = null;
  let mediaFiles: File[] = [];
  let mediaPreviewUrls: string[] = [];
  let content = '';
  let tags: string[] = [];
  let tagInput = '';
  let isBreakingNews = false;

  async function handleMediaSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    
    // Validate files
    const validFiles = files.filter(file => {
      const isValid = file.type.startsWith('image/') || file.type.startsWith('video/');
      const isUnderSize = file.size <= 50 * 1024 * 1024; // 50MB limit
      return isValid && isUnderSize;
    });

    if (validFiles.length + mediaFiles.length > 4) {
      error = 'Maximum 4 media files allowed';
      return;
    }

    // Create preview URLs
    const newPreviewUrls = await Promise.all(
      validFiles.map(file => URL.createObjectURL(file))
    );

    mediaFiles = [...mediaFiles, ...validFiles];
    mediaPreviewUrls = [...mediaPreviewUrls, ...newPreviewUrls];
  }

  function removeMedia(index: number) {
    URL.revokeObjectURL(mediaPreviewUrls[index]);
    mediaFiles = mediaFiles.filter((_, i) => i !== index);
    mediaPreviewUrls = mediaPreviewUrls.filter((_, i) => i !== index);
  }

  function handleTagInput(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      const tag = tagInput.trim().replace(/^#/, '');
      
      if (tag && !tags.includes(tag) && tags.length < 5) {
        tags = [...tags, tag];
      }
      
      tagInput = '';
    }
  }

  function removeTag(tag: string) {
    tags = tags.filter(t => t !== tag);
  }

  async function handleSubmit() {
    if (!$user) return;
    if (!content.trim() && mediaFiles.length === 0) {
      error = 'Please add some content or media';
      return;
    }

    try {
      loading = true;
      error = null;

      // Upload media to IPFS if present
      const mediaUrls = await Promise.all(
        mediaFiles.map(async file => {
          const result = await ipfsService.upload(file);
          return `ipfs://${result.cid}`;
        })
      );

      // Create post
      const { data: post, error: postError } = await supabase
        .from('posts')
        .insert({
          user_id: $user.id,
          content: content.trim(),
          media_urls: mediaUrls,
          tags,
          is_breaking_news: isBreakingNews,
          sentiment_score: 0, // Will be updated by AI service
          trending_score: 0
        })
        .select()
        .single();

      if (postError) throw postError;

      onSuccess(post.id);
      
      // Reset form
      content = '';
      mediaFiles = [];
      mediaPreviewUrls = [];
      tags = [];
      isBreakingNews = false;
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  onDestroy(() => {
    // Cleanup preview URLs
    mediaPreviewUrls.forEach(url => URL.revokeObjectURL(url));
  });
</script>

<div class="bg-gray-900 rounded-lg shadow-neon p-4 space-y-4">
  {#if error}
    <Alert variant="error" title="Error" message={error} />
  {/if}

  <form on:submit|preventDefault={handleSubmit} class="space-y-4">
    <!-- Content Input -->
    <div>
      <textarea
        class="w-full bg-gray-800 text-white border-none rounded-lg p-4 min-h-[120px] focus:ring-2 focus:ring-cyberpunk-red focus:ring-opacity-50"
        placeholder="What's on your mind?"
        bind:value={content}
        maxlength="500"
      ></textarea>
      <div class="mt-1 text-sm text-gray-400 flex justify-end">
        {content.length}/500
      </div>
    </div>

    <!-- Media Upload -->
    <div>
      <input
        type="file"
        accept="image/*,video/*"
        multiple
        class="hidden"
        on:change={handleMediaSelect}
        id="media-upload"
      />
      
      {#if mediaFiles.length > 0}
        <div class="grid grid-cols-2 gap-2 mb-4">
          {#each mediaPreviewUrls as url, i}
            <div class="relative aspect-video bg-black rounded-lg overflow-hidden">
              {#if mediaFiles[i].type.startsWith('video/')}
                <video
                  src={url}
                  class="w-full h-full object-cover"
                  controls
                ></video>
              {:else}
                <img
                  src={url}
                  alt="Media preview"
                  class="w-full h-full object-cover"
                />
              {/if}
              <button
                type="button"
                class="absolute top-2 right-2 p-1 bg-black bg-opacity-50 rounded-full text-white hover:bg-opacity-75"
                on:click={() => removeMedia(i)}
              >
                <svg class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
          {/each}
        </div>
      {/if}

      <label
        for="media-upload"
        class="inline-flex items-center space-x-2 text-cyberpunk-red hover:text-cyberpunk-red-400 cursor-pointer"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>Add media</span>
      </label>
    </div>

    <!-- Tags Input -->
    <div>
      <div class="flex flex-wrap gap-2 mb-2">
        {#each tags as tag}
          <span class="inline-flex items-center bg-gray-800 text-white px-2 py-1 rounded-full text-sm">
            #{tag}
            <button
              type="button"
              class="ml-1 text-gray-400 hover:text-white"
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
        disabled={tags.length >= 5}
        class="bg-gray-800 text-white border-none"
      />
    </div>

    <!-- Breaking News Toggle -->
    <label class="flex items-center space-x-2 text-white cursor-pointer">
      <input
        type="checkbox"
        bind:checked={isBreakingNews}
        class="form-checkbox h-5 w-5 text-cyberpunk-red rounded border-gray-600 focus:ring-cyberpunk-red"
      />
      <span>Mark as Breaking News</span>
    </label>

    <!-- Submit Button -->
    <div class="flex justify-end">
      <Button
        type="submit"
        variant="primary"
        loading={loading}
        class="bg-cyberpunk-red hover:bg-cyberpunk-red-600"
      >
        Post
      </Button>
    </div>
  </form>
</div>

<style lang="postcss">
  .shadow-neon {
    box-shadow: 0 0 10px theme('colors.cyberpunk-red.500/20'),
                0 0 20px theme('colors.cyberpunk-red.500/10');
  }

  :global(.dark) {
    --cyberpunk-red: theme('colors.red.500');
    --cyberpunk-red-600: theme('colors.red.600');
  }
</style> 