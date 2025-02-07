<!-- ImageUpload.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  import { Icon } from '$lib/components/ui';

  export let files: File[] = [];
  export let maxFiles = 5;
  export let maxSize = 5 * 1024 * 1024; // 5MB
  export let accept = 'image/*';
  export let disabled = false;

  const dispatch = createEventDispatcher();
  let dragOver = false;
  let error: string | null = null;

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    dragOver = true;
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;

    if (disabled) return;

    const droppedFiles = Array.from(e.dataTransfer?.files || [])
      .filter(file => file.type.startsWith('image/'));

    handleFiles(droppedFiles);
  }

  function handleFileInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const selectedFiles = Array.from(input.files || []);
    handleFiles(selectedFiles);
    input.value = ''; // Reset input
  }

  function handleFiles(newFiles: File[]) {
    error = null;

    // Check file count
    if (files.length + newFiles.length > maxFiles) {
      error = `Maximum ${maxFiles} files allowed`;
      return;
    }

    // Validate each file
    const validFiles = newFiles.filter(file => {
      // Check file type
      if (!file.type.startsWith('image/')) {
        error = 'Only image files are allowed';
        return false;
      }

      // Check file size
      if (file.size > maxSize) {
        error = `File size must be less than ${formatSize(maxSize)}`;
        return false;
      }

      return true;
    });

    files = [...files, ...validFiles];
    dispatch('change', files);
  }

  function removeFile(index: number) {
    files = files.filter((_, i) => i !== index);
    dispatch('change', files);
  }

  function formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  function getImagePreview(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
</script>

<div class="space-y-4">
  <!-- Dropzone -->
  <div
    class="relative border-2 border-dashed rounded-lg p-8 text-center transition-colors"
    class:border-emerald-500={dragOver}
    class:bg-emerald-50={dragOver}
    class:dark:bg-emerald-900/20={dragOver}
    class:border-gray-300={!dragOver}
    class:dark:border-gray-600={!dragOver}
    class:opacity-50={disabled}
    on:dragover={handleDragOver}
    on:dragleave={handleDragLeave}
    on:drop={handleDrop}
  >
    <input
      type="file"
      {accept}
      multiple
      class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      on:change={handleFileInput}
      {disabled}
    />

    <div class="space-y-2">
      <Icon
        name="upload"
        class="mx-auto h-12 w-12 text-gray-400"
      />
      <div class="text-gray-600 dark:text-gray-300">
        <span class="font-medium">Click to upload</span>
        <span> or drag and drop</span>
      </div>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        PNG, JPG, GIF up to {formatSize(maxSize)}
      </p>
    </div>
  </div>

  <!-- Error Message -->
  {#if error}
    <div
      class="text-red-600 dark:text-red-400 text-sm"
      transition:fade
    >
      {error}
    </div>
  {/if}

  <!-- Preview Grid -->
  {#if files.length > 0}
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {#each files as file, i}
        <div
          class="relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700"
          transition:fade
        >
          {#await getImagePreview(file)}
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500"></div>
            </div>
          {:then preview}
            <img
              src={preview}
              alt="Preview"
              class="w-full h-full object-cover"
            />
          {/await}

          <button
            type="button"
            class="absolute top-2 right-2 p-1 rounded-full bg-gray-900/50 text-white hover:bg-gray-900/75 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
            on:click={() => removeFile(i)}
          >
            <Icon name="x" class="h-4 w-4" />
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  input[type="file"]::-webkit-file-upload-button {
    cursor: pointer;
  }
</style> 