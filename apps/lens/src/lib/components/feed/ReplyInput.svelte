<!-- ReplyInput.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  import { auth } from '$lib/services/auth';
  import UserAvatar from '../shared/UserAvatar.svelte';

  const dispatch = createEventDispatcher();

  // Props
  export let placeholder = 'Write a reply...';
  export let maxLength = 500;
  export let autoFocus = true;

  // State
  let input: HTMLTextAreaElement;
  let content = '';
  let isSubmitting = false;

  // Computed
  $: currentUser = $auth.user;
  $: remainingChars = maxLength - content.length;
  $: isValid = content.trim().length > 0 && content.length <= maxLength;

  // Lifecycle
  onMount(() => {
    if (autoFocus && input) {
      input.focus();
    }
  });

  // Event handlers
  function handleInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    content = target.value;

    // Auto-resize textarea
    target.style.height = 'auto';
    target.style.height = `${target.scrollHeight}px`;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    } else if (event.key === 'Escape') {
      handleCancel();
    }
  }

  async function handleSubmit() {
    if (!isValid || isSubmitting) return;
    isSubmitting = true;

    try {
      dispatch('submit', { content: content.trim() });
      content = '';
      input.style.height = 'auto';
    } catch (error) {
      console.error('Failed to submit reply:', error);
    } finally {
      isSubmitting = false;
    }
  }

  function handleCancel() {
    content = '';
    input.style.height = 'auto';
    dispatch('cancel');
  }
</script>

<div class="reply-input" transition:fade>
  <div class="input-container">
    <UserAvatar user={currentUser} size="sm" />
    <div class="textarea-wrapper">
      <textarea
        bind:this={input}
        bind:value={content}
        {placeholder}
        maxlength={maxLength}
        rows="1"
        on:input={handleInput}
        on:keydown={handleKeydown}
      />
      {#if content.length > 0}
        <div 
          class="char-counter"
          class:warning={remainingChars <= 50}
          class:error={remainingChars <= 0}
        >
          {remainingChars}
        </div>
      {/if}
    </div>
  </div>

  <div class="actions">
    <button
      class="cancel-button"
      on:click={handleCancel}
    >
      Cancel
    </button>
    <button
      class="submit-button"
      disabled={!isValid || isSubmitting}
      on:click={handleSubmit}
    >
      {isSubmitting ? 'Replying...' : 'Reply'}
    </button>
  </div>
</div>

<style lang="postcss">
  .reply-input {
    margin-top: 12px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
  }

  .input-container {
    display: flex;
    gap: 12px;
  }

  .textarea-wrapper {
    position: relative;
    flex: 1;
  }

  textarea {
    width: 100%;
    min-height: 36px;
    max-height: 150px;
    padding: 8px 12px;
    padding-right: 40px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 18px;
    color: white;
    font-size: 14px;
    line-height: 1.4;
    resize: none;
    overflow-y: auto;

    &:focus {
      outline: none;
      background: rgba(255, 255, 255, 0.15);
    }

    &::placeholder {
      color: rgba(255, 255, 255, 0.5);
    }
  }

  .char-counter {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);

    &.warning {
      color: #ff9800;
    }

    &.error {
      color: #ff4444;
    }
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 8px;
  }

  .cancel-button,
  .submit-button {
    padding: 6px 16px;
    border: none;
    border-radius: 16px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .cancel-button {
    background: transparent;
    color: rgba(255, 255, 255, 0.7);

    &:hover {
      color: white;
      background: rgba(255, 255, 255, 0.1);
    }
  }

  .submit-button {
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