<!-- ChapterPerformance.svelte -->
<script lang="ts">
  import { fade } from 'svelte/transition';
  import type { ChapterMetrics } from '$lib/types/analytics';

  // Props
  export let metrics: ChapterMetrics[] = [];
  export let isLoading = false;

  // Computed values
  $: totalViews = metrics.reduce((sum, m) => sum + m.viewCount, 0);
  $: maxWatchTime = Math.max(...metrics.map(m => m.averageWatchTime));
  $: sortedMetrics = [...metrics].sort((a, b) => b.viewCount - a.viewCount);

  function formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  function formatPercentage(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
  }

  function getPerformanceLabel(metric: ChapterMetrics): string {
    const viewPercentage = metric.viewCount / totalViews;
    if (viewPercentage > 0.8) return 'Excellent';
    if (viewPercentage > 0.6) return 'Good';
    if (viewPercentage > 0.4) return 'Average';
    return 'Poor';
  }

  function getPerformanceColor(metric: ChapterMetrics): string {
    const viewPercentage = metric.viewCount / totalViews;
    if (viewPercentage > 0.8) return '#4caf50';
    if (viewPercentage > 0.6) return '#2196f3';
    if (viewPercentage > 0.4) return '#ff9800';
    return '#f44336';
  }
</script>

<div class="chapter-performance">
  {#if isLoading}
    <div class="loading-overlay" transition:fade>
      <svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path 
          stroke-linecap="round" 
          stroke-linejoin="round" 
          stroke-width="2"
          d="M12 6v4m0 4v4m-4-8h8M6 12h12"
        />
      </svg>
      <span>Loading chapter data...</span>
    </div>
  {/if}

  <div class="metrics-grid">
    {#each sortedMetrics as metric}
      <div class="chapter-card" transition:fade>
        <div class="chapter-header">
          <div class="chapter-info">
            <h4>Chapter {metrics.indexOf(metric) + 1}</h4>
            <span 
              class="performance-badge"
              style="background: {getPerformanceColor(metric)}"
            >
              {getPerformanceLabel(metric)}
            </span>
          </div>
          <div class="view-count">
            {metric.viewCount.toLocaleString()} views
          </div>
        </div>

        <div class="metrics-list">
          <div class="metric">
            <div class="metric-label">Average Watch Time</div>
            <div class="metric-bar">
              <div 
                class="bar-fill"
                style="width: {(metric.averageWatchTime / maxWatchTime) * 100}%"
              />
              <span class="bar-value">
                {formatDuration(metric.averageWatchTime)}
              </span>
            </div>
          </div>

          <div class="metric">
            <div class="metric-label">Skip Rate</div>
            <div class="metric-bar">
              <div 
                class="bar-fill warning"
                style="width: {metric.skipRate * 100}%"
              />
              <span class="bar-value">
                {formatPercentage(metric.skipRate)}
              </span>
            </div>
          </div>

          <div class="metric">
            <div class="metric-label">Replay Rate</div>
            <div class="metric-bar">
              <div 
                class="bar-fill success"
                style="width: {metric.replayRate * 100}%"
              />
              <span class="bar-value">
                {formatPercentage(metric.replayRate)}
              </span>
            </div>
          </div>
        </div>

        <div class="chapter-insights">
          {#if metric.skipRate > 0.4}
            <div class="insight warning">
              High skip rate - Consider revising content
            </div>
          {/if}
          {#if metric.replayRate > 0.2}
            <div class="insight success">
              High replay rate - Popular content
            </div>
          {/if}
          {#if metric.viewCount / totalViews < 0.3}
            <div class="insight error">
              Low viewer retention - Review chapter placement
            </div>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>

<style lang="postcss">
  .chapter-performance {
    position: relative;
    min-height: 200px;
  }

  .loading-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    z-index: 1;

    .spinner {
      width: 32px;
      height: 32px;
      animation: spin 1s linear infinite;
    }
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 16px;
  }

  .chapter-card {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 16px;
  }

  .chapter-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;

    h4 {
      font-size: 16px;
      font-weight: 500;
      color: white;
      margin: 0;
    }

    .view-count {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.7);
    }
  }

  .chapter-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .performance-badge {
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
    color: white;
  }

  .metrics-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .metric {
    .metric-label {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.7);
      margin-bottom: 4px;
    }

    .metric-bar {
      position: relative;
      height: 8px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      background: var(--primary-color, #00a8ff);
      transition: width 0.3s ease;

      &.warning {
        background: #ff9800;
      }

      &.success {
        background: #4caf50;
      }
    }

    .bar-value {
      position: absolute;
      right: 0;
      top: -18px;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.7);
    }
  }

  .chapter-insights {
    margin-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;

    .insight {
      padding: 8px;
      border-radius: 4px;
      font-size: 12px;

      &.warning {
        background: rgba(255, 152, 0, 0.1);
        color: #ff9800;
      }

      &.success {
        background: rgba(76, 175, 80, 0.1);
        color: #4caf50;
      }

      &.error {
        background: rgba(244, 67, 54, 0.1);
        color: #f44336;
      }
    }
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style> 