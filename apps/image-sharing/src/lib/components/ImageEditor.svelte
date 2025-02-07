<!-- ImageEditor.svelte -->
<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { Button, Slider, Icon } from '@lena/ui';
  import Cropper from 'cropperjs';
  import 'cropperjs/dist/cropper.css';

  export let imageUrl: string;
  export let aspectRatio: number | null = null;

  const dispatch = createEventDispatcher();
  let imageElement: HTMLImageElement;
  let cropper: Cropper;
  let currentFilter = 'none';
  let brightness = 100;
  let contrast = 100;
  let saturation = 100;

  const filters = [
    { id: 'none', label: 'Normal' },
    { id: 'grayscale', label: 'B&W' },
    { id: 'sepia', label: 'Sepia' },
    { id: 'vintage', label: 'Vintage' },
    { id: 'warm', label: 'Warm' },
    { id: 'cool', label: 'Cool' }
  ];

  const filterStyles = {
    none: '',
    grayscale: 'grayscale(100%)',
    sepia: 'sepia(100%)',
    vintage: 'sepia(50%) hue-rotate(-30deg) saturate(140%)',
    warm: 'sepia(30%) saturate(140%) hue-rotate(10deg)',
    cool: 'saturate(110%) hue-rotate(-10deg)'
  };

  onMount(() => {
    cropper = new Cropper(imageElement, {
      aspectRatio,
      viewMode: 1,
      dragMode: 'move',
      autoCropArea: 1,
      cropBoxMovable: true,
      cropBoxResizable: true,
      guides: true,
      center: true,
      highlight: false,
      background: false,
      zoomOnTouch: false,
      zoomOnWheel: false
    });
  });

  function applyAdjustments() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const croppedCanvas = cropper.getCroppedCanvas();
    
    canvas.width = croppedCanvas.width;
    canvas.height = croppedCanvas.height;
    
    ctx.filter = `
      ${filterStyles[currentFilter]}
      brightness(${brightness}%)
      contrast(${contrast}%)
      saturate(${saturation}%)
    `;
    
    ctx.drawImage(croppedCanvas, 0, 0);
    
    canvas.toBlob((blob) => {
      dispatch('save', { 
        blob,
        dataUrl: canvas.toDataURL('image/jpeg', 0.9)
      });
    }, 'image/jpeg', 0.9);
  }

  function handleReset() {
    currentFilter = 'none';
    brightness = 100;
    contrast = 100;
    saturation = 100;
    cropper.reset();
  }
</script>

<div class="space-y-6">
  <!-- Image Preview -->
  <div class="relative aspect-square bg-gray-900 rounded-lg overflow-hidden">
    <img
      bind:this={imageElement}
      src={imageUrl}
      alt="Edit preview"
      class="max-w-full"
      style="filter: {filterStyles[currentFilter]}
             brightness({brightness}%)
             contrast({contrast}%)
             saturate({saturation}%)"
    />
  </div>

  <!-- Filter Options -->
  <div class="flex gap-4 overflow-x-auto pb-2">
    {#each filters as filter}
      <button
        class="flex flex-col items-center min-w-[64px] gap-2"
        class:text-primary-400={currentFilter === filter.id}
        on:click={() => currentFilter = filter.id}
      >
        <div 
          class="w-16 h-16 rounded-lg bg-gray-800 overflow-hidden"
          style="filter: {filterStyles[filter.id]}"
        >
          <img
            src={imageUrl}
            alt={filter.label}
            class="w-full h-full object-cover"
          />
        </div>
        <span class="text-sm">{filter.label}</span>
      </button>
    {/each}
  </div>

  <!-- Adjustments -->
  <div class="space-y-4">
    <div>
      <label class="text-sm text-gray-400">Brightness</label>
      <Slider
        bind:value={brightness}
        min={0}
        max={200}
        step={1}
      />
    </div>
    <div>
      <label class="text-sm text-gray-400">Contrast</label>
      <Slider
        bind:value={contrast}
        min={0}
        max={200}
        step={1}
      />
    </div>
    <div>
      <label class="text-sm text-gray-400">Saturation</label>
      <Slider
        bind:value={saturation}
        min={0}
        max={200}
        step={1}
      />
    </div>
  </div>

  <!-- Actions -->
  <div class="flex gap-4">
    <Button
      variant="secondary"
      class="flex-1"
      on:click={handleReset}
    >
      Reset
    </Button>
    <Button
      variant="primary"
      class="flex-1"
      on:click={applyAdjustments}
    >
      Apply
    </Button>
  </div>
</div>

<style>
  :global(.cropper-crop-box) {
    border-radius: 8px;
  }
</style> 