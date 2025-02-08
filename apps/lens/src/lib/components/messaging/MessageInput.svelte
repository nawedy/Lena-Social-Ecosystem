<!-- MessageInput.svelte -->
<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { voice } from '$lib/services/messaging/voiceService';
  import type { MessageDraft } from '$lib/types/messaging';
  import Icon from '../shared/Icon.svelte';

  const dispatch = createEventDispatcher();

  // Props
  export let draft: MessageDraft | null = null;
  export let isEncrypted = false;
  export let maxLength = 5000;
  export let maxAttachments = 10;
  export let allowedFileTypes = '*';
  export let maxFileSize = 100 * 1024 * 1024; // 100MB

  // State
  let input: HTMLTextAreaElement;
  let fileInput: HTMLInputElement;
  let message = '';
  let attachments: File[] = [];
  let isRecording = false;
  let recordingDuration = 0;
  let recordingInterval: number;
  let isDragging = false;
  let lastTypingTime = 0;
  let typingTimeout: number;

  // Computed
  $: remainingChars = maxLength - message.length;
  $: canSend = message.trim().length > 0 || attachments.length > 0;
  $: canAttachMore = attachments.length < maxAttachments;

  // Lifecycle
  onMount(() => {
    if (draft) {
      message = draft.content.text || '';
      attachments = draft.attachments.map(a => a.file);
    }
  });

  onDestroy(() => {
    if (isRecording) {
      stopRecording();
    }
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
  });

  // Message handling
  async function handleSubmit() {
    if (!canSend) return;

    dispatch('send', {
      message,
      attachments
    });

    // Clear input
    message = '';
    attachments = [];
    input.style.height = 'auto';
  }

  function handleInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    message = target.value;

    // Auto-resize textarea
    target.style.height = 'auto';
    target.style.height = `${target.scrollHeight}px`;

    // Handle typing indicators
    const now = Date.now();
    if (now - lastTypingTime > 3000) {
      dispatch('typingStart');
      lastTypingTime = now;
    }

    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    typingTimeout = setTimeout(() => {
      dispatch('typingStop');
    }, 3000);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }

  // File handling
  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    if (!target.files) return;

    handleFiles(Array.from(target.files));
    target.value = ''; // Reset input
  }

  function handleDragEnter(event: DragEvent) {
    event.preventDefault();
    isDragging = true;
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    isDragging = false;
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragging = false;

    if (!event.dataTransfer?.files) return;
    handleFiles(Array.from(event.dataTransfer.files));
  }

  function handleFiles(files: File[]) {
    // Filter files
    const validFiles = files.filter(file => {
      // Check file type
      if (allowedFileTypes !== '*') {
        const allowed = allowedFileTypes.split(',').map(t => t.trim());
        if (!allowed.some(type => file.type.startsWith(type))) {
          alert(`File type not allowed: ${file.type}`);
          return false;
        }
      }

      // Check file size
      if (file.size > maxFileSize) {
        alert(`File too large: ${file.name}`);
        return false;
      }

      return true;
    });

    // Check total attachments
    if (attachments.length + validFiles.length > maxAttachments) {
      alert(`Maximum ${maxAttachments} files allowed`);
      return;
    }

    attachments = [...attachments, ...validFiles];
  }

  function removeAttachment(index: number) {
    attachments = attachments.filter((_, i) => i !== index);
  }

  // Voice recording
  async function startRecording() {
    try {
      await voice.startRecording();
      isRecording = true;
      recordingDuration = 0;
      recordingInterval = setInterval(() => {
        recordingDuration++;
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Failed to start voice recording');
    }
  }

  async function stopRecording() {
    try {
      const recording = await voice.stopRecording();
      clearInterval(recordingInterval);
      isRecording = false;
      recordingDuration = 0;

      if (recording) {
        dispatch('voiceMessage', { recording });
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      alert('Failed to process voice recording');
    }
  }

  function cancelRecording() {
    voice.cancelRecording();
    clearInterval(recordingInterval);
    isRecording = false;
    recordingDuration = 0;
  }

  function formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
</script>

<div 
  class="message-input"
  class:dragging={isDragging}
  on:dragenter={handleDragEnter}
  on:dragleave={handleDragLeave}
  on:dragover|preventDefault
  on:drop={handleDrop}
>
  {#if isRecording}
    <div class="recording-overlay" transition:fade>
      <div class="recording-indicator">
        <div class="pulse" />
        <span class="duration">{formatDuration(recordingDuration)}</span>
      </div>
      <div class="recording-actions">
        <button class="cancel-button" on:click={cancelRecording}>
          Cancel
        </button>
        <button class="stop-button" on:click={stopRecording}>
          Send Voice Message
        </button>
      </div>
    </div>
  {:else}
    {#if attachments.length > 0}
      <div class="attachments" transition:slide>
        {#each attachments as file, i}
          <div class="attachment">
            <div class="attachment-preview">
              {#if file.type.startsWith('image/')}
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  on:load={() => URL.revokeObjectURL(file)}
                />
              {:else}
                <Icon name={getFileIcon(file.type)} />
              {/if}
            </div>
            <span class="attachment-name">{file.name}</span>
            <button
              class="remove-attachment"
              on:click={() => removeAttachment(i)}
            >
              <Icon name="close" />
            </button>
          </div>
        {/each}
      </div>
    {/if}

    <div class="input-container">
      <button
        class="action-button"
        on:click={() => dispatch('emojiClick')}
      >
        <Icon name="emoji" />
      </button>

      <button
        class="action-button"
        on:click={() => dispatch('gifClick')}
      >
        <Icon name="gif" />
      </button>

      <textarea
        bind:this={input}
        bind:value={message}
        placeholder={isEncrypted ? '🔒 Send secure message...' : 'Type a message...'}
        maxlength={maxLength}
        rows="1"
        on:input={handleInput}
        on:keydown={handleKeydown}
      />

      {#if canAttachMore}
        <button
          class="action-button"
          on:click={() => fileInput.click()}
        >
          <Icon name="attachment" />
        </button>
      {/if}

      <button
        class="action-button"
        on:mousedown={startRecording}
        on:touchstart={startRecording}
      >
        <Icon name="mic" />
      </button>

      <button
        class="send-button"
        disabled={!canSend}
        on:click={handleSubmit}
      >
        <Icon name="send" />
      </button>

      <input
        bind:this={fileInput}
        type="file"
        accept={allowedFileTypes}
        multiple
        on:change={handleFileSelect}
        style="display: none"
      />
    </div>

    {#if message.length > 0}
      <div 
        class="char-counter"
        class:warning={remainingChars <= 100}
        class:error={remainingChars <= 20}
      >
        {remainingChars}
      </div>
    {/if}
  {/if}

  {#if isDragging}
    <div class="drop-overlay" transition:fade>
      <Icon name="upload" size={48} />
      <span>Drop files to attach</span>
    </div>
  {/if}
</div>

<style lang="postcss">
  .message-input {
    position: relative;
    padding: 12px;
    background: var(--surface-3);
    border-top: 1px solid var(--border-color);

    &.dragging {
      background: var(--surface-4);
    }
  }

  .input-container {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }

  textarea {
    flex: 1;
    min-height: 24px;
    max-height: 150px;
    padding: 8px 12px;
    background: var(--surface-4);
    border: none;
    border-radius: 12px;
    color: var(--text-1);
    font-size: 14px;
    line-height: 1.4;
    resize: none;

    &:focus {
      outline: none;
      background: var(--surface-5);
    }

    &::placeholder {
      color: var(--text-3);
    }
  }

  .action-button {
    padding: 8px;
    background: transparent;
    border: none;
    border-radius: 50%;
    color: var(--text-2);
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: var(--surface-4);
      color: var(--text-1);
    }
  }

  .send-button {
    padding: 8px;
    background: var(--primary);
    border: none;
    border-radius: 50%;
    color: white;
    cursor: pointer;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      filter: brightness(1.1);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .attachments {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 8px;
  }

  .attachment {
    position: relative;
    width: 80px;
    background: var(--surface-4);
    border-radius: 8px;
    overflow: hidden;
  }

  .attachment-preview {
    width: 100%;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-5);

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .attachment-name {
    display: block;
    padding: 4px;
    font-size: 12px;
    color: var(--text-2);
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
  }

  .remove-attachment {
    position: absolute;
    top: 4px;
    right: 4px;
    padding: 4px;
    background: rgba(0, 0, 0, 0.5);
    border: none;
    border-radius: 50%;
    color: white;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: rgba(0, 0, 0, 0.7);
    }
  }

  .recording-overlay {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 16px;
  }

  .recording-indicator {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
  }

  .pulse {
    position: absolute;
    width: 100%;
    height: 100%;
    background: var(--error);
    border-radius: 50%;
    opacity: 0.2;
    animation: pulse 1.5s ease-out infinite;
  }

  .duration {
    color: var(--error);
    font-size: 16px;
    font-weight: 500;
  }

  .recording-actions {
    display: flex;
    gap: 16px;
  }

  .cancel-button,
  .stop-button {
    padding: 8px 16px;
    border: none;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .cancel-button {
    background: var(--surface-4);
    color: var(--text-2);

    &:hover {
      background: var(--surface-5);
    }
  }

  .stop-button {
    background: var(--error);
    color: white;

    &:hover {
      filter: brightness(1.1);
    }
  }

  .char-counter {
    position: absolute;
    right: 64px;
    bottom: 12px;
    font-size: 12px;
    color: var(--text-3);

    &.warning {
      color: var(--warning);
    }

    &.error {
      color: var(--error);
    }
  }

  .drop-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: var(--surface-4);
    color: var(--text-2);
    font-size: 14px;
    z-index: 1;
  }

  @keyframes pulse {
    0% {
      transform: scale(0.95);
      opacity: 0.5;
    }
    50% {
      transform: scale(1.1);
      opacity: 0.3;
    }
    100% {
      transform: scale(0.95);
      opacity: 0.5;
    }
  }
</style> 