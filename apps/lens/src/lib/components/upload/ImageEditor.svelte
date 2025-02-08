<!-- ImageEditor.svelte -->
<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { analytics } from '$lib/services/analytics';
  import type { Media } from '$lib/types';
  import ImageViewer from '../shared/ImageViewer.svelte';

  const dispatch = createEventDispatcher();

  // Props
  export let file: File;

  // State
  let canvas: HTMLCanvasElement;
  let context: CanvasRenderingContext2D | null;
  let image: HTMLImageElement;
  let isLoading = true;
  let isProcessing = false;
  let error: string | null = null;
  let activeFilter: string | null = null;
  let activeAdjustment: string | null = null;
  let adjustments = {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    temperature: 0,
    vignette: 0
  };
  let aiEnhancements = {
    denoise: false,
    sharpen: false,
    hdr: false,
    colorize: false,
    faceRetouching: false
  };

  // Filters
  const filters = [
    { id: 'original', name: 'Original' },
    { id: 'chrome', name: 'Chrome' },
    { id: 'fade', name: 'Fade' },
    { id: 'mono', name: 'Mono' },
    { id: 'noir', name: 'Noir' },
    { id: 'process', name: 'Process' },
    { id: 'tonal', name: 'Tonal' },
    { id: 'transfer', name: 'Transfer' }
  ];

  // Adjustments
  const adjustmentControls = [
    { id: 'brightness', name: 'Brightness', min: -100, max: 100 },
    { id: 'contrast', name: 'Contrast', min: -100, max: 100 },
    { id: 'saturation', name: 'Saturation', min: -100, max: 100 },
    { id: 'temperature', name: 'Temperature', min: -100, max: 100 },
    { id: 'vignette', name: 'Vignette', min: 0, max: 100 }
  ];

  // AI Enhancements
  const aiFeatures = [
    { id: 'denoise', name: 'Denoise', description: 'Remove image noise and grain' },
    { id: 'sharpen', name: 'Sharpen', description: 'Enhance image details and clarity' },
    { id: 'hdr', name: 'HDR Effect', description: 'Improve dynamic range' },
    { id: 'colorize', name: 'Color Enhancement', description: 'Optimize color balance' },
    { id: 'faceRetouching', name: 'Face Retouching', description: 'Enhance facial features' }
  ];

  // Lifecycle
  onMount(async () => {
    try {
      // Initialize canvas
      context = canvas.getContext('2d');
      if (!context) throw new Error('Failed to get canvas context');

      // Load image
      image = new Image();
      image.onload = () => {
        // Set canvas size
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;

        // Draw initial image
        context?.drawImage(image, 0, 0);
        isLoading = false;
      };
      image.onerror = () => {
        throw new Error('Failed to load image');
      };
      image.src = URL.createObjectURL(file);
    } catch (err) {
      console.error('Failed to initialize editor:', err);
      error = 'Failed to load image. Please try again.';
    }
  });

  // Methods
  async function applyFilter(filterId: string) {
    if (!context || isProcessing) return;
    isProcessing = true;

    try {
      // Reset canvas
      context.drawImage(image, 0, 0);

      if (filterId !== 'original') {
        // Apply filter
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const filtered = await applyImageFilter(imageData, filterId);
        context.putImageData(filtered, 0, 0);
      }

      activeFilter = filterId;

      // Track filter usage
      analytics.trackEvent({
        type: 'filter_applied',
        data: { filter: filterId }
      });
    } catch (err) {
      console.error('Failed to apply filter:', err);
      error = 'Failed to apply filter. Please try again.';
    } finally {
      isProcessing = false;
    }
  }

  async function applyAdjustment(adjustment: string, value: number) {
    if (!context || isProcessing) return;
    isProcessing = true;

    try {
      // Reset canvas
      context.drawImage(image, 0, 0);

      // Apply adjustment
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const adjusted = await applyImageAdjustment(imageData, adjustment, value);
      context.putImageData(adjusted, 0, 0);

      // Track adjustment
      analytics.trackEvent({
        type: 'adjustment_applied',
        data: { adjustment, value }
      });
    } catch (err) {
      console.error('Failed to apply adjustment:', err);
      error = 'Failed to apply adjustment. Please try again.';
    } finally {
      isProcessing = false;
    }
  }

  async function applyAIEnhancement(feature: string) {
    if (!context || isProcessing) return;
    isProcessing = true;

    try {
      // Get current image data
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

      // Apply AI enhancement
      const enhanced = await fetch('/api/ai/enhance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          imageData: imageData.data,
          width: canvas.width,
          height: canvas.height,
          feature
        })
      }).then(res => res.json());

      // Update canvas
      const newImageData = new ImageData(
        new Uint8ClampedArray(enhanced.data),
        canvas.width,
        canvas.height
      );
      context.putImageData(newImageData, 0, 0);

      aiEnhancements[feature] = true;

      // Track AI enhancement
      analytics.trackEvent({
        type: 'ai_enhancement_applied',
        data: { feature }
      });
    } catch (err) {
      console.error('Failed to apply AI enhancement:', err);
      error = 'Failed to apply AI enhancement. Please try again.';
    } finally {
      isProcessing = false;
    }
  }

  async function saveChanges() {
    if (!context || isProcessing) return;

    try {
      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob(blob => resolve(blob!), 'image/jpeg', 0.9);
      });

      // Create media object
      const media: Media = {
        url: URL.createObjectURL(blob),
        type: 'image/jpeg',
        width: canvas.width,
        height: canvas.height,
        size: blob.size,
        metadata: {
          filter: activeFilter,
          adjustments,
          aiEnhancements
        }
      };

      dispatch('edit', { media });
    } catch (err) {
      console.error('Failed to save changes:', err);
      error = 'Failed to save changes. Please try again.';
    }
  }

  function handleRemove() {
    dispatch('remove');
  }
</script>

<div class="image-editor">
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

  <div class="editor-main">
    <canvas 
      bind:this={canvas}
      class:loading={isLoading}
      class:processing={isProcessing}
    />

    {#if isLoading}
      <div class="loading-overlay" transition:fade>
        <svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2"
            d="M12 6v4m0 4v4m-4-8h8M6 12h12"
          />
        </svg>
        <span>Loading image...</span>
      </div>
    {/if}

    {#if isProcessing}
      <div class="processing-overlay" transition:fade>
        <svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2"
            d="M12 6v4m0 4v4m-4-8h8M6 12h12"
          />
        </svg>
        <span>Processing...</span>
      </div>
    {/if}
  </div>

  <div class="editor-controls">
    <div class="control-tabs">
      <button
        class="tab-button"
        class:active={!activeAdjustment}
        on:click={() => activeAdjustment = null}
      >
        Filters
      </button>
      <button
        class="tab-button"
        class:active={activeAdjustment === 'adjust'}
        on:click={() => activeAdjustment = 'adjust'}
      >
        Adjust
      </button>
      <button
        class="tab-button"
        class:active={activeAdjustment === 'ai'}
        on:click={() => activeAdjustment = 'ai'}
      >
        AI Enhance
      </button>
    </div>

    <div class="control-content">
      {#if !activeAdjustment}
        <div class="filter-grid">
          {#each filters as filter}
            <button
              class="filter-button"
              class:active={activeFilter === filter.id}
              disabled={isProcessing}
              on:click={() => applyFilter(filter.id)}
            >
              <div class="filter-preview">
                <img 
                  src={URL.createObjectURL(file)}
                  alt={filter.name}
                  style="filter: {filter.id === 'original' ? 'none' : `url(#${filter.id})`}"
                />
              </div>
              <span class="filter-name">{filter.name}</span>
            </button>
          {/each}
        </div>
      {:else if activeAdjustment === 'adjust'}
        <div class="adjustment-controls">
          {#each adjustmentControls as control}
            <div class="adjustment-control">
              <label>
                {control.name}
                <span class="value">{adjustments[control.id]}</span>
              </label>
              <input
                type="range"
                min={control.min}
                max={control.max}
                bind:value={adjustments[control.id]}
                on:change={() => applyAdjustment(control.id, adjustments[control.id])}
                disabled={isProcessing}
              />
            </div>
          {/each}
        </div>
      {:else if activeAdjustment === 'ai'}
        <div class="ai-features">
          {#each aiFeatures as feature}
            <button
              class="ai-feature-button"
              class:active={aiEnhancements[feature.id]}
              disabled={isProcessing}
              on:click={() => applyAIEnhancement(feature.id)}
            >
              <div class="feature-header">
                <span class="feature-name">{feature.name}</span>
                {#if aiEnhancements[feature.id]}
                  <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path 
                      stroke-linecap="round" 
                      stroke-linejoin="round" 
                      stroke-width="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                {/if}
              </div>
              <p class="feature-description">{feature.description}</p>
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <div class="editor-actions">
      <button
        class="secondary-button"
        on:click={handleRemove}
        disabled={isProcessing}
      >
        Remove
      </button>
      <button
        class="primary-button"
        on:click={saveChanges}
        disabled={isProcessing}
      >
        Done
      </button>
    </div>
  </div>
</div>

<style lang="postcss">
  .image-editor {
    display: flex;
    flex-direction: column;
    gap: 24px;
    height: 100%;
    min-height: 400px;
  }

  .editor-main {
    position: relative;
    flex: 1;
    min-height: 0;
    background: var(--surface-color, #1a1a1a);
    border-radius: 8px;
    overflow: hidden;
  }

  canvas {
    width: 100%;
    height: 100%;
    object-fit: contain;

    &.loading,
    &.processing {
      opacity: 0.5;
    }
  }

  .loading-overlay,
  .processing-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    background: rgba(0, 0, 0, 0.5);
    color: white;
  }

  .spinner {
    width: 32px;
    height: 32px;
    animation: spin 1s linear infinite;
  }

  .editor-controls {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .control-tabs {
    display: flex;
    gap: 8px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .tab-button {
    padding: 8px 16px;
    background: transparent;
    border: none;
    border-radius: 20px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      color: white;
      background: rgba(255, 255, 255, 0.05);
    }

    &.active {
      color: white;
      background: var(--primary-color, #00a8ff);
    }
  }

  .control-content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .filter-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 16px;
    padding: 16px;
  }

  .filter-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 0;
    background: none;
    border: none;
    color: white;
    cursor: pointer;

    &:hover .filter-preview {
      border-color: var(--primary-color, #00a8ff);
    }

    &.active .filter-preview {
      border-color: var(--primary-color, #00a8ff);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .filter-preview {
    width: 100%;
    aspect-ratio: 1;
    border: 2px solid transparent;
    border-radius: 8px;
    overflow: hidden;
    transition: border-color 0.2s;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .filter-name {
    font-size: 12px;
    font-weight: 500;
  }

  .adjustment-controls {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 16px;
  }

  .adjustment-control {
    label {
      display: flex;
      justify-content: space-between;
      font-size: 14px;
      font-weight: 500;
      color: white;
      margin-bottom: 8px;
    }

    .value {
      color: rgba(255, 255, 255, 0.5);
    }

    input[type="range"] {
      width: 100%;
      height: 4px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 2px;
      -webkit-appearance: none;

      &::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 16px;
        height: 16px;
        background: var(--primary-color, #00a8ff);
        border-radius: 50%;
        cursor: pointer;
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
  }

  .ai-features {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
  }

  .ai-feature-button {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.05);
    border: none;
    border-radius: 8px;
    color: white;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    &.active {
      background: rgba(var(--primary-color-rgb, 0, 168, 255), 0.2);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .feature-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .feature-name {
    font-weight: 500;
  }

  .check-icon {
    width: 16px;
    height: 16px;
    color: var(--primary-color, #00a8ff);
  }

  .feature-description {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
    margin: 0;
  }

  .editor-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding-top: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .primary-button,
  .secondary-button {
    padding: 8px 16px;
    border: none;
    border-radius: 20px;
    font-size: 14px;
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

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @media (max-width: 640px) {
    .image-editor {
      gap: 16px;
    }

    .filter-grid {
      grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
      gap: 12px;
      padding: 12px;
    }

    .adjustment-controls,
    .ai-features {
      padding: 12px;
    }
  }
</style> 