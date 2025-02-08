<!-- DrawingTool.svelte -->
<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { analytics } from '$lib/services/analytics';
  import type { Layer, DrawingMode, TextStyle } from '$lib/types';

  const dispatch = createEventDispatcher();

  // Props
  export let imageUrl: string;
  export let width: number;
  export let height: number;

  // Canvas state
  let canvas: HTMLCanvasElement;
  let context: CanvasRenderingContext2D;
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;

  // Drawing settings
  let mode: DrawingMode = 'brush';
  let color = '#ffffff';
  let size = 5;
  let opacity = 1;
  let pressure = true;
  let smoothing = true;

  // Text settings
  let textContent = '';
  let textStyle: TextStyle = {
    fontFamily: 'Arial',
    fontSize: 24,
    fontWeight: 'normal',
    fontStyle: 'normal',
    textAlign: 'left',
    color: '#ffffff',
    backgroundColor: 'transparent',
    padding: 8,
    shadow: {
      color: '#000000',
      blur: 4,
      offsetX: 0,
      offsetY: 0
    }
  };

  // Layers
  let layers: Layer[] = [];
  let activeLayer: number = 0;
  let layerCanvas: HTMLCanvasElement;
  let layerContext: CanvasRenderingContext2D;

  // History
  let history: ImageData[] = [];
  let historyIndex = -1;
  const maxHistory = 50;

  // Tools
  const brushTools = [
    { id: 'brush', name: 'Brush', icon: '🖌️' },
    { id: 'pencil', name: 'Pencil', icon: '✏️' },
    { id: 'marker', name: 'Marker', icon: '🖍️' },
    { id: 'eraser', name: 'Eraser', icon: '🧹' },
    { id: 'spray', name: 'Spray', icon: '💨' }
  ];

  const shapeTools = [
    { id: 'rectangle', name: 'Rectangle', icon: '⬜' },
    { id: 'circle', name: 'Circle', icon: '⭕' },
    { id: 'line', name: 'Line', icon: '➖' },
    { id: 'arrow', name: 'Arrow', icon: '➡️' },
    { id: 'polygon', name: 'Polygon', icon: '🔷' }
  ];

  // Lifecycle
  onMount(() => {
    initializeCanvas();
    setupEventListeners();
    createNewLayer();
    loadImage();

    // Track component mount
    analytics.trackEvent({
      type: 'drawing_tool_opened',
      data: { width, height }
    });
  });

  // Canvas initialization
  function initializeCanvas() {
    context = canvas.getContext('2d', {
      alpha: true,
      desynchronized: true,
      willReadFrequently: true
    })!;

    // Enable pressure sensitivity if available
    if (pressure && 'pressure' in PointerEvent.prototype) {
      canvas.style.touchAction = 'none';
    }

    // Set initial canvas size
    canvas.width = width;
    canvas.height = height;

    // Configure context
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.imageSmoothingEnabled = smoothing;
    context.imageSmoothingQuality = 'high';
  }

  function setupEventListeners() {
    // Drawing events
    canvas.addEventListener('pointerdown', startDrawing);
    canvas.addEventListener('pointermove', draw);
    canvas.addEventListener('pointerup', stopDrawing);
    canvas.addEventListener('pointerout', stopDrawing);

    // Keyboard shortcuts
    window.addEventListener('keydown', handleKeyboard);

    return () => {
      canvas.removeEventListener('pointerdown', startDrawing);
      canvas.removeEventListener('pointermove', draw);
      canvas.removeEventListener('pointerup', stopDrawing);
      canvas.removeEventListener('pointerout', stopDrawing);
      window.removeEventListener('keydown', handleKeyboard);
    };
  }

  async function loadImage() {
    const image = new Image();
    image.src = imageUrl;
    await image.decode();
    context.drawImage(image, 0, 0, width, height);
    saveToHistory();
  }

  // Layer management
  function createNewLayer() {
    const layer: Layer = {
      id: crypto.randomUUID(),
      name: `Layer ${layers.length + 1}`,
      visible: true,
      opacity: 1,
      blendMode: 'normal',
      locked: false,
      data: new ImageData(width, height)
    };

    layers = [...layers, layer];
    activeLayer = layers.length - 1;
    updateLayerCanvas();
  }

  function updateLayerCanvas() {
    layerContext.clearRect(0, 0, width, height);
    
    layers.forEach(layer => {
      if (!layer.visible) return;
      
      layerContext.globalAlpha = layer.opacity;
      layerContext.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;
      layerContext.putImageData(layer.data, 0, 0);
    });

    context.clearRect(0, 0, width, height);
    context.drawImage(layerCanvas, 0, 0);
  }

  // Drawing functions
  function startDrawing(event: PointerEvent) {
    if (layers[activeLayer].locked) return;

    isDrawing = true;
    const { x, y } = getCanvasCoordinates(event);
    lastX = x;
    lastY = y;

    // Configure brush based on pressure
    if (pressure && event.pressure !== 0) {
      context.lineWidth = size * event.pressure;
    } else {
      context.lineWidth = size;
    }

    context.strokeStyle = color;
    context.globalAlpha = opacity;

    // Start new path
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x, y);
    context.stroke();

    // Save initial state
    saveToHistory();
  }

  function draw(event: PointerEvent) {
    if (!isDrawing) return;

    const { x, y } = getCanvasCoordinates(event);

    switch (mode) {
      case 'brush':
        drawBrushStroke(x, y, event.pressure);
        break;
      case 'pencil':
        drawPencilStroke(x, y);
        break;
      case 'marker':
        drawMarkerStroke(x, y);
        break;
      case 'spray':
        drawSpray(x, y);
        break;
      case 'eraser':
        erase(x, y, event.pressure);
        break;
    }

    lastX = x;
    lastY = y;
  }

  function stopDrawing() {
    if (!isDrawing) return;
    isDrawing = false;
    saveToHistory();

    // Update layer data
    layers[activeLayer].data = context.getImageData(0, 0, width, height);
    updateLayerCanvas();

    // Track drawing completion
    analytics.trackEvent({
      type: 'drawing_completed',
      data: { mode, color, size }
    });
  }

  // Drawing modes
  function drawBrushStroke(x: number, y: number, pressure: number) {
    context.beginPath();
    context.moveTo(lastX, lastY);

    if (smoothing) {
      // Quadratic curve for smooth lines
      const midX = (lastX + x) / 2;
      const midY = (lastY + y) / 2;
      context.quadraticCurveTo(lastX, lastY, midX, midY);
    } else {
      context.lineTo(x, y);
    }

    if (pressure !== 0) {
      context.lineWidth = size * pressure;
    }

    context.stroke();
  }

  function drawPencilStroke(x: number, y: number) {
    context.beginPath();
    context.moveTo(lastX, lastY);
    context.lineTo(x, y);
    context.stroke();
  }

  function drawMarkerStroke(x: number, y: number) {
    context.globalAlpha = 0.5;
    context.beginPath();
    context.moveTo(lastX, lastY);
    context.lineTo(x, y);
    context.stroke();
    context.globalAlpha = opacity;
  }

  function drawSpray(x: number, y: number) {
    const density = size * 2;
    const radius = size * 2;

    for (let i = 0; i < density; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radiusRandom = Math.random() * radius;
      const dotX = x + Math.cos(angle) * radiusRandom;
      const dotY = y + Math.sin(angle) * radiusRandom;

      context.beginPath();
      context.arc(dotX, dotY, 0.5, 0, Math.PI * 2);
      context.fill();
    }
  }

  function erase(x: number, y: number, pressure: number) {
    context.globalCompositeOperation = 'destination-out';
    drawBrushStroke(x, y, pressure);
    context.globalCompositeOperation = 'source-over';
  }

  // Text handling
  function addText(x: number, y: number) {
    if (!textContent.trim()) return;

    context.save();
    
    // Configure text style
    context.font = `${textStyle.fontStyle} ${textStyle.fontWeight} ${textStyle.fontSize}px ${textStyle.fontFamily}`;
    context.fillStyle = textStyle.color;
    context.textAlign = textStyle.textAlign as CanvasTextAlign;
    
    // Add background if specified
    if (textStyle.backgroundColor !== 'transparent') {
      const metrics = context.measureText(textContent);
      const padding = textStyle.padding;
      
      context.fillStyle = textStyle.backgroundColor;
      context.fillRect(
        x - padding,
        y - textStyle.fontSize - padding,
        metrics.width + padding * 2,
        textStyle.fontSize + padding * 2
      );
      
      context.fillStyle = textStyle.color;
    }

    // Add shadow if specified
    if (textStyle.shadow) {
      context.shadowColor = textStyle.shadow.color;
      context.shadowBlur = textStyle.shadow.blur;
      context.shadowOffsetX = textStyle.shadow.offsetX;
      context.shadowOffsetY = textStyle.shadow.offsetY;
    }

    // Draw text
    context.fillText(textContent, x, y);
    context.restore();

    // Save state and update layer
    saveToHistory();
    layers[activeLayer].data = context.getImageData(0, 0, width, height);
    updateLayerCanvas();

    // Track text addition
    analytics.trackEvent({
      type: 'text_added',
      data: { style: textStyle }
    });
  }

  // History management
  function saveToHistory() {
    if (historyIndex < history.length - 1) {
      history = history.slice(0, historyIndex + 1);
    }

    history.push(context.getImageData(0, 0, width, height));
    if (history.length > maxHistory) {
      history.shift();
    }
    historyIndex = history.length - 1;
  }

  function undo() {
    if (historyIndex > 0) {
      historyIndex--;
      context.putImageData(history[historyIndex], 0, 0);
      layers[activeLayer].data = context.getImageData(0, 0, width, height);
      updateLayerCanvas();
    }
  }

  function redo() {
    if (historyIndex < history.length - 1) {
      historyIndex++;
      context.putImageData(history[historyIndex], 0, 0);
      layers[activeLayer].data = context.getImageData(0, 0, width, height);
      updateLayerCanvas();
    }
  }

  // Utility functions
  function getCanvasCoordinates(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  function handleKeyboard(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey) {
      if (event.key === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    }
  }

  // Export
  function handleSave() {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          console.error('Failed to create blob');
          return;
        }

        dispatch('save', {
          url: URL.createObjectURL(blob),
          layers: layers.map(layer => ({
            name: layer.name,
            visible: layer.visible,
            opacity: layer.opacity,
            blendMode: layer.blendMode
          }))
        });

        // Track save
        analytics.trackEvent({
          type: 'drawing_saved',
          data: {
            layerCount: layers.length,
            historyCount: history.length
          }
        });
      },
      'image/png',
      1
    );
  }

  function handleCancel() {
    dispatch('cancel');
  }
</script>

<div class="drawing-tool" transition:fade>
  <div class="toolbar">
    <div class="tool-group">
      <h3>Brush Tools</h3>
      <div class="tool-buttons">
        {#each brushTools as tool}
          <button
            class="tool-button"
            class:active={mode === tool.id}
            on:click={() => mode = tool.id as DrawingMode}
            title={tool.name}
          >
            <span class="tool-icon">{tool.icon}</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="tool-group">
      <h3>Shapes</h3>
      <div class="tool-buttons">
        {#each shapeTools as tool}
          <button
            class="tool-button"
            class:active={mode === tool.id}
            on:click={() => mode = tool.id as DrawingMode}
            title={tool.name}
          >
            <span class="tool-icon">{tool.icon}</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="tool-group">
      <h3>Settings</h3>
      <div class="settings-grid">
        <label class="color-picker">
          Color
          <input
            type="color"
            bind:value={color}
          />
        </label>

        <label class="slider-control">
          Size
          <input
            type="range"
            min="1"
            max="100"
            bind:value={size}
          />
          <span class="value">{size}px</span>
        </label>

        <label class="slider-control">
          Opacity
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            bind:value={opacity}
          />
          <span class="value">{Math.round(opacity * 100)}%</span>
        </label>

        <label class="checkbox-control">
          <input type="checkbox" bind:checked={pressure} />
          Pressure Sensitivity
        </label>

        <label class="checkbox-control">
          <input type="checkbox" bind:checked={smoothing} />
          Line Smoothing
        </label>
      </div>
    </div>

    <div class="tool-group">
      <h3>Layers</h3>
      <div class="layer-list">
        {#each layers as layer, i}
          <div
            class="layer-item"
            class:active={activeLayer === i}
          >
            <label class="checkbox-control">
              <input
                type="checkbox"
                bind:checked={layer.visible}
                on:change={updateLayerCanvas}
              />
              {layer.name}
            </label>

            <div class="layer-controls">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                bind:value={layer.opacity}
                on:change={updateLayerCanvas}
              />

              <select
                bind:value={layer.blendMode}
                on:change={updateLayerCanvas}
              >
                <option value="normal">Normal</option>
                <option value="multiply">Multiply</option>
                <option value="screen">Screen</option>
                <option value="overlay">Overlay</option>
                <option value="darken">Darken</option>
                <option value="lighten">Lighten</option>
              </select>

              <button
                class="icon-button"
                on:click={() => layer.locked = !layer.locked}
                title={layer.locked ? 'Unlock Layer' : 'Lock Layer'}
              >
                {layer.locked ? '🔒' : '🔓'}
              </button>
            </div>
          </div>
        {/each}

        <button
          class="secondary-button"
          on:click={createNewLayer}
        >
          Add Layer
        </button>
      </div>
    </div>

    <div class="tool-group">
      <h3>Text</h3>
      <div class="text-controls">
        <input
          type="text"
          placeholder="Enter text..."
          bind:value={textContent}
        />

        <div class="text-style-grid">
          <select bind:value={textStyle.fontFamily}>
            <option value="Arial">Arial</option>
            <option value="Helvetica">Helvetica</option>
            <option value="Times New Roman">Times New Roman</option>
            <option value="Georgia">Georgia</option>
            <option value="Courier New">Courier New</option>
          </select>

          <input
            type="number"
            min="8"
            max="200"
            bind:value={textStyle.fontSize}
          />

          <select bind:value={textStyle.fontWeight}>
            <option value="normal">Normal</option>
            <option value="bold">Bold</option>
          </select>

          <select bind:value={textStyle.textAlign}>
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>

          <input
            type="color"
            bind:value={textStyle.color}
          />

          <input
            type="color"
            bind:value={textStyle.backgroundColor}
          />
        </div>
      </div>
    </div>
  </div>

  <div class="canvas-container">
    <canvas
      bind:this={canvas}
      class="drawing-canvas"
      style="width: {width}px; height: {height}px;"
    />
    <canvas
      bind:this={layerCanvas}
      class="layer-canvas"
      width={width}
      height={height}
      style="display: none;"
    />
  </div>

  <div class="action-buttons">
    <button
      class="icon-button"
      on:click={undo}
      disabled={historyIndex <= 0}
      title="Undo (Ctrl+Z)"
    >
      ↩️
    </button>
    <button
      class="icon-button"
      on:click={redo}
      disabled={historyIndex >= history.length - 1}
      title="Redo (Ctrl+Shift+Z)"
    >
      ↪️
    </button>

    <div class="spacer" />

    <button
      class="secondary-button"
      on:click={handleCancel}
    >
      Cancel
    </button>
    <button
      class="primary-button"
      on:click={handleSave}
    >
      Save Changes
    </button>
  </div>
</div>

<style lang="postcss">
  .drawing-tool {
    background: var(--surface-color, #1a1a1a);
    border-radius: 12px;
    overflow: hidden;
    height: 100%;
    display: grid;
    grid-template-columns: 280px 1fr;
    grid-template-rows: 1fr auto;
  }

  .toolbar {
    padding: 16px;
    border-right: 1px solid rgba(255, 255, 255, 0.1);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .tool-group {
    h3 {
      font-size: 14px;
      font-weight: 600;
      color: white;
      margin: 0 0 12px;
    }
  }

  .tool-buttons {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
    gap: 8px;
  }

  .tool-button {
    aspect-ratio: 1;
    padding: 8px;
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

  .tool-icon {
    font-size: 20px;
  }

  .settings-grid {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .color-picker {
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: white;
    font-size: 14px;

    input {
      width: 40px;
      height: 40px;
      padding: 0;
      border: none;
      border-radius: 8px;
      cursor: pointer;

      &::-webkit-color-swatch-wrapper {
        padding: 0;
      }

      &::-webkit-color-swatch {
        border: none;
        border-radius: 6px;
      }
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

  .layer-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .layer-item {
    padding: 8px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    transition: all 0.2s;

    &.active {
      background: rgba(var(--primary-color-rgb, 0, 168, 255), 0.2);
    }
  }

  .layer-controls {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 8px;
    margin-top: 8px;

    select {
      padding: 4px;
      background: rgba(255, 255, 255, 0.1);
      border: none;
      border-radius: 4px;
      color: white;
      font-size: 12px;
      cursor: pointer;
    }
  }

  .text-controls {
    display: flex;
    flex-direction: column;
    gap: 12px;

    input[type="text"] {
      width: 100%;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.1);
      border: none;
      border-radius: 6px;
      color: white;
      font-size: 14px;

      &::placeholder {
        color: rgba(255, 255, 255, 0.3);
      }
    }
  }

  .text-style-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;

    select,
    input {
      padding: 4px 8px;
      background: rgba(255, 255, 255, 0.1);
      border: none;
      border-radius: 4px;
      color: white;
      font-size: 12px;
    }

    input[type="color"] {
      padding: 0;
      width: 100%;
      height: 24px;
    }
  }

  .canvas-container {
    position: relative;
    padding: 24px;
    background: var(--surface-color-light, #2a2a2a);
    overflow: auto;
  }

  .drawing-canvas {
    background: transparent;
    cursor: crosshair;
  }

  .action-buttons {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .icon-button {
    padding: 8px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: white;
    font-size: 20px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.1);
    }

    &:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }
  }

  .spacer {
    flex: 1;
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
  }

  .primary-button {
    background: var(--primary-color, #00a8ff);
    color: white;

    &:hover {
      filter: brightness(1.1);
    }
  }

  .secondary-button {
    background: rgba(255, 255, 255, 0.1);
    color: white;

    &:hover {
      background: rgba(255, 255, 255, 0.15);
    }
  }

  @media (max-width: 768px) {
    .drawing-tool {
      grid-template-columns: 1fr;
      grid-template-rows: auto 1fr auto;
    }

    .toolbar {
      border-right: none;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
  }
</style> 