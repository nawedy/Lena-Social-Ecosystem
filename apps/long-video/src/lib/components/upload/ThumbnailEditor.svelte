<!-- ThumbnailEditor.svelte -->
<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { spring } from 'svelte/motion';

  const dispatch = createEventDispatcher();

  // Props
  export let imageUrl: string;

  // State
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let image: HTMLImageElement;
  let isDragging = false;
  let dragStart = { x: 0, y: 0 };
  let textElements: {
    id: string;
    text: string;
    x: number;
    y: number;
    size: number;
    color: string;
    font: string;
    isDragging?: boolean;
  }[] = [];
  let selectedTextId: string | null = null;
  let editingText: string = '';
  let textSize = 32;
  let textColor = '#ffffff';
  let textFont = 'Arial';
  let filter = {
    brightness: 100,
    contrast: 100,
    saturation: 100,
    blur: 0,
    hue: 0
  };

  // Available fonts
  const fonts = [
    'Arial',
    'Helvetica',
    'Roboto',
    'Open Sans',
    'Montserrat',
    'Poppins'
  ];

  // Available filters
  const filters = [
    { name: 'None', values: { brightness: 100, contrast: 100, saturation: 100, blur: 0, hue: 0 } },
    { name: 'Vivid', values: { brightness: 110, contrast: 120, saturation: 130, blur: 0, hue: 0 } },
    { name: 'Cool', values: { brightness: 100, contrast: 100, saturation: 90, blur: 0, hue: 180 } },
    { name: 'Warm', values: { brightness: 105, contrast: 105, saturation: 110, blur: 0, hue: -10 } },
    { name: 'Dramatic', values: { brightness: 90, contrast: 140, saturation: 80, blur: 0, hue: 0 } },
    { name: 'Blur', values: { brightness: 100, contrast: 100, saturation: 100, blur: 5, hue: 0 } }
  ];

  onMount(async () => {
    ctx = canvas.getContext('2d')!;
    image = new Image();
    image.crossOrigin = 'anonymous';
    
    image.onload = () => {
      resizeCanvas();
      drawImage();
    };
    
    image.src = imageUrl;
    window.addEventListener('resize', resizeCanvas);
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  });

  function resizeCanvas() {
    if (!image) return;

    const container = canvas.parentElement;
    if (!container) return;

    const ratio = image.width / image.height;
    const containerRatio = container.clientWidth / container.clientHeight;

    if (containerRatio > ratio) {
      canvas.height = container.clientHeight;
      canvas.width = container.clientHeight * ratio;
    } else {
      canvas.width = container.clientWidth;
      canvas.height = container.clientWidth / ratio;
    }

    drawImage();
  }

  function drawImage() {
    if (!ctx || !image) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply filters
    ctx.filter = `
      brightness(${filter.brightness}%)
      contrast(${filter.contrast}%)
      saturate(${filter.saturation}%)
      blur(${filter.blur}px)
      hue-rotate(${filter.hue}deg)
    `;

    // Draw image
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // Reset filter for text
    ctx.filter = 'none';

    // Draw text elements
    textElements.forEach(element => {
      ctx.font = `${element.size}px ${element.font}`;
      ctx.fillStyle = element.color;
      ctx.strokeStyle = 'black';
      ctx.lineWidth = element.size / 16;
      ctx.textBaseline = 'middle';

      // Draw text stroke
      ctx.strokeText(element.text, element.x, element.y);
      // Draw text fill
      ctx.fillText(element.text, element.x, element.y);
    });

    // Generate and dispatch thumbnail
    dispatch('update', { thumbnail: canvas.toDataURL('image/jpeg', 0.9) });
  }

  function addText() {
    const text = {
      id: crypto.randomUUID(),
      text: 'New Text',
      x: canvas.width / 2,
      y: canvas.height / 2,
      size: textSize,
      color: textColor,
      font: textFont
    };

    textElements = [...textElements, text];
    selectedTextId = text.id;
    editingText = text.text;
    drawImage();
  }

  function handleTextDragStart(event: MouseEvent, textId: string) {
    const text = textElements.find(t => t.id === textId);
    if (!text) return;

    isDragging = true;
    dragStart = {
      x: event.clientX - text.x,
      y: event.clientY - text.y
    };

    selectedTextId = textId;
    editingText = text.text;
  }

  function handleDrag(event: MouseEvent) {
    if (!isDragging || !selectedTextId) return;

    const text = textElements.find(t => t.id === selectedTextId);
    if (!text) return;

    const rect = canvas.getBoundingClientRect();
    text.x = event.clientX - rect.left - dragStart.x;
    text.y = event.clientY - rect.top - dragStart.y;

    drawImage();
  }

  function handleDragEnd() {
    isDragging = false;
  }

  function updateText() {
    if (!selectedTextId) return;

    const text = textElements.find(t => t.id === selectedTextId);
    if (!text) return;

    text.text = editingText;
    drawImage();
  }

  function deleteText() {
    if (!selectedTextId) return;

    textElements = textElements.filter(t => t.id !== selectedTextId);
    selectedTextId = null;
    editingText = '';
    drawImage();
  }

  function applyFilter(preset: typeof filters[0]) {
    filter = { ...preset.values };
    drawImage();
  }

  function handleFilterChange() {
    drawImage();
  }

  function downloadThumbnail() {
    const link = document.createElement('a');
    link.download = 'thumbnail.jpg';
    link.href = canvas.toDataURL('image/jpeg', 0.9);
    link.click();
  }
</script>

<div class="thumbnail-editor">
  <div class="canvas-container">
    <canvas
      bind:this={canvas}
      on:mousemove={handleDrag}
      on:mouseup={handleDragEnd}
      on:mouseleave={handleDragEnd}
    />
  </div>

  <div class="editor-controls">
    <!-- Text Controls -->
    <div class="control-section">
      <h3>Text</h3>
      <button class="add-text" on:click={addText}>
        Add Text
      </button>

      {#if selectedTextId}
        <div class="text-controls" transition:fade>
          <input
            type="text"
            bind:value={editingText}
            on:input={updateText}
            placeholder="Enter text"
          />

          <div class="text-options">
            <input
              type="number"
              bind:value={textSize}
              min="12"
              max="120"
              step="2"
            />
            <input
              type="color"
              bind:value={textColor}
            />
            <select bind:value={textFont}>
              {#each fonts as font}
                <option value={font}>{font}</option>
              {/each}
            </select>
            <button
              class="delete-text"
              on:click={deleteText}
            >
              Delete
            </button>
          </div>
        </div>
      {/if}
    </div>

    <!-- Filter Controls -->
    <div class="control-section">
      <h3>Filters</h3>
      <div class="filter-presets">
        {#each filters as preset}
          <button
            class="filter-preset"
            class:active={filter === preset.values}
            on:click={() => applyFilter(preset)}
          >
            {preset.name}
          </button>
        {/each}
      </div>

      <div class="filter-sliders">
        <label>
          Brightness
          <input
            type="range"
            bind:value={filter.brightness}
            min="0"
            max="200"
            step="5"
            on:input={handleFilterChange}
          />
        </label>

        <label>
          Contrast
          <input
            type="range"
            bind:value={filter.contrast}
            min="0"
            max="200"
            step="5"
            on:input={handleFilterChange}
          />
        </label>

        <label>
          Saturation
          <input
            type="range"
            bind:value={filter.saturation}
            min="0"
            max="200"
            step="5"
            on:input={handleFilterChange}
          />
        </label>

        <label>
          Blur
          <input
            type="range"
            bind:value={filter.blur}
            min="0"
            max="10"
            step="0.5"
            on:input={handleFilterChange}
          />
        </label>

        <label>
          Hue
          <input
            type="range"
            bind:value={filter.hue}
            min="-180"
            max="180"
            step="5"
            on:input={handleFilterChange}
          />
        </label>
      </div>
    </div>

    <div class="editor-actions">
      <button
        class="download-button"
        on:click={downloadThumbnail}
      >
        Download
      </button>
    </div>
  </div>
</div>

<style lang="postcss">
  .thumbnail-editor {
    display: flex;
    gap: 24px;
  }

  .canvas-container {
    flex: 1;
    aspect-ratio: 16/9;
    background: #000;
    border-radius: 8px;
    overflow: hidden;

    canvas {
      width: 100%;
      height: 100%;
      cursor: move;
    }
  }

  .editor-controls {
    width: 300px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .control-section {
    h3 {
      font-size: 16px;
      font-weight: 500;
      color: white;
      margin: 0 0 12px;
    }
  }

  .add-text {
    width: 100%;
    padding: 8px;
    background: var(--primary-color, #00a8ff);
    border: none;
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

  .text-controls {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;

    input[type="text"] {
      width: 100%;
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

  .text-options {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;

    input,
    select {
      padding: 6px;
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

    input[type="color"] {
      padding: 0;
      width: 100%;
      height: 32px;
      cursor: pointer;
    }
  }

  .delete-text {
    grid-column: span 2;
    padding: 6px;
    background: rgba(255, 68, 68, 0.1);
    border: none;
    border-radius: 4px;
    color: #ff4444;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: rgba(255, 68, 68, 0.2);
    }
  }

  .filter-presets {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 16px;
  }

  .filter-preset {
    padding: 6px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 4px;
    color: white;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    &.active {
      background: var(--primary-color, #00a8ff);
    }
  }

  .filter-sliders {
    display: flex;
    flex-direction: column;
    gap: 12px;

    label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.7);
    }

    input[type="range"] {
      width: 100%;
      height: 4px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 2px;
      -webkit-appearance: none;

      &::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 12px;
        height: 12px;
        background: white;
        border-radius: 50%;
        cursor: pointer;
      }

      &:focus {
        outline: none;
      }
    }
  }

  .editor-actions {
    margin-top: auto;
  }

  .download-button {
    width: 100%;
    padding: 12px;
    background: var(--primary-color, #00a8ff);
    border: none;
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
</style> 