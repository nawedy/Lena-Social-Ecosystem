<!-- FileUpload.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let accept = '*';
  export let multiple = false;
  export let maxSize = 10 * 1024 * 1024; // 10MB default
  export let disabled = false;
  export let uploading = false;
  export let progress = 0;

  const dispatch = createEventDispatcher<{
    select: { files: File[] };
    error: { message: string };
  }>();

  let dragOver = false;
  let fileInput: HTMLInputElement;

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
    
    if (disabled || uploading) return;
    
    const files = Array.from(e.dataTransfer?.files || []);
    handleFiles(files);
  }

  function handleFileSelect(e: Event) {
    const files = Array.from((e.target as HTMLInputElement).files || []);
    handleFiles(files);
  }

  function handleFiles(files: File[]) {
    if (!multiple && files.length > 1) {
      dispatch('error', { message: 'Only one file can be uploaded at a time' });
      return;
    }

    const validFiles = files.filter(file => {
      if (file.size > maxSize) {
        dispatch('error', { message: `File ${file.name} is too large` });
        return false;
      }
      
      if (accept !== '*' && !accept.split(',').some(type => {
        if (type.startsWith('.')) {
          return file.name.endsWith(type);
        }
        return file.type.match(new RegExp(type.replace('*', '.*')));
      })) {
        dispatch('error', { message: `File ${file.name} type not allowed` });
        return false;
      }

      return true;
    });

    if (validFiles.length > 0) {
      dispatch('select', { files: validFiles });
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!disabled && !uploading) {
        fileInput.click();
      }
    }
  }
</script>

<div
  class="relative"
  role="region"
  aria-label="File upload"
>
  <input
    bind:this={fileInput}
    type="file"
    {accept}
    {multiple}
    class="hidden"
    on:change={handleFileSelect}
    disabled={disabled || uploading}
  />

  <div
    class="border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200"
    class:primary-border={dragOver}
    class:secondary-border={!dragOver}
    class:opacity-50={disabled || uploading}
    class:cursor-pointer={!disabled && !uploading}
    class:cursor-not-allowed={disabled || uploading}
    role="button"
    tabindex={disabled || uploading ? -1 : 0}
    aria-disabled={disabled || uploading}
    on:click={() => !disabled && !uploading && fileInput.click()}
    on:keydown={handleKeydown}
    on:dragover={handleDragOver}
    on:dragleave={handleDragLeave}
    on:drop={handleDrop}
  >
    {#if uploading}
      <div class="space-y-4">
        <div class="w-full bg-primary-900/50 rounded-full h-2">
          <div
            class="bg-primary-500 h-2 rounded-full transition-all duration-200"
            style="width: {progress}%"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-label="Upload progress"
          />
        </div>
        <p class="text-gray-400">Uploading... {progress}%</p>
      </div>
    {:else}
      <div class="space-y-2">
        <span class="text-4xl" aria-hidden="true">📁</span>
        <p class="text-gray-400">
          Drag and drop files here, or click to select
        </p>
        <p class="text-sm text-gray-500">
          {#if accept !== '*'}
            Accepted file types: {accept}
          {/if}
          {#if maxSize !== Infinity}
            • Max size: {(maxSize / 1024 / 1024).toFixed(0)}MB
          {/if}
        </p>
      </div>
    {/if}
  </div>
</div>

<style>
  .primary-border {
    @apply border-primary-500;
  }

  .secondary-border {
    @apply border-primary-900/50;
  }
</style> 