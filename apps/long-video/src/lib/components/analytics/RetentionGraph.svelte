<!-- RetentionGraph.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { scaleLinear, line, area } from 'd3';

  // Props
  export let data: number[] = [];
  export let isLoading = false;

  // State
  let svg: SVGSVGElement;
  let width = 0;
  let height = 0;
  let hoveredIndex: number | null = null;

  // Graph dimensions
  const margin = { top: 20, right: 20, bottom: 30, left: 40 };

  $: innerWidth = width - margin.left - margin.right;
  $: innerHeight = height - margin.top - margin.bottom;

  $: xScale = scaleLinear()
    .domain([0, data.length - 1])
    .range([0, innerWidth]);

  $: yScale = scaleLinear()
    .domain([0, 100])
    .range([innerHeight, 0]);

  $: linePath = line<number>()
    .x((d, i) => xScale(i))
    .y(d => yScale(d));

  $: areaPath = area<number>()
    .x((d, i) => xScale(i))
    .y0(innerHeight)
    .y1(d => yScale(d));

  onMount(() => {
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width: newWidth, height: newHeight } = entry.contentRect;
        width = newWidth;
        height = newHeight;
      }
    });

    resizeObserver.observe(svg);

    return () => {
      resizeObserver.disconnect();
    };
  });

  function handleMouseMove(event: MouseEvent) {
    const rect = svg.getBoundingClientRect();
    const x = event.clientX - rect.left - margin.left;
    const index = Math.round(xScale.invert(x));
    
    if (index >= 0 && index < data.length) {
      hoveredIndex = index;
    }
  }

  function handleMouseLeave() {
    hoveredIndex = null;
  }

  function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
</script>

<div class="retention-graph">
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
      <span>Loading retention data...</span>
    </div>
  {/if}

  <svg
    bind:this={svg}
    class="graph"
    on:mousemove={handleMouseMove}
    on:mouseleave={handleMouseLeave}
  >
    <g transform={`translate(${margin.left},${margin.top})`}>
      <!-- Grid lines -->
      {#each yScale.ticks(5) as tick}
        <line
          class="grid-line"
          x1="0"
          x2={innerWidth}
          y1={yScale(tick)}
          y2={yScale(tick)}
        />
        <text
          class="axis-label"
          x="-10"
          y={yScale(tick)}
          dy="0.32em"
          text-anchor="end"
        >
          {tick}%
        </text>
      {/each}

      <!-- Area fill -->
      <path
        class="area"
        d={areaPath(data)}
      />

      <!-- Line -->
      <path
        class="line"
        d={linePath(data)}
      />

      <!-- Hover indicator -->
      {#if hoveredIndex !== null}
        <line
          class="hover-line"
          x1={xScale(hoveredIndex)}
          x2={xScale(hoveredIndex)}
          y1="0"
          y2={innerHeight}
        />
        <circle
          class="hover-point"
          cx={xScale(hoveredIndex)}
          cy={yScale(data[hoveredIndex])}
          r="4"
        />
        <g 
          class="hover-tooltip"
          transform={`translate(${xScale(hoveredIndex)},${yScale(data[hoveredIndex]) - 20})`}
        >
          <rect
            x="-40"
            y="-20"
            width="80"
            height="20"
            rx="4"
          />
          <text
            text-anchor="middle"
            dy="-6"
          >
            {data[hoveredIndex].toFixed(1)}%
          </text>
          <text
            class="time-label"
            text-anchor="middle"
            dy="8"
          >
            {formatTime(hoveredIndex)}
          </text>
        </g>
      {/if}

      <!-- X-axis -->
      <g transform={`translate(0,${innerHeight})`}>
        {#each xScale.ticks(5) as tick}
          <text
            class="axis-label"
            x={xScale(tick)}
            y="20"
            text-anchor="middle"
          >
            {formatTime(tick)}
          </text>
        {/each}
      </g>
    </g>
  </svg>

  <div class="legend">
    <div class="legend-item">
      <div class="legend-color" style="background: var(--primary-color, #00a8ff)" />
      <span>Viewer retention</span>
    </div>
    <div class="average-line">
      <span>Average: {(data.reduce((a, b) => a + b, 0) / data.length).toFixed(1)}%</span>
    </div>
  </div>
</div>

<style lang="postcss">
  .retention-graph {
    position: relative;
    width: 100%;
    height: 300px;
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

  .graph {
    width: 100%;
    height: 100%;
  }

  .grid-line {
    stroke: rgba(255, 255, 255, 0.1);
    stroke-dasharray: 2 2;
  }

  .axis-label {
    font-size: 12px;
    fill: rgba(255, 255, 255, 0.5);
  }

  .area {
    fill: color-mix(in srgb, var(--primary-color, #00a8ff) 20%, transparent);
  }

  .line {
    fill: none;
    stroke: var(--primary-color, #00a8ff);
    stroke-width: 2;
  }

  .hover-line {
    stroke: rgba(255, 255, 255, 0.2);
    stroke-dasharray: 2 2;
  }

  .hover-point {
    fill: white;
    stroke: var(--primary-color, #00a8ff);
    stroke-width: 2;
  }

  .hover-tooltip {
    rect {
      fill: rgba(0, 0, 0, 0.9);
    }

    text {
      fill: white;
      font-size: 12px;
    }

    .time-label {
      fill: rgba(255, 255, 255, 0.7);
      font-size: 10px;
    }
  }

  .legend {
    position: absolute;
    top: 0;
    right: 0;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 8px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .legend-color {
    width: 12px;
    height: 12px;
    border-radius: 2px;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style> 