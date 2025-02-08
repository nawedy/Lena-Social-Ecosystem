<!-- FileTransferProgress.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import Icon from '../shared/Icon.svelte';

  const dispatch = createEventDispatcher();

  // Props
  export let fileName: string;
  export let progress = 0;
  export let status: 'uploading' | 'downloading' | 'completed' | 'failed' = 'uploading';
  export let error: string | undefined = undefined;
  export let showCancel = true;
  export let showRetry = true;

  // Computed
  $: isActive = status === 'uploading' || status === 'downloading';
  $: statusIcon = {
    uploading: 'upload',
    downloading: 'download',
    completed: 'check-circle',
    failed: 'alert-circle'
  }[status];

  $: statusColor = {
    uploading: 'var(--primary)',
    downloading: 'var(--primary)',
    completed: 'var(--success)',
    failed: 'var(--error)'
  }[status];

  // Methods
  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  function handleRetry() {
    dispatch('retry');
  }

  function handleCancel() {
    dispatch('cancel');
  }
</script>

<div 
  class="file-transfer"
  class:active={isActive}
  class:completed={status === 'completed'}
  class:failed={status === 'failed'}
  transition:slide
>
  <div class="file-info">
    <div class="icon-container" style="--status-color: {statusColor}">
      <Icon name={statusIcon} />
      {#if isActive}
        <svg class="progress-ring" viewBox="0 0 36 36">
          <path
            d="M18 2.0845
              a 15.9155 15.9155 0 0 1 0 31.831
              a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-dasharray={`${progress}, 100`}
          />
        </svg>
      {/if}
    </div>

    <div class="details">
      <div class="filename">{fileName}</div>
      {#if error}
        <div class="error" transition:fade>{error}</div>
      {:else if isActive}
        <div class="progress-text">
          {progress}% • {status === 'uploading' ? 'Uploading' : 'Downloading'}
        </div>
      {/if}
    </div>
  </div>

  <div class="actions">
    {#if status === 'failed' && showRetry}
      <button
        class="action-button retry"
        on:click={handleRetry}
      >
        <Icon name="refresh" />
        <span>Retry</span>
      </button>
    {/if}

    {#if isActive && showCancel}
      <button
        class="action-button cancel"
        on:click={handleCancel}
      >
        <Icon name="x" />
        <span>Cancel</span>
      </button>
    {/if}
  </div>
</div>

<style lang="postcss">
  .file-transfer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
    background: var(--surface-2);
    border-radius: 8px;
    color: var(--text-1);

    &.active {
      background: var(--surface-3);
    }

    &.completed {
      opacity: 0.7;
    }

    &.failed {
      background: var(--error-surface);
    }
  }

  .file-info {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .icon-container {
    position: relative;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--status-color);

    :global(svg) {
      width: 24px;
      height: 24px;
    }
  }

  .progress-ring {
    position: absolute;
    inset: 0;
    transform: rotate(-90deg);
    transition: stroke-dasharray 0.2s;
  }

  .details {
    min-width: 0;
  }

  .filename {
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .progress-text {
    font-size: 12px;
    color: var(--text-2);
  }

  .error {
    font-size: 12px;
    color: var(--error);
  }

  .actions {
    display: flex;
    gap: 8px;
    margin-left: 12px;
  }

  .action-button {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    background: var(--surface-4);
    border: none;
    border-radius: 6px;
    color: var(--text-2);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;

    :global(svg) {
      width: 16px;
      height: 16px;
    }

    &:hover {
      background: var(--surface-5);
      color: var(--text-1);
    }

    &.retry {
      background: var(--primary);
      color: white;

      &:hover {
        filter: brightness(1.1);
      }
    }

    &.cancel:hover {
      background: var(--error-surface);
      color: var(--error);
    }
  }
</style> 