<!-- CreatePost.svelte -->
<script lang="ts">
  import { fade, slide } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { writable } from 'svelte/store';
  import { supabase } from '$lib/supabaseClient';
  import { user } from '$lib/stores/auth';

  // Component state
  let content = '';
  let selectedTags: string[] = [];
  let mediaFiles: File[] = [];
  let mediaUrls: string[] = [];
  let isExpanded = false;
  let isUploading = false;
  let error: string | null = null;
  let tagInput = '';
  let suggestedTags: string[] = [];
  let characterCount = 0;
  const MAX_CHARS = 500;
  const MAX_MEDIA = 4;

  // Reactive statements
  $: characterCount = content.length;
  $: isValid = content.trim().length > 0 && characterCount <= MAX_CHARS;
  $: remainingMedia = MAX_MEDIA - mediaFiles.length;

  // Tag suggestions based on content
  $: {
    // Extract potential tags from content
    const words = content.split(/\s+/);
    const potentialTags = words
      .filter(word => word.startsWith('#'))
      .map(tag => tag.slice(1).toLowerCase())
      .filter(tag => !selectedTags.includes(tag));
    
    suggestedTags = [...new Set(potentialTags)].slice(0, 5);
  }

  async function handleMediaUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    
    if (mediaFiles.length + files.length > MAX_MEDIA) {
      error = `You can only upload up to ${MAX_MEDIA} media files`;
      return;
    }

    isUploading = true;
    error = null;

    try {
      for (const file of files) {
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
          throw new Error('Only images and videos are allowed');
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${$user?.id}/posts/${fileName}`;

        const { error: uploadError, data } = await supabase.storage
          .from('media')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('media')
          .getPublicUrl(filePath);

        mediaUrls = [...mediaUrls, publicUrl];
        mediaFiles = [...mediaFiles, file];
      }
    } catch (err) {
      error = err.message;
    } finally {
      isUploading = false;
      input.value = ''; // Reset input
    }
  }

  function removeMedia(index: number) {
    mediaUrls = mediaUrls.filter((_, i) => i !== index);
    mediaFiles = mediaFiles.filter((_, i) => i !== index);
  }

  function addTag(tag: string) {
    if (!selectedTags.includes(tag)) {
      selectedTags = [...selectedTags, tag];
    }
    tagInput = '';
  }

  function removeTag(tag: string) {
    selectedTags = selectedTags.filter(t => t !== tag);
  }

  async function createPost() {
    if (!isValid || !$user) return;

    isUploading = true;
    error = null;

    try {
      // Create post
      const { data: post, error: postError } = await supabase
        .from('posts')
        .insert([
          {
            user_id: $user.id,
            content,
            media_urls: mediaUrls,
            tags: selectedTags,
            sentiment_score: 0, // This would be calculated by an AI service
            is_breaking_news: false
          }
        ])
        .select()
        .single();

      if (postError) throw postError;

      // Reset form
      content = '';
      selectedTags = [];
      mediaFiles = [];
      mediaUrls = [];
      isExpanded = false;

    } catch (err) {
      error = err.message;
    } finally {
      isUploading = false;
    }
  }
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow">
  <!-- Create Post Form -->
  <div class="p-4 space-y-4">
    <!-- Text Input -->
    <div class="relative">
      <textarea
        class="w-full px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 bg-gray-50 dark:bg-gray-700 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
        placeholder="What's happening?"
        rows={isExpanded ? 4 : 2}
        bind:value={content}
        on:focus={() => isExpanded = true}
      ></textarea>

      <!-- Character Counter -->
      <div
        class="absolute bottom-2 right-2 text-sm"
        class:text-red-500={characterCount > MAX_CHARS}
        class:text-gray-500={characterCount <= MAX_CHARS}
      >
        {characterCount}/{MAX_CHARS}
      </div>
    </div>

    {#if isExpanded}
      <!-- Media Preview -->
      {#if mediaFiles.length > 0}
        <div class="grid grid-cols-2 gap-2">
          {#each mediaUrls as url, i (url)}
            <div class="relative group">
              <img
                src={url}
                alt="Media preview"
                class="w-full h-32 object-cover rounded-lg"
              />
              <button
                class="absolute top-2 right-2 p-1 bg-gray-900 bg-opacity-75 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                on:click={() => removeMedia(i)}
              >
                <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Tags -->
      <div class="flex flex-wrap gap-2">
        {#each selectedTags as tag}
          <span
            class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
          >
            #{tag}
            <button
              class="ml-1 text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100"
              on:click={() => removeTag(tag)}
            >
              ×
            </button>
          </span>
        {/each}
        <input
          type="text"
          class="flex-1 min-w-[120px] px-3 py-1 text-sm bg-gray-50 dark:bg-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Add tags..."
          bind:value={tagInput}
          on:keydown={(e) => {
            if (e.key === 'Enter' && tagInput.trim()) {
              addTag(tagInput.trim());
            }
          }}
        />
      </div>

      <!-- Tag Suggestions -->
      {#if suggestedTags.length > 0}
        <div class="flex flex-wrap gap-2">
          {#each suggestedTags as tag}
            <button
              class="px-2 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
              on:click={() => addTag(tag)}
            >
              #{tag}
            </button>
          {/each}
        </div>
      {/if}

      <!-- Error Message -->
      {#if error}
        <div class="text-red-500 text-sm" transition:fade>
          {error}
        </div>
      {/if}

      <!-- Actions -->
      <div class="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
        <div class="flex space-x-2">
          <!-- Media Upload -->
          <label
            class="p-2 text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400 cursor-pointer"
            class:opacity-50={remainingMedia === 0}
          >
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              class="hidden"
              on:change={handleMediaUpload}
              disabled={remainingMedia === 0}
            />
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </label>
        </div>

        <div class="flex items-center space-x-4">
          <button
            class="px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            on:click={() => {
              isExpanded = false;
              content = '';
              selectedTags = [];
              mediaFiles = [];
              mediaUrls = [];
              error = null;
            }}
          >
            Cancel
          </button>
          <button
            class="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-full hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!isValid || isUploading}
            on:click={createPost}
          >
            {#if isUploading}
              <span class="flex items-center">
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Posting...
              </span>
            {:else}
              Post
            {/if}
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  /* Add any component-specific styles here */
</style> 