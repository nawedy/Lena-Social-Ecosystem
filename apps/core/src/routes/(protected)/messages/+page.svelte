<!-- Messages Page -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { DatabaseService } from '$lib/services/database';
  import { auth } from '$lib/stores/auth';
  import { toasts } from '@lena/ui';
  import type { Profile, Message } from '$lib/types/supabase';

  interface Conversation {
    user: Profile;
    lastMessage: Message;
    unreadCount: number;
  }

  let conversations: Conversation[] = [];
  let selectedConversation: Conversation | null = null;
  let messages: Message[] = [];
  let newMessage = '';
  let isLoading = true;
  let isLoadingMessages = false;
  let isLoadingMore = false;
  let hasMore = true;
  let messageSubscription: any;

  onMount(async () => {
    try {
      // Load conversations
      const [messages, profiles] = await Promise.all([
        DatabaseService.getRecentMessages(),
        DatabaseService.getConversationProfiles()
      ]);

      // Group messages by conversation
      conversations = profiles.map(profile => {
        const userMessages = messages.filter(m => 
          m.sender_id === profile.id || m.receiver_id === profile.id
        );
        const unreadCount = userMessages.filter(m => 
          m.receiver_id === $auth.user?.id && !m.read_at
        ).length;

        return {
          user: profile,
          lastMessage: userMessages[0],
          unreadCount
        };
      });

      // Subscribe to new messages
      messageSubscription = DatabaseService.subscribeToNewMessages(handleNewMessage);

      isLoading = false;
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to load conversations');
    }
  });

  onDestroy(() => {
    if (messageSubscription) {
      messageSubscription.unsubscribe();
    }
  });

  async function selectConversation(conversation: Conversation) {
    try {
      selectedConversation = conversation;
      isLoadingMessages = true;
      messages = await DatabaseService.getConversation(conversation.user.id);

      // Mark messages as read
      const unreadMessages = messages.filter(m => 
        m.receiver_id === $auth.user?.id && !m.read_at
      );
      await Promise.all(
        unreadMessages.map(m => DatabaseService.markMessageAsRead(m.id))
      );

      // Update unread count
      conversations = conversations.map(c => 
        c.user.id === conversation.user.id ? { ...c, unreadCount: 0 } : c
      );
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to load messages');
    } finally {
      isLoadingMessages = false;
    }
  }

  async function loadMoreMessages() {
    if (!selectedConversation || isLoadingMore || !hasMore) return;

    try {
      isLoadingMore = true;
      const moreMessages = await DatabaseService.getConversation(
        selectedConversation.user.id,
        20,
        messages.length
      );

      if (moreMessages.length < 20) {
        hasMore = false;
      }

      messages = [...messages, ...moreMessages];
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to load more messages');
    } finally {
      isLoadingMore = false;
    }
  }

  async function handleSendMessage() {
    if (!selectedConversation || !newMessage.trim()) return;

    try {
      const message = await DatabaseService.sendMessage(
        selectedConversation.user.id,
        newMessage
      );

      messages = [message, ...messages];
      newMessage = '';

      // Update conversation list
      conversations = conversations.map(c => 
        c.user.id === selectedConversation.user.id
          ? { ...c, lastMessage: message }
          : c
      );
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to send message');
    }
  }

  function handleNewMessage(payload: any) {
    const message = payload.new as Message;
    const senderId = message.sender_id;
    const conversation = conversations.find(c => c.user.id === senderId);

    if (conversation) {
      // Update existing conversation
      conversations = conversations.map(c => 
        c.user.id === senderId
          ? {
              ...c,
              lastMessage: message,
              unreadCount: selectedConversation?.user.id === senderId
                ? c.unreadCount
                : c.unreadCount + 1
            }
          : c
      );

      // Add message to current conversation if open
      if (selectedConversation?.user.id === senderId) {
        messages = [message, ...messages];
        DatabaseService.markMessageAsRead(message.id);
      }
    } else {
      // Create new conversation
      DatabaseService.getProfile(senderId).then(profile => {
        if (profile) {
          conversations = [
            {
              user: profile,
              lastMessage: message,
              unreadCount: 1
            },
            ...conversations
          ];
        }
      });
    }
  }

  function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    
    return date.toLocaleDateString();
  }
</script>

<svelte:head>
  <title>Messages | TikTokToe</title>
</svelte:head>

<div class="h-[calc(100vh-4rem)] flex">
  <!-- Conversation List -->
  <div class="w-80 border-r border-primary-900/50 flex flex-col">
    <div class="p-4 border-b border-primary-900/50">
      <input
        type="search"
        placeholder="Search messages..."
        class="w-full bg-black/50 border border-primary-900/50 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500/50 focus:border-transparent"
      />
    </div>
    
    <div class="flex-1 overflow-y-auto">
      {#if isLoading}
        <div class="p-4 space-y-4">
          {#each Array(5) as _}
            <div class="animate-pulse flex items-center space-x-4">
              <div class="w-12 h-12 rounded-full bg-primary-900/50"></div>
              <div class="flex-1 space-y-2">
                <div class="h-4 bg-primary-900/50 rounded w-1/2"></div>
                <div class="h-3 bg-primary-900/50 rounded w-3/4"></div>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="p-2">
          {#each conversations as conversation (conversation.user.id)}
            <button
              class="w-full p-3 rounded-lg hover:bg-primary-900/20 transition-colors flex items-center space-x-4"
              class:bg-primary-900/30={selectedConversation?.user.id === conversation.user.id}
              on:click={() => selectConversation(conversation)}
            >
              <div class="relative">
                <img
                  src={conversation.user.avatar_url || `https://api.dicebear.com/7.x/shapes/svg?seed=${conversation.user.id}`}
                  alt={conversation.user.username}
                  class="w-12 h-12 rounded-full bg-primary-900/50"
                />
                {#if conversation.unreadCount > 0}
                  <div class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center text-xs text-black">
                    {conversation.unreadCount}
                  </div>
                {/if}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex justify-between items-baseline">
                  <h3 class="font-medium truncate">@{conversation.user.username}</h3>
                  {#if conversation.lastMessage}
                    <time class="text-xs text-gray-400 flex-shrink-0">
                      {formatTimestamp(conversation.lastMessage.created_at)}
                    </time>
                  {/if}
                </div>
                {#if conversation.lastMessage}
                  <p class="text-sm text-gray-400 truncate">
                    {conversation.lastMessage.sender_id === $auth.user?.id ? 'You: ' : ''}{conversation.lastMessage.content}
                  </p>
                {/if}
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- Chat Window -->
  <div class="flex-1 flex flex-col">
    {#if selectedConversation}
      <!-- Chat Header -->
      <div class="p-4 border-b border-primary-900/50 flex items-center space-x-4">
        <img
          src={selectedConversation.user.avatar_url || `https://api.dicebear.com/7.x/shapes/svg?seed=${selectedConversation.user.id}`}
          alt={selectedConversation.user.username}
          class="w-10 h-10 rounded-full bg-primary-900/50"
        />
        <div>
          <h2 class="font-medium">@{selectedConversation.user.username}</h2>
        </div>
      </div>
      
      <!-- Messages -->
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        {#if isLoadingMessages}
          <div class="animate-pulse space-y-4">
            {#each Array(5) as _}
              <div class="flex flex-col space-y-2">
                <div class="h-10 bg-primary-900/50 rounded w-1/2"></div>
                <div class="h-6 bg-primary-900/50 rounded w-1/3"></div>
              </div>
            {/each}
          </div>
        {:else}
          {#each messages as message (message.id)}
            <div class="flex flex-col {message.sender_id === $auth.user?.id ? 'items-end' : 'items-start'}">
              <div class="max-w-[70%] {message.sender_id === $auth.user?.id ? 'bg-primary-500 text-black' : 'bg-primary-900/20'} rounded-lg p-3 {message.sender_id === $auth.user?.id ? 'rounded-br-none' : 'rounded-bl-none'}">
                <p class="break-words">{message.content}</p>
                <time class="text-xs {message.sender_id === $auth.user?.id ? 'text-black/70' : 'text-gray-400'} mt-1">
                  {formatTimestamp(message.created_at)}
                </time>
              </div>
            </div>
          {/each}

          {#if hasMore}
            <div class="text-center">
              <button
                class="btn-outline"
                on:click={loadMoreMessages}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? 'Loading...' : 'Load More'}
              </button>
            </div>
          {/if}
        {/if}
      </div>
      
      <!-- Message Input -->
      <div class="p-4 border-t border-primary-900/50">
        <form
          class="flex space-x-2"
          on:submit|preventDefault={handleSendMessage}
        >
          <input
            type="text"
            bind:value={newMessage}
            placeholder="Type a message..."
            class="flex-1 bg-black/50 border border-primary-900/50 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500/50 focus:border-transparent"
          />
          <button
            type="submit"
            class="btn-primary px-6"
            disabled={!newMessage.trim()}
          >
            Send
          </button>
        </form>
      </div>
    {:else}
      <div class="flex-1 flex items-center justify-center text-gray-400">
        Select a conversation to start messaging
      </div>
    {/if}
  </div>
</div>

<style lang="postcss">
  .btn-primary {
    @apply inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 bg-gradient-to-r from-primary-500 to-primary-600 text-black hover:from-primary-400 hover:to-primary-500 hover:shadow-neon disabled:opacity-50 disabled:cursor-not-allowed;
  }

  .btn-outline {
    @apply inline-flex items-center justify-center px-6 py-3 rounded-lg font-medium transition-all duration-200 border-2 border-primary-500 text-primary-500 hover:bg-primary-500/10 disabled:opacity-50 disabled:cursor-not-allowed;
  }
</style> 