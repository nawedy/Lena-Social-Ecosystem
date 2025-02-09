&lt;script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { Button, Icon, Avatar } from '@tiktok-toe/ui-shared/components/ui';
  import { userStore } from '@tiktok-toe/shared/stores/user';
  import { performanceService } from '@tiktok-toe/shared/services/optimization/PerformanceService';

  export let streamId: string;
  export let streamer: {
    id: string;
    name: string;
    username: string;
    avatar: string;
    followers: number;
  };

  const dispatch = createEventDispatcher<{
    follow: { streamerId: string };
    unfollow: { streamerId: string };
    error: { message: string };
    close: void;
  }>();

  let videoContainer: HTMLDivElement;
  let chatContainer: HTMLDivElement;
  let chatInput: HTMLInputElement;
  let error: string | null = null;
  let loading = true;
  let following = false;
  let viewers = 0;
  let duration = 0;
  let quality: 'auto' | '1080p' | '720p' | '480p' | '360p' = 'auto';
  let volume = 1;
  let muted = false;
  let fullscreen = false;
  let showControls = true;
  let controlsTimeout: number | null = null;
  let showChat = true;
  let chatMessage = '';

  // Chat messages
  let messages: {
    id: string;
    userId: string;
    username: string;
    avatar: string;
    message: string;
    timestamp: number;
    type: 'message' | 'follow' | 'gift' | 'system';
    gift?: {
      id: string;
      name: string;
      amount: number;
      icon: string;
    };
  }[] = [];

  // Stream stats
  let stats = {
    bitrate: 0,
    frameRate: 0,
    resolution: { width: 0, height: 0 },
    networkQuality: 0,
    bufferHealth: 0,
    latency: 0
  };

  onMount(() => {
    performanceService.optimizeForStreaming();
    initializePlayer();
    initializeChat();

    // Show/hide controls on mouse move
    const handleMouseMove = () => {
      showControls = true;
      if (controlsTimeout) {
        clearTimeout(controlsTimeout);
      }
      controlsTimeout = window.setTimeout(() => {
        if (!chatInput?.matches(':focus')) {
          showControls = false;
        }
      }, 3000);
    };

    videoContainer?.addEventListener('mousemove', handleMouseMove);
    return () => {
      videoContainer?.removeEventListener('mousemove', handleMouseMove);
    };
  });

  onDestroy(() => {
    cleanup();
  });

  function cleanup() {
    if (controlsTimeout) {
      clearTimeout(controlsTimeout);
    }
  }

  function initializePlayer() {
    // Simulated player initialization
    setTimeout(() => {
      loading = false;
      startStatsUpdate();
      startDurationUpdate();
    }, 1000);
  }

  function initializeChat() {
    // Simulated initial messages
    messages = [
      {
        id: 'msg-1',
        userId: 'system',
        username: 'System',
        avatar: '/system-avatar.png',
        message: 'Welcome to the stream!',
        timestamp: Date.now(),
        type: 'system'
      }
    ];

    // Simulated new messages every few seconds
    setInterval(() => {
      if (Math.random() > 0.7) {
        const types: ('message' | 'follow' | 'gift')[] = ['message', 'follow', 'gift'];
        const type = types[Math.floor(Math.random() * types.length)];
        const userId = `user-${Math.floor(Math.random() * 1000)}`;

        messages = [...messages, {
          id: `msg-${Date.now()}`,
          userId,
          username: `User ${userId}`,
          avatar: `https://picsum.photos/seed/${userId}/64`,
          message: type === 'message' ? 'This stream is amazing! 🔥' : '',
          timestamp: Date.now(),
          type,
          ...(type === 'gift' && {
            gift: {
              id: 'super-heart',
              name: 'Super Heart',
              amount: Math.floor(Math.random() * 100) + 1,
              icon: '❤️'
            }
          })
        }];

        // Keep only last 100 messages
        if (messages.length > 100) {
          messages = messages.slice(-100);
        }

        // Scroll chat to bottom
        requestAnimationFrame(() => {
          if (chatContainer) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
          }
        });
      }
    }, 2000);
  }

  function startStatsUpdate() {
    setInterval(() => {
      stats = {
        bitrate: 2500000 + Math.random() * 1000000,
        frameRate: 30 + Math.random() * 30,
        resolution: { width: 1920, height: 1080 },
        networkQuality: Math.floor(Math.random() * 2) + 4,
        bufferHealth: Math.random() * 2 + 1,
        latency: Math.random() * 500 + 500
      };
      viewers = Math.floor(Math.random() * 1000) + 100;
    }, 1000);
  }

  function startDurationUpdate() {
    setInterval(() => {
      duration++;
    }, 1000);
  }

  function handleQualityChange(newQuality: typeof quality) {
    quality = newQuality;
    // Simulate quality change
    loading = true;
    setTimeout(() => {
      loading = false;
    }, 500);
  }

  function handleVolumeChange(event: Event) {
    const input = event.target as HTMLInputElement;
    volume = parseFloat(input.value);
    muted = volume === 0;
  }

  function toggleMute() {
    muted = !muted;
    volume = muted ? 0 : 1;
  }

  function toggleFullscreen() {
    if (!videoContainer) return;

    if (!document.fullscreenElement) {
      videoContainer.requestFullscreen();
      fullscreen = true;
    } else {
      document.exitFullscreen();
      fullscreen = false;
    }
  }

  function toggleChat() {
    showChat = !showChat;
  }

  function handleFollow() {
    following = !following;
    if (following) {
      dispatch('follow', { streamerId: streamer.id });
      messages = [...messages, {
        id: `msg-${Date.now()}`,
        userId: $userStore.id,
        username: $userStore.username,
        avatar: $userStore.avatar,
        message: '',
        timestamp: Date.now(),
        type: 'follow'
      }];
    } else {
      dispatch('unfollow', { streamerId: streamer.id });
    }
  }

  function sendMessage() {
    if (!chatMessage.trim()) return;

    messages = [...messages, {
      id: `msg-${Date.now()}`,
      userId: $userStore.id,
      username: $userStore.username,
      avatar: $userStore.avatar,
      message: chatMessage,
      timestamp: Date.now(),
      type: 'message'
    }];

    chatMessage = '';

    // Scroll chat to bottom
    requestAnimationFrame(() => {
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    });
  }

  function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return [hours, minutes, remainingSeconds]
      .map(v => v.toString().padStart(2, '0'))
      .join(':');
  }

  function formatNumber(num: number): string {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  }

  function formatBitrate(bits: number): string {
    const mbps = bits / 1000000;
    return `${mbps.toFixed(1)} Mbps`;
  }

  function formatLatency(ms: number): string {
    return `${ms.toFixed(0)}ms`;
  }

  function getNetworkQualityColor(quality: number): string {
    if (quality >= 4) return 'text-green-500';
    if (quality >= 2) return 'text-yellow-500';
    return 'text-red-500';
  }

  function formatTimestamp(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  }
</script>

<div class="fixed inset-0 bg-black flex z-50">
  <!-- Video Container -->
  <div
    bind:this={videoContainer}
    class="relative flex-1 bg-black"
  >
    <!-- Video Player -->
    <video
      class="w-full h-full object-contain"
      poster={`https://picsum.photos/seed/${streamId}/1920/1080`}
    />

    <!-- Loading Overlay -->
    {#if loading}
      <div
        class="absolute inset-0 bg-black/50 flex items-center justify-center"
        transition:fade
      >
        <div class="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent" />
      </div>
    {/if}

    <!-- Controls Overlay -->
    {#if showControls}
      <div
        class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none"
        transition:fade={{ duration: 200 }}
      >
        <!-- Top Bar -->
        <div class="absolute top-0 left-0 right-0 p-4 flex items-center justify-between pointer-events-auto">
          <div class="flex items-center gap-4">
            <!-- Streamer Info -->
            <div class="flex items-center gap-3">
              <Avatar
                src={streamer.avatar}
                alt={streamer.name}
                size="md"
                class="ring-2 ring-primary-500"
              />
              <div>
                <h2 class="font-medium text-white">{streamer.name}</h2>
                <p class="text-sm text-gray-300">@{streamer.username}</p>
              </div>
            </div>

            <!-- Follow Button -->
            <Button
              variant={following ? 'outline' : 'primary'}
              size="sm"
              on:click={handleFollow}
            >
              {following ? 'Following' : 'Follow'}
            </Button>

            <!-- Live Badge -->
            <div class="bg-red-500 px-2 py-1 rounded text-sm font-medium text-white">
              LIVE
            </div>

            <!-- Viewer Count -->
            <div class="flex items-center gap-2 text-white">
              <Icon name="users" class="w-4 h-4" />
              <span>{formatNumber(viewers)}</span>
            </div>
          </div>

          <div class="flex items-center gap-4">
            <!-- Stream Quality -->
            <div class="relative group">
              <button class="flex items-center gap-2 text-white">
                <Icon name="settings" class="w-5 h-5" />
                <span>{quality}</span>
              </button>
              <div class="absolute right-0 top-full mt-2 bg-gray-900 rounded-lg shadow-lg overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity">
                {#each ['auto', '1080p', '720p', '480p', '360p'] as q}
                  <button
                    class="w-full px-4 py-2 text-left text-white hover:bg-gray-800"
                    class:text-primary-500={quality === q}
                    on:click={() => handleQualityChange(q)}
                  >
                    {q}
                  </button>
                {/each}
              </div>
            </div>

            <!-- Toggle Chat -->
            <button
              class="text-white hover:text-primary-500 transition-colors"
              on:click={toggleChat}
            >
              <Icon name={showChat ? 'message-square-off' : 'message-square'} class="w-5 h-5" />
            </button>

            <!-- Close Button -->
            <button
              class="text-white hover:text-primary-500 transition-colors"
              on:click={() => dispatch('close')}
            >
              <Icon name="x" class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Bottom Bar -->
        <div class="absolute bottom-0 left-0 right-0 p-4 pointer-events-auto">
          <div class="flex items-center gap-4">
            <!-- Volume Control -->
            <div class="flex items-center gap-2">
              <button
                class="text-white hover:text-primary-500 transition-colors"
                on:click={toggleMute}
              >
                <Icon
                  name={muted ? 'volume-x' : volume < 0.5 ? 'volume-1' : 'volume-2'}
                  class="w-5 h-5"
                />
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                class="w-24"
                value={volume}
                on:input={handleVolumeChange}
              />
            </div>

            <!-- Stream Duration -->
            <div class="text-white">
              {formatDuration(duration)}
            </div>

            <div class="flex-1" />

            <!-- Stream Stats -->
            <div class="flex items-center gap-4 text-sm text-white">
              <div>
                {formatBitrate(stats.bitrate)}
              </div>
              <div>
                {stats.resolution.height}p
              </div>
              <div>
                {stats.frameRate.toFixed(0)} FPS
              </div>
              <div class={getNetworkQualityColor(stats.networkQuality)}>
                {stats.networkQuality}/5
              </div>
              <div>
                {formatLatency(stats.latency)}
              </div>
            </div>

            <!-- Fullscreen Button -->
            <button
              class="text-white hover:text-primary-500 transition-colors"
              on:click={toggleFullscreen}
            >
              <Icon
                name={fullscreen ? 'minimize' : 'maximize'}
                class="w-5 h-5"
              />
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Chat Panel -->
  {#if showChat}
    <div
      class="w-96 bg-gray-900 border-l border-gray-800 flex flex-col"
      transition:slide={{ axis: 'x' }}
    >
      <!-- Chat Messages -->
      <div
        bind:this={chatContainer}
        class="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {#each messages as message (message.id)}
          <div
            class="animate-fade-in"
            transition:fade={{ duration: 200 }}
          >
            {#if message.type === 'system'}
              <div class="bg-gray-800/50 text-gray-400 text-sm px-3 py-2 rounded-lg">
                {message.message}
              </div>
            {:else if message.type === 'follow'}
              <div class="flex items-center gap-2 text-sm">
                <Avatar
                  src={message.avatar}
                  alt={message.username}
                  size="sm"
                />
                <span class="font-medium text-primary-500">{message.username}</span>
                <span class="text-gray-400">started following</span>
              </div>
            {:else if message.type === 'gift'}
              <div class="flex items-center gap-2 text-sm">
                <Avatar
                  src={message.avatar}
                  alt={message.username}
                  size="sm"
                />
                <span class="font-medium text-primary-500">{message.username}</span>
                <span class="text-gray-400">sent</span>
                <span class="font-medium text-yellow-500">
                  {message.gift?.amount}x {message.gift?.icon}
                </span>
              </div>
            {:else}
              <div class="group flex gap-2">
                <Avatar
                  src={message.avatar}
                  alt={message.username}
                  size="sm"
                />
                <div class="flex-1 space-y-1">
                  <div class="flex items-baseline gap-2">
                    <span class="font-medium text-primary-500">{message.username}</span>
                    <span class="text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      {formatTimestamp(message.timestamp)}
                    </span>
                  </div>
                  <p class="text-white">{message.message}</p>
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>

      <!-- Chat Input -->
      <div class="p-4 border-t border-gray-800">
        <form
          class="flex gap-2"
          on:submit|preventDefault={sendMessage}
        >
          <input
            type="text"
            bind:this={chatInput}
            bind:value={chatMessage}
            placeholder="Send a message..."
            class="flex-1 bg-gray-800 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <Button
            type="submit"
            variant="primary"
            disabled={!chatMessage.trim()}
          >
            <Icon name="send" class="w-5 h-5" />
          </Button>
        </form>
      </div>
    </div>
  {/if}
</div>

<style>
  .animate-fade-in {
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Custom range input styling */
  input[type="range"] {
    -webkit-appearance: none;
    background: transparent;
  }

  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    height: 16px;
    width: 16px;
    border-radius: 50%;
    background: theme('colors.primary.500');
    cursor: pointer;
    margin-top: -6px;
  }

  input[type="range"]::-webkit-slider-runnable-track {
    width: 100%;
    height: 4px;
    background: theme('colors.gray.700');
    border-radius: 2px;
  }

  input[type="range"]:focus {
    outline: none;
  }
</style> 