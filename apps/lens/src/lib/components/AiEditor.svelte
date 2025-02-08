<!-- AI-powered image editor component -->
<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { aiImage } from '$lib/services/aiImageService';
  import { analytics } from '$lib/services/analytics';
  import type { ObjectRemovalOptions, FaceRetouchingOptions } from '$lib/services/aiImageService';

  export let imageData: ImageData;
  export let width: number;
  export let height: number;

  const dispatch = createEventDispatcher();

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let isLoading = false;
  let error: string | null = null;
  let activeTab: 'object-removal' | 'face-retouching' = 'object-removal';
  let selectionStart: { x: number; y: number } | null = null;
  let selectionEnd: { x: number; y: number } | null = null;
  let isSelecting = false;

  // Object removal options
  let removalMode: ObjectRemovalOptions['mode'] = 'object';
  let preserveStructure = true;
  let refineMask = true;
  let inpaintQuality: 'fast' | 'balanced' | 'best' = 'balanced';

  // Face retouching options
  let faceOptions: FaceRetouchingOptions = {
    features: {
      skin: {
        smoothing: 0.5,
        evenness: 0.5,
        blemishRemoval: true
      },
      eyes: {
        brightness: 0.5,
        enlarge: 0
      },
      lips: {
        definition: 0.5
      },
      face: {
        slimming: 0,
        jawline: 0,
        symmetry: 0.5
      }
    },
    preserveNaturalLook: true,
    enhanceFeatures: true
  };

  onMount(() => {
    ctx = canvas.getContext('2d')!;
    drawImage();
    analytics.track('ai_editor_opened');
  });

  function drawImage() {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.putImageData(imageData, 0, 0);
  }

  function drawSelection() {
    if (!ctx || !selectionStart || !selectionEnd) return;
    
    ctx.save();
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    
    const x = Math.min(selectionStart.x, selectionEnd.x);
    const y = Math.min(selectionStart.y, selectionEnd.y);
    const w = Math.abs(selectionEnd.x - selectionStart.x);
    const h = Math.abs(selectionEnd.y - selectionStart.y);
    
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }

  function handleMouseDown(event: MouseEvent) {
    if (activeTab !== 'object-removal') return;
    
    const rect = canvas.getBoundingClientRect();
    selectionStart = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
    isSelecting = true;
  }

  function handleMouseMove(event: MouseEvent) {
    if (!isSelecting) return;
    
    const rect = canvas.getBoundingClientRect();
    selectionEnd = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
    
    drawImage();
    drawSelection();
  }

  function handleMouseUp() {
    isSelecting = false;
  }

  async function removeObject() {
    if (!selectionStart || !selectionEnd) {
      error = 'Please select an area first';
      return;
    }

    try {
      isLoading = true;
      error = null;

      const options: ObjectRemovalOptions = {
        boundingBox: {
          x: Math.min(selectionStart.x, selectionEnd.x),
          y: Math.min(selectionStart.y, selectionEnd.y),
          width: Math.abs(selectionEnd.x - selectionStart.x),
          height: Math.abs(selectionEnd.y - selectionStart.y)
        },
        mode: removalMode,
        preserveStructure,
        refineMask,
        inpaintQuality
      };

      const result = await aiImage.removeObject(imageData, options);
      
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to remove object');
      }

      imageData = result.data;
      drawImage();
      
      selectionStart = null;
      selectionEnd = null;

      analytics.track('object_removed', { mode: removalMode });
      dispatch('change', { imageData });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to remove object';
      console.error('Error removing object:', err);
    } finally {
      isLoading = false;
    }
  }

  async function retouchFace() {
    try {
      isLoading = true;
      error = null;

      const result = await aiImage.retouchFace(imageData, faceOptions);
      
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to retouch face');
      }

      imageData = result.data;
      drawImage();

      analytics.track('face_retouched', {
        skin_smoothing: faceOptions.features.skin?.smoothing,
        eyes_brightness: faceOptions.features.eyes?.brightness
      });
      dispatch('change', { imageData });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to retouch face';
      console.error('Error retouching face:', err);
    } finally {
      isLoading = false;
    }
  }

  function resetOptions() {
    if (activeTab === 'object-removal') {
      removalMode = 'object';
      preserveStructure = true;
      refineMask = true;
      inpaintQuality = 'balanced';
      selectionStart = null;
      selectionEnd = null;
      drawImage();
    } else {
      faceOptions = {
        features: {
          skin: {
            smoothing: 0.5,
            evenness: 0.5,
            blemishRemoval: true
          },
          eyes: {
            brightness: 0.5,
            enlarge: 0
          },
          lips: {
            definition: 0.5
          },
          face: {
            slimming: 0,
            jawline: 0,
            symmetry: 0.5
          }
        },
        preserveNaturalLook: true,
        enhanceFeatures: true
      };
    }
  }
</script>

<div class="ai-editor">
  <div class="tabs">
    <button
      class:active={activeTab === 'object-removal'}
      on:click={() => {
        activeTab = 'object-removal';
        resetOptions();
      }}
    >
      Object Removal
    </button>
    <button
      class:active={activeTab === 'face-retouching'}
      on:click={() => {
        activeTab = 'face-retouching';
        resetOptions();
      }}
    >
      Face Retouching
    </button>
  </div>

  {#if error}
    <div class="error" transition:fade>
      {error}
    </div>
  {/if}

  <div class="canvas-container">
    <canvas
      bind:this={canvas}
      {width}
      {height}
      on:mousedown={handleMouseDown}
      on:mousemove={handleMouseMove}
      on:mouseup={handleMouseUp}
      on:mouseleave={handleMouseUp}
    />
    {#if isLoading}
      <div class="loading-overlay" transition:fade>
        <div class="spinner"></div>
        <p>Processing image...</p>
      </div>
    {/if}
  </div>

  <div class="options" transition:slide>
    {#if activeTab === 'object-removal'}
      <div class="option-group">
        <label>
          Mode
          <select bind:value={removalMode}>
            <option value="object">Object</option>
            <option value="person">Person</option>
            <option value="text">Text</option>
            <option value="defect">Defect</option>
          </select>
        </label>

        <label class="checkbox">
          <input type="checkbox" bind:checked={preserveStructure}>
          Preserve Structure
        </label>

        <label class="checkbox">
          <input type="checkbox" bind:checked={refineMask}>
          Refine Mask
        </label>

        <label>
          Quality
          <select bind:value={inpaintQuality}>
            <option value="fast">Fast</option>
            <option value="balanced">Balanced</option>
            <option value="best">Best</option>
          </select>
        </label>

        <button
          on:click={removeObject}
          disabled={isLoading || !selectionStart}
        >
          Remove Selected Area
        </button>
      </div>
    {:else}
      <div class="option-group">
        <h4>Skin</h4>
        <label>
          Smoothing
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            bind:value={faceOptions.features.skin!.smoothing}
          >
        </label>

        <label>
          Evenness
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            bind:value={faceOptions.features.skin!.evenness}
          >
        </label>

        <label class="checkbox">
          <input
            type="checkbox"
            bind:checked={faceOptions.features.skin!.blemishRemoval}
          >
          Remove Blemishes
        </label>

        <h4>Eyes</h4>
        <label>
          Brightness
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            bind:value={faceOptions.features.eyes!.brightness}
          >
        </label>

        <label>
          Enlarge
          <input
            type="range"
            min="0"
            max="0.5"
            step="0.1"
            bind:value={faceOptions.features.eyes!.enlarge}
          >
        </label>

        <h4>Lips</h4>
        <label>
          Definition
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            bind:value={faceOptions.features.lips!.definition}
          >
        </label>

        <h4>Face Shape</h4>
        <label>
          Slimming
          <input
            type="range"
            min="0"
            max="0.5"
            step="0.1"
            bind:value={faceOptions.features.face!.slimming}
          >
        </label>

        <label>
          Jawline
          <input
            type="range"
            min="0"
            max="0.5"
            step="0.1"
            bind:value={faceOptions.features.face!.jawline}
          >
        </label>

        <label>
          Symmetry
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            bind:value={faceOptions.features.face!.symmetry}
          >
        </label>

        <label class="checkbox">
          <input
            type="checkbox"
            bind:checked={faceOptions.preserveNaturalLook}
          >
          Preserve Natural Look
        </label>

        <label class="checkbox">
          <input
            type="checkbox"
            bind:checked={faceOptions.enhanceFeatures}
          >
          Enhance Features
        </label>

        <button
          on:click={retouchFace}
          disabled={isLoading}
        >
          Apply Face Retouching
        </button>
      </div>
    {/if}
  </div>
</div>

<style lang="scss">
  .ai-editor {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    background: var(--surface-2);
    border-radius: 0.5rem;
  }

  .tabs {
    display: flex;
    gap: 0.5rem;
    
    button {
      flex: 1;
      padding: 0.5rem;
      background: var(--surface-3);
      border: none;
      border-radius: 0.25rem;
      color: var(--text-2);
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        background: var(--surface-4);
      }

      &.active {
        background: var(--primary);
        color: var(--text-1);
      }
    }
  }

  .error {
    padding: 0.75rem;
    background: var(--error-surface);
    color: var(--error-text);
    border-radius: 0.25rem;
    font-size: 0.875rem;
  }

  .canvas-container {
    position: relative;
    
    canvas {
      display: block;
      width: 100%;
      height: auto;
      border-radius: 0.25rem;
      cursor: crosshair;
    }
  }

  .loading-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.75);
    border-radius: 0.25rem;
    color: white;

    .spinner {
      width: 2rem;
      height: 2rem;
      border: 2px solid transparent;
      border-top-color: white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    p {
      margin-top: 0.5rem;
      font-size: 0.875rem;
    }
  }

  .options {
    padding: 1rem;
    background: var(--surface-3);
    border-radius: 0.25rem;

    .option-group {
      display: flex;
      flex-direction: column;
      gap: 1rem;

      h4 {
        margin: 0;
        color: var(--text-2);
        font-size: 0.875rem;
        font-weight: 500;
      }

      label {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        font-size: 0.875rem;
        color: var(--text-2);

        &.checkbox {
          flex-direction: row;
          align-items: center;
          gap: 0.5rem;
        }

        input[type="range"] {
          width: 100%;
          height: 0.25rem;
          background: var(--surface-4);
          border-radius: 0.125rem;
          appearance: none;

          &::-webkit-slider-thumb {
            width: 1rem;
            height: 1rem;
            background: var(--primary);
            border: none;
            border-radius: 50%;
            cursor: pointer;
            appearance: none;
          }
        }

        select {
          padding: 0.5rem;
          background: var(--surface-4);
          border: none;
          border-radius: 0.25rem;
          color: var(--text-1);
          font-size: 0.875rem;
        }
      }

      button {
        padding: 0.75rem;
        background: var(--primary);
        border: none;
        border-radius: 0.25rem;
        color: var(--text-1);
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;

        &:hover:not(:disabled) {
          background: var(--primary-hover);
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style> 