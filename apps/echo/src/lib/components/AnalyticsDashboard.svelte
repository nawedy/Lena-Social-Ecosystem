<!-- Analytics Dashboard Component -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable, derived } from 'svelte/store';
  import { supabase } from '$lib/supabaseClient';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { toast } from '$lib/stores/toast';
  import { formatDistanceToNow, format } from 'date-fns';
  import { Icon } from '$lib/components/ui';
  import { Button } from '$lib/components/ui/button';
  import { Select } from '$lib/components/ui/select';
  import { Card } from '$lib/components/ui/card';
  import { Tabs } from '$lib/components/ui/tabs';
  import { LineChart, BarChart, PieChart } from '$lib/components/charts';

  // Types
  interface EngagementMetrics {
    total_events: number;
    unique_users: number;
    content_count: number;
    engagement: {
      views: number;
      likes: number;
      comments: number;
      shares: number;
      reports: number;
      avg_time_spent: number;
      engagement_rate: number;
    };
    activity: {
      events_last_hour: number;
      trend: 'increasing' | 'decreasing' | 'stable';
    };
  }

  interface RetentionMetrics {
    cohort_date: string;
    total_users: number;
    day_1: number;
    day_7: number;
    day_30: number;
  }

  interface ContentPerformance {
    content_id: string;
    total_engagement: number;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    engagement_rate: number;
    trending_score: number;
  }

  // Stores
  const timeRange = writable('24h');
  const contentType = writable('all');
  const metrics = writable<EngagementMetrics | null>(null);
  const retentionData = writable<RetentionMetrics[]>([]);
  const topContent = writable<ContentPerformance[]>([]);
  const isLoading = writable(false);
  const error = writable<string | null>(null);

  // Derived metrics
  const engagementRate = derived(metrics, ($metrics) => {
    if (!$metrics) return 0;
    const { views, likes, comments, shares } = $metrics.engagement;
    return views > 0 ? ((likes + comments + shares) / views) * 100 : 0;
  });

  const retentionChartData = derived(retentionData, ($retentionData) => {
    return {
      labels: $retentionData.map(d => format(new Date(d.cohort_date), 'MMM d')),
      datasets: [
        {
          label: 'Day 1',
          data: $retentionData.map(d => d.day_1),
          borderColor: '#3b82f6',
          backgroundColor: '#3b82f680',
        },
        {
          label: 'Day 7',
          data: $retentionData.map(d => d.day_7),
          borderColor: '#10b981',
          backgroundColor: '#10b98180',
        },
        {
          label: 'Day 30',
          data: $retentionData.map(d => d.day_30),
          borderColor: '#6366f1',
          backgroundColor: '#6366f180',
        },
      ],
    };
  });

  const engagementChartData = derived(metrics, ($metrics) => {
    if (!$metrics) return null;
    const { views, likes, comments, shares } = $metrics.engagement;
    return {
      labels: ['Views', 'Likes', 'Comments', 'Shares'],
      datasets: [{
        data: [views, likes, comments, shares],
        backgroundColor: [
          '#3b82f6',
          '#10b981',
          '#6366f1',
          '#f59e0b'
        ],
      }],
    };
  });

  // Load metrics
  async function loadMetrics() {
    try {
      isLoading.set(true);
      error.set(null);

      const { data: metricsData, error: metricsError } = await supabase.rpc(
        'get_engagement_metrics',
        {
          time_range: $timeRange,
          content_type: $contentType === 'all' ? null : $contentType
        }
      );

      if (metricsError) throw metricsError;
      metrics.set(metricsData);

      // Load retention data
      const { data: retentionResult, error: retentionError } = await supabase.rpc(
        'get_retention_metrics',
        { time_range: '30d' }
      );

      if (retentionError) throw retentionError;
      retentionData.set(retentionResult);

      // Load top performing content
      const { data: contentData, error: contentError } = await supabase.rpc(
        'get_content_performance',
        {
          content_type: $contentType === 'all' ? null : $contentType,
          time_range: $timeRange,
          limit_count: 10
        }
      );

      if (contentError) throw contentError;
      topContent.set(contentData);

    } catch (err) {
      error.set(err.message);
      toast.error('Failed to load analytics data');
    } finally {
      isLoading.set(false);
    }
  }

  // Subscribe to real-time updates
  function subscribeToUpdates() {
    const subscription = supabase
      .channel('analytics_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'analytics_events'
        },
        () => {
          loadMetrics();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }

  // Load data on mount and when filters change
  $: if (browser && ($timeRange || $contentType)) {
    loadMetrics();
  }

  onMount(() => {
    const unsubscribe = subscribeToUpdates();
    return () => {
      unsubscribe();
    };
  });
</script>

<div class="w-full h-full flex flex-col space-y-4 p-4">
  <!-- Header -->
  <div class="flex justify-between items-center">
    <h1 class="text-2xl font-bold">Analytics Dashboard</h1>
    <div class="flex items-center space-x-4">
      <Select
        bind:value={$timeRange}
        options={[
          { value: '1h', label: 'Last Hour' },
          { value: '24h', label: 'Last 24 Hours' },
          { value: '7d', label: 'Last 7 Days' },
          { value: '30d', label: 'Last 30 Days' }
        ]}
      />
      <Select
        bind:value={$contentType}
        options={[
          { value: 'all', label: 'All Content' },
          { value: 'post', label: 'Posts' },
          { value: 'comment', label: 'Comments' }
        ]}
      />
    </div>
  </div>

  {#if $isLoading}
    <div class="flex justify-center items-center h-full">
      <Icon name="loader" class="animate-spin" />
    </div>
  {:else if $error}
    <div class="text-red-500 p-4">
      {$error}
    </div>
  {:else if $metrics}
    <!-- Overview Cards -->
    <div class="grid grid-cols-4 gap-4">
      <Card>
        <div class="p-4">
          <h3 class="text-sm font-medium text-gray-500">Total Events</h3>
          <p class="text-2xl font-bold mt-1">{$metrics.total_events}</p>
          <div class="flex items-center mt-2">
            <Icon
              name={$metrics.activity.trend === 'increasing' ? 'trending-up' :
                    $metrics.activity.trend === 'decreasing' ? 'trending-down' : 'minus'}
              class={$metrics.activity.trend === 'increasing' ? 'text-green-500' :
                     $metrics.activity.trend === 'decreasing' ? 'text-red-500' : 'text-gray-500'}
            />
            <span class="text-sm ml-1">
              {$metrics.activity.events_last_hour} events in the last hour
            </span>
          </div>
        </div>
      </Card>

      <Card>
        <div class="p-4">
          <h3 class="text-sm font-medium text-gray-500">Unique Users</h3>
          <p class="text-2xl font-bold mt-1">{$metrics.unique_users}</p>
          <p class="text-sm text-gray-500 mt-2">
            {$metrics.content_count} pieces of content
          </p>
        </div>
      </Card>

      <Card>
        <div class="p-4">
          <h3 class="text-sm font-medium text-gray-500">Engagement Rate</h3>
          <p class="text-2xl font-bold mt-1">{$engagementRate.toFixed(1)}%</p>
          <p class="text-sm text-gray-500 mt-2">
            Avg. time spent: {Math.round($metrics.engagement.avg_time_spent)}s
          </p>
        </div>
      </Card>

      <Card>
        <div class="p-4">
          <h3 class="text-sm font-medium text-gray-500">Reports</h3>
          <p class="text-2xl font-bold mt-1">{$metrics.engagement.reports}</p>
          <p class="text-sm text-gray-500 mt-2">
            {($metrics.engagement.reports / $metrics.content_count * 100).toFixed(1)}% of content
          </p>
        </div>
      </Card>
    </div>

    <!-- Charts -->
    <div class="grid grid-cols-2 gap-4">
      <Card class="col-span-2">
        <div class="p-4">
          <h3 class="text-lg font-medium mb-4">User Retention</h3>
          <LineChart
            data={$retentionChartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: {
                  beginAtZero: true,
                  max: 100,
                  title: {
                    display: true,
                    text: 'Retention Rate (%)'
                  }
                }
              }
            }}
            height={300}
          />
        </div>
      </Card>

      <Card>
        <div class="p-4">
          <h3 class="text-lg font-medium mb-4">Engagement Distribution</h3>
          <PieChart
            data={$engagementChartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'bottom'
                }
              }
            }}
            height={300}
          />
        </div>
      </Card>

      <Card>
        <div class="p-4">
          <h3 class="text-lg font-medium mb-4">Top Performing Content</h3>
          <div class="space-y-4">
            {#each $topContent as content}
              <div class="flex justify-between items-center">
                <div>
                  <p class="font-medium">Content #{content.content_id.slice(0, 8)}</p>
                  <p class="text-sm text-gray-500">
                    {content.views} views • {content.engagement_rate}% engagement
                  </p>
                </div>
                <div class="flex items-center space-x-4">
                  <div class="text-sm">
                    <Icon name="heart" class="inline-block text-red-500" />
                    {content.likes}
                  </div>
                  <div class="text-sm">
                    <Icon name="message-square" class="inline-block text-blue-500" />
                    {content.comments}
                  </div>
                  <div class="text-sm">
                    <Icon name="share" class="inline-block text-green-500" />
                    {content.shares}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </Card>
    </div>
  {/if}
</div>

<style>
  :global(.chart-container) {
    position: relative;
    height: 300px;
  }
</style> 