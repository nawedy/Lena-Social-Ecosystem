<!-- AnalyticsDashboard.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import { analyticsService } from '$lib/services/analytics/AnalyticsService';
  import MetricsCard from '../shared/MetricsCard.svelte';
  import LineChart from '../shared/LineChart.svelte';
  import BarChart from '../shared/BarChart.svelte';
  import PieChart from '../shared/PieChart.svelte';
  import DateRangePicker from '../shared/DateRangePicker.svelte';
  import Tabs from '../shared/Tabs.svelte';
  import Icon from '../shared/Icon.svelte';

  let activeTab = 'overview';
  let contentMetrics = analyticsService.getContentMetrics();
  let audienceMetrics = analyticsService.getAudienceMetrics();
  let revenueMetrics = analyticsService.getRevenueMetrics();
  let performanceMetrics = analyticsService.getPerformanceMetrics();
  let timeRange = analyticsService.getTimeRange();
  let unsubscribe: () => void;

  onMount(() => {
    unsubscribe = analyticsService.subscribe((data) => {
      contentMetrics = data.contentMetrics;
      audienceMetrics = data.audienceMetrics;
      revenueMetrics = data.revenueMetrics;
      performanceMetrics = data.performanceMetrics;
    });
  });

  onDestroy(() => {
    if (unsubscribe) unsubscribe();
  });

  function handleTimeRangeChange(event: CustomEvent) {
    analyticsService.setTimeRange(event.detail);
  }

  function formatNumber(num: number) {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(num);
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  function formatPercentage(value: number) {
    return `${(value * 100).toFixed(1)}%`;
  }

  function getGrowthIndicator(value: number) {
    return value > 0 ? 'up' : value < 0 ? 'down' : 'neutral';
  }
</script>

<div class="analytics-dashboard">
  <header class="header">
    <div class="title">
      <h1>Analytics Dashboard</h1>
      <p class="subtitle">Track your performance and growth</p>
    </div>
    <DateRangePicker
      value={timeRange}
      on:change={handleTimeRangeChange}
    />
  </header>

  <Tabs
    items={[
      { id: 'overview', label: 'Overview' },
      { id: 'audience', label: 'Audience' },
      { id: 'content', label: 'Content' },
      { id: 'revenue', label: 'Revenue' },
      { id: 'performance', label: 'Performance' }
    ]}
    bind:active={activeTab}
  />

  {#if activeTab === 'overview'}
    <div class="metrics-grid" transition:fade>
      <MetricsCard
        title="Total Views"
        value={contentMetrics?.views || 0}
        format="number"
        icon="eye"
        trend={{
          value: 15,
          direction: 'up'
        }}
      />
      <MetricsCard
        title="Active Followers"
        value={audienceMetrics?.activeFollowers || 0}
        format="number"
        icon="users"
        trend={{
          value: 8,
          direction: 'up'
        }}
      />
      <MetricsCard
        title="Total Revenue"
        value={revenueMetrics?.totalRevenue || 0}
        format="currency"
        icon="dollar-sign"
        trend={{
          value: 12,
          direction: 'up'
        }}
      />
      <MetricsCard
        title="Engagement Rate"
        value={audienceMetrics?.engagement.rate || 0}
        format="percent"
        icon="activity"
        trend={{
          value: 5,
          direction: 'up'
        }}
      />
    </div>

    <div class="charts-grid">
      <div class="chart-card">
        <h3>Views Over Time</h3>
        <LineChart
          data={contentMetrics?.retention.map(point => ({
            x: new Date(point.timestamp),
            y: point.viewers
          })) || []}
          xAxis="time"
          yAxis="views"
        />
      </div>

      <div class="chart-card">
        <h3>Revenue Distribution</h3>
        <PieChart
          data={Object.entries(revenueMetrics?.revenueByPlatform || {}).map(([key, value]) => ({
            label: key,
            value
          }))}
        />
      </div>

      <div class="chart-card">
        <h3>Audience Demographics</h3>
        <BarChart
          data={Object.entries(audienceMetrics?.demographics.age || {}).map(([key, value]) => ({
            x: key,
            y: value
          }))}
          xAxis="age"
          yAxis="viewers"
        />
      </div>

      <div class="chart-card">
        <h3>Performance Metrics</h3>
        <LineChart
          data={Object.entries(performanceMetrics?.qualityMetrics.resolution || {}).map(([key, value]) => ({
            x: key,
            y: value
          }))}
          xAxis="resolution"
          yAxis="views"
        />
      </div>
    </div>
  {/if}

  {#if activeTab === 'audience'}
    <div class="audience-metrics" transition:fade>
      <!-- Audience-specific metrics and charts -->
    </div>
  {/if}

  {#if activeTab === 'content'}
    <div class="content-metrics" transition:fade>
      <!-- Content-specific metrics and charts -->
    </div>
  {/if}

  {#if activeTab === 'revenue'}
    <div class="revenue-metrics" transition:fade>
      <!-- Revenue-specific metrics and charts -->
    </div>
  {/if}

  {#if activeTab === 'performance'}
    <div class="performance-metrics" transition:fade>
      <!-- Performance-specific metrics and charts -->
    </div>
  {/if}
</div>

<style lang="postcss">
  .analytics-dashboard {
    padding: 24px;
    max-width: 1400px;
    margin: 0 auto;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 24px;

    .title {
      h1 {
        margin: 0;
        font-size: 24px;
        font-weight: 600;
      }

      .subtitle {
        margin: 4px 0 0;
        color: var(--text-2);
      }
    }
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }

  .charts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 24px;
  }

  .chart-card {
    background: var(--surface-1);
    border-radius: 8px;
    padding: 16px;
    box-shadow: var(--shadow-1);

    h3 {
      margin: 0 0 16px;
      font-size: 16px;
      font-weight: 500;
    }
  }

  @media (max-width: 768px) {
    .analytics-dashboard {
      padding: 16px;
    }

    .header {
      flex-direction: column;
      gap: 16px;
    }

    .charts-grid {
      grid-template-columns: 1fr;
    }
  }
</style> 