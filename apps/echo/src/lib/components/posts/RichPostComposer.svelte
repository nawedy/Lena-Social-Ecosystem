<!-- RichPostComposer.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { Button, Input, Alert } from '$lib/components/ui';
  import { ipfsService } from '$lib/services/ipfs';
  import { supabase } from '$lib/supabaseClient';
  import { user } from '$lib/stores/auth';

  export let inReplyTo: string | null = null;
  export let threadParent: string | null = null;
  export let onSuccess: () => void = () => {};

  let content = '';
  let mediaFiles: File[] = [];
  let tags: string[] = [];
  let mentions: string[] = [];
  let loading = false;
  let error: string | null = null;
  let isBreakingNews = false;
  let isThreadMode = false;
  let threadPosts: string[] = [];
  let currentThreadIndex = 0;
  let previewUrls: string[] = [];
  let tagInput = '';
  let mentionInput = '';
  let maxLength = 500;

  $: remainingChars = maxLength - content.length;
  $: isValid = content.trim().length > 0 && content.length <= maxLength;

  async function handleMediaUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    
    if (files.length + mediaFiles.length > 4) {
      error = 'Maximum 4 media files allowed';
      return;
    }

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        error = 'File size must be less than 10MB';
        return;
      }

      const url = URL.createObjectURL(file);
      previewUrls = [...previewUrls, url];
      mediaFiles = [...mediaFiles, file];
    }
  }

  function removeMedia(index: number) {
    mediaFiles = mediaFiles.filter((_, i) => i !== index);
    previewUrls = previewUrls.filter((_, i) => i !== index);
  }

  function addTag() {
    const tag = tagInput.trim().replace(/^#/, '');
    if (tag && !tags.includes(tag)) {
      tags = [...tags, tag];
    }
    tagInput = '';
  }

  function removeTag(tag: string) {
    tags = tags.filter(t => t !== tag);
  }

  function addMention() {
    const mention = mentionInput.trim().replace(/^@/, '');
    if (mention && !mentions.includes(mention)) {
      mentions = [...mentions, mention];
    }
    mentionInput = '';
  }

  function removeMention(mention: string) {
    mentions = mentions.filter(m => m !== mention);
  }

  function toggleThreadMode() {
    isThreadMode = !isThreadMode;
    if (isThreadMode && threadPosts.length === 0) {
      threadPosts = [content];
      currentThreadIndex = 0;
    }
  }

  function addThreadPost() {
    threadPosts = [...threadPosts, ''];
    currentThreadIndex = threadPosts.length - 1;
  }

  function removeThreadPost(index: number) {
    threadPosts = threadPosts.filter((_, i) => i !== index);
    if (currentThreadIndex >= threadPosts.length) {
      currentThreadIndex = threadPosts.length - 1;
    }
  }

  async function uploadMedia(file: File): Promise<string> {
    try {
      const { cid } = await ipfsService.upload(file, {
        encrypt: true,
        metadata: {
          type: file.type,
          name: file.name
        }
      });
      return `ipfs://${cid}`;
    } catch (e) {
      throw new Error(`Failed to upload media: ${e.message}`);
    }
  }

  async function handleSubmit() {
    if (!$user) return;
    
    try {
      loading = true;
      error = null;

      // Upload media files
      const mediaUrls = await Promise.all(mediaFiles.map(uploadMedia));

      if (isThreadMode) {
        // Create thread posts
        let parentId = threadParent;
        for (const threadContent of threadPosts) {
          const { data, error: postError } = await supabase
            .from('posts')
            .insert({
              user_id: $user.id,
              content: threadContent,
              media_urls: mediaUrls,
              tags,
              mentions,
              is_breaking_news: isBreakingNews,
              thread_parent_id: parentId,
              in_reply_to: inReplyTo
            })
            .select()
            .single();

          if (postError) throw postError;
          parentId = data.id;
        }
      } else {
        // Create single post
        const { error: postError } = await supabase
          .from('posts')
          .insert({
            user_id: $user.id,
            content,
            media_urls: mediaUrls,
            tags,
            mentions,
            is_breaking_news: isBreakingNews,
            thread_parent_id: threadParent,
            in_reply_to: inReplyTo
          });

        if (postError) throw postError;
      }

      // Reset form
      content = '';
      mediaFiles = [];
      previewUrls = [];
      tags = [];
      mentions = [];
      isBreakingNews = false;
      isThreadMode = false;
      threadPosts = [];
      currentThreadIndex = 0;

      onSuccess();
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }
</script>

<div class="space-y-4">
  {#if error}
    <Alert type="error" message={error} />
  {/if}

  <div class="relative">
    {#if isThreadMode}
      <div class="space-y-4">
        {#each threadPosts as post, index}
          <div class="relative">
            <textarea
              class="w-full min-h-[100px] p-4 rounded-lg border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary-500"
              placeholder="What's happening?"
              bind:value={threadPosts[index]}
              disabled={loading}
            />
            {#if index > 0}
              <button
                class="absolute top-2 right-2 text-gray-500 hover:text-red-500"
                on:click={() => removeThreadPost(index)}
              >
                ×
              </button>
            {/if}
          </div>
        {/each}
        <Button
          variant="outline"
          on:click={addThreadPost}
          disabled={loading}
        >
          Add to thread
        </Button>
      </div>
    {:else}
      <textarea
        class="w-full min-h-[100px] p-4 rounded-lg border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary-500"
        placeholder="What's happening?"
        bind:value={content}
        disabled={loading}
      />
    {/if}

    <div class="absolute bottom-2 right-2 text-sm text-gray-500">
      {remainingChars}/{maxLength}
    </div>
  </div>

  <!-- Media Upload -->
  <div class="space-y-2">
    <input
      type="file"
      accept="image/*,video/*"
      multiple
      on:change={handleMediaUpload}
      class="hidden"
      id="media-upload"
      disabled={loading}
    />
    <label
      for="media-upload"
      class="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
    >
      Add Media
    </label>

    {#if previewUrls.length > 0}
      <div class="grid grid-cols-2 gap-2">
        {#each previewUrls as url, index}
          <div class="relative">
            <img
              src={url}
              alt="Preview"
              class="rounded-lg object-cover w-full h-32"
            />
            <button
              class="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1"
              on:click={() => removeMedia(index)}
            >
              ×
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Tags -->
  <div class="space-y-2">
    <Input
      placeholder="Add tag (press Enter)"
      bind:value={tagInput}
      on:keydown={(e) => e.key === 'Enter' && addTag()}
      disabled={loading}
    />
    {#if tags.length > 0}
      <div class="flex flex-wrap gap-2">
        {#each tags as tag}
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

  <!-- Mentions -->
  <div class="space-y-2">
    <Input
      placeholder="Mention user (press Enter)"
      bind:value={mentionInput}
      on:keydown={(e) => e.key === 'Enter' && addMention()}
      disabled={loading}
    />
    {#if mentions.length > 0}
      <div class="flex flex-wrap gap-2">
        {#each mentions as mention}
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
            @{mention}
            <button
              class="ml-1 text-purple-600 dark:text-purple-300"
              on:click={() => removeMention(mention)}
            >
              ×
            </button>
          </span>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Options -->
  <div class="flex items-center space-x-4">
    <label class="flex items-center space-x-2">
      <input
        type="checkbox"
        bind:checked={isBreakingNews}
        disabled={loading}
        class="rounded border-gray-300 dark:border-gray-600"
      />
      <span class="text-sm">Breaking News</span>
    </label>

    <label class="flex items-center space-x-2">
      <input
        type="checkbox"
        bind:checked={isThreadMode}
        on:change={toggleThreadMode}
        disabled={loading}
        class="rounded border-gray-300 dark:border-gray-600"
      />
      <span class="text-sm">Thread Mode</span>
    </label>
  </div>

  <!-- Submit Button -->
  <div class="flex justify-end">
    <Button
      variant="primary"
      on:click={handleSubmit}
      disabled={!isValid || loading}
      loading={loading}
    >
      {isThreadMode ? 'Post Thread' : 'Post'}
    </Button>
  </div>
</div> 