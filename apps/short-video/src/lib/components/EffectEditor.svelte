<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { VideoPlayer } from '@tiktok-toe/ui-shared/components';
  import { Button, Icon, Slider, Tabs } from '@tiktok-toe/ui-shared/components/ui';
  import { effectService } from '@tiktok-toe/shared/services/video/EffectService';
  import type { Effect, FilterPreset, TransitionPreset } from '@tiktok-toe/shared/services/video/EffectService';

  export let videoId: string;
  export let videoUrl: string;

  const dispatch = createEventDispatcher<{
    complete: { outputUrl: string };
    error: { message: string };
    cancel: void;
  }>();

  let sessionId: string | null = null;
  let processing = false;
  let error: string | null = null;
  let activeTab: 'effects' | 'filters' | 'transitions' = 'effects';
  let selectedEffect: Effect | null = null;
  let filterPresets: FilterPreset[] = [];
  let transitionPresets: TransitionPreset[] = [];
  let previewCanvas: HTMLCanvasElement;
  let previewCtx: CanvasRenderingContext2D;

  onMount(async () => {
    try {
      // Initialize session
      sessionId = await effectService.createSession(videoId);

      // Load presets
      filterPresets = effectService.getFilterPresets();
      transitionPresets = effectService.getTransitionPresets();

      // Set up preview canvas
      previewCtx = previewCanvas.getContext('2d')!;
      setupPreview();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to initialize effect editor';
      dispatch('error', { message: error });
    }
  });

  onDestroy(() => {
    cleanup();
  });

  function cleanup() {
    if (sessionId) {
      effectService.cleanup();
    }
  }

  function setupPreview() {
    const video = document.createElement('video');
    video.src = videoUrl;
    video.muted = true;
    video.loop = true;

    video.onloadedmetadata = () => {
      previewCanvas.width = video.videoWidth;
      previewCanvas.height = video.videoHeight;
      video.play();

      // Start render loop
      function render() {
        if (!previewCtx) return;
        previewCtx.drawImage(video, 0, 0);
        applyEffects();
        requestAnimationFrame(render);
      }
      render();
    };
  }

  function applyEffects() {
    if (!sessionId || !previewCtx) return;

    const session = effectService.getSession(sessionId);
    if (!session) return;

    // Apply filters
    session.filters.forEach(filter => {
      applyFilter(filter);
    });

    // Apply effects
    session.effects.forEach(effect => {
      applyEffect(effect);
    });
  }

  function applyFilter(filter: FilterPreset) {
    if (!previewCtx) return;

    const imageData = previewCtx.getImageData(
      0, 0,
      previewCanvas.width,
      previewCanvas.height
    );

    // Apply filter settings
    if (filter.settings.brightness) {
      adjustBrightness(imageData, filter.settings.brightness);
    }
    if (filter.settings.contrast) {
      adjustContrast(imageData, filter.settings.contrast);
    }
    if (filter.settings.saturation) {
      adjustSaturation(imageData, filter.settings.saturation);
    }
    // ... apply other filter settings

    previewCtx.putImageData(imageData, 0, 0);
  }

  function applyEffect(effect: Effect) {
    if (!previewCtx) return;

    switch (effect.type) {
      case 'text':
        applyTextEffect(effect);
        break;
      case 'sticker':
        applyStickerEffect(effect);
        break;
      case 'overlay':
        applyOverlayEffect(effect);
        break;
      // ... handle other effect types
    }
  }

  function adjustBrightness(imageData: ImageData, value: number) {
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] *= value;     // red
      d[i + 1] *= value; // green
      d[i + 2] *= value; // blue
    }
  }

  function adjustContrast(imageData: ImageData, value: number) {
    const d = imageData.data;
    const factor = (259 * (value + 255)) / (255 * (259 - value));
    for (let i = 0; i < d.length; i += 4) {
      d[i] = factor * (d[i] - 128) + 128;
      d[i + 1] = factor * (d[i + 1] - 128) + 128;
      d[i + 2] = factor * (d[i + 2] - 128) + 128;
    }
  }

  function adjustSaturation(imageData: ImageData, value: number) {
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.2989 * d[i] + 0.5870 * d[i + 1] + 0.1140 * d[i + 2];
      d[i] = gray + value * (d[i] - gray);
      d[i + 1] = gray + value * (d[i + 1] - gray);
      d[i + 2] = gray + value * (d[i + 2] - gray);
    }
  }

  function applyTextEffect(effect: Effect) {
    if (!previewCtx) return;
    const { text, font, size, color } = effect.config;
    const { x, y } = effect.position || { x: 0, y: 0 };

    previewCtx.font = `${size}px ${font}`;
    previewCtx.fillStyle = color;
    previewCtx.fillText(text, x, y);
  }

  function applyStickerEffect(effect: Effect) {
    if (!previewCtx) return;
    const { imageUrl } = effect.config;
    const { x, y } = effect.position || { x: 0, y: 0 };
    const { scale = 1, rotation = 0 } = effect;

    const image = new Image();
    image.src = imageUrl;
    image.onload = () => {
      previewCtx.save();
      previewCtx.translate(x, y);
      previewCtx.rotate(rotation);
      previewCtx.scale(scale, scale);
      previewCtx.drawImage(image, -image.width / 2, -image.height / 2);
      previewCtx.restore();
    };
  }

  function applyOverlayEffect(effect: Effect) {
    if (!previewCtx) return;
    const { color, blendMode } = effect.config;
    const { opacity = 1 } = effect;

    previewCtx.save();
    previewCtx.globalAlpha = opacity;
    previewCtx.globalCompositeOperation = blendMode;
    previewCtx.fillStyle = color;
    previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
    previewCtx.restore();
  }

  async function addEffect(type: Effect['type'], config: Record<string, any>) {
    if (!sessionId) return;

    try {
      const effectId = await effectService.addEffect(sessionId, {
        type,
        name: `${type} effect`,
        config
      });

      const session = effectService.getSession(sessionId);
      selectedEffect = session?.effects.find(e => e.id === effectId) || null;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to add effect';
      dispatch('error', { message: error });
    }
  }

  async function updateSelectedEffect(updates: Partial<Effect>) {
    if (!sessionId || !selectedEffect) return;

    try {
      await effectService.updateEffect(sessionId, selectedEffect.id, updates);
      const session = effectService.getSession(sessionId);
      selectedEffect = session?.effects.find(e => e.id === selectedEffect.id) || null;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to update effect';
      dispatch('error', { message: error });
    }
  }

  async function removeSelectedEffect() {
    if (!sessionId || !selectedEffect) return;

    try {
      await effectService.removeEffect(sessionId, selectedEffect.id);
      selectedEffect = null;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to remove effect';
      dispatch('error', { message: error });
    }
  }

  async function applyFilterPreset(filterId: string) {
    if (!sessionId) return;

    try {
      await effectService.applyFilter(sessionId, filterId);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to apply filter';
      dispatch('error', { message: error });
    }
  }

  async function addTransitionPreset(transitionId: string) {
    if (!sessionId) return;

    try {
      await effectService.addTransition(sessionId, transitionId);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to add transition';
      dispatch('error', { message: error });
    }
  }

  async function processVideo() {
    if (!sessionId) return;

    try {
      processing = true;
      error = null;

      const outputUrl = await effectService.processVideo(sessionId);
      dispatch('complete', { outputUrl });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to process video';
      dispatch('error', { message: error });
    } finally {
      processing = false;
    }
  }
</script>

<div class="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
  <div class="relative w-full max-w-6xl h-[90vh] flex">
    <!-- Close Button -->
    <button
      class="absolute -top-12 right-0 text-white hover:text-primary-400 transition-colors"
      on:click={() => dispatch('cancel')}
    >
      <Icon name="x" class="w-8 h-8" />
    </button>

    <!-- Preview Area -->
    <div class="flex-1 relative">
      <canvas
        bind:this={previewCanvas}
        class="w-full h-full object-contain bg-black"
      />

      {#if selectedEffect?.type === 'text' || selectedEffect?.type === 'sticker'}
        <div
          class="absolute inset-0"
          on:mousedown|preventDefault|stopPropagation
          on:mousemove|preventDefault|stopPropagation
          on:mouseup|preventDefault|stopPropagation
        >
          <!-- Draggable effect overlay -->
        </div>
      {/if}
    </div>

    <!-- Controls Panel -->
    <div class="w-96 bg-gray-900 p-6 overflow-y-auto">
      <Tabs
        items={[
          { id: 'effects', label: 'Effects' },
          { id: 'filters', label: 'Filters' },
          { id: 'transitions', label: 'Transitions' }
        ]}
        bind:selected={activeTab}
      />

      <div class="mt-6">
        {#if activeTab === 'effects'}
          <!-- Effects Panel -->
          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                on:click={() => addEffect('text', {
                  text: 'New Text',
                  font: 'Arial',
                  size: 24,
                  color: '#ffffff'
                })}
              >
                Add Text
              </Button>
              <Button
                variant="secondary"
                on:click={() => addEffect('sticker', {
                  imageUrl: '/stickers/default.png'
                })}
              >
                Add Sticker
              </Button>
              <Button
                variant="secondary"
                on:click={() => addEffect('overlay', {
                  color: '#000000',
                  blendMode: 'multiply'
                })}
              >
                Add Overlay
              </Button>
            </div>

            {#if selectedEffect}
              <div class="mt-8 space-y-4">
                <h3 class="text-lg font-medium text-white">Effect Settings</h3>

                {#if selectedEffect.type === 'text'}
                  <div class="space-y-2">
                    <input
                      type="text"
                      class="w-full bg-gray-800 text-white px-3 py-2 rounded-lg"
                      value={selectedEffect.config.text}
                      on:input={(e) => updateSelectedEffect({
                        config: { ...selectedEffect.config, text: e.currentTarget.value }
                      })}
                    />
                    <div class="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        class="bg-gray-800 text-white px-3 py-2 rounded-lg"
                        value={selectedEffect.config.size}
                        on:input={(e) => updateSelectedEffect({
                          config: { ...selectedEffect.config, size: parseInt(e.currentTarget.value) }
                        })}
                      />
                      <input
                        type="color"
                        class="w-full bg-gray-800 rounded-lg"
                        value={selectedEffect.config.color}
                        on:input={(e) => updateSelectedEffect({
                          config: { ...selectedEffect.config, color: e.currentTarget.value }
                        })}
                      />
                    </div>
                  </div>
                {/if}

                {#if selectedEffect.type === 'overlay'}
                  <div class="space-y-2">
                    <input
                      type="color"
                      class="w-full bg-gray-800 rounded-lg"
                      value={selectedEffect.config.color}
                      on:input={(e) => updateSelectedEffect({
                        config: { ...selectedEffect.config, color: e.currentTarget.value }
                      })}
                    />
                    <select
                      class="w-full bg-gray-800 text-white px-3 py-2 rounded-lg"
                      value={selectedEffect.config.blendMode}
                      on:change={(e) => updateSelectedEffect({
                        config: { ...selectedEffect.config, blendMode: e.currentTarget.value }
                      })}
                    >
                      <option value="multiply">Multiply</option>
                      <option value="screen">Screen</option>
                      <option value="overlay">Overlay</option>
                      <option value="darken">Darken</option>
                      <option value="lighten">Lighten</option>
                    </select>
                    <Slider
                      label="Opacity"
                      min={0}
                      max={1}
                      step={0.1}
                      value={selectedEffect.opacity || 1}
                      on:change={(e) => updateSelectedEffect({ opacity: e.detail })}
                    />
                  </div>
                {/if}

                <Button
                  variant="danger"
                  class="w-full"
                  on:click={removeSelectedEffect}
                >
                  Remove Effect
                </Button>
              </div>
            {/if}
          </div>

        {:else if activeTab === 'filters'}
          <!-- Filters Panel -->
          <div class="grid grid-cols-2 gap-4">
            {#each filterPresets as filter}
              <button
                class="aspect-square bg-gray-800 rounded-lg p-2 hover:bg-gray-700 transition-colors"
                on:click={() => applyFilterPreset(filter.id)}
              >
                <div class="w-full h-full bg-center bg-cover rounded"
                  style="background-image: url('/filter-previews/{filter.id}.jpg')"
                />
                <span class="mt-2 block text-sm text-white">{filter.name}</span>
              </button>
            {/each}
          </div>

        {:else}
          <!-- Transitions Panel -->
          <div class="grid grid-cols-2 gap-4">
            {#each transitionPresets as transition}
              <button
                class="aspect-video bg-gray-800 rounded-lg p-2 hover:bg-gray-700 transition-colors"
                on:click={() => addTransitionPreset(transition.id)}
              >
                <div class="w-full h-full bg-center bg-cover rounded"
                  style="background-image: url('/transition-previews/{transition.id}.jpg')"
                />
                <span class="mt-2 block text-sm text-white">{transition.name}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Process Button -->
      <div class="mt-8">
        <Button
          variant="primary"
          class="w-full"
          disabled={processing}
          on:click={processVideo}
        >
          {#if processing}
            Processing...
          {:else}
            Apply Effects
          {/if}
        </Button>
      </div>
    </div>
  </div>

  <!-- Error Message -->
  {#if error}
    <div
      class="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg"
      transition:slide
    >
      {error}
    </div>
  {/if}
</div> 