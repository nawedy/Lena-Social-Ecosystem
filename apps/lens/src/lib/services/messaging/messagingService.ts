import { writable, derived } from 'svelte/store';
import { supabase } from '$lib/supabase';
import { api } from '$lib/services/api';
import { encryption } from './encryptionService';
import { voice } from './voiceService';
import type {
  Message,
  Chat,
  MessageDraft,
  ChatPreferences,
  MessageReaction,
  MessageThread,
  ChatEvent,
  ChatAnalytics,
  ChatInvite
} from '$lib/types/messaging';

interface MessagingState {
  chats: Record<string, Chat>;
  messages: Record<string, Record<string, Message>>;
  drafts: Record<string, MessageDraft>;
  preferences: Record<string, ChatPreferences>;
  threads: Record<string, MessageThread>;
  reactions: Record<string, MessageReaction[]>;
  events: Record<string, ChatEvent[]>;
  analytics: Record<string, ChatAnalytics>;
  activeChat: string | null;
  loading: boolean;
  error: string | null;
}

class MessagingService {
  private store = writable<MessagingState>({
    chats: {},
    messages: {},
    drafts: {},
    preferences: {},
    threads: {},
    reactions: {},
    events: {},
    analytics: {},
    activeChat: null,
    loading: false,
    error: null
  });

  private subscriptions: Record<string, any> = {};

  constructor() {
    // Initialize encryption
    encryption.initialize();
  }

  /**
   * Initialize messaging and subscribe to updates
   */
  async initialize(): Promise<void> {
    this.store.update(state => ({ ...state, loading: true }));

    try {
      // Get user's chats
      const { data: chats } = await api.get<Chat[]>('/chats');
      
      if (chats) {
        // Initialize chats
        const chatMap = Object.fromEntries(
          chats.map(chat => [chat.id, chat])
        );

        // Subscribe to chat updates
        chats.forEach(chat => {
          this.subscribeToChat(chat.id);
        });

        this.store.update(state => ({
          ...state,
          chats: chatMap,
          loading: false
        }));
      }
    } catch (error) {
      console.error('Failed to initialize messaging:', error);
      this.store.update(state => ({
        ...state,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to initialize messaging'
      }));
    }
  }

  /**
   * Create a new chat
   */
  async createChat(data: {
    type: Chat['type'];
    name?: string;
    description?: string;
    participants: string[];
    settings?: Partial<Chat['settings']>;
  }): Promise<Chat | null> {
    try {
      const { data: chat } = await api.post<Chat>('/chats', data);
      
      if (chat) {
        // Initialize encryption if enabled
        if (chat.settings.encryption) {
          const keyBundle = await encryption.getKeyBundle();
          await api.post(`/chats/${chat.id}/keys`, { keyBundle });
        }

        // Subscribe to updates
        this.subscribeToChat(chat.id);

        this.store.update(state => ({
          ...state,
          chats: {
            ...state.chats,
            [chat.id]: chat
          }
        }));

        return chat;
      }
      return null;
    } catch (error) {
      console.error('Failed to create chat:', error);
      return null;
    }
  }

  /**
   * Send message to chat
   */
  async sendMessage(chatId: string, data: {
    type: Message['type'];
    content: Message['content'];
    replyTo?: string;
  }): Promise<Message | null> {
    try {
      const chat = this.store.chats[chatId];
      if (!chat) throw new Error('Chat not found');

      // Prepare message
      let messageData = { ...data };

      // Handle encryption
      if (chat.settings.encryption) {
        const encryptedContent = await encryption.encryptMessage(
          chat.metadata.groupKey || chat.participants[0].userId,
          JSON.stringify(data.content)
        );

        messageData.content = {
          ...data.content,
          metadata: {
            encryptedKey: encryptedContent.body,
            type: encryptedContent.type
          }
        };
      }

      // Send message
      const { data: message } = await api.post<Message>(
        `/chats/${chatId}/messages`,
        messageData
      );

      if (message) {
        this.store.update(state => ({
          ...state,
          messages: {
            ...state.messages,
            [chatId]: {
              ...state.messages[chatId],
              [message.id]: message
            }
          }
        }));

        return message;
      }
      return null;
    } catch (error) {
      console.error('Failed to send message:', error);
      return null;
    }
  }

  /**
   * Load chat messages
   */
  async loadMessages(chatId: string, options?: {
    before?: string;
    limit?: number;
  }): Promise<Message[]> {
    try {
      const { data: messages } = await api.get<Message[]>(
        `/chats/${chatId}/messages`,
        options
      );

      if (messages) {
        // Decrypt messages if needed
        const chat = this.store.chats[chatId];
        if (chat?.settings.encryption) {
          await Promise.all(
            messages.map(async message => {
              if (message.metadata.encryptedKey) {
                const decrypted = await encryption.decryptMessage(
                  message.senderId,
                  {
                    type: message.metadata.type,
                    body: message.metadata.encryptedKey
                  }
                );
                message.content = JSON.parse(
                  new TextDecoder().decode(decrypted)
                );
              }
            })
          );
        }

        this.store.update(state => ({
          ...state,
          messages: {
            ...state.messages,
            [chatId]: {
              ...state.messages[chatId],
              ...Object.fromEntries(messages.map(m => [m.id, m]))
            }
          }
        }));

        return messages;
      }
      return [];
    } catch (error) {
      console.error('Failed to load messages:', error);
      return [];
    }
  }

  /**
   * Subscribe to chat updates
   */
  private subscribeToChat(chatId: string): void {
    // Messages subscription
    this.subscriptions[`messages:${chatId}`] = supabase
      .channel(`chat:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`
        },
        this.handleMessageChange.bind(this)
      )
      .subscribe();

    // Events subscription
    this.subscriptions[`events:${chatId}`] = supabase
      .channel(`events:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_events',
          filter: `chat_id=eq.${chatId}`
        },
        this.handleEventChange.bind(this)
      )
      .subscribe();

    // Reactions subscription
    this.subscriptions[`reactions:${chatId}`] = supabase
      .channel(`reactions:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
          filter: `chat_id=eq.${chatId}`
        },
        this.handleReactionChange.bind(this)
      )
      .subscribe();
  }

  /**
   * Handle message changes
   */
  private async handleMessageChange(payload: any): Promise<void> {
    const { new: message, old: oldMessage, eventType } = payload;

    // Decrypt message if needed
    const chat = this.store.chats[message.chatId];
    if (chat?.settings.encryption && message.metadata?.encryptedKey) {
      const decrypted = await encryption.decryptMessage(
        message.senderId,
        {
          type: message.metadata.type,
          body: message.metadata.encryptedKey
        }
      );
      message.content = JSON.parse(
        new TextDecoder().decode(decrypted)
      );
    }

    this.store.update(state => {
      const chatMessages = state.messages[message.chatId] || {};

      switch (eventType) {
        case 'INSERT':
        case 'UPDATE':
          return {
            ...state,
            messages: {
              ...state.messages,
              [message.chatId]: {
                ...chatMessages,
                [message.id]: message
              }
            }
          };
        case 'DELETE':
          const { [oldMessage.id]: _, ...remainingMessages } = chatMessages;
          return {
            ...state,
            messages: {
              ...state.messages,
              [message.chatId]: remainingMessages
            }
          };
        default:
          return state;
      }
    });
  }

  /**
   * Handle chat event changes
   */
  private handleEventChange(payload: any): void {
    const { new: event, eventType } = payload;

    this.store.update(state => {
      const chatEvents = state.events[event.chatId] || [];

      switch (eventType) {
        case 'INSERT':
          return {
            ...state,
            events: {
              ...state.events,
              [event.chatId]: [...chatEvents, event]
            }
          };
        default:
          return state;
      }
    });
  }

  /**
   * Handle reaction changes
   */
  private handleReactionChange(payload: any): void {
    const { new: reaction, old: oldReaction, eventType } = payload;

    this.store.update(state => {
      const messageReactions = state.reactions[reaction.messageId] || [];

      switch (eventType) {
        case 'INSERT':
          return {
            ...state,
            reactions: {
              ...state.reactions,
              [reaction.messageId]: [...messageReactions, reaction]
            }
          };
        case 'DELETE':
          return {
            ...state,
            reactions: {
              ...state.reactions,
              [reaction.messageId]: messageReactions.filter(
                r => r.userId !== oldReaction.userId
              )
            }
          };
        default:
          return state;
      }
    });
  }

  /**
   * Clean up subscriptions
   */
  destroy(): void {
    Object.values(this.subscriptions).forEach(subscription => {
      subscription.unsubscribe();
    });
    this.subscriptions = {};
    voice.destroy();
  }

  // Store subscriptions
  subscribe = this.store.subscribe;
  chats = derived(this.store, $store => $store.chats);
  messages = derived(this.store, $store => $store.messages);
  activeChat = derived(this.store, $store => $store.activeChat);
  loading = derived(this.store, $store => $store.loading);
  error = derived(this.store, $store => $store.error);
}

// Create messaging service instance
export const messaging = new MessagingService(); 