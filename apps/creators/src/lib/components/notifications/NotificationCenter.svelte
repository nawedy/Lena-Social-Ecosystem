<!-- NotificationCenter.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { notificationService } from '$lib/services/notification/NotificationService';
  import Icon from '../shared/Icon.svelte';
  import Badge from '../shared/Badge.svelte';
  import Tabs from '../shared/Tabs.svelte';
  import Switch from '../shared/Switch.svelte';
  import TimeInput from '../shared/TimeInput.svelte';

  let activeTab = 'notifications';
  let showPreferences = false;
  let notifications = notificationService.getNotifications();
  let preferences = notificationService.getPreferences();
  let stats = notificationService.getStats();
  let unsubscribe: () => void;

  onMount(() => {
    unsubscribe = notificationService.subscribe((data) => {
      notifications = data.notifications;
      preferences = data.preferences;
      stats = data.stats;
    });
  });

  onDestroy(() => {
    if (unsubscribe) unsubscribe();
  });

  function handleNotificationClick(notification: any) {
    if (!notification.read) {
      notificationService.markAsRead(notification.id);
    }
    if (notification.link) {
      window.location.href = notification.link;
    }
  }

  function handleMarkAllRead() {
    const unreadIds = notifications
      .filter(n => !n.read)
      .map(n => n.id);
    if (unreadIds.length > 0) {
      notificationService.markAsRead(unreadIds);
    }
  }

  function handleDeleteNotification(id: string) {
    notificationService.deleteNotification(id);
  }

  function handlePreferenceChange(key: string, value: any) {
    notificationService.updatePreferences({
      [key]: value
    });
  }

  function getNotificationIcon(type: string) {
    switch (type) {
      case 'mention': return 'at';
      case 'reply': return 'reply';
      case 'reaction': return 'heart';
      case 'moderation': return 'shield';
      case 'achievement': return 'trophy';
      case 'system': return 'bell';
      default: return 'bell';
    }
  }

  function formatDate(date: string) {
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
      .format(
        Math.floor((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        'day'
      );
  }
</script>

<div class="notification-center">
  <header class="header">
    <h2>Notifications</h2>
    <div class="actions">
      <button 
        class="icon-button"
        on:click={() => showPreferences = !showPreferences}
        aria-label="Settings"
      >
        <Icon name="settings" />
      </button>
      {#if stats?.unread > 0}
        <button 
          class="icon-button"
          on:click={handleMarkAllRead}
          aria-label="Mark all as read"
        >
          <Icon name="check-all" />
        </button>
      {/if}
    </div>
  </header>

  <Tabs
    items={[
      { id: 'notifications', label: 'All', count: stats?.total },
      { id: 'unread', label: 'Unread', count: stats?.unread },
      { id: 'mentions', label: 'Mentions', count: stats?.byType?.mention }
    ]}
    bind:active={activeTab}
  />

  {#if showPreferences}
    <div class="preferences" transition:slide>
      <h3>Notification Preferences</h3>
      
      <section>
        <h4>Channels</h4>
        <div class="preference-group">
          <Switch
            label="In-app notifications"
            checked={preferences?.channels.inApp}
            on:change={(e) => handlePreferenceChange('channels.inApp', e.detail)}
          />
          <Switch
            label="Email notifications"
            checked={preferences?.channels.email}
            on:change={(e) => handlePreferenceChange('channels.email', e.detail)}
          />
          <Switch
            label="Push notifications"
            checked={preferences?.channels.push}
            on:change={(e) => handlePreferenceChange('channels.push', e.detail)}
          />
        </div>
      </section>

      <section>
        <h4>Notification Types</h4>
        <div class="preference-group">
          {#each Object.entries(preferences?.types || {}) as [type, enabled]}
            <Switch
              label={type.charAt(0).toUpperCase() + type.slice(1)}
              checked={enabled}
              on:change={(e) => handlePreferenceChange(`types.${type}`, e.detail)}
            />
          {/each}
        </div>
      </section>

      <section>
        <h4>Schedule</h4>
        <div class="preference-group">
          <label>
            Digest Frequency
            <select
              value={preferences?.schedule.digest}
              on:change={(e) => handlePreferenceChange('schedule.digest', e.target.value)}
            >
              <option value="never">Never</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </label>

          <div class="quiet-hours">
            <h5>Quiet Hours</h5>
            <div class="time-range">
              <TimeInput
                label="Start"
                value={preferences?.schedule.quietHours.start}
                on:change={(e) => handlePreferenceChange('schedule.quietHours.start', e.detail)}
              />
              <TimeInput
                label="End"
                value={preferences?.schedule.quietHours.end}
                on:change={(e) => handlePreferenceChange('schedule.quietHours.end', e.detail)}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  {/if}

  <div class="notifications">
    {#if notifications.length === 0}
      <div class="empty-state" transition:fade>
        <Icon name="bell-off" size={32} />
        <p>No notifications to show</p>
      </div>
    {:else}
      {#each notifications as notification (notification.id)}
        <div
          class="notification"
          class:unread={!notification.read}
          transition:fade
          on:click={() => handleNotificationClick(notification)}
        >
          <div class="icon">
            <Icon name={getNotificationIcon(notification.type)} />
          </div>
          <div class="content">
            <div class="title">{notification.title}</div>
            <div class="body">{notification.body}</div>
            <div class="meta">
              <span class="time">{formatDate(notification.createdAt)}</span>
              {#if !notification.read}
                <Badge>New</Badge>
              {/if}
            </div>
          </div>
          <button
            class="delete-button"
            on:click|stopPropagation={() => handleDeleteNotification(notification.id)}
            aria-label="Delete notification"
          >
            <Icon name="trash" />
          </button>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style lang="postcss">
  .notification-center {
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
    background: var(--surface-1);
    border-radius: 8px;
    box-shadow: var(--shadow-2);
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid var(--border-color);

    h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
    }

    .actions {
      display: flex;
      gap: 8px;
    }
  }

  .preferences {
    padding: 16px;
    background: var(--surface-2);
    border-bottom: 1px solid var(--border-color);

    h3 {
      margin: 0 0 16px;
      font-size: 18px;
      font-weight: 600;
    }

    section {
      margin-bottom: 24px;

      &:last-child {
        margin-bottom: 0;
      }

      h4 {
        margin: 0 0 12px;
        font-size: 16px;
        font-weight: 500;
      }
    }

    .preference-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .quiet-hours {
      h5 {
        margin: 0 0 8px;
        font-size: 14px;
        font-weight: 500;
      }

      .time-range {
        display: flex;
        gap: 16px;
      }
    }
  }

  .notifications {
    max-height: 500px;
    overflow-y: auto;
    padding: 16px;

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 0;
      color: var(--text-2);
      gap: 16px;

      p {
        margin: 0;
        font-size: 16px;
      }
    }
  }

  .notification {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background: var(--surface-2);

      .delete-button {
        opacity: 1;
      }
    }

    &.unread {
      background: var(--primary-color-light);

      &:hover {
        background: var(--primary-color-light-hover);
      }

      .icon {
        color: var(--primary-color);
      }
    }

    .icon {
      flex-shrink: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--surface-2);
      border-radius: 50%;
      color: var(--text-2);
    }

    .content {
      flex: 1;
      min-width: 0;

      .title {
        font-weight: 500;
        margin-bottom: 4px;
      }

      .body {
        color: var(--text-2);
        font-size: 14px;
        margin-bottom: 8px;
      }

      .meta {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: var(--text-3);
      }
    }

    .delete-button {
      flex-shrink: 0;
      opacity: 0;
      transition: opacity 0.2s;
      color: var(--text-3);

      &:hover {
        color: var(--error);
      }
    }
  }

  .icon-button {
    padding: 8px;
    border-radius: 6px;
    color: var(--text-2);
    transition: all 0.2s;

    &:hover {
      background: var(--surface-2);
      color: var(--text-1);
    }
  }
</style> 