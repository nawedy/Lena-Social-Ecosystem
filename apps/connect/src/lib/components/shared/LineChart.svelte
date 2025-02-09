<!-- LineChart.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import * as d3 from 'd3';

  export let data: Array<Record<string, any>>;
  export let xKey: string;
  export let series: Array<{
    key: string;
    name: string;
    color?: string;
  }>;
  export let height = 300;
  export let margin = { top: 20, right: 20, bottom: 30, left: 40 };

  let chart: SVGSVGElement;
  let width: number;

  $: if (chart && width && data) {
    drawChart();
  }

  onMount(() => {
    const resizeObserver = new ResizeObserver(entries => {
      width = entries[0].contentRect.width;
    });
    resizeObserver.observe(chart);

    return () => {
      resizeObserver.disconnect();
    };
  });

  function drawChart() {
    // Clear previous chart
    d3.select(chart).selectAll('*').remove();

    // Create scales
    const x = d3.scaleTime()
      .domain(d3.extent(data, d => new Date(d[xKey])) as [Date, Date])
      .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => 
        Math.max(...series.map(s => d[s.key] || 0))
      ) as number])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const color = d3.scaleOrdinal()
      .domain(series.map(s => s.key))
      .range(series.map(s => s.color || d3.schemeCategory10[series.indexOf(s)]));

    // Create line generator
    const line = d3.line<Record<string, any>>()
      .x(d => x(new Date(d[xKey])))
      .y(d => y(d[series[0].key]))
      .curve(d3.curveMonotoneX);

    const svg = d3.select(chart);

    // Add axes
    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(width > 600 ? 10 : 5))
      .call(g => g.select('.domain').remove());

    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y))
      .call(g => g.select('.domain').remove());

    // Add grid lines
    svg.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x)
        .ticks(width > 600 ? 10 : 5)
        .tickSize(-(height - margin.top - margin.bottom))
        .tickFormat(() => '')
      );

    svg.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y)
        .tickSize(-(width - margin.left - margin.right))
        .tickFormat(() => '')
      );

    // Add lines
    series.forEach(s => {
      svg.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', color(s.key))
        .attr('stroke-width', 2)
        .attr('d', line.y(d => y(d[s.key])));

      // Add dots
      svg.selectAll(`.dot-${s.key}`)
        .data(data)
        .join('circle')
        .attr('class', `dot-${s.key}`)
        .attr('cx', d => x(new Date(d[xKey])))
        .attr('cy', d => y(d[s.key]))
        .attr('r', 4)
        .attr('fill', color(s.key));
    });

    // Add legend
    const legend = svg.append('g')
      .attr('font-family', 'sans-serif')
      .attr('font-size', 10)
      .attr('text-anchor', 'start')
      .selectAll('g')
      .data(series)
      .join('g')
      .attr('transform', (d, i) => `translate(${margin.left},${margin.top + i * 20})`);

    legend.append('rect')
      .attr('x', width - margin.right - 19)
      .attr('width', 19)
      .attr('height', 19)
      .attr('fill', d => color(d.key));

    legend.append('text')
      .attr('x', width - margin.right - 24)
      .attr('y', 9.5)
      .attr('dy', '0.32em')
      .text(d => d.name);
  }
</script>

<svg
  bind:this={chart}
  {width}
  {height}
  transition:fade
  viewBox="0 0 {width} {height}"
>
</svg>

<style lang="postcss">
  svg {
    width: 100%;
    height: 100%;
    min-height: 300px;
  }

  :global {
    .grid line {
      stroke: var(--surface-3);
      stroke-opacity: 0.1;
    }

    .grid path {
      stroke-width: 0;
    }
  }
</style> 