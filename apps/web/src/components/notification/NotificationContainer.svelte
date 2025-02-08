<!-- NotificationContainer.svelte -->
<script lang="ts">
  import { notificationStore } from '@/stores/notification';
  import Notification from './Notification.svelte';

  export let class: string = '';

  function handleDismiss(event: CustomEvent<string>) {
    notificationStore.remove(event.detail);
  }
</script>

<div class={class}>
  {#each $notificationStore.notifications as notification (notification.id)}
    <Notification
      {notification}
      position={$notificationStore.position}
      on:dismiss={handleDismiss}
    />
  {/each}
</div>

<style>
  /* Add any component-specific styles here */
</style> 