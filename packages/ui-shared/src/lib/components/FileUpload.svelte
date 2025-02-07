<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { toasts } from '../stores/toasts';

  export let accept = '*/*';
  export let maxSize = 10 * 1024 * 1024; // 10MB
  export let multiple = false;
  export let disabled = false;
  export let preview = true;
  export let progress = 0;

  let dragOver = false;
  let fileInput: HTMLInputElement;
  let previewUrls: string[] = [];

  const dispatch = createEventDispatcher<{
    change: { files: FileList | null };
    progress: { progress: number };
  }>();

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    dragOver = true;
  }

  function handleDragLeave() {
    dragOver = false;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    if (disabled) return;

    const files = e.dataTransfer?.files;
    if (files) handleFiles(files);
  }

  function handleFileSelect() {
    const files = fileInput?.files;
    if (files) handleFiles(files);
  }

  async function handleFiles(files: FileList) {
    if (!validateFiles(files)) return;

    // Clear previous previews if not multiple
    if (!multiple) previewUrls = [];

    // Generate previews
    if (preview) {
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          const url = URL.createObjectURL(file);
          previewUrls = [...previewUrls, url];
        }
      }
    }

    dispatch('change', { files });
  }

  function validateFiles(files: FileList): boolean {
    for (const file of files) {
      if (file.size > maxSize) {
        toasts.error(`File ${file.name} is too large. Maximum size is ${maxSize / 1024 / 1024}MB`);
        return false;
      }

      if (!file.type.match(accept.replace('*', '.*'))) {
        toasts.error(`File ${file.name} is not of accepted type`);
        return false;
      }
    }
    return true;
  }

  function clearFiles() {
    if (fileInput) fileInput.value = '';
    previewUrls.forEach(URL.revokeObjectURL);
    previewUrls = [];
    dispatch('change', { files: null });
  }

  $: containerClasses = [
    'relative border-2 border-dashed rounded-lg p-6 transition-colors duration-200 text-center',
    dragOver ? 'border-primary-500 bg-primary-500/10' : 'border-primary-900/50',
    disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
    '$$props.class'
  ].join(' ');
</script>

<div
  class={containerClasses}
  on:dragover={handleDragOver}
  on:dragleave={handleDragLeave}
  on:drop={handleDrop}
  on:click={() => !disabled && fileInput.click()}
  role="button"
  tabindex="0"
>
  <input
    bind:this={fileInput}
    type="file"
    {accept}
    {multiple}
    {disabled}
    class="hidden"
    on:change={handleFileSelect}
  />

  {#if progress > 0}
    <div class="mb-4">
      <div class="h-2 bg-primary-900/50 rounded-full overflow-hidden">
        <div
          class="h-full bg-primary-500 transition-all duration-200"
          style="width: {progress}%"
        />
      </div>
      <p class="text-sm mt-1">{progress}% uploaded</p>
    </div>
  {/if}

  <slot>
    <div class="space-y-2">
      <p class="text-lg">
        {#if dragOver}
          Drop files here
        {:else}
          Drag and drop files here, or click to select
        {/if}
      </p>
      <p class="text-sm text-gray-400">
        Maximum file size: {maxSize / 1024 / 1024}MB
      </p>
    </div>
  </slot>

  {#if preview && previewUrls.length > 0}
    <div class="mt-4 grid grid-cols-3 gap-4">
      {#each previewUrls as url}
        <div class="relative aspect-square">
          <img
            src={url}
            alt="Preview"
            class="w-full h-full object-cover rounded-lg"
          />
          <button
            class="absolute top-1 right-1 p-1 rounded-full bg-black/50 hover:bg-black/75 text-white"
            on:click|stopPropagation={clearFiles}
          >
            ×
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div> 