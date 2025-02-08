<!-- TransitionEditor.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';

  const dispatch = createEventDispatcher();

  // Props
  export let videoId: string;
  export let chapters: any[] = [];

  // Transition types with their configurations
  const transitionTypes = {
    fade: {
      name: 'Fade',
      duration: 1,
      options: {
        curve: 'ease-in-out'
      }
    },
    dissolve: {
      name: 'Dissolve',
      duration: 1.5,
      options: {
        intensity: 0.8
      }
    },
    wipe: {
      name: 'Wipe',
      duration: 1,
      options: {
        direction: 'left-to-right',
        softness: 0.2
      }
    },
    zoom: {
      name: 'Zoom',
      duration: 1.2,
      options: {
        scale: 1.5,
        direction: 'in'
      }
    },
    slide: {
      name: 'Slide',
      duration: 1,
      options: {
        direction: 'left',
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
      }
    }
  };

  // State
  let selectedChapterIndex = 0;
  let selectedTransition = 'fade';
  let customDuration = transitionTypes[selectedTransition].duration;
  let customOptions = { ...transitionTypes[selectedTransition].options };

  function updateTransition() {
    if (selectedChapterIndex < chapters.length - 1) {
      dispatch('update', {
        chapterId: chapters[selectedChapterIndex + 1].id,
        transition: {
          type: selectedTransition,
          duration: customDuration,
          options: customOptions
        }
      });
    }
  }

  function previewTransition() {
    dispatch('preview', {
      chapterId: chapters[selectedChapterIndex + 1].id,
      transition: {
        type: selectedTransition,
        duration: customDuration,
        options: customOptions
      }
    });
  }

  $: currentTransition = transitionTypes[selectedTransition];
  $: canAddTransition = selectedChapterIndex < chapters.length - 1;
</script>

<div class="transition-editor">
  <div class="chapter-select">
    <h3>Select Chapter Transition</h3>
    <select bind:value={selectedChapterIndex}>
      {#each chapters as chapter, index}
        {#if index < chapters.length - 1}
          <option value={index}>
            {chapter.title} → {chapters[index + 1].title}
          </option>
        {/if}
      {/each}
    </select>
  </div>

  <div class="transition-options">
    <div class="transition-type">
      <h4>Transition Type</h4>
      <div class="type-grid">
        {#each Object.entries(transitionTypes) as [type, config]}
          <button
            class="type-button"
            class:selected={type === selectedTransition}
            on:click={() => {
              selectedTransition = type;
              customDuration = config.duration;
              customOptions = { ...config.options };
            }}
          >
            <span class="type-name">{config.name}</span>
            <div class="type-preview" />
          </button>
        {/each}
      </div>
    </div>

    <div class="transition-settings">
      <h4>Settings</h4>
      
      <div class="setting">
        <label>Duration (seconds)</label>
        <input
          type="range"
          min="0.5"
          max="3"
          step="0.1"
          bind:value={customDuration}
        />
        <span class="value">{customDuration}s</span>
      </div>

      {#if selectedTransition === 'wipe'}
        <div class="setting">
          <label>Direction</label>
          <select bind:value={customOptions.direction}>
            <option value="left-to-right">Left to Right</option>
            <option value="right-to-left">Right to Left</option>
            <option value="top-to-bottom">Top to Bottom</option>
            <option value="bottom-to-top">Bottom to Top</option>
          </select>
        </div>
      {/if}

      {#if selectedTransition === 'zoom'}
        <div class="setting">
          <label>Direction</label>
          <select bind:value={customOptions.direction}>
            <option value="in">Zoom In</option>
            <option value="out">Zoom Out</option>
          </select>
        </div>
      {/if}

      {#if selectedTransition === 'slide'}
        <div class="setting">
          <label>Direction</label>
          <select bind:value={customOptions.direction}>
            <option value="left">Left</option>
            <option value="right">Right</option>
            <option value="up">Up</option>
            <option value="down">Down</option>
          </select>
        </div>
      {/if}
    </div>
  </div>

  <div class="transition-actions">
    <button
      class="preview-button"
      on:click={previewTransition}
      disabled={!canAddTransition}
    >
      Preview Transition
    </button>

    <button
      class="apply-button"
      on:click={updateTransition}
      disabled={!canAddTransition}
    >
      Apply Transition
    </button>
  </div>
</div>

<style lang="postcss">
  .transition-editor {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 16px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
  }

  h3, h4 {
    font-size: 16px;
    font-weight: 500;
    color: white;
    margin: 0 0 12px;
  }

  .chapter-select {
    select {
      width: 100%;
      padding: 8px;
      background: rgba(255, 255, 255, 0.1);
      border: none;
      border-radius: 4px;
      color: white;
      font-size: 14px;
    }
  }

  .transition-options {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 24px;
  }

  .type-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 12px;
  }

  .type-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.1);
    border: 2px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.15);
    }

    &.selected {
      border-color: var(--primary-color, #00a8ff);
    }
  }

  .type-name {
    font-size: 14px;
    color: white;
  }

  .type-preview {
    width: 100%;
    height: 60px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
  }

  .transition-settings {
    .setting {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;

      label {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.7);
      }

      input[type="range"] {
        width: 100%;
      }

      select {
        padding: 8px;
        background: rgba(255, 255, 255, 0.1);
        border: none;
        border-radius: 4px;
        color: white;
        font-size: 14px;
      }

      .value {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.5);
      }
    }
  }

  .transition-actions {
    display: flex;
    gap: 12px;

    button {
      flex: 1;
      padding: 12px;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .preview-button {
      background: rgba(255, 255, 255, 0.1);
      color: white;

      &:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.2);
      }
    }

    .apply-button {
      background: var(--primary-color, #00a8ff);
      color: white;

      &:hover:not(:disabled) {
        filter: brightness(1.1);
      }
    }
  }
</style> 