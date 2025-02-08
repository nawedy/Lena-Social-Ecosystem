<!-- ThumbnailSuggestions.svelte -->
<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { createThumbnailService } from '$lib/services/thumbnailService';
  import type { ThumbnailSuggestion } from '$lib/types';
  import { formatTime } from '$lib/utils/video';

  const dispatch = createEventDispatcher();

  // Props
  export let videoId: string;
  export let videoUrl: string;
  export let duration: number;

  // State
  let suggestions: ThumbnailSuggestion[] = [];
  let selectedSuggestion: ThumbnailSuggestion | null = null;
  let isGenerating = false;
  let error: string | null = null;
  let thumbnailService = createThumbnailService(videoId, videoUrl, duration);

  onMount(async () => {
    await generateSuggestions();
  });

  async function generateSuggestions() {
    isGenerating = true;
    error = null;

    try {
      suggestions = await thumbnailService.generateSuggestions();
      if (suggestions.length > 0) {
        selectedSuggestion = suggestions[0];
      }
    } catch (err) {
      console.error('Failed to generate suggestions:', err);
      error = 'Failed to generate thumbnail suggestions. Please try again.';
    } finally {
      isGenerating = false;
    }
  }

  function handleSelect(suggestion: ThumbnailSuggestion) {
    selectedSuggestion = suggestion;
    dispatch('select', { thumbnail: suggestion.thumbnail });
  }

  function getScoreColor(score: number): string {
    if (score >= 80) return '#00c853';
    if (score >= 60) return '#ffd600';
    return '#ff3d00';
  }

  function getAnalysisText(suggestion: ThumbnailSuggestion): string {
    const { analysis } = suggestion;
    const features = [];

    if (analysis.faceCount > 0) {
      features.push(`${analysis.faceCount} face${analysis.faceCount > 1 ? 's' : ''}`);
    }
    if (analysis.textCount > 0) {
      features.push(`${analysis.textCount} text element${analysis.textCount > 1 ? 's' : ''}`);
    }
    if (analysis.tags.length > 0) {
      features.push(analysis.tags.slice(0, 3).join(', '));
    }

    return features.join(' • ');
  }
</script>

<div class="thumbnail-suggestions">
  <div class="suggestions-header">
    <h3>AI-Powered Suggestions</h3>
    <button
      class="refresh-button"
      on:click={generateSuggestions}
      disabled={isGenerating}
    >
      {#if isGenerating}
        <svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2"
            d="M12 6v4m0 4v4m-4-8h8M6 12h12"
          />
        </svg>
        Generating...
      {:else}
        Regenerate
      {/if}
    </button>
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

  <div class="suggestions-grid">
    {#each suggestions as suggestion}
      {@const isSelected = suggestion === selectedSuggestion}
      <button
        class="suggestion-item"
        class:selected={isSelected}
        on:click={() => handleSelect(suggestion)}
      >
        <div class="suggestion-preview">
          <img 
            src={suggestion.thumbnail} 
            alt="Thumbnail suggestion"
          />
          <div class="suggestion-time">
            {formatTime(suggestion.time)}
          </div>
          <div 
            class="suggestion-score"
            style="background-color: {getScoreColor(suggestion.analysis.score)}"
          >
            {suggestion.analysis.score}
          </div>
        </div>

        <div class="suggestion-details">
          <div class="analysis-text">
            {getAnalysisText(suggestion)}
          </div>

          <div class="analysis-bars">
            <div class="analysis-bar">
              <span class="bar-label">Composition</span>
              <div class="bar-track">
                <div 
                  class="bar-fill"
                  style="width: {suggestion.analysis.composition}%"
                />
              </div>
            </div>

            <div class="analysis-bar">
              <span class="bar-label">Brightness</span>
              <div class="bar-track">
                <div 
                  class="bar-fill"
                  style="width: {suggestion.analysis.brightness}%"
                />
              </div>
            </div>

            <div class="analysis-bar">
              <span class="bar-label">Contrast</span>
              <div class="bar-track">
                <div 
                  class="bar-fill"
                  style="width: {suggestion.analysis.contrast}%"
                />
              </div>
            </div>
          </div>

          <div class="color-palette">
            {#each suggestion.analysis.dominantColors as color}
              <div 
                class="color-swatch"
                style="background-color: {color}"
              />
            {/each}
          </div>
        </div>
      </button>
    {/each}
  </div>
</div>

<style lang="postcss">
  .thumbnail-suggestions {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .suggestions-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    h3 {
      font-size: 16px;
      font-weight: 500;
      color: white;
      margin: 0;
    }
  }

  .refresh-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: var(--primary-color, #00a8ff);
    border: none;
    border-radius: 4px;
    color: white;
    font-size: 14px;
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

    .spinner {
      width: 16px;
      height: 16px;
      animation: spin 1s linear infinite;
    }
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

  .suggestions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 16px;
  }

  .suggestion-item {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 0;
    background: rgba(255, 255, 255, 0.05);
    border: 2px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;

    &:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    &.selected {
      border-color: var(--primary-color, #00a8ff);
    }
  }

  .suggestion-preview {
    position: relative;
    aspect-ratio: 16/9;
    border-radius: 6px 6px 0 0;
    overflow: hidden;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .suggestion-time {
    position: absolute;
    bottom: 8px;
    left: 8px;
    padding: 4px 8px;
    background: rgba(0, 0, 0, 0.8);
    border-radius: 4px;
    color: white;
    font-size: 12px;
  }

  .suggestion-score {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #00c853;
    border-radius: 50%;
    color: white;
    font-size: 12px;
    font-weight: 600;
  }

  .suggestion-details {
    padding: 0 12px 12px;
  }

  .analysis-text {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
    margin-bottom: 12px;
  }

  .analysis-bars {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 12px;
  }

  .analysis-bar {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .bar-label {
    width: 80px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
  }

  .bar-track {
    flex: 1;
    height: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    background: var(--primary-color, #00a8ff);
    transition: width 0.3s ease;
  }

  .color-palette {
    display: flex;
    gap: 4px;
  }

  .color-swatch {
    width: 16px;
    height: 16px;
    border-radius: 4px;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style> 