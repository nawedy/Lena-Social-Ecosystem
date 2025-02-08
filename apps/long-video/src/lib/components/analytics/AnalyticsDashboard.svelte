<!-- AnalyticsDashboard.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import { createAnalyticsService } from '$lib/services/analyticsService';
  import RetentionGraph from './RetentionGraph.svelte';
  import ChapterPerformance from './ChapterPerformance.svelte';
  import EngagementMetrics from './EngagementMetrics.svelte';
  import ViewerDemographics from './ViewerDemographics.svelte';
  import RealTimeStats from './RealTimeStats.svelte';
  import type { VideoMetrics, ViewerEngagement, ChapterMetrics } from '$lib/types/analytics';

  // Props
  export let videoId: string;

  // Services
  const analytics = createAnalyticsService(videoId);

  // State
  let metrics: VideoMetrics | null = null;
  let engagement: ViewerEngagement | null = null;
  let chapterMetrics: ChapterMetrics[] = [];
  let retentionData: number[] = [];
  let selectedTimeRange = '24h';
  let isLoading = true;
  let error: string | null = null;
  let subscription: any;

  // Time range options
  const timeRanges = [
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: 'all', label: 'All Time' }
  ];

  onMount(async () => {
    try {
      await loadData();
      setupRealtimeUpdates();
    } catch (err) {
      console.error('Failed to load analytics:', err);
      error = 'Failed to load analytics data. Please try again.';
    } finally {
      isLoading = false;
    }
  });

  onDestroy(() => {
    if (subscription) {
      subscription.unsubscribe();
    }
  });

  async function loadData() {
    const [metricsData, engagementData, chaptersData] = await Promise.all([
      analytics.getMetrics(),
      analytics.getEngagement(),
      analytics.getChapterMetrics()
    ]);

    metrics = metricsData;
    engagement = engagementData;
    chapterMetrics = chaptersData;
    retentionData = metricsData.retentionCurve;
  }

  function setupRealtimeUpdates() {
    subscription = analytics.subscribeToMetrics((updatedMetrics) => {
      metrics = updatedMetrics;
      retentionData = updatedMetrics.retentionCurve;
    });
  }

  async function handleTimeRangeChange() {
    isLoading = true;
    error = null;

    try {
      await loadData();
    } catch (err) {
      console.error('Failed to update analytics:', err);
      error = 'Failed to update analytics data. Please try again.';
    } finally {
      isLoading = false;
    }
  }

  $: viewerRetention = metrics?.completionRate || 0;
  $: totalViews = metrics?.viewCount || 0;
  $: avgWatchTime = metrics?.averageWatchTime || 0;
</script>

<div class="analytics-dashboard">
  <header class="dashboard-header">
    <h2>Video Analytics</h2>
    
    <div class="time-range">
      <select 
        bind:value={selectedTimeRange}
        on:change={handleTimeRangeChange}
      >
        {#each timeRanges as range}
          <option value={range.value}>{range.label}</option>
        {/each}
      </select>
    </div>
  </header>

  {#if error}
    <div class="error-message" transition:fade>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path 
          stroke-linecap="round" 
          stroke-linejoin="round" 
          stroke-width="2"
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>{error}</span>
    </div>
  {/if}

  <div class="metrics-grid">
    <div class="metric-card views">
      <h3>Total Views</h3>
      <div class="metric-value">{totalViews.toLocaleString()}</div>
      {#if engagement}
        <div class="metric-change">
          <span class="change-label">vs. previous period</span>
          <span class="change-value positive">+{((engagement.totalViews / totalViews - 1) * 100).toFixed(1)}%</span>
        </div>
      {/if}
    </div>

    <div class="metric-card watch-time">
      <h3>Average Watch Time</h3>
      <div class="metric-value">{(avgWatchTime / 60).toFixed(1)} min</div>
      <div class="metric-subtitle">
        {viewerRetention}% completion rate
      </div>
    </div>

    <div class="metric-card engagement">
      <h3>Engagement Rate</h3>
      <div class="metric-value">{metrics?.engagementRate.toFixed(1)}%</div>
      <div class="metric-subtitle">
        {engagement?.likes} likes • {engagement?.comments} comments
      </div>
    </div>
  </div>

  <div class="analytics-sections">
    <section class="retention-section">
      <h3>Viewer Retention</h3>
      <RetentionGraph 
        data={retentionData}
        isLoading={isLoading}
      />
    </section>

    <section class="chapters-section">
      <h3>Chapter Performance</h3>
      <ChapterPerformance
        metrics={chapterMetrics}
        isLoading={isLoading}
      />
    </section>

    <section class="engagement-section">
      <h3>Engagement Metrics</h3>
      <EngagementMetrics
        {engagement}
        isLoading={isLoading}
      />
    </section>

    <section class="demographics-section">
      <h3>Viewer Demographics</h3>
      <ViewerDemographics
        videoId={videoId}
        isLoading={isLoading}
      />
    </section>
  </div>

  <div class="realtime-section">
    <RealTimeStats
      {videoId}
      currentViews={metrics?.viewCount || 0}
    />
  </div>
</div>

<style lang="postcss">
  .analytics-dashboard {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 24px;
    background: var(--surface-color, #1a1a1a);
    border-radius: 8px;
  }

  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    h2 {
      font-size: 24px;
      font-weight: 600;
      color: white;
      margin: 0;
    }
  }

  .time-range {
    select {
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.1);
      border: none;
      border-radius: 4px;
      color: white;
      font-size: 14px;
      cursor: pointer;

      &:focus {
        outline: none;
        box-shadow: 0 0 0 2px var(--primary-color, #00a8ff);
      }
    }
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: rgba(255, 68, 68, 0.1);
    border-radius: 4px;
    color: #ff4444;

    svg {
      width: 20px;
      height: 20px;
    }
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 16px;
  }

  .metric-card {
    padding: 20px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    transition: all 0.2s;

    &:hover {
      transform: translateY(-2px);
      background: rgba(255, 255, 255, 0.08);
    }

    h3 {
      font-size: 14px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.7);
      margin: 0 0 8px;
    }

    .metric-value {
      font-size: 32px;
      font-weight: 600;
      color: white;
      margin-bottom: 4px;
    }

    .metric-subtitle {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.5);
    }

    .metric-change {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 8px;
      font-size: 12px;

      .change-label {
        color: rgba(255, 255, 255, 0.5);
      }

      .change-value {
        &.positive {
          color: #4caf50;
        }
        &.negative {
          color: #ff4444;
        }
      }
    }
  }

  .analytics-sections {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 24px;

    section {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 20px;

      h3 {
        font-size: 16px;
        font-weight: 500;
        color: white;
        margin: 0 0 16px;
      }
    }
  }

  .realtime-section {
    position: sticky;
    bottom: 0;
    background: var(--surface-color, #1a1a1a);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding-top: 16px;
    margin: 0 -24px -24px;
    padding: 16px 24px;
  }
</style> 