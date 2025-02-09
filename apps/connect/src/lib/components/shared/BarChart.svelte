<!-- BarChart.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import * as d3 from 'd3';

  export let data: Array<Record<string, any>>;
  export let xKey: string;
  export let yKey: string;
  export let colorKey?: string;
  export let height = 300;
  export let margin = { top: 20, right: 20, bottom: 40, left: 60 };

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
    const x = d3.scaleBand()
      .domain(data.map(d => d[xKey]))
      .range([margin.left, width - margin.right])
      .padding(0.1);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d[yKey]) as number])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const color = colorKey
      ? d3.scaleSequential(d3.interpolateBlues)
        .domain([
          d3.min(data, d => d[colorKey]) as number,
          d3.max(data, d => d[colorKey]) as number
        ])
      : () => 'var(--primary-color)';

    const svg = d3.select(chart);

    // Add bars
    svg.append('g')
      .selectAll('rect')
      .data(data)
      .join('rect')
      .attr('x', d => x(d[xKey]) as number)
      .attr('y', d => y(d[yKey]))
      .attr('height', d => y(0) - y(d[yKey]))
      .attr('width', x.bandwidth())
      .attr('fill', d => colorKey ? color(d[colorKey]) : color())
      .attr('rx', 4)
      .attr('ry', 4);

    // Add x-axis
    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x))
      .call(g => g.select('.domain').remove())
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end');

    // Add y-axis
    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y))
      .call(g => g.select('.domain').remove());

    // Add grid lines
    svg.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y)
        .tickSize(-(width - margin.left - margin.right))
        .tickFormat(() => '')
      );

    // Add hover effects
    const tooltip = d3.select('body')
      .append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('background', 'var(--surface-2)')
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('z-index', '100');

    svg.selectAll('rect')
      .on('mouseenter', function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('opacity', 0.8);

        tooltip
          .style('opacity', 1)
          .html(`
            <strong>${d[xKey]}</strong><br/>
            ${d[yKey].toLocaleString()}
            ${colorKey ? `<br/>${colorKey}: ${d[colorKey]}` : ''}
          `);
      })
      .on('mousemove', (event) => {
        tooltip
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY - 10}px`);
      })
      .on('mouseleave', function() {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('opacity', 1);

        tooltip
          .style('opacity', 0);
      });

    return () => {
      tooltip.remove();
    };
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

    text {
      fill: var(--text-2);
      font-size: 12px;
    }
  }
</style> 