<!-- LineChart Component -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Chart from 'chart.js/auto';
  import type { ChartData, ChartOptions } from 'chart.js';

  export let data: ChartData;
  export let options: ChartOptions = {};

  let canvas: HTMLCanvasElement;
  let chart: Chart;

  const defaultOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        }
      }
    }
  };

  $: if (chart && data) {
    chart.data = data;
    chart.update();
  }

  onMount(() => {
    chart = new Chart(canvas, {
      type: 'line',
      data,
      options: { ...defaultOptions, ...options }
    });
  });

  onDestroy(() => {
    if (chart) {
      chart.destroy();
    }
  });
</script>

<div class="chart-container">
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .chart-container {
    position: relative;
    height: 300px;
    width: 100%;
  }
</style> 