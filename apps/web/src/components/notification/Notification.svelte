<!-- Notification.svelte -->
<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { createEventDispatcher } from 'svelte';
  import { NotificationConfig } from '@core/services/notification/types';
  import { cn } from '@/lib/utils';
  import { Icon } from '@/components/ui/icon';

  export let notification: NotificationConfig;
  export let position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' = 'top-right';
  export let class: string = '';

  const dispatch = createEventDispatcher();

  let timeoutId: NodeJS.Timeout;

  $: {
    if (notification.priority === 'normal' || notification.priority === 'low') {
      timeoutId = setTimeout(() => {
        dispatch('dismiss', notification.id);
      }, 5000);
    }
  }

  function handleDismiss() {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    dispatch('dismiss', notification.id);
  }

  function handleAction() {
    if (notification.data?.actionUrl) {
      window.location.href = notification.data.actionUrl;
    }
    handleDismiss();
  }

  const icons = {
    info: 'info-circle',
    success: 'check-circle',
    warning: 'exclamation-triangle',
    error: 'exclamation-circle'
  };

  const variants = {
    info: 'bg-blue-50 text-blue-800 border-blue-200',
    success: 'bg-green-50 text-green-800 border-green-200',
    warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    error: 'bg-red-50 text-red-800 border-red-200'
  };

  const positions = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4'
  };

  $: variant = notification.priority === 'urgent' ? 'error' :
               notification.priority === 'high' ? 'warning' :
               notification.priority === 'low' ? 'info' : 'success';

  $: classes = cn(
    'fixed z-50 flex items-start gap-3 p-4 rounded-lg border shadow-lg max-w-sm',
    variants[variant],
    positions[position],
    class
  );
</script>

<div
  class={classes}
  role="alert"
  in:fly={{ y: position.startsWith('top') ? -20 : 20, duration: 300 }}
  out:fade={{ duration: 200 }}
>
  <div class="flex-shrink-0">
    <Icon name={icons[variant]} class="w-5 h-5" />
  </div>

  <div class="flex-1">
    {#if notification.title}
      <h4 class="font-semibold mb-1">{notification.title}</h4>
    {/if}
    <p class="text-sm">{notification.body}</p>
    {#if notification.data?.actionUrl}
      <button
        class="text-sm font-medium underline mt-2 hover:opacity-80"
        on:click={handleAction}
      >
        View Details
      </button>
    {/if}
  </div>

  <button
    class="flex-shrink-0 hover:opacity-80"
    aria-label="Close"
    on:click={handleDismiss}
  >
    <Icon name="x" class="w-4 h-4" />
  </button>
</div>

<style>
  /* Add any component-specific styles here */
</style> 