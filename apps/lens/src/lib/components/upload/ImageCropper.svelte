<!-- ImageCropper.svelte -->
<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { analytics } from '$lib/services/analytics';
  import type { Media } from '$lib/types';

  const dispatch = createEventDispatcher();

  // Props
  export let imageUrl: string;
  export let aspectRatio: number | null = null;
  export let minWidth = 100;
  export let minHeight = 100;

  // State
  let canvas: HTMLCanvasElement;
  let context: CanvasRenderingContext2D;
  let image: HTMLImageElement;
  let isLoading = true;
  let error: string | null = null;

  // Crop state
  let cropX = 0;
  let cropY = 0;
  let cropWidth = 0;
  let cropHeight = 0;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let resizeHandle: string | null = null;
  let originalCrop = { x: 0, y: 0, width: 0, height: 0 };

  // Rotation and flip state
  let rotation = 0;
  let flipHorizontal = false;
  let flipVertical = false;

  // Preset aspect ratios
  const aspectRatios = [
    { label: 'Free', value: null },
    { label: 'Square', value: 1 },
    { label: '4:3', value: 4/3 },
    { label: '16:9', value: 16/9 },
    { label: '3:4', value: 3/4 },
    { label: '9:16', value: 9/16 }
  ];

  // Lifecycle
  onMount(async () => {
    try {
      // Initialize canvas
      context = canvas.getContext('2d')!;

      // Load image
      image = new Image();
      image.onload = () => {
        // Set canvas size
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;

        // Initialize crop area
        cropWidth = image.naturalWidth;
        cropHeight = image.naturalHeight;

        // Draw initial image
        drawImage();
        isLoading = false;

        // Track component mount
        analytics.trackEvent({
          type: 'image_cropper_opened',
          data: {
            imageWidth: image.naturalWidth,
            imageHeight: image.naturalHeight
          }
        });
      };
      image.onerror = () => {
        throw new Error('Failed to load image');
      };
      image.src = imageUrl;
    } catch (err) {
      console.error('Failed to initialize cropper:', err);
      error = 'Failed to load image. Please try again.';
    }
  });

  // Methods
  function drawImage() {
    if (!context || !image) return;

    // Clear canvas
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Save context state
    context.save();

    // Translate to center for rotation
    context.translate(canvas.width/2, canvas.height/2);

    // Apply rotation
    context.rotate((rotation * Math.PI) / 180);

    // Apply flips
    context.scale(
      flipHorizontal ? -1 : 1,
      flipVertical ? -1 : 1
    );

    // Draw image
    context.drawImage(
      image,
      -image.width/2,
      -image.height/2,
      image.width,
      image.height
    );

    // Restore context state
    context.restore();

    // Draw crop overlay
    drawCropOverlay();
  }

  function drawCropOverlay() {
    if (!context) return;

    // Draw semi-transparent overlay
    context.fillStyle = 'rgba(0, 0, 0, 0.5)';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Clear crop area
    context.clearRect(cropX, cropY, cropWidth, cropHeight);

    // Draw crop border
    context.strokeStyle = '#00a8ff';
    context.lineWidth = 2;
    context.strokeRect(cropX, cropY, cropWidth, cropHeight);

    // Draw resize handles
    const handleSize = 10;
    const handles = [
      { x: cropX - handleSize/2, y: cropY - handleSize/2, cursor: 'nw-resize' },
      { x: cropX + cropWidth/2 - handleSize/2, y: cropY - handleSize/2, cursor: 'n-resize' },
      { x: cropX + cropWidth - handleSize/2, y: cropY - handleSize/2, cursor: 'ne-resize' },
      { x: cropX + cropWidth - handleSize/2, y: cropY + cropHeight/2 - handleSize/2, cursor: 'e-resize' },
      { x: cropX + cropWidth - handleSize/2, y: cropY + cropHeight - handleSize/2, cursor: 'se-resize' },
      { x: cropX + cropWidth/2 - handleSize/2, y: cropY + cropHeight - handleSize/2, cursor: 's-resize' },
      { x: cropX - handleSize/2, y: cropY + cropHeight - handleSize/2, cursor: 'sw-resize' },
      { x: cropX - handleSize/2, y: cropY + cropHeight/2 - handleSize/2, cursor: 'w-resize' }
    ];

    handles.forEach(handle => {
      context.fillStyle = '#00a8ff';
      context.fillRect(handle.x, handle.y, handleSize, handleSize);
    });

    // Draw grid lines
    context.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    context.lineWidth = 1;

    // Vertical thirds
    context.beginPath();
    context.moveTo(cropX + cropWidth/3, cropY);
    context.lineTo(cropX + cropWidth/3, cropY + cropHeight);
    context.moveTo(cropX + (cropWidth/3)*2, cropY);
    context.lineTo(cropX + (cropWidth/3)*2, cropY + cropHeight);
    context.stroke();

    // Horizontal thirds
    context.beginPath();
    context.moveTo(cropX, cropY + cropHeight/3);
    context.lineTo(cropX + cropWidth, cropY + cropHeight/3);
    context.moveTo(cropX, cropY + (cropHeight/3)*2);
    context.lineTo(cropX + cropWidth, cropY + (cropHeight/3)*2);
    context.stroke();
  }

  function handleMouseDown(event: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Check if clicking on resize handle
    const handleSize = 10;
    const handles = [
      { x: cropX - handleSize/2, y: cropY - handleSize/2, handle: 'nw' },
      { x: cropX + cropWidth/2 - handleSize/2, y: cropY - handleSize/2, handle: 'n' },
      { x: cropX + cropWidth - handleSize/2, y: cropY - handleSize/2, handle: 'ne' },
      { x: cropX + cropWidth - handleSize/2, y: cropY + cropHeight/2 - handleSize/2, handle: 'e' },
      { x: cropX + cropWidth - handleSize/2, y: cropY + cropHeight - handleSize/2, handle: 'se' },
      { x: cropX + cropWidth/2 - handleSize/2, y: cropY + cropHeight - handleSize/2, handle: 's' },
      { x: cropX - handleSize/2, y: cropY + cropHeight - handleSize/2, handle: 'sw' },
      { x: cropX - handleSize/2, y: cropY + cropHeight/2 - handleSize/2, handle: 'w' }
    ];

    for (const handle of handles) {
      if (
        x >= handle.x &&
        x <= handle.x + handleSize &&
        y >= handle.y &&
        y <= handle.y + handleSize
      ) {
        resizeHandle = handle.handle;
        break;
      }
    }

    // Check if clicking inside crop area
    if (!resizeHandle && 
        x >= cropX && 
        x <= cropX + cropWidth && 
        y >= cropY && 
        y <= cropY + cropHeight) {
      isDragging = true;
    }

    dragStartX = x;
    dragStartY = y;
    originalCrop = { x: cropX, y: cropY, width: cropWidth, height: cropHeight };
  }

  function handleMouseMove(event: MouseEvent) {
    if (!isDragging && !resizeHandle) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const deltaX = x - dragStartX;
    const deltaY = y - dragStartY;

    if (isDragging) {
      // Move crop area
      cropX = Math.max(0, Math.min(canvas.width - cropWidth, originalCrop.x + deltaX));
      cropY = Math.max(0, Math.min(canvas.height - cropHeight, originalCrop.y + deltaY));
    } else if (resizeHandle) {
      // Resize crop area
      let newWidth = originalCrop.width;
      let newHeight = originalCrop.height;
      let newX = originalCrop.x;
      let newY = originalCrop.y;

      if (resizeHandle.includes('e')) {
        newWidth = Math.max(minWidth, originalCrop.width + deltaX);
        if (aspectRatio) {
          newHeight = newWidth / aspectRatio;
        }
      }
      if (resizeHandle.includes('w')) {
        const maxDeltaX = originalCrop.width - minWidth;
        const adjustedDeltaX = Math.max(-maxDeltaX, Math.min(originalCrop.x, deltaX));
        newWidth = Math.max(minWidth, originalCrop.width - adjustedDeltaX);
        newX = originalCrop.x + adjustedDeltaX;
        if (aspectRatio) {
          newHeight = newWidth / aspectRatio;
          newY = originalCrop.y + (originalCrop.height - newHeight) / 2;
        }
      }
      if (resizeHandle.includes('s')) {
        newHeight = Math.max(minHeight, originalCrop.height + deltaY);
        if (aspectRatio) {
          newWidth = newHeight * aspectRatio;
        }
      }
      if (resizeHandle.includes('n')) {
        const maxDeltaY = originalCrop.height - minHeight;
        const adjustedDeltaY = Math.max(-maxDeltaY, Math.min(originalCrop.y, deltaY));
        newHeight = Math.max(minHeight, originalCrop.height - adjustedDeltaY);
        newY = originalCrop.y + adjustedDeltaY;
        if (aspectRatio) {
          newWidth = newHeight * aspectRatio;
          newX = originalCrop.x + (originalCrop.width - newWidth) / 2;
        }
      }

      // Apply new dimensions while keeping within canvas bounds
      cropWidth = Math.min(canvas.width - cropX, newWidth);
      cropHeight = Math.min(canvas.height - cropY, newHeight);
      cropX = Math.max(0, Math.min(canvas.width - cropWidth, newX));
      cropY = Math.max(0, Math.min(canvas.height - cropHeight, newY));
    }

    drawImage();
  }

  function handleMouseUp() {
    isDragging = false;
    resizeHandle = null;
  }

  function rotate(degrees: number) {
    rotation = (rotation + degrees) % 360;
    drawImage();

    // Track rotation
    analytics.trackEvent({
      type: 'image_rotated',
      data: { degrees, totalRotation: rotation }
    });
  }

  function flip(direction: 'horizontal' | 'vertical') {
    if (direction === 'horizontal') {
      flipHorizontal = !flipHorizontal;
    } else {
      flipVertical = !flipVertical;
    }
    drawImage();

    // Track flip
    analytics.trackEvent({
      type: 'image_flipped',
      data: { direction }
    });
  }

  function setAspectRatio(ratio: number | null) {
    aspectRatio = ratio;
    if (ratio) {
      // Adjust crop area to match aspect ratio
      const currentRatio = cropWidth / cropHeight;
      if (currentRatio > ratio) {
        cropWidth = cropHeight * ratio;
      } else {
        cropHeight = cropWidth / ratio;
      }
      drawImage();
    }

    // Track aspect ratio change
    analytics.trackEvent({
      type: 'aspect_ratio_changed',
      data: { ratio }
    });
  }

  function handleSave() {
    // Create temporary canvas for cropped image
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = cropWidth;
    cropCanvas.height = cropHeight;
    const cropContext = cropCanvas.getContext('2d')!;

    // Draw cropped portion
    cropContext.drawImage(
      canvas,
      cropX, cropY, cropWidth, cropHeight,
      0, 0, cropWidth, cropHeight
    );

    // Convert to blob and create URL
    cropCanvas.toBlob(
      (blob) => {
        if (!blob) {
          error = 'Failed to save image. Please try again.';
          return;
        }

        // Track success
        analytics.trackEvent({
          type: 'image_cropped',
          data: {
            cropWidth,
            cropHeight,
            rotation,
            flipHorizontal,
            flipVertical
          }
        });

        dispatch('save', {
          url: URL.createObjectURL(blob),
          width: cropWidth,
          height: cropHeight,
          metadata: {
            crop: {
              x: cropX,
              y: cropY,
              width: cropWidth,
              height: cropHeight
            },
            rotation,
            flip: {
              horizontal: flipHorizontal,
              vertical: flipVertical
            }
          }
        });
      },
      'image/jpeg',
      0.95
    );
  }

  function handleCancel() {
    dispatch('cancel');
  }
</script>

<div class="image-cropper" transition:fade>
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

  <div class="cropper-content">
    <div class="canvas-container">
      <canvas
        bind:this={canvas}
        on:mousedown={handleMouseDown}
        on:mousemove={handleMouseMove}
        on:mouseup={handleMouseUp}
        on:mouseleave={handleMouseUp}
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
    </div>

    <div class="controls-section">
      <div class="control-group">
        <h3>Aspect Ratio</h3>
        <div class="aspect-ratio-buttons">
          {#each aspectRatios as ratio}
            <button
              class="aspect-ratio-button"
              class:active={aspectRatio === ratio.value}
              on:click={() => setAspectRatio(ratio.value)}
            >
              {ratio.label}
            </button>
          {/each}
        </div>
      </div>

      <div class="control-group">
        <h3>Rotation</h3>
        <div class="rotation-buttons">
          <button
            class="tool-button"
            on:click={() => rotate(-90)}
            title="Rotate Left"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path 
                stroke-linecap="round" 
                stroke-linejoin="round" 
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
          <button
            class="tool-button"
            on:click={() => rotate(90)}
            title="Rotate Right"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path 
                stroke-linecap="round" 
                stroke-linejoin="round" 
                stroke-width="2"
                d="M20 4v5h-.582m0 0a8.001 8.001 0 00-15.356 2m15.356-2H15M4 20v-5h.581m0 0a8.003 8.003 0 0015.357-2M4.581 15H9"
              />
            </svg>
          </button>
          <button
            class="tool-button"
            on:click={() => flip('horizontal')}
            title="Flip Horizontal"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path 
                stroke-linecap="round" 
                stroke-linejoin="round" 
                stroke-width="2"
                d="M7 16V4m10 12V4M3 8h18M3 16h18"
              />
            </svg>
          </button>
          <button
            class="tool-button"
            on:click={() => flip('vertical')}
            title="Flip Vertical"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path 
                stroke-linecap="round" 
                stroke-linejoin="round" 
                stroke-width="2"
                d="M8 7h8m-8 10h8M4 3v18M20 3v18"
              />
            </svg>
          </button>
        </div>
      </div>

      <div class="action-buttons">
        <button
          class="secondary-button"
          on:click={handleCancel}
        >
          Cancel
        </button>
        <button
          class="primary-button"
          on:click={handleSave}
          disabled={isLoading}
        >
          Save Changes
        </button>
      </div>
    </div>
  </div>
</div>

<style lang="postcss">
  .image-cropper {
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

  .cropper-content {
    display: flex;
    gap: 24px;
    padding: 24px;
    height: 100%;
    min-height: 0;
  }

  .canvas-container {
    position: relative;
    flex: 1;
    min-width: 0;
    background: var(--surface-color-light, #2a2a2a);
    border-radius: 8px;
    overflow: hidden;

    canvas {
      width: 100%;
      height: 100%;
      object-fit: contain;
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

    .spinner {
      width: 32px;
      height: 32px;
      animation: spin 1s linear infinite;
    }
  }

  .controls-section {
    width: 280px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .control-group {
    h3 {
      font-size: 14px;
      font-weight: 600;
      color: white;
      margin: 0 0 12px;
    }
  }

  .aspect-ratio-buttons {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .aspect-ratio-button {
    padding: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: none;
    border-radius: 6px;
    color: white;
    font-size: 12px;
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

  .rotation-buttons {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }

  .tool-button {
    aspect-ratio: 1;
    padding: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: none;
    border-radius: 6px;
    color: white;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    svg {
      width: 100%;
      height: 100%;
    }
  }

  .action-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: auto;
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

  @media (max-width: 768px) {
    .cropper-content {
      flex-direction: column;
      padding: 16px;
    }

    .controls-section {
      width: 100%;
    }
  }
</style> 