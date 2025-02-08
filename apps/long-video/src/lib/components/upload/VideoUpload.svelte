<!-- VideoUpload.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  import { Web3Storage } from 'web3.storage';
  import { formatFileSize } from '$lib/utils/video';
  import { PUBLIC_WEB3_STORAGE_TOKEN } from '$env/static/public';

  const dispatch = createEventDispatcher();
  const client = new Web3Storage({ token: PUBLIC_WEB3_STORAGE_TOKEN });

  // Props
  export let maxSize = 10 * 1024 * 1024 * 1024; // 10GB
  export let acceptedTypes = [
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ];

  // State
  let dragOver = false;
  let file: File | null = null;
  let uploadProgress = 0;
  let isUploading = false;
  let error: string | null = null;

  // Computed
  $: isValidFile = file && validateFile(file);
  $: fileSize = file ? formatFileSize(file.size) : '';

  function validateFile(file: File): boolean {
    if (file.size > maxSize) {
      error = `File size exceeds maximum allowed size of ${formatFileSize(maxSize)}`;
      return false;
    }

    if (!acceptedTypes.includes(file.type)) {
      error = 'Invalid file type. Please upload MP4, WebM, or QuickTime video files.';
      return false;
    }

    error = null;
    return true;
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    dragOver = true;
  }

  function handleDragLeave() {
    dragOver = false;
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    dragOver = false;

    const droppedFile = event.dataTransfer?.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }

  function handleFileInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const selectedFile = input.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  }

  function handleFileSelect(selectedFile: File) {
    file = selectedFile;
    uploadProgress = 0;
    error = null;
  }

  async function startUpload() {
    if (!file || !isValidFile) return;

    isUploading = true;
    uploadProgress = 0;

    try {
      // Create a CAR file for the video
      const filesCar = await client.put([file], {
        name: file.name,
        onRootCidReady: () => {
          uploadProgress = 5;
        },
        onStoredChunk: (size) => {
          uploadProgress = Math.min(95, Math.round((size / file.size) * 100));
        }
      });

      // Get IPFS hash
      const ipfsHash = filesCar.toString();
      uploadProgress = 100;

      // Dispatch success event
      dispatch('success', { 
        ipfsHash,
        filename: file.name,
        size: file.size,
        type: file.type
      });

      // Reset state
      file = null;
      uploadProgress = 0;
    } catch (err) {
      console.error('Upload failed:', err);
      error = 'Failed to upload video. Please try again.';
    } finally {
      isUploading = false;
    }
  }

  function cancelUpload() {
    file = null;
    uploadProgress = 0;
    error = null;
  }
</script>

<div 
  class="upload-container"
  class:drag-over={dragOver}
  on:dragover={handleDragOver}
  on:dragleave={handleDragLeave}
  on:drop={handleDrop}
>
  {#if !file}
    <div class="upload-prompt" transition:fade>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path 
          stroke-linecap="round" 
          stroke-linejoin="round" 
          stroke-width="2"
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
        />
      </svg>
      <p>Drag and drop your video here or</p>
      <label class="file-input">
        <input
          type="file"
          accept={acceptedTypes.join(',')}
          on:change={handleFileInput}
        />
        <span>Choose file</span>
      </label>
      <p class="hint">
        Maximum file size: {formatFileSize(maxSize)}<br>
        Supported formats: MP4, WebM, QuickTime
      </p>
    </div>
  {:else}
    <div class="file-preview" transition:fade>
      <div class="file-info">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2"
            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
        <div class="file-details">
          <span class="filename">{file.name}</span>
          <span class="filesize">{fileSize}</span>
        </div>
      </div>

      {#if error}
        <div class="error-message" transition:fade>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path 
              stroke-linecap="round" 
              stroke-linejoin="round" 
              stroke-width="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{error}</span>
        </div>
      {/if}

      {#if isUploading}
        <div class="upload-progress" transition:fade>
          <div class="progress-bar">
            <div 
              class="progress-fill"
              style="width: {uploadProgress}%"
            />
          </div>
          <span class="progress-text">{uploadProgress}%</span>
        </div>
      {:else}
        <div class="file-actions">
          <button
            class="cancel-button"
            on:click={cancelUpload}
          >
            Cancel
          </button>
          <button
            class="upload-button"
            disabled={!isValidFile}
            on:click={startUpload}
          >
            Upload
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style lang="postcss">
  .upload-container {
    width: 100%;
    min-height: 300px;
    border: 2px dashed rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;

    &.drag-over {
      border-color: var(--primary-color, #00a8ff);
      background: rgba(var(--primary-color-rgb, 0, 168, 255), 0.1);
    }
  }

  .upload-prompt {
    text-align: center;
    color: rgba(255, 255, 255, 0.7);

    svg {
      width: 48px;
      height: 48px;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    p {
      margin: 0 0 16px;
      font-size: 16px;
    }

    .hint {
      font-size: 12px;
      opacity: 0.7;
    }
  }

  .file-input {
    position: relative;
    display: inline-block;

    input {
      position: absolute;
      width: 0;
      height: 0;
      opacity: 0;
    }

    span {
      display: inline-block;
      padding: 8px 16px;
      background: var(--primary-color, #00a8ff);
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
  }

  .file-preview {
    width: 100%;
    max-width: 500px;
  }

  .file-info {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;

    svg {
      width: 32px;
      height: 32px;
      color: rgba(255, 255, 255, 0.7);
    }
  }

  .file-details {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .filename {
    font-size: 16px;
    font-weight: 500;
    color: white;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .filesize {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: rgba(255, 68, 68, 0.1);
    border-radius: 4px;
    color: #ff4444;
    margin-bottom: 20px;

    svg {
      width: 20px;
      height: 20px;
    }
  }

  .upload-progress {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .progress-bar {
    flex: 1;
    height: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--primary-color, #00a8ff);
    transition: width 0.2s linear;
  }

  .progress-text {
    font-size: 14px;
    font-weight: 500;
    color: white;
    min-width: 48px;
    text-align: right;
  }

  .file-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }

  .cancel-button,
  .upload-button {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .cancel-button {
    background: rgba(255, 255, 255, 0.1);
    color: white;

    &:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  }

  .upload-button {
    background: var(--primary-color, #00a8ff);
    color: white;

    &:hover:not(:disabled) {
      filter: brightness(1.1);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
</style> 