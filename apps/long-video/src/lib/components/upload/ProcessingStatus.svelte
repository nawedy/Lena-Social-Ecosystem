<!-- ProcessingStatus.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import { supabase } from '$lib/supabase';
  import type { VideoMetadata } from '$lib/types';

  // Props
  export let videoId: string;

  // State
  let status: 'processing' | 'transcoding' | 'generating_captions' | 'completed' | 'failed' = 'processing';
  let progress = 0;
  let error: string | null = null;
  let qualities: string[] = [];
  let captionLanguages: string[] = [];
  let subscription: any;

  onMount(() => {
    // Subscribe to realtime updates
    subscription = supabase
      .channel(`video-processing:${videoId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'video_processing_status',
        filter: `video_id=eq.${videoId}`
      }, handleUpdate)
      .subscribe();

    // Get initial status
    fetchStatus();
  });

  onDestroy(() => {
    if (subscription) {
      supabase.removeChannel(subscription);
    }
  });

  async function fetchStatus() {
    const { data, error: err } = await supabase
      .from('video_processing_status')
      .select('*')
      .eq('video_id', videoId)
      .single();

    if (err) {
      console.error('Failed to fetch status:', err);
      error = 'Failed to fetch processing status';
      return;
    }

    if (data) {
      updateStatus(data);
    }
  }

  function handleUpdate(payload: any) {
    const { new: newData } = payload;
    if (newData) {
      updateStatus(newData);
    }
  }

  function updateStatus(data: any) {
    status = data.status;
    progress = data.progress;
    error = data.error;
    qualities = data.qualities || [];
    captionLanguages = data.caption_languages || [];
  }

  function getStatusMessage() {
    switch (status) {
      case 'processing':
        return 'Processing video...';
      case 'transcoding':
        return `Transcoding video (${qualities.length} qualities)...`;
      case 'generating_captions':
        return `Generating captions (${captionLanguages.length} languages)...`;
      case 'completed':
        return 'Processing completed!';
      case 'failed':
        return `Processing failed: ${error}`;
      default:
        return 'Unknown status';
    }
  }

  function getStatusIcon() {
    switch (status) {
      case 'processing':
      case 'transcoding':
      case 'generating_captions':
        return `
          <path 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2"
            d="M12 6v4m0 4v4m-4-8h8M6 12h12"
          />
        `;
      case 'completed':
        return `
          <path 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2"
            d="M5 13l4 4L19 7"
          />
        `;
      case 'failed':
        return `
          <path 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        `;
      default:
        return '';
    }
  }
</script>

<div 
  class="processing-status"
  class:completed={status === 'completed'}
  class:failed={status === 'failed'}
  transition:fade
>
  <div class="status-icon">
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor"
      class:spinning={status !== 'completed' && status !== 'failed'}
    >
      {@html getStatusIcon()}
    </svg>
  </div>

  <div class="status-details">
    <div class="status-message">
      {getStatusMessage()}
    </div>

    {#if status !== 'completed' && status !== 'failed'}
      <div class="progress-bar">
        <div 
          class="progress-fill"
          style="width: {progress}%"
        />
      </div>
    {/if}

    {#if qualities.length > 0}
      <div class="quality-list">
        {#each qualities as quality}
          <span class="quality-badge">{quality}</span>
        {/each}
      </div>
    {/if}

    {#if captionLanguages.length > 0}
      <div class="caption-list">
        {#each captionLanguages as language}
          <span class="caption-badge">
            {new Intl.DisplayNames([language], { type: 'language' }).of(language)}
          </span>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style lang="postcss">
  .processing-status {
    display: flex;
    gap: 16px;
    padding: 16px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    color: white;

    &.completed {
      background: rgba(var(--success-color-rgb, 0, 200, 83), 0.1);
      color: var(--success-color, #00c853);
    }

    &.failed {
      background: rgba(255, 68, 68, 0.1);
      color: #ff4444;
    }
  }

  .status-icon {
    flex-shrink: 0;

    svg {
      width: 24px;
      height: 24px;

      &.spinning {
        animation: spin 1s linear infinite;
      }
    }
  }

  .status-details {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .status-message {
    font-size: 14px;
    font-weight: 500;
  }

  .progress-bar {
    width: 100%;
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

  .quality-list,
  .caption-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .quality-badge,
  .caption-badge {
    padding: 2px 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    font-size: 12px;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style> 