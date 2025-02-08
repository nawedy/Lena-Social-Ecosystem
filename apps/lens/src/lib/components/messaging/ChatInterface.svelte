<!-- ChatInterface.svelte -->
<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { messaging } from '$lib/services/messaging/messagingService';
  import { voice } from '$lib/services/messaging/voiceService';
  import { encryption } from '$lib/services/messaging/encryptionService';
  import { auth } from '$lib/services/auth';
  import type { Chat, Message, MessageDraft } from '$lib/types/messaging';
  import MessageList from './MessageList.svelte';
  import MessageInput from './MessageInput.svelte';
  import ChatHeader from './ChatHeader.svelte';
  import ChatSidebar from './ChatSidebar.svelte';
  import CallOverlay from './CallOverlay.svelte';
  import FileTransferProgress from './FileTransferProgress.svelte';
  import TypingIndicator from './TypingIndicator.svelte';
  import ReplyContext from './ReplyContext.svelte';
  import EmojiPicker from '../shared/EmojiPicker.svelte';
  import GifPicker from '../shared/GifPicker.svelte';

  const dispatch = createEventDispatcher();

  // Props
  export let chat: Chat;
  export let initialMessage?: string;

  // State
  let messageInput: HTMLTextAreaElement;
  let draft: MessageDraft | null = null;
  let replyingTo: Message | null = null;
  let isTyping = false;
  let showEmojiPicker = false;
  let showGifPicker = false;
  let isCallActive = false;
  let isVideoEnabled = true;
  let isAudioEnabled = true;
  let fileTransfers: Record<string, {
    file: File;
    progress: number;
    status: 'uploading' | 'downloading' | 'completed' | 'failed';
    error?: string;
  }> = {};

  // Computed
  $: currentUser = $auth.user;
  $: isEncrypted = chat.settings.encryption;
  $: otherParticipants = chat.participants.filter(p => p.userId !== currentUser?.id);
  $: typingUsers = $messaging.typingUsers?.[chat.id] || [];
  $: unreadCount = $messaging.unreadCount?.[chat.id] || 0;

  // Lifecycle
  onMount(async () => {
    // Load messages
    await messaging.loadMessages(chat.id);

    // Load draft if exists
    const existingDraft = $messaging.drafts[chat.id];
    if (existingDraft) {
      draft = existingDraft;
    } else if (initialMessage) {
      draft = {
        id: crypto.randomUUID(),
        chatId: chat.id,
        type: 'text',
        content: { text: initialMessage },
        attachments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    // Subscribe to typing indicators
    messaging.subscribeToTyping(chat.id);

    // Initialize encryption if needed
    if (isEncrypted) {
      await encryption.initialize();
      const keyBundle = await encryption.getKeyBundle();
      await messaging.exchangeKeys(chat.id, keyBundle);
    }
  });

  onDestroy(() => {
    // Save draft
    if (draft) {
      messaging.saveDraft(draft);
    }

    // Clean up subscriptions
    messaging.unsubscribeFromTyping(chat.id);
  });

  // Message handling
  async function handleSend(event: CustomEvent) {
    const { message, attachments } = event.detail;

    try {
      // Handle attachments
      if (attachments.length > 0) {
        for (const file of attachments) {
          const transferId = crypto.randomUUID();
          fileTransfers[transferId] = {
            file,
            progress: 0,
            status: 'uploading'
          };

          try {
            const url = await messaging.uploadFile(file, {
              onProgress: (progress) => {
                fileTransfers[transferId].progress = progress;
              }
            });

            await messaging.sendMessage(chat.id, {
              type: getMessageType(file.type),
              content: {
                mediaUrl: url,
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type
              },
              replyTo: replyingTo?.id
            });

            fileTransfers[transferId].status = 'completed';
          } catch (error) {
            fileTransfers[transferId].status = 'failed';
            fileTransfers[transferId].error = error.message;
          }
        }
      }

      // Send text message
      if (message.trim()) {
        await messaging.sendMessage(chat.id, {
          type: 'text',
          content: { text: message },
          replyTo: replyingTo?.id
        });
      }

      // Clear draft and reply context
      draft = null;
      replyingTo = null;
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }

  async function handleVoiceMessage(event: CustomEvent) {
    const { recording } = event.detail;
    try {
      await messaging.sendMessage(chat.id, {
        type: 'voice',
        content: {
          mediaUrl: recording.url,
          duration: recording.duration,
          waveform: recording.waveform,
          transcription: recording.transcription
        },
        replyTo: replyingTo?.id
      });
    } catch (error) {
      console.error('Failed to send voice message:', error);
    }
  }

  function handleTypingStart() {
    if (!isTyping) {
      isTyping = true;
      messaging.sendTypingIndicator(chat.id, true);
    }
  }

  function handleTypingStop() {
    if (isTyping) {
      isTyping = false;
      messaging.sendTypingIndicator(chat.id, false);
    }
  }

  // Call handling
  async function startCall(withVideo = true) {
    try {
      isCallActive = true;
      isVideoEnabled = withVideo;
      await messaging.initiateCall(chat.id, withVideo);
    } catch (error) {
      console.error('Failed to start call:', error);
      isCallActive = false;
    }
  }

  async function endCall() {
    try {
      await messaging.endCall(chat.id);
      isCallActive = false;
    } catch (error) {
      console.error('Failed to end call:', error);
    }
  }

  function toggleVideo() {
    isVideoEnabled = !isVideoEnabled;
    messaging.toggleVideo(isVideoEnabled);
  }

  function toggleAudio() {
    isAudioEnabled = !isAudioEnabled;
    messaging.toggleAudio(isAudioEnabled);
  }

  // Utility functions
  function getMessageType(mimeType: string): MessageType {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'file';
  }
</script>

<div class="chat-interface">
  <ChatHeader
    {chat}
    {isCallActive}
    onVideoCall={() => startCall(true)}
    onAudioCall={() => startCall(false)}
    onInfoClick={() => dispatch('showInfo')}
  />

  <div class="chat-content">
    <MessageList
      chatId={chat.id}
      {replyingTo}
      on:reply={(event) => replyingTo = event.detail}
      on:cancelReply={() => replyingTo = null}
    />

    {#if typingUsers.length > 0}
      <TypingIndicator users={typingUsers} />
    {/if}

    {#if Object.keys(fileTransfers).length > 0}
      <div class="transfer-progress">
        {#each Object.entries(fileTransfers) as [id, transfer]}
          <FileTransferProgress
            fileName={transfer.file.name}
            progress={transfer.progress}
            status={transfer.status}
            error={transfer.error}
            onRetry={() => {/* Implement retry logic */}}
            onCancel={() => {/* Implement cancel logic */}}
          />
        {/each}
      </div>
    {/if}

    {#if replyingTo}
      <ReplyContext
        message={replyingTo}
        onCancel={() => replyingTo = null}
      />
    {/if}

    <MessageInput
      bind:this={messageInput}
      {draft}
      {isEncrypted}
      onSend={handleSend}
      onVoiceMessage={handleVoiceMessage}
      onTypingStart={handleTypingStart}
      onTypingStop={handleTypingStop}
      onEmojiClick={() => showEmojiPicker = true}
      onGifClick={() => showGifPicker = true}
    />
  </div>

  {#if isCallActive}
    <CallOverlay
      {chat}
      {isVideoEnabled}
      {isAudioEnabled}
      onEnd={endCall}
      onToggleVideo={toggleVideo}
      onToggleAudio={toggleAudio}
    />
  {/if}

  {#if showEmojiPicker}
    <div class="picker-overlay" transition:fade>
      <EmojiPicker
        onSelect={(emoji) => {
          messageInput.insertText(emoji);
          showEmojiPicker = false;
        }}
        onClose={() => showEmojiPicker = false}
      />
    </div>
  {/if}

  {#if showGifPicker}
    <div class="picker-overlay" transition:fade>
      <GifPicker
        onSelect={async (gif) => {
          await messaging.sendMessage(chat.id, {
            type: 'image',
            content: {
              mediaUrl: gif.url,
              mimeType: 'image/gif'
            }
          });
          showGifPicker = false;
        }}
        onClose={() => showGifPicker = false}
      />
    </div>
  {/if}
</div>

<style lang="postcss">
  .chat-interface {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--surface-2);
    border-radius: 12px;
    overflow: hidden;
  }

  .chat-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .transfer-progress {
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .picker-overlay {
    position: absolute;
    bottom: 100%;
    right: 0;
    margin-bottom: 8px;
    background: var(--surface-3);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
</style> 