<!-- ReplyContext.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import type { Message } from '$lib/types/messaging';
  import { auth } from '$lib/services/auth';
  import Icon from '../shared/Icon.svelte';
  import UserAvatar from '../shared/UserAvatar.svelte';

  const dispatch = createEventDispatcher();

  // Props
  export let message: Message;

  // Computed
  $: currentUser = $auth.user;
  $: isOwnMessage = message.senderId === currentUser?.id;
  $: previewText = getPreviewText(message);
  $: previewIcon = getPreviewIcon(message);
  $: previewMedia = getPreviewMedia(message);

  function getPreviewText(msg: Message): string {
    switch (msg.type) {
      case 'text':
        return msg.content.text || '';
      case 'image':
        return '📷 Photo';
      case 'video':
        return '🎥 Video';
      case 'audio':
        return '🎵 Audio';
      case 'file':
        return `📎 ${msg.content.fileName || 'File'}`;
      case 'voice':
        return '🎤 Voice Message';
      case 'location':
        return '📍 Location';
      case 'contact':
        return '👤 Contact';
      default:
        return '';
    }
  }

  function getPreviewIcon(msg: Message): string {
    switch (msg.type) {
      case 'text':
        return 'message';
      case 'image':
        return 'image';
      case 'video':
        return 'video';
      case 'audio':
        return 'music';
      case 'file':
        return 'file';
      case 'voice':
        return 'mic';
      case 'location':
        return 'map-pin';
      case 'contact':
        return 'user';
      default:
        return 'message';
    }
  }

  function getPreviewMedia(msg: Message): string | null {
    if (msg.type === 'image') {
      return msg.content.thumbnail || msg.content.mediaUrl;
    }
    if (msg.type === 'video') {
      return msg.content.thumbnail;
    }
    return null;
  }
</script>

<div class="reply-context" transition:slide>
  <div class="context-content">
    <div class="context-indicator">
      <Icon name="corner-up-left" />
      <span>Replying to {isOwnMessage ? 'yourself' : message.sender?.displayName || 'message'}</span>
    </div>

    <div class="message-preview">
      {#if previewMedia}
        <div class="media-preview">
          <img
            src={previewMedia}
            alt="Message preview"
            on:error={(e) => e.currentTarget.style.display = 'none'}
          />
        </div>
      {:else}
        <div class="icon-preview">
          <Icon name={previewIcon} />
        </div>
      {/if}

      <div class="preview-content">
        <div class="preview-header">
          <UserAvatar user={message.sender} size="xs" />
          <span class="sender-name">
            {message.sender?.displayName || 'Unknown'}
          </span>
        </div>
        <div class="preview-text">
          {previewText}
        </div>
      </div>
    </div>
  </div>

  <button
    class="close-button"
    on:click={() => dispatch('cancel')}
  >
    <Icon name="x" />
  </button>
</div>

<style lang="postcss">
  .reply-context {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    background: var(--surface-2);
    border-top: 1px solid var(--border-color);
  }

  .context-content {
    flex: 1;
    min-width: 0;
  }

  .context-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
    color: var(--text-2);
    font-size: 12px;

    :global(svg) {
      width: 16px;
      height: 16px;
    }
  }

  .message-preview {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 8px;
    background: var(--surface-3);
    border-radius: 8px;
  }

  .media-preview {
    width: 40px;
    height: 40px;
    border-radius: 4px;
    overflow: hidden;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .icon-preview {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-4);
    border-radius: 4px;
    color: var(--text-2);

    :global(svg) {
      width: 24px;
      height: 24px;
    }
  }

  .preview-content {
    flex: 1;
    min-width: 0;
  }

  .preview-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }

  .sender-name {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-2);
  }

  .preview-text {
    font-size: 14px;
    color: var(--text-1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .close-button {
    padding: 4px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--text-2);
    cursor: pointer;
    transition: all 0.2s;

    :global(svg) {
      width: 20px;
      height: 20px;
    }

    &:hover {
      background: var(--surface-3);
      color: var(--text-1);
    }
  }
</style> 