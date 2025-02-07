<!-- ToastContainer.svelte -->
<script lang="ts">
  import { toasts } from '../stores/toast';
  import Toast from './Toast.svelte';

  const positions = {
    'top-right': 'top-0 right-0',
    'top-left': 'top-0 left-0',
    'bottom-right': 'bottom-0 right-0',
    'bottom-left': 'bottom-0 left-0'
  };

  $: groupedToasts = $toasts.reduce((acc, toast) => {
    const position = toast.position || 'top-right';
    if (!acc[position]) acc[position] = [];
    acc[position].push(toast);
    return acc;
  }, {} as Record<keyof typeof positions, typeof $toasts>);
</script>

{#each Object.entries(positions) as [position, classes]}
  {#if groupedToasts[position]?.length}
    <div
      class="fixed {classes} z-50 m-4 flex flex-col {position.includes('bottom') ? 'space-y-reverse' : ''} space-y-2"
      role="log"
      aria-live="polite"
      aria-label="Notifications"
    >
      {#each groupedToasts[position] as toast (toast.id)}
        <Toast
          {...toast}
          onClose={(id) => toasts.remove(id)}
        />
      {/each}
    </div>
  {/if}
{/each} 