<!-- +page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/services/auth';
  import { posts } from '$lib/services/posts';
  import { analytics } from '$lib/services/analytics';
  import { notifications } from '$lib/services/notifications';
  import ImageEditor from '$lib/components/upload/ImageEditor.svelte';
  import LocationPicker from '$lib/components/shared/LocationPicker.svelte';
  import TagInput from '$lib/components/shared/TagInput.svelte';
  import UserSearch from '$lib/components/shared/UserSearch.svelte';
  import PrivacySelector from '$lib/components/shared/PrivacySelector.svelte';
  import type { Media, PrivacyLevel } from '$lib/types';

  // State
  let files: File[] = [];
  let editedMedia: Media[] = [];
  let caption = '';
  let hashtags: string[] = [];
  let mentionedUsers: string[] = [];
  let location: { name: string; point: { latitude: number; longitude: number } } | null = null;
  let privacy: PrivacyLevel = 'public';
  let isUploading = false;
  let uploadProgress = 0;
  let error: string | null = null;
  let currentStep: 'upload' | 'edit' | 'details' = 'upload';
  let dropZoneActive = false;

  // Computed
  $: currentUser = $auth.user;
  $: isValid = files.length > 0 && editedMedia.length === files.length;
  $: canProceed = currentStep === 'edit' ? editedMedia.length > 0 : true;

  // Lifecycle
  onMount(() => {
    // Track page view
    analytics.trackEvent({
      type: 'page_view',
      data: { page: 'upload' }
    });
  });

  // Methods
  function handleFileDrop(event: DragEvent) {
    event.preventDefault();
    dropZoneActive = false;

    const droppedFiles = Array.from(event.dataTransfer?.files || [])
      .filter(file => file.type.startsWith('image/'));

    if (droppedFiles.length > 0) {
      handleFileSelect(droppedFiles);
    }
  }

  function handleFileSelect(selectedFiles: File[]) {
    // Validate file types and sizes
    const validFiles = selectedFiles.filter(file => {
      if (!file.type.startsWith('image/')) {
        error = 'Only image files are allowed';
        return false;
      }
      if (file.size > 20 * 1024 * 1024) { // 20MB limit
        error = 'Files must be smaller than 20MB';
        return false;
      }
      return true;
    });

    if (validFiles.length > 0) {
      files = [...files, ...validFiles];
      error = null;
      currentStep = 'edit';
    }
  }

  function handleMediaEdit(event: CustomEvent) {
    const { media } = event.detail;
    editedMedia = [...editedMedia, media];

    if (editedMedia.length === files.length) {
      currentStep = 'details';
    }
  }

  function handleRemoveFile(index: number) {
    files = files.filter((_, i) => i !== index);
    editedMedia = editedMedia.filter((_, i) => i !== index);
  }

  async function handleSubmit() {
    if (!isValid || isUploading) return;
    isUploading = true;
    error = null;

    try {
      // Create post
      const post = await posts.create({
        media: editedMedia,
        caption,
        hashtags,
        mentionedUsers,
        location,
        privacy
      }, {
        onProgress: (progress) => {
          uploadProgress = progress;
        }
      });

      // Track success
      analytics.trackEvent({
        type: 'post_create',
        contentId: post.id,
        contentType: 'photo',
        data: {
          mediaCount: editedMedia.length,
          hasLocation: !!location,
          hashtagCount: hashtags.length,
          mentionCount: mentionedUsers.length
        }
      });

      // Notify mentioned users
      if (mentionedUsers.length > 0) {
        await notifications.notifyMentions(post.id, mentionedUsers);
      }

      // Redirect to post
      goto(`/p/${post.id}`);
    } catch (err) {
      console.error('Failed to create post:', err);
      error = 'Failed to create post. Please try again.';
    } finally {
      isUploading = false;
    }
  }
</script>

<svelte:head>
  <title>Upload • Lens</title>
  <meta name="description" content="Share your photos with the world" />
</svelte:head>

<div class="upload-page">
  <header class="page-header">
    <h1>Create New Post</h1>
    <div class="step-indicator">
      <div 
        class="step"
        class:active={currentStep === 'upload'}
        class:complete={currentStep !== 'upload'}
      >
        <span class="step-number">1</span>
        <span class="step-label">Upload</span>
      </div>
      <div 
        class="step"
        class:active={currentStep === 'edit'}
        class:complete={currentStep === 'details'}
      >
        <span class="step-number">2</span>
        <span class="step-label">Edit</span>
      </div>
      <div 
        class="step"
        class:active={currentStep === 'details'}
      >
        <span class="step-number">3</span>
        <span class="step-label">Details</span>
      </div>
    </div>
  </header>

  {#if error}
    <div class="error-message" transition:fade>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path 
          stroke-linecap="round" 
          stroke-linejoin="round" 
          stroke-width="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <span>{error}</span>
    </div>
  {/if}

  <div class="upload-container">
    {#if currentStep === 'upload'}
      <div 
        class="drop-zone"
        class:active={dropZoneActive}
        on:dragenter|preventDefault={() => dropZoneActive = true}
        on:dragleave|preventDefault={() => dropZoneActive = false}
        on:dragover|preventDefault
        on:drop={handleFileDrop}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2"
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <h2>Drag photos here</h2>
        <p>or</p>
        <label class="file-input">
          <input
            type="file"
            accept="image/*"
            multiple
            on:change={(e) => handleFileSelect(Array.from(e.target.files || []))}
          />
          <span>Choose Files</span>
        </label>
      </div>
    {:else if currentStep === 'edit'}
      <div class="editor-grid">
        {#each files as file, index}
          <div class="editor-item" transition:fade>
            <ImageEditor
              {file}
              on:edit={handleMediaEdit}
              on:remove={() => handleRemoveFile(index)}
            />
          </div>
        {/each}
      </div>
    {:else if currentStep === 'details'}
      <div class="details-form">
        <div class="preview-grid">
          {#each editedMedia as media}
            <div class="preview-item">
              <img src={media.url} alt="" />
            </div>
          {/each}
        </div>

        <div class="form-fields">
          <div class="field">
            <label for="caption">Caption</label>
            <textarea
              id="caption"
              bind:value={caption}
              placeholder="Write a caption..."
              maxlength="2200"
              rows="4"
            />
            <span class="character-count">
              {caption.length}/2200
            </span>
          </div>

          <div class="field">
            <label>Tags</label>
            <TagInput
              bind:tags={hashtags}
              placeholder="Add hashtags..."
              maxTags={30}
            />
          </div>

          <div class="field">
            <label>Mention People</label>
            <UserSearch
              bind:selectedUsers={mentionedUsers}
              placeholder="Search people..."
            />
          </div>

          <div class="field">
            <label>Location</label>
            <LocationPicker
              bind:location
              placeholder="Add location..."
            />
          </div>

          <div class="field">
            <label>Privacy</label>
            <PrivacySelector
              bind:value={privacy}
            />
          </div>
        </div>

        <div class="form-actions">
          <button
            class="secondary-button"
            on:click={() => currentStep = 'edit'}
            disabled={isUploading}
          >
            Back
          </button>
          <button
            class="primary-button"
            on:click={handleSubmit}
            disabled={!isValid || isUploading}
          >
            {#if isUploading}
              <div class="upload-progress">
                <div 
                  class="progress-bar"
                  style="width: {uploadProgress}%"
                />
                <span>Uploading... {uploadProgress}%</span>
              </div>
            {:else}
              Share
            {/if}
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style lang="postcss">
  .upload-page {
    max-width: 1200px;
    margin: 0 auto;
    padding: 40px 24px;
  }

  .page-header {
    text-align: center;
    margin-bottom: 40px;

    h1 {
      font-size: 32px;
      font-weight: 600;
      color: white;
      margin: 0 0 24px;
    }
  }

  .step-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 40px;
  }

  .step {
    display: flex;
    align-items: center;
    gap: 8px;
    color: rgba(255, 255, 255, 0.5);

    &.active {
      color: var(--primary-color, #00a8ff);

      .step-number {
        background: var(--primary-color, #00a8ff);
        border-color: var(--primary-color, #00a8ff);
        color: white;
      }
    }

    &.complete {
      color: #4caf50;

      .step-number {
        background: #4caf50;
        border-color: #4caf50;
        color: white;
      }
    }
  }

  .step-number {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 2px solid currentColor;
    border-radius: 50%;
    font-size: 12px;
    font-weight: 600;
  }

  .step-label {
    font-size: 14px;
    font-weight: 500;
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: rgba(255, 68, 68, 0.1);
    color: #ff4444;
    border-radius: 8px;
    margin-bottom: 24px;

    svg {
      width: 20px;
      height: 20px;
    }
  }

  .upload-container {
    background: var(--surface-color-light, #2a2a2a);
    border-radius: 12px;
    overflow: hidden;
  }

  .drop-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 64px 24px;
    border: 2px dashed rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    color: rgba(255, 255, 255, 0.7);
    transition: all 0.2s;

    &.active {
      border-color: var(--primary-color, #00a8ff);
      background: rgba(0, 168, 255, 0.05);
    }

    svg {
      width: 48px;
      height: 48px;
      color: var(--primary-color, #00a8ff);
    }

    h2 {
      font-size: 24px;
      font-weight: 600;
      color: white;
      margin: 0;
    }

    p {
      font-size: 16px;
      margin: 0;
    }
  }

  .file-input {
    input {
      display: none;
    }

    span {
      display: inline-block;
      padding: 12px 24px;
      background: var(--primary-color, #00a8ff);
      border-radius: 24px;
      color: white;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        filter: brightness(1.1);
      }
    }
  }

  .editor-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 24px;
    padding: 24px;
  }

  .details-form {
    padding: 24px;
  }

  .preview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 12px;
    margin-bottom: 24px;
  }

  .preview-item {
    aspect-ratio: 1;
    border-radius: 8px;
    overflow: hidden;
    background: var(--surface-color, #1a1a1a);

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .form-fields {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .field {
    label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.7);
      margin-bottom: 8px;
    }

    textarea {
      width: 100%;
      min-height: 100px;
      padding: 12px;
      background: rgba(255, 255, 255, 0.05);
      border: none;
      border-radius: 8px;
      color: white;
      font-size: 14px;
      resize: vertical;

      &:focus {
        outline: none;
        background: rgba(255, 255, 255, 0.1);
      }

      &::placeholder {
        color: rgba(255, 255, 255, 0.3);
      }
    }
  }

  .character-count {
    display: block;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    text-align: right;
    margin-top: 4px;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 32px;
    padding-top: 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .primary-button,
  .secondary-button {
    padding: 12px 24px;
    border: none;
    border-radius: 24px;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .primary-button {
    background: var(--primary-color, #00a8ff);
    color: white;

    &:not(:disabled):hover {
      filter: brightness(1.1);
    }
  }

  .secondary-button {
    background: rgba(255, 255, 255, 0.1);
    color: white;

    &:not(:disabled):hover {
      background: rgba(255, 255, 255, 0.15);
    }
  }

  .upload-progress {
    position: relative;
    width: 120px;
    height: 20px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 10px;
    overflow: hidden;

    .progress-bar {
      height: 100%;
      background: rgba(255, 255, 255, 0.9);
      transition: width 0.2s linear;
    }

    span {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
    }
  }

  @media (max-width: 640px) {
    .upload-page {
      padding: 24px 16px;
    }

    .page-header h1 {
      font-size: 24px;
    }

    .step-indicator {
      gap: 20px;
    }

    .drop-zone {
      padding: 40px 16px;

      h2 {
        font-size: 20px;
      }
    }
  }
</style> 