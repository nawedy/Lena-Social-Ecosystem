<!-- NotificationCenter.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { notificationService } from '$lib/services/notification/NotificationService';
  import { Button, Card, Tabs, Tab, Badge, Switch } from '$lib/components/ui';

  // Stores
  const notifications = notificationService.getNotifications();
  const preferences = notificationService.getPreferences();
  const stats = notificationService.getStats();

  // State
  let activeTab = 'all';
  let showPreferences = false;
  let selectedNotifications: Set<string> = new Set();
  let searchQuery = '';
  let filterType: string[] = [];

  // Computed
  $: filteredNotifications = filterNotifications($notifications, {
    query: searchQuery,
    type: filterType,
    tab: activeTab
  });

  function filterNotifications(notifications: any[], filters: {
    query: string;
    type: string[];
    tab: string;
  }) {
    return notifications.filter(notification => {
      // Text search
      if (filters.query) {
        const searchText = `${notification.title} ${notification.body}`.toLowerCase();
        if (!searchText.includes(filters.query.toLowerCase())) return false;
      }

      // Type filter
      if (filters.type.length > 0 && !filters.type.includes(notification.type)) return false;

      // Tab filter
      switch (filters.tab) {
        case 'unread':
          if (notification.read) return false;
          break;
        case 'mentions':
          if (notification.type !== 'mention') return false;
          break;
        case 'moderation':
          if (notification.type !== 'moderation') return false;
          break;
      }

      return true;
    });
  }

  function formatDate(date: string): string {
    const now = new Date();
    const notificationDate = new Date(date);
    const diffInHours = (now.getTime() - notificationDate.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      if (diffInHours < 1) {
        const minutes = Math.floor(diffInHours * 60);
        return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
      }
      return `${Math.floor(diffInHours)} hour${diffInHours === 1 ? '' : 's'} ago`;
    }

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(notificationDate);
  }

  function getTypeIcon(type: string): string {
    switch (type) {
      case 'mention': return '@';
      case 'reply': return '↩️';
      case 'reaction': return '👍';
      case 'moderation': return '🛡️';
      case 'achievement': return '🏆';
      case 'system': return '🔔';
      default: return '•';
    }
  }

  function getTypeColor(type: string): string {
    switch (type) {
      case 'mention': return 'text-blue-500 bg-blue-500/10';
      case 'reply': return 'text-green-500 bg-green-500/10';
      case 'reaction': return 'text-yellow-500 bg-yellow-500/10';
      case 'moderation': return 'text-red-500 bg-red-500/10';
      case 'achievement': return 'text-purple-500 bg-purple-500/10';
      case 'system': return 'text-gray-500 bg-gray-500/10';
      default: return 'text-gray-500 bg-gray-500/10';
    }
  }

  async function handleNotificationClick(notification: any) {
    if (!notification.read) {
      await notificationService.markAsRead(notification.id);
    }

    if (notification.link) {
      window.location.href = notification.link;
    }
  }

  async function handleMarkAllAsRead() {
    const unreadIds = filteredNotifications
      .filter(n => !n.read)
      .map(n => n.id);

    if (unreadIds.length > 0) {
      await notificationService.markAsRead(unreadIds);
    }
  }

  async function handleDeleteSelected() {
    for (const id of selectedNotifications) {
      await notificationService.deleteNotification(id);
    }
    selectedNotifications.clear();
  }

  async function updatePreference(key: string, value: any) {
    if (!$preferences) return;

    const [category, setting] = key.split('.');
    const update = {
      ...($preferences as any),
      [category]: {
        ...($preferences as any)[category],
        [setting]: value
      }
    };

    await notificationService.updatePreferences(update);
  }
</script>

<div class="w-full max-w-md">
  <!-- Header -->
  <div class="flex items-center justify-between mb-4">
    <div>
      <h2 class="text-lg font-semibold">Notifications</h2>
      {#if $stats}
        <p class="text-sm text-muted-foreground">
          {$stats.unread} unread • {$stats.total} total
        </p>
      {/if}
    </div>
    <div class="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        on:click={() => showPreferences = !showPreferences}
      >
        <i class="fas fa-cog" />
      </Button>
      {#if selectedNotifications.size > 0}
        <Button
          variant="destructive"
          size="sm"
          on:click={handleDeleteSelected}
        >
          Delete ({selectedNotifications.size})
        </Button>
      {/if}
      <Button
        variant="outline"
        size="sm"
        on:click={handleMarkAllAsRead}
      >
        Mark All as Read
      </Button>
    </div>
  </div>

  <!-- Search & Filters -->
  <div class="flex items-center gap-4 mb-4">
    <input
      type="search"
      placeholder="Search notifications..."
      bind:value={searchQuery}
      class="flex-1 bg-background border border-border rounded-lg px-3 py-1.5"
    />
    <select
      multiple
      bind:value={filterType}
      class="bg-background border border-border rounded-lg px-2 py-1"
    >
      <option value="mention">Mentions</option>
      <option value="reply">Replies</option>
      <option value="reaction">Reactions</option>
      <option value="moderation">Moderation</option>
      <option value="achievement">Achievements</option>
      <option value="system">System</option>
    </select>
  </div>

  <!-- Tabs -->
  <Tabs bind:active={activeTab}>
    <Tab id="all" title="All" />
    <Tab id="unread" title="Unread" />
    <Tab id="mentions" title="Mentions" />
    <Tab id="moderation" title="Moderation" />
  </Tabs>

  <!-- Notifications List -->
  <div class="space-y-2 mt-4">
    {#each filteredNotifications as notification (notification.id)}
      <div
        class="p-4 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors cursor-pointer"
        class:bg-primary-50={selectedNotifications.has(notification.id)}
        class:opacity-75={notification.read}
        on:click={() => handleNotificationClick(notification)}
        transition:fade
      >
        <div class="flex items-start gap-3">
          <input
            type="checkbox"
            class="mt-1"
            checked={selectedNotifications.has(notification.id)}
            on:click|stopPropagation={(e) => {
              if (e.target.checked) {
                selectedNotifications.add(notification.id);
              } else {
                selectedNotifications.delete(notification.id);
              }
              selectedNotifications = selectedNotifications;
            }}
          />

          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <Badge class={getTypeColor(notification.type)}>
                {getTypeIcon(notification.type)} {notification.type}
              </Badge>
              <span class="text-sm text-muted-foreground">
                {formatDate(notification.createdAt)}
              </span>
            </div>

            <h3 class="font-medium">{notification.title}</h3>
            <p class="text-sm text-muted-foreground mt-1">
              {notification.body}
            </p>

            {#if notification.link}
              <a
                href={notification.link}
                class="text-sm text-primary hover:underline mt-2 inline-block"
                on:click|stopPropagation
              >
                View Details →
              </a>
            {/if}
          </div>
        </div>
      </div>
    {/each}

    {#if filteredNotifications.length === 0}
      <div class="p-8 text-center text-muted-foreground">
        No notifications match your filters
      </div>
    {/if}
  </div>

  <!-- Preferences Panel -->
  {#if showPreferences && $preferences}
    <div
      class="fixed inset-y-0 right-0 w-96 bg-background border-l border-border p-6 space-y-6 shadow-xl"
      transition:slide={{ duration: 200, axis: 'x' }}
    >
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-medium">Notification Settings</h2>
        <Button
          variant="ghost"
          size="icon"
          on:click={() => showPreferences = false}
        >
          ×
        </Button>
      </div>

      <div class="space-y-6">
        <!-- Channels -->
        <div>
          <h3 class="text-sm font-medium mb-3">Notification Channels</h3>
          <div class="space-y-3">
            <label class="flex items-center justify-between">
              <span>In-App Notifications</span>
              <Switch
                checked={$preferences.channels.inApp}
                on:change={(e) => updatePreference('channels.inApp', e.target.checked)}
              />
            </label>
            <label class="flex items-center justify-between">
              <span>Email Notifications</span>
              <Switch
                checked={$preferences.channels.email}
                on:change={(e) => updatePreference('channels.email', e.target.checked)}
              />
            </label>
            <label class="flex items-center justify-between">
              <span>Push Notifications</span>
              <Switch
                checked={$preferences.channels.push}
                on:change={(e) => updatePreference('channels.push', e.target.checked)}
              />
            </label>
          </div>
        </div>

        <!-- Types -->
        <div>
          <h3 class="text-sm font-medium mb-3">Notification Types</h3>
          <div class="space-y-3">
            {#each Object.entries($preferences.types) as [type, enabled]}
              <label class="flex items-center justify-between">
                <span class="capitalize">{type}</span>
                <Switch
                  checked={enabled}
                  on:change={(e) => updatePreference(`types.${type}`, e.target.checked)}
                />
              </label>
            {/each}
          </div>
        </div>

        <!-- Schedule -->
        <div>
          <h3 class="text-sm font-medium mb-3">Schedule</h3>
          <div class="space-y-3">
            <div>
              <label class="block text-sm mb-1">Digest Frequency</label>
              <select
                bind:value={$preferences.schedule.digest}
                on:change={(e) => updatePreference('schedule.digest', e.target.value)}
                class="w-full bg-background border border-border rounded-lg px-3 py-1.5"
              >
                <option value="never">Never</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>

            <div>
              <label class="block text-sm mb-1">Quiet Hours</label>
              <div class="flex items-center gap-2">
                <input
                  type="time"
                  bind:value={$preferences.schedule.quietHours.start}
                  on:change={(e) => updatePreference('schedule.quietHours.start', e.target.value)}
                  class="bg-background border border-border rounded-lg px-3 py-1.5"
                />
                <span>to</span>
                <input
                  type="time"
                  bind:value={$preferences.schedule.quietHours.end}
                  on:change={(e) => updatePreference('schedule.quietHours.end', e.target.value)}
                  class="bg-background border border-border rounded-lg px-3 py-1.5"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Add any component-specific styles here */
</style> 