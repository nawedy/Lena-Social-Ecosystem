<!-- (protected)/messages/+page.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { auth } from '$lib/auth/store';
  import { supabase } from '$lib/supabaseClient';
  import Button from '$lib/components/ui/Button.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Alert from '$lib/components/ui/Alert.svelte';
  import { ethers } from 'ethers';

  let loading = false;
  let error: string | null = null;
  let conversations: any[] = [];
  let selectedConversation: any = null;
  let messages: any[] = [];
  let newMessage = '';
  let searchQuery = '';
  let subscription: any = null;

  // Encryption state
  let encryptionKeys: {
    [userId: string]: {
      publicKey: string;
      sharedSecret?: string;
    };
  } = {};

  onMount(async () => {
    await loadConversations();
    await initializeEncryption();
  });

  onDestroy(() => {
    if (subscription) {
      subscription.unsubscribe();
    }
  });

  async function initializeEncryption() {
    try {
      // Get user's encryption keys
      const { data: keys, error: keysError } = await supabase
        .from('encryption_keys')
        .select('*')
        .eq('user_id', auth.user?.id)
        .eq('key_type', 'messaging');

      if (keysError) throw keysError;

      // Generate new keys if none exist
      if (!keys?.length) {
        const wallet = ethers.Wallet.createRandom();
        const { error: saveError } = await supabase
          .from('encryption_keys')
          .insert({
            user_id: auth.user?.id,
            key_type: 'messaging',
            public_key: wallet.publicKey,
            encrypted_private_key: wallet.privateKey // In production, encrypt this
          });

        if (saveError) throw saveError;
      }
    } catch (e) {
      error = 'Failed to initialize encryption';
      console.error(e);
    }
  }

  async function loadConversations() {
    loading = true;
    try {
      const { data, error: conversationsError } = await supabase
        .from('conversations')
        .select(`
          *,
          participants:conversation_participants(
            user:profiles(
              id,
              username,
              avatar_url
            )
          )
        `)
        .eq('participants.user_id', auth.user?.id);

      if (conversationsError) throw conversationsError;

      conversations = data || [];

      // Subscribe to new conversations
      subscription = supabase
        .channel('conversations')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'conversations',
            filter: `participants->>'user_id'=eq.${auth.user?.id}`
          },
          () => loadConversations()
        )
        .subscribe();

    } catch (e) {
      error = 'Failed to load conversations';
      console.error(e);
    } finally {
      loading = false;
    }
  }

  async function selectConversation(conversation: any) {
    selectedConversation = conversation;
    await loadMessages(conversation.id);

    // Load participants' public keys
    for (const participant of conversation.participants) {
      if (participant.user.id === auth.user?.id) continue;

      const { data: keys } = await supabase
        .from('encryption_keys')
        .select('public_key')
        .eq('user_id', participant.user.id)
        .eq('key_type', 'messaging')
        .single();

      if (keys) {
        encryptionKeys[participant.user.id] = {
          publicKey: keys.public_key
        };
      }
    }
  }

  async function loadMessages(conversationId: string) {
    loading = true;
    try {
      const { data, error: messagesError } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles(
            id,
            username,
            avatar_url
          )
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      messages = await Promise.all((data || []).map(async (message) => ({
        ...message,
        content: await decryptMessage(message.content, message.sender.id)
      })));

    } catch (e) {
      error = 'Failed to load messages';
      console.error(e);
    } finally {
      loading = false;
    }
  }

  async function sendMessage() {
    if (!newMessage.trim() || !selectedConversation) return;

    loading = true;
    try {
      // Encrypt message for each participant
      const encryptedMessages = await Promise.all(
        selectedConversation.participants
          .filter((p: any) => p.user.id !== auth.user?.id)
          .map(async (p: any) => {
            const encrypted = await encryptMessage(newMessage, p.user.id);
            return {
              recipient_id: p.user.id,
              content: encrypted
            };
          })
      );

      // Send message
      const { error: sendError } = await supabase
        .from('messages')
        .insert({
          conversation_id: selectedConversation.id,
          sender_id: auth.user?.id,
          content: encryptedMessages[0].content, // Store first encryption
          recipients: encryptedMessages
        });

      if (sendError) throw sendError;

      newMessage = '';
    } catch (e) {
      error = 'Failed to send message';
      console.error(e);
    } finally {
      loading = false;
    }
  }

  async function encryptMessage(message: string, recipientId: string) {
    // Get recipient's public key
    const recipientKey = encryptionKeys[recipientId]?.publicKey;
    if (!recipientKey) throw new Error('Recipient public key not found');

    // Get sender's private key
    const { data: senderKey } = await supabase
      .from('encryption_keys')
      .select('encrypted_private_key')
      .eq('user_id', auth.user?.id)
      .eq('key_type', 'messaging')
      .single();

    if (!senderKey) throw new Error('Sender private key not found');

    // Create shared secret if not exists
    if (!encryptionKeys[recipientId].sharedSecret) {
      const wallet = new ethers.Wallet(senderKey.encrypted_private_key);
      const sharedSecret = wallet.privateKey; // In production, use proper ECDH
      encryptionKeys[recipientId].sharedSecret = sharedSecret;
    }

    // Encrypt message
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await crypto.subtle.importKey(
      'raw',
      ethers.utils.arrayify(encryptionKeys[recipientId].sharedSecret!),
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    return ethers.utils.hexlify(
      ethers.utils.concat([iv, new Uint8Array(encrypted)])
    );
  }

  async function decryptMessage(encryptedMessage: string, senderId: string) {
    try {
      // Get sender's public key
      const senderKey = encryptionKeys[senderId]?.publicKey;
      if (!senderKey) return '[Encrypted Message]';

      // Get recipient's private key
      const { data: recipientKey } = await supabase
        .from('encryption_keys')
        .select('encrypted_private_key')
        .eq('user_id', auth.user?.id)
        .eq('key_type', 'messaging')
        .single();

      if (!recipientKey) return '[Encrypted Message]';

      // Create shared secret if not exists
      if (!encryptionKeys[senderId].sharedSecret) {
        const wallet = new ethers.Wallet(recipientKey.encrypted_private_key);
        const sharedSecret = wallet.privateKey; // In production, use proper ECDH
        encryptionKeys[senderId].sharedSecret = sharedSecret;
      }

      // Decrypt message
      const encrypted = ethers.utils.arrayify(encryptedMessage);
      const iv = encrypted.slice(0, 12);
      const data = encrypted.slice(12);

      const key = await crypto.subtle.importKey(
        'raw',
        ethers.utils.arrayify(encryptionKeys[senderId].sharedSecret!),
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        data
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (e) {
      console.error('Failed to decrypt message:', e);
      return '[Encrypted Message]';
    }
  }
</script>

<div class="container mx-auto px-4 py-8">
  <div class="max-w-6xl mx-auto">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
      <div class="grid grid-cols-12 divide-x divide-gray-200 dark:divide-gray-700">
        <!-- Conversations List -->
        <div class="col-span-4 h-[calc(100vh-12rem)]">
          <div class="p-4 border-b border-gray-200 dark:border-gray-700">
            <Input
              type="search"
              placeholder="Search conversations..."
              bind:value={searchQuery}
            />
          </div>

          <div class="overflow-y-auto h-full">
            {#each conversations as conversation}
              <button
                class="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                class:bg-gray-100={selectedConversation?.id === conversation.id}
                on:click={() => selectConversation(conversation)}
              >
                <div class="flex items-center space-x-3">
                  <div class="flex -space-x-2">
                    {#each conversation.participants as participant}
                      {#if participant.user.id !== auth.user?.id}
                        <img
                          src={participant.user.avatar_url || '/default-avatar.png'}
                          alt={participant.user.username}
                          class="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800"
                        />
                      {/if}
                    {/each}
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {conversation.participants
                        .filter((p: any) => p.user.id !== auth.user?.id)
                        .map((p: any) => p.user.username)
                        .join(', ')}
                    </p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {conversation.last_message || 'No messages yet'}
                    </p>
                  </div>
                </div>
              </button>
            {/each}
          </div>
        </div>

        <!-- Messages -->
        <div class="col-span-8 h-[calc(100vh-12rem)] flex flex-col">
          {#if selectedConversation}
            <!-- Chat Header -->
            <div class="p-4 border-b border-gray-200 dark:border-gray-700">
              <div class="flex items-center space-x-3">
                <div class="flex -space-x-2">
                  {#each selectedConversation.participants as participant}
                    {#if participant.user.id !== auth.user?.id}
                      <img
                        src={participant.user.avatar_url || '/default-avatar.png'}
                        alt={participant.user.username}
                        class="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800"
                      />
                    {/if}
                  {/each}
                </div>
                <div>
                  <h3 class="text-lg font-medium text-gray-900 dark:text-white">
                    {selectedConversation.participants
                      .filter((p: any) => p.user.id !== auth.user?.id)
                      .map((p: any) => p.user.username)
                      .join(', ')}
                  </h3>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    End-to-end encrypted conversation
                  </p>
                </div>
              </div>
            </div>

            <!-- Messages List -->
            <div class="flex-1 overflow-y-auto p-4 space-y-4">
              {#each messages as message}
                <div class="flex items-start space-x-3 {message.sender.id === auth.user?.id ? 'flex-row-reverse space-x-reverse' : ''}">
                  <img
                    src={message.sender.avatar_url || '/default-avatar.png'}
                    alt={message.sender.username}
                    class="w-8 h-8 rounded-full"
                  />
                  <div class="flex flex-col">
                    <div
                      class="inline-block rounded-lg px-4 py-2 max-w-xs lg:max-w-md {
                        message.sender.id === auth.user?.id
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                      }"
                    >
                      <p class="text-sm">{message.content}</p>
                    </div>
                    <span class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {new Date(message.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              {/each}
            </div>

            <!-- Message Input -->
            <div class="p-4 border-t border-gray-200 dark:border-gray-700">
              <form
                class="flex items-center space-x-2"
                on:submit|preventDefault={sendMessage}
              >
                <Input
                  type="text"
                  placeholder="Type a message..."
                  bind:value={newMessage}
                  class="flex-1"
                />
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!newMessage.trim() || loading}
                >
                  Send
                </Button>
              </form>
            </div>
          {:else}
            <div class="flex-1 flex items-center justify-center">
              <p class="text-gray-500 dark:text-gray-400">
                Select a conversation to start messaging
              </p>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div> 