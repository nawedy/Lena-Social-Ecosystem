<!-- RealTimeStats.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import { supabase } from '$lib/supabase';

  // Props
  export let videoId: string;
  export let currentViews: number;

  // State
  let activeViewers = 0;
  let recentEngagements: Array<{
    type: string;
    timestamp: number;
    metadata?: any;
  }> = [];
  let viewerTrend: number[] = [];
  let subscription: any;

  onMount(() => {
    setupRealtimeUpdates();
    startViewerTracking();
  });

  onDestroy(() => {
    if (subscription) {
      subscription.unsubscribe();
    }
  });

  function setupRealtimeUpdates() {
    subscription = supabase
      .channel(`video-realtime-${videoId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'engagement_events',
          filter: `video_id=eq.${videoId}`
        },
        handleEngagement
      )
      .subscribe();
  }

  function startViewerTracking() {
    // Simulate active viewer count for demo
    setInterval(() => {
      const randomChange = Math.floor(Math.random() * 5) - 2;
      activeViewers = Math.max(0, activeViewers + randomChange);
      viewerTrend = [...viewerTrend.slice(-19), activeViewers];
    }, 5000);

    // Initial values
    activeViewers = Math.floor(currentViews * 0.01);
    viewerTrend = Array(20).fill(activeViewers);
  }

  function handleEngagement(payload: any) {
    const engagement = {
      type: payload.new.engagement_type,
      timestamp: Date.now(),
      metadata: payload.new.metadata
    };

    recentEngagements = [engagement, ...recentEngagements.slice(0, 9)];
  }

  function getEngagementIcon(type: string): string {
    switch (type) {
      case 'like':
        return '❤️';
      case 'comment':
        return '💬';
      case 'share':
        return '🔄';
      default:
        return '👆';
    }
  }

  function formatTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  }
</script>

<div class="realtime-stats">
  <div class="stats-grid">
    <div class="stat-card viewers">
      <div class="stat-header">
        <h4>Active Viewers</h4>
        <div class="trend-indicator">
          {#if viewerTrend[viewerTrend.length - 1] > viewerTrend[viewerTrend.length - 2]}
            <span class="trend up">↑</span>
          {:else if viewerTrend[viewerTrend.length - 1] < viewerTrend[viewerTrend.length - 2]}
            <span class="trend down">↓</span>
          {/if}
        </div>
      </div>
      <div class="stat-value">{activeViewers}</div>
      <div class="trend-graph">
        {#each viewerTrend as value, i}
          {@const height = (value / Math.max(...viewerTrend)) * 100}
          <div 
            class="trend-bar"
            style="height: {height}%"
          />
        {/each}
      </div>
    </div>

    <div class="stat-card engagements">
      <h4>Recent Engagements</h4>
      <div class="engagement-list">
        {#each recentEngagements as engagement (engagement.timestamp)}
          <div class="engagement-item" transition:fade>
            <span class="engagement-icon">
              {getEngagementIcon(engagement.type)}
            </span>
            <span class="engagement-time">
              {formatTimeAgo(engagement.timestamp)}
            </span>
          </div>
        {/each}
      </div>
    </div>

    <div class="stat-card performance">
      <h4>Real-time Performance</h4>
      <div class="performance-metrics">
        <div class="metric">
          <div class="metric-label">Engagement Rate</div>
          <div class="metric-value">
            {((recentEngagements.length / activeViewers) * 100).toFixed(1)}%
          </div>
        </div>
        <div class="metric">
          <div class="metric-label">Peak Viewers</div>
          <div class="metric-value">
            {Math.max(...viewerTrend)}
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style lang="postcss">
  .realtime-stats {
    width: 100%;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 16px;
  }

  .stat-card {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 16px;

    h4 {
      font-size: 14px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.7);
      margin: 0 0 12px;
    }
  }

  .stat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .trend-indicator {
    .trend {
      font-size: 16px;
      font-weight: bold;

      &.up {
        color: #4caf50;
      }

      &.down {
        color: #f44336;
      }
    }
  }

  .stat-value {
    font-size: 32px;
    font-weight: 600;
    color: white;
    margin-bottom: 12px;
  }

  .trend-graph {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 40px;
  }

  .trend-bar {
    flex: 1;
    background: var(--primary-color, #00a8ff);
    border-radius: 2px 2px 0 0;
    min-height: 2px;
    transition: height 0.3s ease;
  }

  .engagement-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 200px;
    overflow-y: auto;
  }

  .engagement-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
    font-size: 14px;
  }

  .engagement-icon {
    font-size: 16px;
  }

  .engagement-time {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
  }

  .performance-metrics {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }

  .metric {
    text-align: center;

    .metric-label {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.5);
      margin-bottom: 4px;
    }

    .metric-value {
      font-size: 18px;
      font-weight: 500;
      color: white;
    }
  }
</style> 