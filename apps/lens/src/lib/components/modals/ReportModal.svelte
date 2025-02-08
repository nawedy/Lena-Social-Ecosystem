<!-- ReportModal.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  import { clickOutside } from '$lib/actions/clickOutside';
  import type { Post } from '$lib/types';
  import { moderation } from '$lib/services/moderation';
  import { analytics } from '$lib/services/analytics';

  const dispatch = createEventDispatcher();

  // Props
  export let post: Post;
  export let type: 'post' | 'comment' = 'post';
  export let commentId: string | null = null;

  // State
  let isLoading = false;
  let error: string | null = null;
  let selectedReason: string | null = null;
  let additionalDetails = '';

  // Report reasons
  const reasons = [
    {
      id: 'spam',
      label: 'Spam or misleading',
      description: 'Content that is commercial, promotional, or misleading'
    },
    {
      id: 'hate_speech',
      label: 'Hate speech or symbols',
      description: 'Content that promotes hate or discrimination'
    },
    {
      id: 'violence',
      label: 'Violence or dangerous behavior',
      description: 'Content that promotes violence or dangerous acts'
    },
    {
      id: 'harassment',
      label: 'Harassment or bullying',
      description: 'Content that harasses, intimidates, or bullies'
    },
    {
      id: 'nudity',
      label: 'Nudity or sexual content',
      description: 'Content that contains explicit material'
    },
    {
      id: 'copyright',
      label: 'Copyright violation',
      description: 'Content that violates intellectual property rights'
    },
    {
      id: 'other',
      label: 'Other',
      description: 'Other issues not listed above'
    }
  ];

  // Methods
  async function handleSubmit() {
    if (!selectedReason) return;

    isLoading = true;
    error = null;

    try {
      await moderation.submitReport({
        contentId: commentId || post.id,
        contentType: type,
        reason: selectedReason,
        details: additionalDetails.trim(),
        timestamp: Date.now()
      });

      analytics.trackEvent({
        type: 'content_report',
        contentId: commentId || post.id,
        contentType: type,
        data: {
          reason: selectedReason,
          timestamp: Date.now()
        }
      });

      dispatch('close');
    } catch (err) {
      console.error('Failed to submit report:', err);
      error = 'Failed to submit report. Please try again.';
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="modal-backdrop" transition:fade>
  <div 
    class="modal"
    use:clickOutside
    on:clickoutside={() => dispatch('close')}
  >
    <header class="modal-header">
      <h2>Report {type === 'post' ? 'Post' : 'Comment'}</h2>
      <button
        class="close-button"
        on:click={() => dispatch('close')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </header>

    {#if error}
      <div class="error-message" transition:fade>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span>{error}</span>
      </div>
    {/if}

    <div class="report-form">
      <div class="reason-list">
        {#each reasons as reason}
          <button
            class="reason-button"
            class:selected={selectedReason === reason.id}
            disabled={isLoading}
            on:click={() => selectedReason = reason.id}
          >
            <div class="reason-info">
              <h3>{reason.label}</h3>
              <p>{reason.description}</p>
            </div>
            <div class="radio-button">
              <div class="radio-inner" />
            </div>
          </button>
        {/each}
      </div>

      {#if selectedReason}
        <div class="details-input" transition:fade>
          <label for="details">Additional details (optional)</label>
          <textarea
            id="details"
            bind:value={additionalDetails}
            placeholder="Please provide any additional context that will help us understand the issue..."
            maxlength="500"
            disabled={isLoading}
          />
          <div class="character-count">
            {additionalDetails.length}/500
          </div>
        </div>

        <div class="form-actions">
          <button
            class="secondary-button"
            on:click={() => dispatch('close')}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            class="primary-button"
            on:click={handleSubmit}
            disabled={!selectedReason || isLoading}
          >
            {#if isLoading}
              <svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path 
                  stroke-linecap="round" 
                  stroke-linejoin="round" 
                  stroke-width="2"
                  d="M12 6v4m0 2v4m0 2v4M4 12h4m2 0h4m2 0h4"
                />
              </svg>
              Submitting...
            {:else}
              Submit Report
            {/if}
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>

<style lang="postcss">
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .modal {
    width: 100%;
    max-width: 480px;
    max-height: 90vh;
    background: var(--surface-color, #1a1a1a);
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);

    h2 {
      font-size: 18px;
      font-weight: 600;
      color: white;
      margin: 0;
    }
  }

  .close-button {
    padding: 8px;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    transition: color 0.2s;

    &:hover {
      color: white;
    }

    svg {
      width: 20px;
      height: 20px;
    }
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: rgba(255, 68, 68, 0.1);
    color: #ff4444;
    margin: 16px;
    border-radius: 8px;

    svg {
      width: 20px;
      height: 20px;
    }
  }

  .report-form {
    flex: 1;
    padding: 16px;
    overflow-y: auto;
  }

  .reason-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .reason-button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 12px;
    background: rgba(255, 255, 255, 0.05);
    border: none;
    border-radius: 8px;
    color: white;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.1);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &.selected {
      background: rgba(0, 168, 255, 0.1);
      border: 1px solid var(--primary-color, #00a8ff);
    }
  }

  .reason-info {
    h3 {
      font-size: 16px;
      font-weight: 500;
      margin: 0;
    }

    p {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.5);
      margin: 4px 0 0;
    }
  }

  .radio-button {
    width: 20px;
    height: 20px;
    border: 2px solid rgba(255, 255, 255, 0.5);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.2s;

    .radio-inner {
      width: 10px;
      height: 10px;
      background: var(--primary-color, #00a8ff);
      border-radius: 50%;
      transform: scale(0);
      transition: transform 0.2s;
    }
  }

  .selected .radio-button {
    border-color: var(--primary-color, #00a8ff);

    .radio-inner {
      transform: scale(1);
    }
  }

  .details-input {
    margin-top: 24px;

    label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.7);
      margin-bottom: 8px;
    }

    textarea {
      width: 100%;
      height: 120px;
      padding: 12px;
      background: rgba(255, 255, 255, 0.1);
      border: none;
      border-radius: 8px;
      color: white;
      font-size: 14px;
      resize: none;

      &:focus {
        outline: none;
        background: rgba(255, 255, 255, 0.15);
      }

      &::placeholder {
        color: rgba(255, 255, 255, 0.5);
      }
    }
  }

  .character-count {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    text-align: right;
    margin-top: 4px;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 24px;
  }

  .primary-button,
  .secondary-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .primary-button {
    background: var(--primary-color, #00a8ff);
    color: white;

    &:hover:not(:disabled) {
      filter: brightness(1.1);
    }
  }

  .secondary-button {
    background: rgba(255, 255, 255, 0.1);
    color: white;

    &:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.15);
    }
  }

  .spinner {
    width: 16px;
    height: 16px;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style> 