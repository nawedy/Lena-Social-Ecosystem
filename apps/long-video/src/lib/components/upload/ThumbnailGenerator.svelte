<!-- ThumbnailGenerator.svelte -->
<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { generateThumbnail, extractFrames } from '$lib/utils/video';

  const dispatch = createEventDispatcher();

  // Props
  export let videoUrl: string;
  export let duration: number = 0;

  // State
  let thumbnails: string[] = [];
  let customThumbnail: File | null = null;
  let selectedThumbnail: string | null = null;
  let isGenerating = false;
  let error: string | null = null;
  let customPreview: string | null = null;

  onMount(async () => {
    await generateAutoThumbnails();
  });

  async function generateAutoThumbnails() {
    isGenerating = true;
    error = null;

    try {
      // Generate thumbnails at different timestamps
      const timestamps = [
        0,
        duration * 0.25,
        duration * 0.5,
        duration * 0.75,
        duration - 1
      ];

      const generatedThumbnails = await Promise.all(
        timestamps.map(time => generateThumbnail(videoUrl, time))
      );

      thumbnails = generatedThumbnails;
      if (!selectedThumbnail && thumbnails.length > 0) {
        selectedThumbnail = thumbnails[0];
      }
    } catch (err) {
      console.error('Failed to generate thumbnails:', err);
      error = 'Failed to generate thumbnails. Please try again.';
    } finally {
      isGenerating = false;
    }
  }

  async function handleCustomThumbnail(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      error = 'Please upload an image file';
      return;
    }

    if (file.size > 2 * 1024 * 1024) { // 2MB limit
      error = 'Image size should be less than 2MB';
      return;
    }

    customThumbnail = file;
    customPreview = URL.createObjectURL(file);
    selectedThumbnail = customPreview;
  }

  function handleThumbnailSelect(thumbnail: string) {
    selectedThumbnail = thumbnail;
    dispatch('select', { thumbnail });
  }

  function handleGenerateFromTime(event: Event) {
    const input = event.target as HTMLInputElement;
    const time = parseFloat(input.value);
    if (isNaN(time) || time < 0 || time > duration) return;

    generateThumbnail(videoUrl, time)
      .then(thumbnail => {
        thumbnails = [...thumbnails, thumbnail];
        selectedThumbnail = thumbnail;
        dispatch('select', { thumbnail });
      })
      .catch(err => {
        console.error('Failed to generate thumbnail:', err);
        error = 'Failed to generate thumbnail. Please try again.';
      });
  }
</script>

<div class="thumbnail-generator">
  <div class="preview-section">
    {#if selectedThumbnail}
      <img
        src={selectedThumbnail}
        alt="Selected thumbnail"
        class="selected-thumbnail"
      />
    {/if}

    <div class="thumbnail-actions">
      <label class="upload-button">
        <input
          type="file"
          accept="image/*"
          on:change={handleCustomThumbnail}
        />
        <span>Upload custom thumbnail</span>
      </label>

      <div class="time-input">
        <input
          type="number"
          min="0"
          max={duration}
          step="0.1"
          placeholder="Enter time (seconds)"
          on:change={handleGenerateFromTime}
        />
        <button class="generate-button">
          Generate from time
        </button>
      </div>
    </div>
  </div>

  <div class="thumbnails-grid">
    {#if isGenerating}
      <div class="loading-state" transition:fade>
        <svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2"
            d="M12 6v4m0 4v4m-4-8h8M6 12h12"
          />
        </svg>
        <span>Generating thumbnails...</span>
      </div>
    {:else}
      {#each thumbnails as thumbnail}
        <button
          class="thumbnail-option"
          class:selected={thumbnail === selectedThumbnail}
          on:click={() => handleThumbnailSelect(thumbnail)}
        >
          <img src={thumbnail} alt="Thumbnail option" />
        </button>
      {/each}

      {#if customPreview}
        <button
          class="thumbnail-option"
          class:selected={customPreview === selectedThumbnail}
          on:click={() => handleThumbnailSelect(customPreview)}
        >
          <img src={customPreview} alt="Custom thumbnail" />
          <span class="custom-label">Custom</span>
        </button>
      {/if}
    {/if}
  </div>

  {#if error}
    <div class="error-message" transition:fade>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path 
          stroke-linecap="round" 
          stroke-linejoin="round" 
          stroke-width="2"
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>{error}</span>
    </div>
  {/if}
</div>

<style lang="postcss">
  .thumbnail-generator {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .preview-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
    align-items: center;
  }

  .selected-thumbnail {
    width: 100%;
    max-width: 640px;
    aspect-ratio: 16/9;
    object-fit: cover;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.2);
  }

  .thumbnail-actions {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .upload-button {
    position: relative;
    display: inline-block;

    input {
      position: absolute;
      width: 0;
      height: 0;
      opacity: 0;
    }

    span {
      display: inline-block;
      padding: 8px 16px;
      background: var(--primary-color, #00a8ff);
      border-radius: 4px;
      color: white;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        filter: brightness(1.1);
      }
    }
  }

  .time-input {
    display: flex;
    gap: 8px;

    input {
      width: 120px;
      padding: 8px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      color: white;
      font-size: 14px;

      &:focus {
        outline: none;
        border-color: var(--primary-color, #00a8ff);
      }
    }
  }

  .generate-button {
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 4px;
    color: white;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  }

  .thumbnails-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 16px;
    padding: 16px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
  }

  .loading-state {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 32px;
    color: rgba(255, 255, 255, 0.7);

    .spinner {
      width: 32px;
      height: 32px;
      animation: spin 1s linear infinite;
    }
  }

  .thumbnail-option {
    position: relative;
    padding: 0;
    background: none;
    border: 2px solid transparent;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      transform: scale(1.05);
    }

    &.selected {
      border-color: var(--primary-color, #00a8ff);
    }

    img {
      width: 100%;
      aspect-ratio: 16/9;
      object-fit: cover;
      border-radius: 2px;
    }
  }

  .custom-label {
    position: absolute;
    top: 8px;
    right: 8px;
    padding: 2px 6px;
    background: rgba(0, 0, 0, 0.8);
    border-radius: 4px;
    font-size: 12px;
    color: white;
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: rgba(255, 68, 68, 0.1);
    border-radius: 4px;
    color: #ff4444;

    svg {
      width: 20px;
      height: 20px;
    }
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style> 