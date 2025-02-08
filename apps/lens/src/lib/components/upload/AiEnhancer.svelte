<!-- AiEnhancer.svelte -->
<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { fade, slide, scale } from 'svelte/transition';
  import { aiImage } from '$lib/services/aiImageService';
  import { analytics } from '$lib/services/analytics';
  import type { Media } from '$lib/types';
  import ImageViewer from '../shared/ImageViewer.svelte';
  import LoadingSpinner from '../shared/LoadingSpinner.svelte';

  const dispatch = createEventDispatcher();

  // Props
  export let imageUrl: string;
  export let originalWidth: number;
  export let originalHeight: number;

  // State
  let isLoading = false;
  let error: string | null = null;
  let activeTab: 'style' | 'background' | 'enhance' | 'analyze' = 'style';
  let previewUrl: string | null = null;
  let analysisResult: any = null;
  let variations: string[] = [];

  // Style transfer options
  let selectedStyle: string = 'impressionist';
  let styleStrength = 0.75;
  let preserveColor = false;
  let enhanceDetail = true;

  // Background removal options
  let removalMode: 'precise' | 'fast' = 'precise';
  let featherAmount = 0;
  let refineMask = true;
  let showMask = false;
  let backgroundMask: string | null = null;

  // Enhancement options
  let enhancementOptions = {
    denoise: false,
    upscale: false,
    hdr: false,
    faceRetouching: false,
    colorEnhancement: false,
    smartContrast: false
  };

  // Available styles
  const styles = [
    { id: 'impressionist', name: 'Impressionist', icon: '🎨' },
    { id: 'cubist', name: 'Cubist', icon: '📐' },
    { id: 'vangogh', name: 'Van Gogh', icon: '🌻' },
    { id: 'monet', name: 'Monet', icon: '💫' },
    { id: 'anime', name: 'Anime', icon: '✨' },
    { id: 'sketch', name: 'Sketch', icon: '✏️' },
    { id: 'watercolor', name: 'Watercolor', icon: '💧' }
  ];

  // Lifecycle
  onMount(async () => {
    // Track component mount
    analytics.trackEvent({
      type: 'ai_enhancer_opened',
      data: { imageWidth: originalWidth, imageHeight: originalHeight }
    });

    // Start image analysis
    await analyzeImage();
  });

  // Methods
  async function applyStyleTransfer() {
    isLoading = true;
    error = null;

    try {
      const result = await aiImage.applyStyle(imageUrl, {
        style: selectedStyle as any,
        strength: styleStrength,
        preserveColor,
        enhanceDetail
      });

      if (result.error) throw new Error(result.error.message);
      previewUrl = result.data;

      // Track success
      analytics.trackEvent({
        type: 'style_transfer_applied',
        data: {
          style: selectedStyle,
          strength: styleStrength,
          preserveColor,
          enhanceDetail
        }
      });
    } catch (err) {
      console.error('Style transfer failed:', err);
      error = 'Failed to apply style. Please try again.';
    } finally {
      isLoading = false;
    }
  }

  async function removeBackground() {
    isLoading = true;
    error = null;

    try {
      const result = await aiImage.removeBackground(imageUrl, {
        mode: removalMode,
        feather: featherAmount,
        refineMask,
        returnMask: showMask
      });

      if (result.error) throw new Error(result.error.message);
      previewUrl = result.data.url;
      if (showMask && result.data.mask) {
        backgroundMask = result.data.mask;
      }

      // Track success
      analytics.trackEvent({
        type: 'background_removed',
        data: {
          mode: removalMode,
          feather: featherAmount,
          refineMask
        }
      });
    } catch (err) {
      console.error('Background removal failed:', err);
      error = 'Failed to remove background. Please try again.';
    } finally {
      isLoading = false;
    }
  }

  async function applyEnhancements() {
    isLoading = true;
    error = null;

    try {
      const result = await aiImage.enhance(imageUrl, enhancementOptions);

      if (result.error) throw new Error(result.error.message);
      previewUrl = result.data;

      // Track success
      analytics.trackEvent({
        type: 'enhancements_applied',
        data: enhancementOptions
      });
    } catch (err) {
      console.error('Enhancement failed:', err);
      error = 'Failed to enhance image. Please try again.';
    } finally {
      isLoading = false;
    }
  }

  async function analyzeImage() {
    try {
      const result = await aiImage.analyze(imageUrl);

      if (result.error) throw new Error(result.error.message);
      analysisResult = result.data;

      // Generate variations if analysis is successful
      await generateVariations();

      // Track success
      analytics.trackEvent({
        type: 'image_analyzed',
        data: {
          hasObjects: result.data.objects.length > 0,
          hasFaces: result.data.faces.length > 0
        }
      });
    } catch (err) {
      console.error('Analysis failed:', err);
      error = 'Failed to analyze image. Some features may be limited.';
    }
  }

  async function generateVariations() {
    try {
      const result = await aiImage.generateVariations(imageUrl);

      if (result.error) throw new Error(result.error.message);
      variations = result.data;

      // Track success
      analytics.trackEvent({
        type: 'variations_generated',
        data: { count: variations.length }
      });
    } catch (err) {
      console.error('Variation generation failed:', err);
      // Don't show error to user as this is a non-critical feature
    }
  }

  function handleSave() {
    if (!previewUrl) return;

    dispatch('save', {
      url: previewUrl,
      metadata: {
        aiEnhancements: {
          style: activeTab === 'style' ? selectedStyle : null,
          backgroundRemoved: activeTab === 'background',
          enhancements: activeTab === 'enhance' ? enhancementOptions : null
        }
      }
    });
  }

  function handleCancel() {
    dispatch('cancel');
  }
</script>

<div class="ai-enhancer" transition:fade>
  {#if error}
    <div class="error-message" transition:slide>
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

  <div class="enhancer-content">
    <div class="preview-section">
      <div class="preview-container" class:loading={isLoading}>
        <ImageViewer
          src={previewUrl || imageUrl}
          alt="Preview"
          width={originalWidth}
          height={originalHeight}
        />
        {#if isLoading}
          <div class="loading-overlay" transition:fade>
            <LoadingSpinner size={40} />
            <span>Processing image...</span>
          </div>
        {/if}
      </div>

      {#if variations.length > 0}
        <div class="variations-grid" transition:slide>
          {#each variations as variation}
            <button
              class="variation-item"
              on:click={() => previewUrl = variation}
            >
              <img src={variation} alt="Variation" />
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <div class="controls-section">
      <div class="tabs">
        <button
          class="tab-button"
          class:active={activeTab === 'style'}
          on:click={() => activeTab = 'style'}
        >
          Style Transfer
        </button>
        <button
          class="tab-button"
          class:active={activeTab === 'background'}
          on:click={() => activeTab = 'background'}
        >
          Background
        </button>
        <button
          class="tab-button"
          class:active={activeTab === 'enhance'}
          on:click={() => activeTab = 'enhance'}
        >
          Enhance
        </button>
        <button
          class="tab-button"
          class:active={activeTab === 'analyze'}
          on:click={() => activeTab = 'analyze'}
        >
          Analysis
        </button>
      </div>

      <div class="tab-content">
        {#if activeTab === 'style'}
          <div class="style-controls" transition:fade>
            <div class="style-grid">
              {#each styles as style}
                <button
                  class="style-button"
                  class:active={selectedStyle === style.id}
                  on:click={() => selectedStyle = style.id}
                >
                  <span class="style-icon">{style.icon}</span>
                  <span class="style-name">{style.name}</span>
                </button>
              {/each}
            </div>

            <div class="style-options">
              <label class="slider-control">
                Style Strength
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  bind:value={styleStrength}
                />
                <span class="value">{Math.round(styleStrength * 100)}%</span>
              </label>

              <label class="checkbox-control">
                <input type="checkbox" bind:checked={preserveColor} />
                Preserve Original Colors
              </label>

              <label class="checkbox-control">
                <input type="checkbox" bind:checked={enhanceDetail} />
                Enhance Details
              </label>
            </div>

            <button
              class="action-button"
              on:click={applyStyleTransfer}
              disabled={isLoading}
            >
              Apply Style
            </button>
          </div>
        {:else if activeTab === 'background'}
          <div class="background-controls" transition:fade>
            <div class="mode-selector">
              <button
                class="mode-button"
                class:active={removalMode === 'precise'}
                on:click={() => removalMode = 'precise'}
              >
                Precise
              </button>
              <button
                class="mode-button"
                class:active={removalMode === 'fast'}
                on:click={() => removalMode = 'fast'}
              >
                Fast
              </button>
            </div>

            <label class="slider-control">
              Edge Feathering
              <input
                type="range"
                min="0"
                max="20"
                bind:value={featherAmount}
              />
              <span class="value">{featherAmount}px</span>
            </label>

            <label class="checkbox-control">
              <input type="checkbox" bind:checked={refineMask} />
              Refine Edges
            </label>

            <label class="checkbox-control">
              <input type="checkbox" bind:checked={showMask} />
              Show Mask
            </label>

            <button
              class="action-button"
              on:click={removeBackground}
              disabled={isLoading}
            >
              Remove Background
            </button>
          </div>
        {:else if activeTab === 'enhance'}
          <div class="enhancement-controls" transition:fade>
            {#each Object.entries(enhancementOptions) as [option, enabled]}
              <label class="checkbox-control">
                <input
                  type="checkbox"
                  bind:checked={enhancementOptions[option]}
                />
                {option.split(/(?=[A-Z])/).join(' ')}
              </label>
            {/each}

            <button
              class="action-button"
              on:click={applyEnhancements}
              disabled={isLoading || !Object.values(enhancementOptions).some(v => v)}
            >
              Apply Enhancements
            </button>
          </div>
        {:else if activeTab === 'analyze'}
          <div class="analysis-results" transition:fade>
            {#if analysisResult}
              <div class="analysis-section">
                <h3>Objects Detected</h3>
                <div class="object-list">
                  {#each analysisResult.objects as object}
                    <div class="object-item">
                      <span class="object-label">{object.label}</span>
                      <span class="object-confidence">
                        {Math.round(object.confidence * 100)}%
                      </span>
                    </div>
                  {/each}
                </div>
              </div>

              <div class="analysis-section">
                <h3>Image Quality</h3>
                <div class="quality-metrics">
                  {#each Object.entries(analysisResult.quality) as [metric, value]}
                    <div class="quality-item">
                      <span class="metric-label">
                        {metric.charAt(0).toUpperCase() + metric.slice(1)}
                      </span>
                      <div class="metric-bar">
                        <div
                          class="metric-value"
                          style="width: {value * 100}%"
                        />
                      </div>
                    </div>
                  {/each}
                </div>
              </div>

              <div class="analysis-section">
                <h3>Composition</h3>
                <div class="composition-metrics">
                  {#each Object.entries(analysisResult.composition) as [metric, value]}
                    <div class="composition-item">
                      <span class="metric-label">
                        {metric.split(/(?=[A-Z])/).join(' ')}
                      </span>
                      <div class="metric-bar">
                        <div
                          class="metric-value"
                          style="width: {value * 100}%"
                        />
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {:else}
              <div class="loading-message">
                <LoadingSpinner size={24} />
                <span>Analyzing image...</span>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <div class="action-buttons">
        <button
          class="secondary-button"
          on:click={handleCancel}
          disabled={isLoading}
        >
          Cancel
        </button>
        <button
          class="primary-button"
          on:click={handleSave}
          disabled={isLoading || !previewUrl}
        >
          Save Changes
        </button>
      </div>
    </div>
  </div>
</div>

<style lang="postcss">
  .ai-enhancer {
    background: var(--surface-color, #1a1a1a);
    border-radius: 12px;
    overflow: hidden;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: rgba(255, 68, 68, 0.1);
    color: #ff4444;

    svg {
      width: 20px;
      height: 20px;
    }
  }

  .enhancer-content {
    display: flex;
    gap: 24px;
    padding: 24px;
    height: 100%;
    min-height: 0;
  }

  .preview-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  }

  .preview-container {
    position: relative;
    flex: 1;
    min-height: 0;
    background: var(--surface-color-light, #2a2a2a);
    border-radius: 8px;
    overflow: hidden;

    &.loading {
      :global(img) {
        opacity: 0.5;
      }
    }
  }

  .loading-overlay {
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

  .variations-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
    gap: 8px;
    padding: 8px;
    background: var(--surface-color-light, #2a2a2a);
    border-radius: 8px;
  }

  .variation-item {
    aspect-ratio: 1;
    padding: 0;
    border: none;
    border-radius: 4px;
    overflow: hidden;
    cursor: pointer;
    transition: transform 0.2s;

    &:hover {
      transform: scale(1.05);
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .controls-section {
    width: 320px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .tabs {
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

  .tab-content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .style-controls,
  .background-controls,
  .enhancement-controls,
  .analysis-results {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .style-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 12px;
  }

  .style-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.05);
    border: none;
    border-radius: 8px;
    color: white;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    &.active {
      background: var(--primary-color, #00a8ff);
    }
  }

  .style-icon {
    font-size: 24px;
  }

  .style-name {
    font-size: 12px;
    font-weight: 500;
  }

  .style-options {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .mode-selector {
    display: flex;
    gap: 8px;
  }

  .mode-button {
    flex: 1;
    padding: 12px;
    background: rgba(255, 255, 255, 0.05);
    border: none;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    &.active {
      background: var(--primary-color, #00a8ff);
    }
  }

  .slider-control {
    display: flex;
    flex-direction: column;
    gap: 8px;
    color: white;
    font-size: 14px;

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
    }

    .value {
      color: rgba(255, 255, 255, 0.5);
    }
  }

  .checkbox-control {
    display: flex;
    align-items: center;
    gap: 8px;
    color: white;
    font-size: 14px;
    cursor: pointer;

    input[type="checkbox"] {
      width: 16px;
      height: 16px;
      border-radius: 4px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      background: transparent;
      cursor: pointer;

      &:checked {
        background: var(--primary-color, #00a8ff);
        border-color: var(--primary-color, #00a8ff);
      }
    }
  }

  .action-button {
    padding: 12px;
    background: var(--primary-color, #00a8ff);
    border: none;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      filter: brightness(1.1);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .analysis-section {
    h3 {
      font-size: 16px;
      font-weight: 600;
      color: white;
      margin: 0 0 12px;
    }
  }

  .object-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .object-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 6px;
    color: white;
    font-size: 14px;
  }

  .object-confidence {
    color: rgba(255, 255, 255, 0.5);
  }

  .quality-metrics,
  .composition-metrics {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .quality-item,
  .composition-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .metric-label {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
  }

  .metric-bar {
    height: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    overflow: hidden;
  }

  .metric-value {
    height: 100%;
    background: var(--primary-color, #00a8ff);
    transition: width 0.3s ease-out;
  }

  .loading-message {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
  }

  .action-buttons {
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

  @media (max-width: 768px) {
    .enhancer-content {
      flex-direction: column;
      padding: 16px;
    }

    .controls-section {
      width: 100%;
    }
  }
</style> 