<!-- AnalyticsDashboard.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import { analyticsService } from '$lib/services/analytics/AnalyticsService';
  import { Button, Card, Tabs, Tab } from '$lib/components/ui';
  import LineChart from '../shared/LineChart.svelte';
  import PieChart from '../shared/PieChart.svelte';
  import BarChart from '../shared/BarChart.svelte';
  import DataTable from '../shared/DataTable.svelte';

  // Stores
  const engagement = analyticsService.getEngagementMetrics();
  const content = analyticsService.getContentMetrics();
  const users = analyticsService.getUserMetrics();
  const reputation = analyticsService.getReputationMetrics();

  // State
  let activeTab = 'overview';
  let timeRange = 'week';

  // Computed
  $: engagementScore = $engagement ? calculateEngagementScore($engagement) : 0;
  $: contentScore = $content ? calculateContentScore($content) : 0;
  $: userScore = $users ? calculateUserScore($users) : 0;
  $: reputationScore = $reputation ? calculateReputationScore($reputation) : 0;

  function calculateEngagementScore(metrics: any): number {
    const weights = {
      views: 0.2,
      participants: 0.3,
      comments: 0.3,
      shares: 0.2
    };

    const normalizedViews = Math.min(metrics.views / 1000, 1);
    const normalizedParticipants = Math.min(metrics.participants / 100, 1);
    const normalizedComments = Math.min(metrics.comments / 500, 1);
    const normalizedShares = Math.min(metrics.shares / 100, 1);

    return (
      normalizedViews * weights.views +
      normalizedParticipants * weights.participants +
      normalizedComments * weights.comments +
      normalizedShares * weights.shares
    ) * 100;
  }

  function calculateContentScore(metrics: any): number {
    if (!metrics.topDiscussions.length) return 0;

    const averageQuality = metrics.topDiscussions.reduce(
      (sum: number, d: any) => sum + d.quality,
      0
    ) / metrics.topDiscussions.length;

    const categoryDiversity = Object.keys(metrics.categoryDistribution).length / 10;
    const tagDiversity = Object.keys(metrics.tagDistribution).length / 20;

    return (averageQuality * 0.6 + categoryDiversity * 0.2 + tagDiversity * 0.2) * 100;
  }

  function calculateUserScore(metrics: any): number {
    const retentionWeight = 0.4;
    const growthWeight = 0.3;
    const activityWeight = 0.3;

    const retentionScore = metrics.retentionRate;
    const growthScore = metrics.newUsers / metrics.totalUsers;
    const activityScore = metrics.activeUsers / metrics.totalUsers;

    return (
      retentionScore * retentionWeight +
      growthScore * growthWeight +
      activityScore * activityWeight
    ) * 100;
  }

  function calculateReputationScore(metrics: any): number {
    const totalUsers = metrics.reputationDistribution.reduce(
      (sum: number, d: any) => sum + d.count,
      0
    );

    const highRepUsers = metrics.reputationDistribution
      .filter((d: any) => parseInt(d.range.split('-')[0]) > 500)
      .reduce((sum: number, d: any) => sum + d.count, 0);

    return (highRepUsers / totalUsers) * 100;
  }

  function formatNumber(num: number): string {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(num);
  }

  function formatDuration(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }

  function formatPercentage(num: number): string {
    return `${num.toFixed(1)}%`;
  }
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold">Analytics Dashboard</h1>
    <div class="flex items-center gap-4">
      <select
        bind:value={timeRange}
        class="bg-card border border-border rounded-lg px-3 py-1.5"
      >
        <option value="day">Last 24 Hours</option>
        <option value="week">Last 7 Days</option>
        <option value="month">Last 30 Days</option>
      </select>
    </div>
  </div>

  <!-- Score Cards -->
  <div class="grid grid-cols-4 gap-4">
    <Card class="p-4">
      <div class="text-sm text-muted-foreground">Engagement Score</div>
      <div class="text-2xl font-bold mt-1">{formatPercentage(engagementScore)}</div>
      {#if $engagement}
        <div class="text-xs text-muted-foreground mt-2">
          {formatNumber($engagement.views)} views • 
          {formatNumber($engagement.participants)} participants
        </div>
      {/if}
    </Card>

    <Card class="p-4">
      <div class="text-sm text-muted-foreground">Content Score</div>
      <div class="text-2xl font-bold mt-1">{formatPercentage(contentScore)}</div>
      {#if $content}
        <div class="text-xs text-muted-foreground mt-2">
          {Object.keys($content.categoryDistribution).length} categories • 
          {Object.keys($content.tagDistribution).length} tags
        </div>
      {/if}
    </Card>

    <Card class="p-4">
      <div class="text-sm text-muted-foreground">User Score</div>
      <div class="text-2xl font-bold mt-1">{formatPercentage(userScore)}</div>
      {#if $users}
        <div class="text-xs text-muted-foreground mt-2">
          {formatNumber($users.activeUsers)} active • 
          {formatNumber($users.newUsers)} new
        </div>
      {/if}
    </Card>

    <Card class="p-4">
      <div class="text-sm text-muted-foreground">Reputation Score</div>
      <div class="text-2xl font-bold mt-1">{formatPercentage(reputationScore)}</div>
      {#if $reputation}
        <div class="text-xs text-muted-foreground mt-2">
          {formatNumber($reputation.topEarners.length)} top earners
        </div>
      {/if}
    </Card>
  </div>

  <!-- Tabs -->
  <Tabs bind:active={activeTab}>
    <Tab id="overview" title="Overview">
      <div class="space-y-6">
        {#if $engagement}
          <Card class="p-6">
            <h3 class="text-lg font-medium mb-4">Engagement Overview</h3>
            <div class="grid grid-cols-2 gap-6">
              <div>
                <LineChart
                  data={[
                    { label: 'Views', value: $engagement.views },
                    { label: 'Comments', value: $engagement.comments },
                    { label: 'Reactions', value: $engagement.reactions },
                    { label: 'Shares', value: $engagement.shares }
                  ]}
                  height={300}
                />
              </div>
              <div class="space-y-4">
                <div>
                  <div class="text-sm text-muted-foreground">Average Session Duration</div>
                  <div class="text-xl font-medium">
                    {formatDuration($engagement.averageSessionDuration)}
                  </div>
                </div>
                <div>
                  <div class="text-sm text-muted-foreground">Bounce Rate</div>
                  <div class="text-xl font-medium">
                    {formatPercentage($engagement.bounceRate)}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        {/if}

        {#if $content}
          <Card class="p-6">
            <h3 class="text-lg font-medium mb-4">Content Distribution</h3>
            <div class="grid grid-cols-2 gap-6">
              <div>
                <h4 class="text-sm font-medium mb-2">By Category</h4>
                <PieChart
                  data={Object.entries($content.categoryDistribution).map(([category, count]) => ({
                    label: category,
                    value: count
                  }))}
                  height={250}
                />
              </div>
              <div>
                <h4 class="text-sm font-medium mb-2">Top Tags</h4>
                <BarChart
                  data={Object.entries($content.tagDistribution)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
                    .map(([tag, count]) => ({
                      label: tag,
                      value: count
                    }))}
                  height={250}
                />
              </div>
            </div>
          </Card>
        {/if}

        {#if $users}
          <Card class="p-6">
            <h3 class="text-lg font-medium mb-4">User Growth</h3>
            <LineChart
              data={$users.userGrowth.map(point => ({
                date: point.date,
                total: point.total,
                new: point.new,
                active: point.active
              }))}
              height={300}
            />
          </Card>
        {/if}
      </div>
    </Tab>

    <Tab id="content" title="Content">
      {#if $content}
        <div class="space-y-6">
          <Card class="p-6">
            <h3 class="text-lg font-medium mb-4">Top Discussions</h3>
            <DataTable
              data={$content.topDiscussions}
              columns={[
                { key: 'title', label: 'Title' },
                { key: 'views', label: 'Views', format: formatNumber },
                { key: 'participants', label: 'Participants', format: formatNumber },
                { key: 'comments', label: 'Comments', format: formatNumber },
                { key: 'quality', label: 'Quality', format: formatPercentage }
              ]}
            />
          </Card>

          <Card class="p-6">
            <h3 class="text-lg font-medium mb-4">Content Quality Trend</h3>
            <LineChart
              data={$content.contentQualityTrend}
              height={300}
            />
          </Card>
        </div>
      {/if}
    </Tab>

    <Tab id="users" title="Users">
      {#if $users}
        <div class="space-y-6">
          <Card class="p-6">
            <h3 class="text-lg font-medium mb-4">Top Contributors</h3>
            <DataTable
              data={$users.topContributors}
              columns={[
                { key: 'username', label: 'User' },
                { key: 'discussions', label: 'Discussions', format: formatNumber },
                { key: 'comments', label: 'Comments', format: formatNumber },
                { key: 'reputation', label: 'Reputation', format: formatNumber }
              ]}
            />
          </Card>

          {#if $reputation}
            <div class="grid grid-cols-2 gap-6">
              <Card class="p-6">
                <h3 class="text-lg font-medium mb-4">Reputation Distribution</h3>
                <PieChart
                  data={$reputation.reputationDistribution}
                  height={300}
                />
              </Card>

              <Card class="p-6">
                <h3 class="text-lg font-medium mb-4">Reputation Sources</h3>
                <BarChart
                  data={Object.entries($reputation.reputationSources)
                    .sort((a, b) => b[1] - a[1])
                    .map(([source, amount]) => ({
                      label: source,
                      value: amount
                    }))}
                  height={300}
                />
              </Card>
            </div>
          {/if}
        </div>
      {/if}
    </Tab>
  </Tabs>
</div>

<style>
  /* Add any component-specific styles here */
</style> 