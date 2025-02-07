<!-- NotificationCenter.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade, slide, fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { writable, derived } from 'svelte/store';
  import { supabase } from '$lib/supabaseClient';
  import { user } from '$lib/stores/auth';

  // Types
  interface Notification {
    id: string;
    user_id: string;
    type: 'like' | 'repost' | 'reply' | 'mention' | 'follow' | 'tag';
    actor: {
      id: string;
      name: string;
      avatar_url: string;
      is_verified: boolean;
    };
    content: string;
    reference_id: string;
    reference_type: 'post' | 'comment' | 'profile';
    read: boolean;
    created_at: string;
  }

  interface NotificationGroup {
    date: string;
    notifications: Notification[];
  }

  // Stores
  const notifications = writable<Notification[]>([]);
  const isOpen = writable(false);
  const unreadCount = writable(0);
  const selectedTypes = writable<Set<string>>(new Set(['all']));
  const searchQuery = writable('');

  // Derived store for filtered and grouped notifications
  const filteredNotifications = derived(
    [notifications, selectedTypes, searchQuery],
    ([$notifications, $selectedTypes, $searchQuery]) => {
      let filtered = [...$notifications];

      // Apply type filter
      if (!$selectedTypes.has('all')) {
        filtered = filtered.filter(n => $selectedTypes.has(n.type));
      }

      // Apply search filter
      if ($searchQuery) {
        const query = $searchQuery.toLowerCase();
        filtered = filtered.filter(n =>
          n.content.toLowerCase().includes(query) ||
          n.actor.name.toLowerCase().includes(query)
        );
      }

      // Group by date
      const groups: NotificationGroup[] = [];
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();

      filtered.forEach(notification => {
        const date = new Date(notification.created_at).toDateString();
        let groupTitle = date;

        if (date === today) {
          groupTitle = 'Today';
        } else if (date === yesterday) {
          groupTitle = 'Yesterday';
        }

        const existingGroup = groups.find(g => g.date === groupTitle);
        if (existingGroup) {
          existingGroup.notifications.push(notification);
        } else {
          groups.push({
            date: groupTitle,
            notifications: [notification]
          });
        }
      });

      return groups;
    }
  );

  let subscription: any;

  onMount(async () => {
    if ($user) {
      await loadNotifications();
      setupRealtimeSubscription();
    }
  });

  onDestroy(() => {
    if (subscription) {
      subscription.unsubscribe();
    }
  });

  async function loadNotifications() {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          actor:actor_id (
            id,
            name,
            avatar_url,
            is_verified
          )
        `)
        .eq('user_id', $user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      notifications.set(data);
      updateUnreadCount(data);
    } catch (err) {
      console.error('Error loading notifications:', err);
    }
  }

  function setupRealtimeSubscription() {
    subscription = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${$user?.id}`
        },
        (payload) => {
          handleRealtimeUpdate(payload);
        }
      )
      .subscribe();
  }

  function handleRealtimeUpdate(payload: any) {
    notifications.update(current => {
      let updated = [...current];

      switch (payload.eventType) {
        case 'INSERT':
          showNotificationToast(payload.new);
          updated = [payload.new, ...updated];
          break;
        case 'DELETE':
          updated = updated.filter(n => n.id !== payload.old.id);
          break;
        case 'UPDATE':
          updated = updated.map(n =>
            n.id === payload.new.id ? payload.new : n
          );
          break;
      }

      updateUnreadCount(updated);
      return updated;
    });
  }

  function updateUnreadCount(notifs: Notification[]) {
    const count = notifs.filter(n => !n.read).length;
    unreadCount.set(count);
    updateFavicon(count);
  }

  function updateFavicon(count: number) {
    const favicon = document.querySelector('link[rel="icon"]');
    if (favicon && count > 0) {
      // Create a canvas to draw the favicon with a notification badge
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw original favicon
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, 32, 32);

        // Draw notification badge
        ctx.beginPath();
        ctx.arc(24, 8, 8, 0, 2 * Math.PI);
        ctx.fillStyle = '#ff003c';
        ctx.fill();

        // Draw count
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(count > 99 ? '99+' : count.toString(), 24, 8);

        // Update favicon
        favicon.setAttribute('href', canvas.toDataURL('image/png'));
      };
      img.src = favicon.getAttribute('href') || '';
    }
  }

  function showNotificationToast(notification: Notification) {
    // Create and show a toast notification
    const toast = document.createElement('div');
    toast.className = 'notification-toast';
    toast.innerHTML = `
      <div class="flex items-center p-4 space-x-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <img src="${notification.actor.avatar_url}" class="w-10 h-10 rounded-full" />
        <div>
          <p class="font-medium">${notification.actor.name}</p>
          <p class="text-sm text-gray-500">${notification.content}</p>
        </div>
      </div>
    `;

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 5000);
  }

  async function markAsRead(notificationId?: string) {
    try {
      if (notificationId) {
        await supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', notificationId);
      } else {
        await supabase
          .from('notifications')
          .update({ read: true })
          .eq('user_id', $user?.id)
          .eq('read', false);
      }

      await loadNotifications();
    } catch (err) {
      console.error('Error marking notifications as read:', err);
    }
  }

  async function deleteNotification(notificationId: string) {
    try {
      await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      notifications.update(current =>
        current.filter(n => n.id !== notificationId)
      );
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  }

  function toggleType(type: string) {
    selectedTypes.update(current => {
      const updated = new Set(current);
      if (type === 'all') {
        updated.clear();
        updated.add('all');
      } else {
        updated.delete('all');
        if (updated.has(type)) {
          updated.delete(type);
          if (updated.size === 0) {
            updated.add('all');
          }
        } else {
          updated.add(type);
        }
      }
      return updated;
    });
  }
</script>

<div class="relative">
  <!-- Notification Bell -->
  <button
    class="relative p-2 text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400"
    on:click={() => isOpen.update(v => !v)}
  >
    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>

    {#if $unreadCount > 0}
      <span
        class="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full"
        transition:scale
      >
        {$unreadCount}
      </span>
    {/if}
  </button>

  <!-- Notification Panel -->
  {#if $isOpen}
    <div
      class="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 rounded-lg shadow-xl"
      transition:fly={{ y: -20, duration: 200 }}
    >
      <!-- Header -->
      <div class="p-4 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
            Notifications
          </h2>
          {#if $unreadCount > 0}
            <button
              class="text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
              on:click={() => markAsRead()}
            >
              Mark all as read
            </button>
          {/if}
        </div>

        <!-- Filters -->
        <div class="mt-4 space-y-2">
          <div class="flex flex-wrap gap-2">
            {#each ['all', 'like', 'repost', 'reply', 'mention', 'follow', 'tag'] as type}
              <button
                class="px-3 py-1 text-sm rounded-full transition-colors
                       {$selectedTypes.has(type)
                         ? 'bg-blue-500 text-white'
                         : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}"
                on:click={() => toggleType(type)}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            {/each}
          </div>

          <input
            type="text"
            class="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg
                   text-gray-900 dark:text-white placeholder-gray-500
                   focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Search notifications..."
            bind:value={$searchQuery}
          />
        </div>
      </div>

      <!-- Notification List -->
      <div class="max-h-[60vh] overflow-y-auto">
        {#if $filteredNotifications.length === 0}
          <div class="p-4 text-center text-gray-500 dark:text-gray-400">
            No notifications found
          </div>
        {:else}
          {#each $filteredNotifications as group}
            <div class="border-b border-gray-200 dark:border-gray-700 last:border-0">
              <div class="px-4 py-2 bg-gray-50 dark:bg-gray-750 text-sm font-medium text-gray-500">
                {group.date}
              </div>

              {#each group.notifications as notification (notification.id)}
                <div
                  class="p-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                  class:bg-blue-50={!notification.read}
                  transition:slide|local
                >
                  <div class="flex items-start space-x-3">
                    <!-- Actor Avatar -->
                    <img
                      src={notification.actor.avatar_url}
                      alt={notification.actor.name}
                      class="w-10 h-10 rounded-full"
                    />

                    <!-- Content -->
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center space-x-1">
                        <span class="font-medium text-gray-900 dark:text-white">
                          {notification.actor.name}
                        </span>
                        {#if notification.actor.is_verified}
                          <svg class="w-4 h-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                          </svg>
                        {/if}
                      </div>
                      <p class="text-gray-600 dark:text-gray-300">
                        {notification.content}
                      </p>
                      <span class="text-sm text-gray-500">
                        {new Date(notification.created_at).toLocaleTimeString()}
                      </span>
                    </div>

                    <!-- Actions -->
                    <div class="flex items-center space-x-2">
                      {#if !notification.read}
                        <button
                          class="text-blue-500 hover:text-blue-600"
                          on:click={() => markAsRead(notification.id)}
                        >
                          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                      {/if}
                      <button
                        class="text-gray-400 hover:text-red-500"
                        on:click={() => deleteNotification(notification.id)}
                      >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>

<style lang="postcss">
  .notification-toast {
    @apply fixed bottom-4 right-4 z-50 animate-slide-up;
  }

  @keyframes slide-up {
    0% {
      transform: translateY(100%);
      opacity: 0;
    }
    100% {
      transform: translateY(0);
      opacity: 1;
    }
  }
</style> 