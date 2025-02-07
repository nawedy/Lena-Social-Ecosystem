<!-- Notifications Page -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { DatabaseService } from '$lib/services/database';
  import { auth } from '$lib/stores/auth';
  import { toasts } from '@lena/ui';
  import type { Profile, Post } from '$lib/types/supabase';

  interface Notification {
    id: string;
    type: 'like' | 'comment' | 'follow';
    actor: Profile;
    post?: Post;
    comment?: string;
    created_at: string;
    read: boolean;
  }

  let notifications: Notification[] = [];
  let isLoading = true;
  let notificationSubscription: any;

  onMount(async () => {
    try {
      // Load initial notifications
      const [likes, comments, follows] = await Promise.all([
        DatabaseService.getRecentLikes(),
        DatabaseService.getRecentComments(),
        DatabaseService.getRecentFollows()
      ]);

      // Transform likes into notifications
      const likeNotifications = likes.map(like => ({
        id: like.id,
        type: 'like' as const,
        actor: like.profiles,
        post: like.posts,
        created_at: like.created_at,
        read: false
      }));

      // Transform comments into notifications
      const commentNotifications = comments.map(comment => ({
        id: comment.id,
        type: 'comment' as const,
        actor: comment.profiles,
        post: comment.posts,
        comment: comment.content,
        created_at: comment.created_at,
        read: false
      }));

      // Transform follows into notifications
      const followNotifications = follows.map(follow => ({
        id: follow.id,
        type: 'follow' as const,
        actor: follow.profiles,
        created_at: follow.created_at,
        read: false
      }));

      // Combine and sort notifications by date
      notifications = [...likeNotifications, ...commentNotifications, ...followNotifications]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Subscribe to new notifications
      notificationSubscription = DatabaseService.subscribeToNotifications(handleNewNotification);

      isLoading = false;
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to load notifications');
    }
  });

  onDestroy(() => {
    if (notificationSubscription) {
      notificationSubscription.unsubscribe();
    }
  });

  function handleNewNotification(payload: any) {
    const { type, data } = payload;
    let notification: Notification;

    switch (type) {
      case 'like':
        notification = {
          id: data.id,
          type: 'like',
          actor: data.profiles,
          post: data.posts,
          created_at: data.created_at,
          read: false
        };
        break;
      case 'comment':
        notification = {
          id: data.id,
          type: 'comment',
          actor: data.profiles,
          post: data.posts,
          comment: data.content,
          created_at: data.created_at,
          read: false
        };
        break;
      case 'follow':
        notification = {
          id: data.id,
          type: 'follow',
          actor: data.profiles,
          created_at: data.created_at,
          read: false
        };
        break;
      default:
        return;
    }

    notifications = [notification, ...notifications];
    toasts.info(`@${notification.actor.username} ${getNotificationText(notification)}`);
  }

  function getNotificationText(notification: Notification): string {
    switch (notification.type) {
      case 'like':
        return 'liked your post';
      case 'comment':
        return 'commented on your post';
      case 'follow':
        return 'started following you';
      default:
        return '';
    }
  }

  function getNotificationIcon(type: Notification['type']): string {
    switch (type) {
      case 'like':
        return '❤️';
      case 'comment':
        return '💬';
      case 'follow':
        return '👤';
      default:
        return '';
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

  async function markAsRead(notification: Notification) {
    try {
      await DatabaseService.markNotificationAsRead(notification.id);
      notifications = notifications.map(n =>
        n.id === notification.id ? { ...n, read: true } : n
      );
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to mark notification as read');
    }
  }
</script>

<svelte:head>
  <title>Notifications | TikTokToe</title>
</svelte:head>

<div class="max-w-2xl mx-auto px-4 py-8">
  <h1 class="text-2xl font-bold mb-8">Notifications</h1>

  {#if isLoading}
    <div class="space-y-4">
      {#each Array(5) as _}
        <div class="animate-pulse flex items-start space-x-4 p-4 rounded-lg bg-primary-900/20">
          <div class="w-12 h-12 rounded-full bg-primary-900/50"></div>
          <div class="flex-1 space-y-2">
            <div class="h-4 bg-primary-900/50 rounded w-3/4"></div>
            <div class="h-3 bg-primary-900/50 rounded w-1/2"></div>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="space-y-4">
      {#each notifications as notification (notification.id)}
        <div
          class="flex items-start space-x-4 p-4 rounded-lg transition-colors hover:bg-primary-900/20"
          class:bg-primary-900/10={!notification.read}
          class:bg-transparent={notification.read}
          on:click={() => markAsRead(notification)}
        >
          <!-- Actor Avatar -->
          <img
            src={notification.actor.avatar_url || `https://api.dicebear.com/7.x/shapes/svg?seed=${notification.actor.id}`}
            alt={notification.actor.username}
            class="w-12 h-12 rounded-full bg-primary-900/50"
          />

          <!-- Notification Content -->
          <div class="flex-1 min-w-0">
            <div class="flex items-baseline space-x-2">
              <span class="text-xl">{getNotificationIcon(notification.type)}</span>
              <p class="font-medium">
                <span class="text-primary-400">@{notification.actor.username}</span>
                {getNotificationText(notification)}
              </p>
            </div>

            {#if notification.type === 'comment' && notification.comment}
              <p class="mt-2 text-gray-400 line-clamp-2">{notification.comment}</p>
            {/if}

            {#if notification.post}
              <div class="mt-2 rounded bg-primary-900/20 p-3">
                <p class="text-sm text-gray-400 line-clamp-2">{notification.post.content}</p>
              </div>
            {/if}

            <time class="block mt-2 text-sm text-gray-400">
              {formatTimestamp(notification.created_at)}
            </time>
          </div>
        </div>
      {/each}

      {#if notifications.length === 0}
        <div class="text-center text-gray-400 py-8">
          <p class="text-2xl mb-2">👋</p>
          <p>No notifications yet</p>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style lang="postcss">
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style> 