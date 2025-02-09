<!-- PieChart.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import * as d3 from 'd3';

  export let data: Array<Record<string, any>>;
  export let valueKey: string;
  export let labelKey: string;
  export let height = 300;
  export let colors = d3.schemeCategory10;

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

    const radius = Math.min(width, height) / 2;
    const centerX = width / 2;
    const centerY = height / 2;

    // Create pie generator
    const pie = d3.pie<Record<string, any>>()
      .value(d => d[valueKey])
      .sort(null);

    // Create arc generator
    const arc = d3.arc<d3.PieArcDatum<Record<string, any>>>()
      .innerRadius(0)
      .outerRadius(radius * 0.8);

    const labelArc = d3.arc<d3.PieArcDatum<Record<string, any>>>()
      .innerRadius(radius * 0.9)
      .outerRadius(radius * 0.9);

    const color = d3.scaleOrdinal(colors);

    const svg = d3.select(chart);

    // Add pie slices
    const g = svg.append('g')
      .attr('transform', `translate(${centerX},${centerY})`);

    const path = g.selectAll('path')
      .data(pie(data))
      .join('path')
      .attr('fill', (d, i) => color(i.toString()))
      .attr('d', arc)
      .attr('stroke', 'white')
      .attr('stroke-width', 2);

    // Add labels
    const label = g.selectAll('text')
      .data(pie(data))
      .join('text')
      .attr('transform', d => `translate(${labelArc.centroid(d)})`)
      .attr('dy', '0.35em');

    label.append('tspan')
      .attr('x', 0)
      .attr('y', '-0.7em')
      .style('font-weight', 'bold')
      .text(d => d.data[labelKey]);

    label.append('tspan')
      .attr('x', 0)
      .attr('y', '0.7em')
      .text(d => d.value.toLocaleString());

    // Add hover effects
    path.on('mouseenter', function(event, d) {
      d3.select(this)
        .transition()
        .duration(200)
        .attr('transform', () => {
          const centroid = arc.centroid(d);
          const x = centroid[0] * 0.1;
          const y = centroid[1] * 0.1;
          return `translate(${x},${y})`;
        });
    }).on('mouseleave', function() {
      d3.select(this)
        .transition()
        .duration(200)
        .attr('transform', 'translate(0,0)');
    });

    // Add legend
    const legend = svg.append('g')
      .attr('font-family', 'sans-serif')
      .attr('font-size', 10)
      .attr('text-anchor', 'start')
      .selectAll('g')
      .data(data)
      .join('g')
      .attr('transform', (d, i) => `translate(${width - 120},${i * 20 + 20})`);

    legend.append('rect')
      .attr('width', 15)
      .attr('height', 15)
      .attr('fill', (d, i) => color(i.toString()));

    legend.append('text')
      .attr('x', 20)
      .attr('y', 7.5)
      .attr('dy', '0.32em')
      .text(d => d[labelKey]);
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
    text {
      fill: var(--text-1);
      font-size: 12px;
      text-anchor: middle;
    }
  }
</style> 