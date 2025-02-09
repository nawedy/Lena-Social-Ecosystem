&lt;script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { Button, Icon, Slider, Tabs } from '@tiktok-toe/ui-shared/components/ui';
  import { arFilterService } from '@tiktok-toe/shared/services/ar/ARFilterService';
  import type { ARFilter, ARSession } from '@tiktok-toe/shared/services/ar/ARFilterService';
  import * as THREE from 'three';

  export let initialFilter: ARFilter | null = null;

  const dispatch = createEventDispatcher<{
    complete: { filter: ARFilter };
    error: { message: string };
    cancel: void;
  }>();

  let sessionId: string | null = null;
  let currentFilter: ARFilter | null = initialFilter;
  let previewContainer: HTMLDivElement;
  let activeTab: 'filters' | 'adjustments' | 'effects' = 'filters';
  let loading = false;
  let error: string | null = null;
  let stats = {
    fps: 0,
    latency: 0,
    gpuMemory: 0
  };

  // Filter categories and presets
  const filterCategories = [
    { id: 'fun', name: 'Fun', icon: '😄' },
    { id: 'beauty', name: 'Beauty', icon: '✨' },
    { id: 'artistic', name: 'Artistic', icon: '🎨' },
    { id: 'masks', name: 'Masks', icon: '🎭' }
  ];

  const filterPresets: ARFilter[] = [
    {
      id: 'dog-ears',
      name: 'Dog Ears',
      description: 'Cute dog ears and nose',
      category: 'fun',
      assets: [
        {
          id: 'ears-model',
          type: '3d_model',
          url: '/models/dog-ears.glb',
          preload: true
        },
        {
          id: 'nose-texture',
          type: 'texture',
          url: '/textures/dog-nose.png',
          preload: true
        }
      ],
      settings: {
        position: new THREE.Vector3(0, 0.2, 0),
        rotation: new THREE.Euler(),
        scale: new THREE.Vector3(1, 1, 1),
        opacity: 1,
        blendMode: 'normal'
      },
      landmarks: [1, 33, 61, 291] // Ear and nose landmarks
    },
    {
      id: 'butterfly',
      name: 'Butterfly',
      description: 'Floating butterflies',
      category: 'artistic',
      assets: [
        {
          id: 'butterfly-model',
          type: '3d_model',
          url: '/models/butterfly.glb',
          preload: true
        }
      ],
      settings: {
        position: new THREE.Vector3(0, 0, -0.5),
        rotation: new THREE.Euler(),
        scale: new THREE.Vector3(0.5, 0.5, 0.5),
        opacity: 0.9,
        blendMode: 'screen',
        deformationStrength: 0.2
      }
    },
    {
      id: 'glam',
      name: 'Glam',
      description: 'Beauty enhancement filter',
      category: 'beauty',
      assets: [
        {
          id: 'beauty-shader',
          type: 'shader',
          url: '/shaders/beauty.glsl',
          preload: true
        }
      ],
      settings: {
        position: new THREE.Vector3(),
        rotation: new THREE.Euler(),
        scale: new THREE.Vector3(1, 1, 1),
        opacity: 0.8,
        blendMode: 'soft-light',
        colorAdjustments: {
          brightness: 1.1,
          contrast: 1.2,
          saturation: 1.1,
          hue: 0
        }
      }
    }
  ];

  let selectedCategory = filterCategories[0].id;
  let filteredPresets = filterPresets.filter(f => f.category === selectedCategory);

  // Stats update interval
  let statsInterval: number;

  onMount(async () => {
    try {
      if (currentFilter) {
        await startFilterSession(currentFilter);
      }

      // Start stats update
      statsInterval = window.setInterval(updateStats, 1000);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to initialize AR filter editor';
      dispatch('error', { message: error });
    }
  });

  onDestroy(() => {
    cleanup();
  });

  function cleanup() {
    if (sessionId) {
      arFilterService.stopSession(sessionId);
    }
    if (statsInterval) {
      clearInterval(statsInterval);
    }
  }

  async function startFilterSession(filter: ARFilter) {
    try {
      loading = true;
      error = null;

      // Stop existing session if any
      if (sessionId) {
        await arFilterService.stopSession(sessionId);
      }

      sessionId = await arFilterService.startSession(filter);
      currentFilter = filter;

      // Add renderer to preview container
      const session = arFilterService.getSession(sessionId);
      if (session && previewContainer) {
        const renderer = (arFilterService as any).renderer;
        previewContainer.appendChild(renderer.domElement);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to start filter session';
      dispatch('error', { message: error });
    } finally {
      loading = false;
    }
  }

  function updateStats() {
    if (!sessionId) return;

    const session = arFilterService.getSession(sessionId);
    if (session) {
      stats = { ...session.stats };
    }
  }

  async function applyFilter(filter: ARFilter) {
    await startFilterSession(filter);
  }

  async function updateFilterSettings(updates: Partial<ARFilter['settings']>) {
    if (!sessionId || !currentFilter) return;

    try {
      await arFilterService.updateFilter(sessionId, {
        settings: {
          ...currentFilter.settings,
          ...updates
        }
      });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to update filter settings';
      dispatch('error', { message: error });
    }
  }

  function handleComplete() {
    if (currentFilter) {
      dispatch('complete', { filter: currentFilter });
    }
  }

  $: filteredPresets = filterPresets.filter(f => f.category === selectedCategory);
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
    <div class="flex-1 relative bg-black">
      <div
        bind:this={previewContainer}
        class="w-full h-full"
      />

      <!-- Loading Overlay -->
      {#if loading}
        <div
          class="absolute inset-0 bg-black/50 flex items-center justify-center"
          transition:fade
        >
          <div class="text-white text-xl">Loading filter...</div>
        </div>
      {/if}

      <!-- Stats Overlay -->
      <div
        class="absolute top-4 left-4 bg-black/50 text-white text-sm px-3 py-2 rounded-lg"
        transition:slide
      >
        <div>FPS: {stats.fps.toFixed(1)}</div>
        <div>Latency: {stats.latency.toFixed(1)}ms</div>
      </div>
    </div>

    <!-- Controls Panel -->
    <div class="w-96 bg-gray-900 p-6 overflow-y-auto">
      <Tabs
        items={[
          { id: 'filters', label: 'Filters' },
          { id: 'adjustments', label: 'Adjustments' },
          { id: 'effects', label: 'Effects' }
        ]}
        bind:selected={activeTab}
      />

      <div class="mt-6">
        {#if activeTab === 'filters'}
          <!-- Filter Categories -->
          <div class="grid grid-cols-4 gap-2 mb-6">
            {#each filterCategories as category}
              <button
                class="aspect-square rounded-lg p-2 flex flex-col items-center justify-center gap-1 transition-colors"
                class:bg-primary-500={selectedCategory === category.id}
                class:bg-gray-800={selectedCategory !== category.id}
                on:click={() => selectedCategory = category.id}
              >
                <span class="text-2xl">{category.icon}</span>
                <span class="text-xs text-white">{category.name}</span>
              </button>
            {/each}
          </div>

          <!-- Filter Presets -->
          <div class="grid grid-cols-2 gap-4">
            {#each filteredPresets as filter}
              <button
                class="aspect-square bg-gray-800 rounded-lg p-2 hover:bg-gray-700 transition-colors"
                on:click={() => applyFilter(filter)}
              >
                <div
                  class="w-full h-full bg-center bg-cover rounded"
                  style="background-image: url('/filter-previews/{filter.id}.jpg')"
                />
                <span class="mt-2 block text-sm text-white">{filter.name}</span>
              </button>
            {/each}
          </div>

        {:else if activeTab === 'adjustments'}
          <!-- Filter Adjustments -->
          {#if currentFilter}
            <div class="space-y-6">
              <div class="space-y-4">
                <h3 class="text-lg font-medium text-white">Position</h3>
                <div class="grid grid-cols-3 gap-2">
                  <div>
                    <label class="text-sm text-gray-400">X</label>
                    <Slider
                      min={-1}
                      max={1}
                      step={0.1}
                      value={currentFilter.settings.position.x}
                      on:change={(e) => updateFilterSettings({
                        position: new THREE.Vector3(
                          e.detail,
                          currentFilter.settings.position.y,
                          currentFilter.settings.position.z
                        )
                      })}
                    />
                  </div>
                  <div>
                    <label class="text-sm text-gray-400">Y</label>
                    <Slider
                      min={-1}
                      max={1}
                      step={0.1}
                      value={currentFilter.settings.position.y}
                      on:change={(e) => updateFilterSettings({
                        position: new THREE.Vector3(
                          currentFilter.settings.position.x,
                          e.detail,
                          currentFilter.settings.position.z
                        )
                      })}
                    />
                  </div>
                  <div>
                    <label class="text-sm text-gray-400">Z</label>
                    <Slider
                      min={-1}
                      max={1}
                      step={0.1}
                      value={currentFilter.settings.position.z}
                      on:change={(e) => updateFilterSettings({
                        position: new THREE.Vector3(
                          currentFilter.settings.position.x,
                          currentFilter.settings.position.y,
                          e.detail
                        )
                      })}
                    />
                  </div>
                </div>
              </div>

              <div class="space-y-4">
                <h3 class="text-lg font-medium text-white">Scale</h3>
                <div class="grid grid-cols-3 gap-2">
                  <div>
                    <label class="text-sm text-gray-400">X</label>
                    <Slider
                      min={0.1}
                      max={2}
                      step={0.1}
                      value={currentFilter.settings.scale.x}
                      on:change={(e) => updateFilterSettings({
                        scale: new THREE.Vector3(
                          e.detail,
                          currentFilter.settings.scale.y,
                          currentFilter.settings.scale.z
                        )
                      })}
                    />
                  </div>
                  <div>
                    <label class="text-sm text-gray-400">Y</label>
                    <Slider
                      min={0.1}
                      max={2}
                      step={0.1}
                      value={currentFilter.settings.scale.y}
                      on:change={(e) => updateFilterSettings({
                        scale: new THREE.Vector3(
                          currentFilter.settings.scale.x,
                          e.detail,
                          currentFilter.settings.scale.z
                        )
                      })}
                    />
                  </div>
                  <div>
                    <label class="text-sm text-gray-400">Z</label>
                    <Slider
                      min={0.1}
                      max={2}
                      step={0.1}
                      value={currentFilter.settings.scale.z}
                      on:change={(e) => updateFilterSettings({
                        scale: new THREE.Vector3(
                          currentFilter.settings.scale.x,
                          currentFilter.settings.scale.y,
                          e.detail
                        )
                      })}
                    />
                  </div>
                </div>
              </div>

              <div class="space-y-4">
                <h3 class="text-lg font-medium text-white">Rotation</h3>
                <div class="grid grid-cols-3 gap-2">
                  <div>
                    <label class="text-sm text-gray-400">X</label>
                    <Slider
                      min={-Math.PI}
                      max={Math.PI}
                      step={0.1}
                      value={currentFilter.settings.rotation.x}
                      on:change={(e) => updateFilterSettings({
                        rotation: new THREE.Euler(
                          e.detail,
                          currentFilter.settings.rotation.y,
                          currentFilter.settings.rotation.z
                        )
                      })}
                    />
                  </div>
                  <div>
                    <label class="text-sm text-gray-400">Y</label>
                    <Slider
                      min={-Math.PI}
                      max={Math.PI}
                      step={0.1}
                      value={currentFilter.settings.rotation.y}
                      on:change={(e) => updateFilterSettings({
                        rotation: new THREE.Euler(
                          currentFilter.settings.rotation.x,
                          e.detail,
                          currentFilter.settings.rotation.z
                        )
                      })}
                    />
                  </div>
                  <div>
                    <label class="text-sm text-gray-400">Z</label>
                    <Slider
                      min={-Math.PI}
                      max={Math.PI}
                      step={0.1}
                      value={currentFilter.settings.rotation.z}
                      on:change={(e) => updateFilterSettings({
                        rotation: new THREE.Euler(
                          currentFilter.settings.rotation.x,
                          currentFilter.settings.rotation.y,
                          e.detail
                        )
                      })}
                    />
                  </div>
                </div>
              </div>

              <div class="space-y-4">
                <h3 class="text-lg font-medium text-white">Appearance</h3>
                <div>
                  <label class="text-sm text-gray-400">Opacity</label>
                  <Slider
                    min={0}
                    max={1}
                    step={0.1}
                    value={currentFilter.settings.opacity}
                    on:change={(e) => updateFilterSettings({ opacity: e.detail })}
                  />
                </div>
                <div>
                  <label class="text-sm text-gray-400">Blend Mode</label>
                  <select
                    class="w-full bg-gray-800 text-white px-3 py-2 rounded-lg"
                    value={currentFilter.settings.blendMode}
                    on:change={(e) => updateFilterSettings({ blendMode: e.currentTarget.value })}
                  >
                    <option value="normal">Normal</option>
                    <option value="multiply">Multiply</option>
                    <option value="screen">Screen</option>
                    <option value="overlay">Overlay</option>
                    <option value="soft-light">Soft Light</option>
                  </select>
                </div>
              </div>
            </div>
          {/if}

        {:else if activeTab === 'effects'}
          <!-- Special Effects -->
          {#if currentFilter}
            <div class="space-y-6">
              {#if currentFilter.settings.deformationStrength !== undefined}
                <div>
                  <label class="text-sm text-gray-400">Deformation Strength</label>
                  <Slider
                    min={0}
                    max={1}
                    step={0.1}
                    value={currentFilter.settings.deformationStrength}
                    on:change={(e) => updateFilterSettings({ deformationStrength: e.detail })}
                  />
                </div>
              {/if}

              {#if currentFilter.settings.colorAdjustments}
                <div class="space-y-4">
                  <h3 class="text-lg font-medium text-white">Color Adjustments</h3>
                  <div>
                    <label class="text-sm text-gray-400">Brightness</label>
                    <Slider
                      min={0.5}
                      max={1.5}
                      step={0.1}
                      value={currentFilter.settings.colorAdjustments.brightness}
                      on:change={(e) => updateFilterSettings({
                        colorAdjustments: {
                          ...currentFilter.settings.colorAdjustments,
                          brightness: e.detail
                        }
                      })}
                    />
                  </div>
                  <div>
                    <label class="text-sm text-gray-400">Contrast</label>
                    <Slider
                      min={0.5}
                      max={1.5}
                      step={0.1}
                      value={currentFilter.settings.colorAdjustments.contrast}
                      on:change={(e) => updateFilterSettings({
                        colorAdjustments: {
                          ...currentFilter.settings.colorAdjustments,
                          contrast: e.detail
                        }
                      })}
                    />
                  </div>
                  <div>
                    <label class="text-sm text-gray-400">Saturation</label>
                    <Slider
                      min={0}
                      max={2}
                      step={0.1}
                      value={currentFilter.settings.colorAdjustments.saturation}
                      on:change={(e) => updateFilterSettings({
                        colorAdjustments: {
                          ...currentFilter.settings.colorAdjustments,
                          saturation: e.detail
                        }
                      })}
                    />
                  </div>
                  <div>
                    <label class="text-sm text-gray-400">Hue</label>
                    <Slider
                      min={-Math.PI}
                      max={Math.PI}
                      step={0.1}
                      value={currentFilter.settings.colorAdjustments.hue}
                      on:change={(e) => updateFilterSettings({
                        colorAdjustments: {
                          ...currentFilter.settings.colorAdjustments,
                          hue: e.detail
                        }
                      })}
                    />
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        {/if}
      </div>

      <!-- Apply Button -->
      <div class="mt-8">
        <Button
          variant="primary"
          class="w-full"
          disabled={!currentFilter || loading}
          on:click={handleComplete}
        >
          Apply Filter
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