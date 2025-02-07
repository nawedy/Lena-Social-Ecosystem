<script lang="ts">
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import { supabase } from '$lib/supabaseClient';
  import * as d3 from 'd3';
  import { fade, slide } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';

  // Props
  export let debateId: string;

  // Types
  interface DebateMetrics {
    totalArguments: number;
    totalParticipants: number;
    averageStrength: number;
    averageFactCheckerScore: number;
    averageExpertConsensus: number;
    topContributors: {
      userId: string;
      userName: string;
      contributions: number;
      avgStrength: number;
    }[];
    argumentTypes: {
      type: string;
      count: number;
    }[];
    timelineData: {
      timestamp: Date;
      argumentCount: number;
      participantCount: number;
    }[];
    sentimentAnalysis: {
      positive: number;
      neutral: number;
      negative: number;
    };
    engagementMetrics: {
      views: number;
      shares: number;
      reactions: number;
      comments: number;
    };
  }

  interface ChartConfig {
    margin: { top: number; right: number; bottom: number; left: number };
    height: number;
    width: number;
  }

  // Stores
  const metrics = writable<DebateMetrics | null>(null);
  const selectedTimeRange = writable<'day' | 'week' | 'month' | 'year'>('week');
  const selectedMetric = writable<'arguments' | 'participants'>('arguments');
  const chartConfig = writable<ChartConfig>({
    margin: { top: 20, right: 30, bottom: 30, left: 40 },
    height: 0,
    width: 0
  });
  const hoveredData = writable<{
    x: number;
    y: number;
    value: number;
    timestamp: Date;
  } | null>(null);

  // Chart dimensions
  let width = 0;
  let height = 0;
  let svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;

  // Fix onMount by separating async initialization
  async function initializeAnalytics() {
    await loadMetrics();
  }

  onMount(() => {
    // Initialize analytics
    initializeAnalytics();

    // Set up chart
    const container = document.querySelector('#analytics-chart') as SVGSVGElement;
    svg = d3.select(container);
    updateDimensions();
    
    // Update chart when window resizes
    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
      updateChart();
    });
    
    resizeObserver.observe(container);

    // Set up real-time updates
    const metricsSubscription = supabase
      .channel('debate-metrics')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'debate_metrics',
          filter: 'debate_id=eq.' + debateId
        },
        () => loadMetrics()
      )
      .subscribe();

    return () => {
      metricsSubscription.unsubscribe();
      resizeObserver.disconnect();
    };
  });

  async function loadMetrics() {
    try {
      const response = await fetch(`/api/debates/${debateId}/metrics`);
      if (!response.ok) throw new Error('Failed to fetch metrics');
      
      const data = await response.json();
      metrics.set({
        ...data,
        timelineData: data.timelineData.map((d: any) => ({
          ...d,
          timestamp: new Date(d.timestamp)
        }))
      });

      updateChart();
    } catch (error) {
      console.error('Error loading metrics:', error);
    }
  }

  function updateDimensions() {
    const container = document.querySelector('#analytics-container');
    if (container) {
      width = container.clientWidth;
      height = container.clientHeight;
      svg.attr('width', width).attr('height', height);
    }
  }

  function getTimeRangeFilter(range: 'day' | 'week' | 'month' | 'year'): Date {
    const now = new Date();
    switch (range) {
      case 'day':
        return new Date(now.setDate(now.getDate() - 1));
      case 'week':
        return new Date(now.setDate(now.getDate() - 7));
      case 'month':
        return new Date(now.setMonth(now.getMonth() - 1));
      case 'year':
        return new Date(now.setFullYear(now.getFullYear() - 1));
      default:
        return new Date(now.setDate(now.getDate() - 7));
    }
  }

  function updateChart() {
    if (!$metrics || !svg) return;

    const { margin, width, height } = $chartConfig;
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Filter data based on selected time range
    const timeFilter = getTimeRangeFilter($selectedTimeRange);
    const filteredData = $metrics.timelineData.filter(d => d.timestamp >= timeFilter);

    // Clear previous chart
    svg.selectAll('*').remove();

    // Create scales
    const xScale = d3.scaleTime()
      .domain(d3.extent(filteredData, d => d.timestamp) as [Date, Date])
      .range([0, chartWidth]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(filteredData, d => 
        $selectedMetric === 'arguments' ? d.argumentCount : d.participantCount
      ) as number])
      .range([chartHeight, 0]);

    // Create chart group
    const chart = svg.append('g')
      .attr('class', 'chart-group')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Add gradient
    const gradient = chart.append('defs')
      .append('linearGradient')
      .attr('id', 'area-gradient')
    // Add axes
    chart.append('g')
      .attr('transform', `translate(0,${chartHeight})`)
      .call(d3.axisBottom(xScale));

    chart.append('g')
      .call(d3.axisLeft(yScale));

    // Add line
    const lineGenerator = d3.line<typeof filteredData[0]>()
      .x(d => xScale(d.timestamp))
      .y(d => yScale($selectedMetric === 'arguments' ? d.argumentCount : d.participantCount))
      .curve(d3.curveMonotoneX);

    chart.append('path')
      .datum(filteredData)
      .attr('class', 'line')
      .attr('d', lineGenerator)
      .attr('fill', 'none')
      .attr('stroke', 'var(--color-deep-gold)')
      .attr('stroke-width', 2);

    // Add area
    const area = d3.area<typeof $metrics.timelineData[0]>()
      .x(d => xScale(d.timestamp))
      .y0(chartHeight)
      .y1(d => yScale($selectedMetric === 'arguments' ? d.argumentCount : d.participantCount))
      .curve(d3.curveMonotoneX);

    chart.append('path')
      .datum($metrics.timelineData)
      .attr('class', 'area')
      .attr('d', area)
      .attr('fill', 'var(--color-deep-gold)')
      .attr('fill-opacity', 0.1);

    // Add interactive elements
    const focus = chart.append('g')
      .attr('class', 'focus')
      .style('display', 'none');

    focus.append('circle')
      .attr('r', 4)
      .attr('fill', 'var(--color-deep-gold)');

    focus.append('text')
      .attr('x', 9)
      .attr('dy', '.35em')
      .attr('fill', 'white');

    const overlay = chart.append('rect')
      .attr('class', 'overlay')
      .attr('width', chartWidth)
      .attr('height', chartHeight)
      .attr('fill', 'none')
      .attr('pointer-events', 'all')
      .on('mouseover', () => focus.style('display', null))
      .on('mouseout', () => focus.style('display', 'none'))
      .on('mousemove', (event: MouseEvent) => {
        const [x] = d3.pointer(event);
        const bisectDate = d3.bisector<typeof $metrics.timelineData[0], Date>(d => d.timestamp).left;
        const x0 = xScale.invert(x);
        const i = bisectDate($metrics.timelineData, x0, 1);
        const d0 = $metrics.timelineData[i - 1];
        const d1 = $metrics.timelineData[i];
        const d = x0.getTime() - d0.timestamp.getTime() > d1.timestamp.getTime() - x0.getTime() ? d1 : d0;
        
        focus.attr('transform', `translate(${xScale(d.timestamp)},${yScale(
          $selectedMetric === 'arguments' ? d.argumentCount : d.participantCount
        )})`);
        
        focus.select('text').text(
          $selectedMetric === 'arguments' ? d.argumentCount : d.participantCount
        );
      });
  }

  // Update chart when selected metric changes
  $: if ($selectedMetric) {
    updateChart();
  }
</script>

<div class="analytics-container" id="analytics-container">
  <div class="metrics-overview">
    {#if $metrics}
      <div class="metrics-grid">
        <div class="metric-card">
          <h3>Total Arguments</h3>
          <p class="metric-value">{$metrics.totalArguments}</p>
        </div>
        <div class="metric-card">
          <h3>Total Participants</h3>
          <p class="metric-value">{$metrics.totalParticipants}</p>
        </div>
        <div class="metric-card">
          <h3>Average Strength</h3>
          <p class="metric-value">{($metrics.averageStrength * 100).toFixed(1)}%</p>
        </div>
        <div class="metric-card">
          <h3>Fact Checker Score</h3>
          <p class="metric-value">{($metrics.averageFactCheckerScore * 100).toFixed(1)}%</p>
        </div>
      </div>

      <div class="engagement-section">
        <h3>Engagement Metrics</h3>
        <div class="engagement-grid">
          <div class="engagement-metric">
            <span class="label">Views</span>
            <span class="value">{$metrics.engagementMetrics.views.toLocaleString()}</span>
          </div>
          <div class="engagement-metric">
            <span class="label">Shares</span>
            <span class="value">{$metrics.engagementMetrics.shares.toLocaleString()}</span>
          </div>
          <div class="engagement-metric">
            <span class="label">Reactions</span>
            <span class="value">{$metrics.engagementMetrics.reactions.toLocaleString()}</span>
          </div>
          <div class="engagement-metric">
            <span class="label">Comments</span>
            <span class="value">{$metrics.engagementMetrics.comments.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div class="sentiment-section">
        <h3>Sentiment Analysis</h3>
        <div class="sentiment-bars">
          <div class="sentiment-bar">
            <div class="label">Positive</div>
            <div class="bar-container">
              <div
                class="bar positive"
                style="width: {$metrics.sentimentAnalysis.positive * 100}%"
              ></div>
            </div>
            <div class="value">{($metrics.sentimentAnalysis.positive * 100).toFixed(1)}%</div>
          </div>
          <div class="sentiment-bar">
            <div class="label">Neutral</div>
            <div class="bar-container">
              <div
                class="bar neutral"
                style="width: {$metrics.sentimentAnalysis.neutral * 100}%"
              ></div>
            </div>
            <div class="value">{($metrics.sentimentAnalysis.neutral * 100).toFixed(1)}%</div>
          </div>
          <div class="sentiment-bar">
            <div class="label">Negative</div>
            <div class="bar-container">
              <div
                class="bar negative"
                style="width: {$metrics.sentimentAnalysis.negative * 100}%"
              ></div>
            </div>
            <div class="value">{($metrics.sentimentAnalysis.negative * 100).toFixed(1)}%</div>
          </div>
        </div>
      </div>

      <div class="contributors-section">
        <h3>Top Contributors</h3>
        <div class="contributors-list">
          {#each $metrics.topContributors as contributor}
            <div class="contributor-card">
              <div class="contributor-info">
                <span class="name">{contributor.userName}</span>
                <span class="contributions">{contributor.contributions} contributions</span>
              </div>
              <div class="strength-meter">
                <div
                  class="strength-bar"
                  style="width: {contributor.avgStrength * 100}%"
                ></div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <div class="chart-container">
    <div class="chart-controls">
      <div class="metric-selector">
        <label>Show:</label>
        <select bind:value={$selectedMetric}>
          <option value="arguments">Arguments</option>
          <option value="participants">Participants</option>
        </select>
      </div>

      <div class="time-range-selector">
        <label>Time Range:</label>
        <select bind:value={$selectedTimeRange}>
          <option value="day">Last 24 Hours</option>
          <option value="week">Last Week</option>
          <option value="month">Last Month</option>
          <option value="year">Last Year</option>
        </select>
      </div>
    </div>

    <svg id="analytics-chart"></svg>
  </div>
</div>

<style lang="postcss">
  .analytics-container {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 1rem;
    padding: 1rem;
    height: 100vh;
    background: var(--color-deep-space-black);
    color: white;
  }

  .metrics-overview {
    background: rgba(10, 37, 64, 0.9);
    border-radius: 8px;
    padding: 1rem;
    border: 1px solid var(--color-deep-gold);
    overflow-y: auto;
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .metric-card {
    background: rgba(255, 255, 255, 0.1);
    padding: 1rem;
    border-radius: 4px;
    text-align: center;
  }

  .metric-value {
    font-size: 1.5rem;
    font-weight: bold;
    color: var(--color-deep-gold);
  }

  .engagement-section,
  .sentiment-section,
  .contributors-section {
    margin-top: 2rem;
  }

  .engagement-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }

  .engagement-metric {
    background: rgba(255, 255, 255, 0.1);
    padding: 0.5rem;
    border-radius: 4px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .sentiment-bars {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .sentiment-bar {
    display: grid;
    grid-template-columns: 80px 1fr 60px;
    align-items: center;
    gap: 1rem;
  }

  .bar-container {
    height: 8px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    overflow: hidden;
  }

  .bar {
    height: 100%;
    transition: width 0.3s ease;
  }

  .bar.positive {
    background: #4CAF50;
  }

  .bar.neutral {
    background: #FFC107;
  }

  .bar.negative {
    background: #f44336;
  }

  .contributors-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .contributor-card {
    background: rgba(255, 255, 255, 0.1);
    padding: 0.5rem;
    border-radius: 4px;
  }

  .contributor-info {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.25rem;
  }

  .strength-meter {
    height: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    overflow: hidden;
  }

  .strength-bar {
    height: 100%;
    background: var(--color-deep-gold);
    transition: width 0.3s ease;
  }

  .chart-container {
    background: rgba(10, 37, 64, 0.9);
    border-radius: 8px;
    padding: 1rem;
    border: 1px solid var(--color-deep-gold);
    display: flex;
    flex-direction: column;
  }

  .chart-controls {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .metric-selector,
  .time-range-selector {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  select {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid var(--color-deep-gold);
    border-radius: 4px;
    color: white;
    padding: 0.25rem 0.5rem;
  }

  svg {
    flex: 1;
  }

  :global(.line) {
    transition: d 0.3s ease;
  }

  :global(.area) {
    transition: d 0.3s ease;
  }

  :global(.focus circle) {
    stroke: white;
    stroke-width: 1.5;
  }

  :global(.focus text) {
    font-size: 12px;
  }
</style> 