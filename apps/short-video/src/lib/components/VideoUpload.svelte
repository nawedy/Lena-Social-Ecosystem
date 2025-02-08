<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Button } from '$lib/components/ui';
  import { Icon } from '$lib/components/ui';

  export let maxSize = 100 * 1024 * 1024; // 100MB
  export let maxDuration = 60; // 60 seconds
  export let allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
  export let multiple = false;

  let dragActive = false;
  let fileInput: HTMLInputElement;
  let error: string | null = null;

  const dispatch = createEventDispatcher<{
    select: { files: File[] };
    error: { message: string };
  }>();

  function handleDragEnter(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragActive = true;
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragActive = false;
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragActive = false;

    const files = Array.from(e.dataTransfer?.files || []);
    handleFiles(files);
  }

  function handleFileSelect(e: Event) {
    const files = Array.from((e.target as HTMLInputElement).files || []);
    handleFiles(files);
  }

  async function handleFiles(files: File[]) {
    error = null;

    // Filter video files
    const videoFiles = files.filter(file => allowedTypes.includes(file.type));

    if (videoFiles.length === 0) {
      error = 'Please select valid video files';
      dispatch('error', { message: error });
      return;
    }

    // Check file sizes
    const oversizedFiles = videoFiles.filter(file => file.size > maxSize);
    if (oversizedFiles.length > 0) {
      error = `Some files exceed the maximum size of ${formatSize(maxSize)}`;
      dispatch('error', { message: error });
      return;
    }

    // Check video durations
    try {
      const durations = await Promise.all(
        videoFiles.map(file => getVideoDuration(file))
      );

      const longVideos = durations.some(duration => duration > maxDuration);
      if (longVideos) {
        error = `Videos must be ${maxDuration} seconds or less`;
        dispatch('error', { message: error });
        return;
      }

      dispatch('select', { files: videoFiles });
    } catch (err) {
      error = 'Failed to process video files';
      dispatch('error', { message: error });
    }
  }

  function getVideoDuration(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';

      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };

      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        reject(new Error('Invalid video file'));
      };

      video.src = URL.createObjectURL(file);
    });
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

  function openFileDialog() {
    fileInput.click();
  }
</script>

<div
  class="relative w-full"
  on:dragenter={handleDragEnter}
  on:dragleave={handleDragLeave}
  on:dragover={handleDragOver}
  on:drop={handleDrop}
>
  <input
    bind:this={fileInput}
    type="file"
    accept={allowedTypes.join(',')}
    class="hidden"
    {multiple}
    on:change={handleFileSelect}
  />

  <div
    class="w-full aspect-[9/16] border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-8 transition-colors"
    class:border-primary={dragActive}
    class:bg-primary/5={dragActive}
    class:border-muted={!dragActive}
    class:hover:border-primary={!dragActive}
  >
    <div class="text-center">
      <Icon
        name="upload-cloud"
        class="w-12 h-12 mx-auto mb-4 text-muted-foreground"
      />
      <h3 class="text-lg font-semibold mb-2">
        Upload Videos
      </h3>
      <p class="text-sm text-muted-foreground mb-4">
        Drag and drop video files here or click to select
      </p>
      <Button
        variant="outline"
        on:click={openFileDialog}
      >
        Select Files
      </Button>
      <p class="text-xs text-muted-foreground mt-4">
        Maximum file size: {formatSize(maxSize)}<br>
        Maximum duration: {maxDuration} seconds<br>
        Supported formats: {allowedTypes.map(type => type.split('/')[1]).join(', ')}
      </p>
    </div>
  </div>

  {#if error}
    <div class="mt-4 p-4 bg-destructive/10 text-destructive rounded-lg text-sm">
      {error}
    </div>
  {/if}
</div>

<style>
  /* Add any component-specific styles here */
</style> 