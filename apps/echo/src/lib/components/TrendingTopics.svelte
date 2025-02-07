<!-- TrendingTopics.svelte -->
<script lang="ts">
  import { fade, slide } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';

  export let topics: {
    tag: string;
    count: number;
    sentiment: number;
    velocity: number;
  }[] = [];

  function getSentimentColor(sentiment: number): string {
    // Normalize sentiment to 0-1 range
    const normalized = (sentiment + 1) / 2;
    
    // Generate colors from red (negative) to green (positive)
    const red = Math.round(255 * (1 - normalized));
    const green = Math.round(255 * normalized);
    
    return `rgb(${red}, ${green}, 0)`;
  }

  function getVelocityIndicator(velocity: number): string {
    if (velocity > 2) return '🚀';
    if (velocity > 1) return '📈';
    if (velocity < -1) return '📉';
    return '➡️';
  }

  function formatCount(count: number): string {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  }
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
  <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
    Trending Topics
  </h2>

  {#if topics.length === 0}
    <p class="text-gray-500 dark:text-gray-400 text-center py-4">
      No trending topics yet
    </p>
  {:else}
    <div class="space-y-3">
      {#each topics as topic (topic.tag)}
        <div
          class="group relative flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          transition:slide|local={{ duration: 300, easing: quintOut }}
        >
          <!-- Topic Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center space-x-2">
              <span class="text-sm font-medium text-gray-900 dark:text-white truncate">
                #{topic.tag}
              </span>
              <span class="text-lg" title="Trend direction">
                {getVelocityIndicator(topic.velocity)}
              </span>
            </div>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {formatCount(topic.count)} posts
            </p>
          </div>

          <!-- Sentiment Indicator -->
          <div class="flex items-center space-x-2">
            <div
              class="w-2 h-8 rounded-full"
              style="background-color: {getSentimentColor(topic.sentiment)}"
              title="Sentiment: {Math.round(topic.sentiment * 100)}%"
            ></div>
          </div>

          <!-- Hover Stats -->
          <div
            class="absolute left-0 right-0 bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          >
            <div
              class="bg-gray-900 text-white text-xs rounded py-1 px-2 text-center"
              transition:fade|local={{ duration: 200 }}
            >
              Sentiment: {Math.round(topic.sentiment * 100)}% | 
              Velocity: {topic.velocity > 0 ? '+' : ''}{topic.velocity.toFixed(1)}x
            </div>
          </div>
        </div>
      {/each}
    </div>

    <!-- Legend -->
    <div class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
      <div class="text-xs text-gray-500 dark:text-gray-400 space-y-2">
        <div class="flex items-center justify-between">
          <span>🚀 Viral</span>
          <span>📈 Rising</span>
          <span>➡️ Stable</span>
          <span>📉 Falling</span>
        </div>
        <div class="flex items-center space-x-2">
          <div class="flex-1 h-1 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded"></div>
          <span>Sentiment</span>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Add any component-specific styles here */
</style> 