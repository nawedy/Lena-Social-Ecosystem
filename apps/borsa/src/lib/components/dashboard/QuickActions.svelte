<!-- QuickActions.svelte -->
<script lang="ts">
  import { fade } from 'svelte/transition';
  import Icon from '$lib/components/shared/Icon.svelte';
  import { goto } from '$app/navigation';

  const actions = [
    {
      id: 'send',
      label: 'Send',
      icon: 'send',
      route: '/transfer/send',
      color: 'blue'
    },
    {
      id: 'receive',
      label: 'Receive',
      icon: 'receive',
      route: '/transfer/receive',
      color: 'green'
    },
    {
      id: 'exchange',
      label: 'Exchange',
      icon: 'exchange',
      route: '/exchange',
      color: 'purple'
    },
    {
      id: 'tip',
      label: 'Tip Creator',
      icon: 'gift',
      route: '/tip',
      color: 'pink'
    },
    {
      id: 'subscribe',
      label: 'Subscribe',
      icon: 'star',
      route: '/subscribe',
      color: 'yellow'
    }
  ];

  function handleAction(action: typeof actions[0]) {
    goto(action.route);
  }
</script>

<div class="quick-actions" transition:fade>
  {#each actions as action}
    <button
      class="action-button"
      class:blue={action.color === 'blue'}
      class:green={action.color === 'green'}
      class:purple={action.color === 'purple'}
      class:pink={action.color === 'pink'}
      class:yellow={action.color === 'yellow'}
      on:click={() => handleAction(action)}
    >
      <div class="icon-wrapper">
        <Icon name={action.icon} size={24} />
      </div>
      <span class="label">{action.label}</span>
    </button>
  {/each}
</div>

<style lang="postcss">
  .quick-actions {
    @apply grid gap-4;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  }

  .action-button {
    @apply flex flex-col items-center gap-2 p-4 rounded-xl;
    @apply bg-white bg-opacity-5 backdrop-blur-lg;
    @apply border border-white border-opacity-10;
    @apply transition-all duration-300 ease-in-out;

    &:hover {
      @apply transform scale-105 shadow-lg;
      border-opacity: 0.2;
    }

    &.blue .icon-wrapper {
      @apply bg-blue-500 bg-opacity-20;
      @apply text-blue-400;
    }

    &.green .icon-wrapper {
      @apply bg-green-500 bg-opacity-20;
      @apply text-green-400;
    }

    &.purple .icon-wrapper {
      @apply bg-purple-500 bg-opacity-20;
      @apply text-purple-400;
    }

    &.pink .icon-wrapper {
      @apply bg-pink-500 bg-opacity-20;
      @apply text-pink-400;
    }

    &.yellow .icon-wrapper {
      @apply bg-yellow-500 bg-opacity-20;
      @apply text-yellow-400;
    }
  }

  .icon-wrapper {
    @apply p-3 rounded-lg;
    @apply transition-colors duration-200;
  }

  .label {
    @apply text-sm font-medium text-white text-opacity-90;
  }
</style> 