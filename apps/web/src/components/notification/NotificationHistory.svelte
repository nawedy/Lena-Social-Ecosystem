<!-- NotificationHistory.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { NotificationService } from '@core/services/notification/notification.service';
  import type { NotificationConfig } from '@core/services/notification/types';
  import { Card } from '@/components/ui/card';
  import { Button } from '@/components/ui/button';
  import { Icon } from '@/components/ui/icon';

  export let notificationService: NotificationService;
  export let class: string = '';

  let notifications: NotificationConfig[] = [];
  let loading = true;
  let error: string | null = null;
  let page = 1;
  let totalPages = 1;
  let hasMore = false;

  const PAGE_SIZE = 20;

  onMount(() => {
    loadNotifications();
  });

  async function loadNotifications(reset = false) {
    if (reset) {
      page = 1;
      notifications = [];
    }

    try {
      loading = true;
      error = null;

      const result = await notificationService.getNotifications({
        page,
        limit: PAGE_SIZE
      });

      notifications = reset ? result.notifications : [...notifications, ...result.notifications];
      totalPages = Math.ceil(result.total / PAGE_SIZE);
      hasMore = page < totalPages;
    } catch (e) {
      error = 'Failed to load notifications';
      console.error('Failed to load notifications:', e);
    } finally {
      loading = false;
    }
  }

  async function loadMore() {
    if (loading || !hasMore) return;
    page++;
    await loadNotifications();
  }

  async function markAllAsRead() {
    try {
      await notificationService.markAllAsRead();
      loadNotifications(true);
    } catch (e) {
      console.error('Failed to mark all notifications as read:', e);
    }
  }

  async function handleNotificationClick(notification: NotificationConfig) {
    if (!notification.read) {
      try {
        await notificationService.markAsRead(notification.id!);
        notification.read = true;
      } catch (e) {
        console.error('Failed to mark notification as read:', e);
      }
    }

    if (notification.data?.actionUrl) {
      window.location.href = notification.data.actionUrl;
    }
  }

  const priorityClasses = {
    urgent: 'bg-red-50 border-red-200',
    high: 'bg-yellow-50 border-yellow-200',
    normal: 'bg-blue-50 border-blue-200',
    low: 'bg-gray-50 border-gray-200'
  };

  const priorityIcons = {
    urgent: 'exclamation-circle',
    high: 'exclamation-triangle',
    normal: 'info-circle',
    low: 'bell'
  };
</script>

<Card class={class}>
  <div class="p-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold">Notification History</h2>
      <Button
        variant="outline"
        size="sm"
        on:click={() => markAllAsRead()}
        disabled={loading || notifications.length === 0}
      >
        Mark All as Read
      </Button>
    </div>

    {#if error}
      <div class="text-center py-4 text-red-600">{error}</div>
    {:else if loading && notifications.length === 0}
      <div class="text-center py-4">Loading...</div>
    {:else if notifications.length === 0}
      <div class="text-center py-4 text-gray-500">No notifications</div>
    {:else}
      <div class="space-y-3">
        {#each notifications as notification (notification.id)}
          <div
            class={`p-4 rounded-lg border cursor-pointer transition-colors ${
              priorityClasses[notification.priority]
            } ${notification.read ? 'opacity-75' : ''} hover:opacity-100`}
            on:click={() => handleNotificationClick(notification)}
            role="button"
            tabindex="0"
          >
            <div class="flex items-start gap-3">
              <div class="flex-shrink-0">
                <Icon
                  name={priorityIcons[notification.priority]}
                  class="w-5 h-5"
                />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-2">
                  <h4 class="font-medium truncate">{notification.title}</h4>
                  <time class="text-sm text-gray-500 whitespace-nowrap">
                    {new Date(notification.created_at!).toLocaleDateString()}
                  </time>
                </div>
                <p class="text-sm text-gray-600 mt-1">{notification.body}</p>
                {#if notification.data?.actionUrl}
                  <div class="mt-2">
                    <span class="text-sm font-medium text-blue-600 hover:underline">
                      View Details →
                    </span>
                  </div>
                {/if}
              </div>
              {#if !notification.read}
                <div class="flex-shrink-0">
                  <div class="w-2 h-2 bg-blue-600 rounded-full" />
                </div>
              {/if}
            </div>
          </div>
        {/each}

        {#if hasMore}
          <div class="text-center pt-4">
            <Button
              variant="outline"
              on:click={loadMore}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Load More'}
            </Button>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</Card>

<style>
  /* Add any component-specific styles here */
</style> 