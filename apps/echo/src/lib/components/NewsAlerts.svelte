<!-- NewsAlerts.svelte -->
<script lang="ts">
  import { fade, slide } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { writable } from 'svelte/store';

  export let newsAlerts: {
    id: string;
    title: string;
    content: string;
    urgency: 'low' | 'medium' | 'high';
    source_url: string;
    active: boolean;
  }[] = [];

  // Store for tracking dismissed alerts
  const dismissedAlerts = writable<Set<string>>(new Set());

  // Store for the currently displayed alert in the ticker
  let currentAlertIndex = writable(0);
  let tickerInterval: NodeJS.Timeout;

  // Filter out inactive and dismissed alerts
  $: activeAlerts = newsAlerts.filter(
    alert => alert.active && !$dismissedAlerts.has(alert.id)
  );

  function dismissAlert(alertId: string) {
    dismissedAlerts.update(dismissed => {
      dismissed.add(alertId);
      return dismissed;
    });
  }

  function getUrgencyStyles(urgency: string) {
    switch (urgency) {
      case 'high':
        return {
          bg: 'bg-red-500 dark:bg-red-600',
          text: 'text-white',
          border: 'border-red-600 dark:border-red-700',
          hover: 'hover:bg-red-600 dark:hover:bg-red-700'
        };
      case 'medium':
        return {
          bg: 'bg-yellow-500 dark:bg-yellow-600',
          text: 'text-black dark:text-white',
          border: 'border-yellow-600 dark:border-yellow-700',
          hover: 'hover:bg-yellow-600 dark:hover:bg-yellow-700'
        };
      default:
        return {
          bg: 'bg-blue-500 dark:bg-blue-600',
          text: 'text-white',
          border: 'border-blue-600 dark:border-blue-700',
          hover: 'hover:bg-blue-600 dark:hover:bg-blue-700'
        };
    }
  }

  // Start the ticker when component mounts
  import { onMount, onDestroy } from 'svelte';

  onMount(() => {
    if (activeAlerts.length > 1) {
      tickerInterval = setInterval(() => {
        currentAlertIndex.update(n => (n + 1) % activeAlerts.length);
      }, 5000);
    }
  });

  onDestroy(() => {
    if (tickerInterval) {
      clearInterval(tickerInterval);
    }
  });
</script>

{#if activeAlerts.length > 0}
  <!-- News Ticker -->
  <div
    class="relative w-full bg-gray-900 dark:bg-gray-800 shadow-lg overflow-hidden"
    style="height: 48px;"
  >
    <div class="absolute inset-0 flex items-center">
      <!-- Gradient Overlay (Left) -->
      <div class="absolute left-0 w-16 h-full bg-gradient-to-r from-gray-900 dark:from-gray-800 to-transparent z-10"></div>

      <!-- Ticker Content -->
      <div class="flex-1 px-16">
        {#each [activeAlerts[$currentAlertIndex]] as alert (alert.id)}
          <div
            class="flex items-center h-full"
            transition:slide|local={{ axis: 'x', duration: 300 }}
          >
            <!-- Urgency Indicator -->
            <div
              class={`flex-shrink-0 w-3 h-3 rounded-full mr-3 ${
                getUrgencyStyles(alert.urgency).bg
              }`}
            ></div>

            <!-- Alert Content -->
            <div class="flex-1 truncate">
              <span class="text-white font-medium">{alert.title}</span>
              {#if alert.content}
                <span class="text-gray-400 ml-2">{alert.content}</span>
              {/if}
            </div>

            <!-- Source Link -->
            {#if alert.source_url}
              <a
                href={alert.source_url}
                target="_blank"
                rel="noopener noreferrer"
                class="ml-4 text-blue-400 hover:text-blue-300 text-sm"
              >
                Read More →
              </a>
            {/if}
          </div>
        {/each}
      </div>

      <!-- Gradient Overlay (Right) -->
      <div class="absolute right-0 w-16 h-full bg-gradient-to-l from-gray-900 dark:from-gray-800 to-transparent z-10"></div>

      <!-- Dismiss Button -->
      <button
        class="absolute right-4 text-gray-400 hover:text-white z-20"
        on:click={() => dismissAlert(activeAlerts[$currentAlertIndex].id)}
      >
        <svg class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
          <path
            fill-rule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clip-rule="evenodd"
          />
        </svg>
      </button>
    </div>

    <!-- Progress Bar -->
    {#if activeAlerts.length > 1}
      <div class="absolute bottom-0 left-0 w-full h-0.5 bg-gray-800 dark:bg-gray-700">
        <div
          class="h-full bg-blue-500 transition-all duration-[5000ms] ease-linear"
          style="width: {(($currentAlertIndex + 1) / activeAlerts.length) * 100}%"
        ></div>
      </div>
    {/if}
  </div>

  <!-- Expanded Alerts Panel (Optional) -->
  {#if activeAlerts.length > 1}
    <div class="fixed right-4 top-16 w-96 max-w-full z-50 space-y-2">
      {#each activeAlerts as alert (alert.id)}
        <div
          class={`relative p-4 rounded-lg shadow-lg border ${
            getUrgencyStyles(alert.urgency).bg
          } ${getUrgencyStyles(alert.urgency).border}`}
          transition:slide|local
        >
          <div class="pr-8">
            <h3 class={`font-medium ${getUrgencyStyles(alert.urgency).text}`}>
              {alert.title}
            </h3>
            {#if alert.content}
              <p class={`mt-1 text-sm ${getUrgencyStyles(alert.urgency).text} opacity-90`}>
                {alert.content}
              </p>
            {/if}
            {#if alert.source_url}
              <a
                href={alert.source_url}
                target="_blank"
                rel="noopener noreferrer"
                class="inline-block mt-2 text-sm text-white hover:underline"
              >
                Read More →
              </a>
            {/if}
          </div>
          <button
            class="absolute top-4 right-4 text-white opacity-75 hover:opacity-100"
            on:click={() => dismissAlert(alert.id)}
          >
            <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fill-rule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clip-rule="evenodd"
              />
            </svg>
          </button>
        </div>
      {/each}
    </div>
  {/if}
{/if}

<style>
  /* Add any component-specific styles here */
</style> 