<!-- BarChart Component -->
<script lang="ts">
  import { Bar } from 'svelte-chartjs';
  import {
    Chart as ChartJS,
    Title,
    Tooltip,
    Legend,
    BarElement,
    CategoryScale,
    LinearScale
  } from 'chart.js';

  ChartJS.register(
    Title,
    Tooltip,
    Legend,
    BarElement,
    CategoryScale,
    LinearScale
  );

  export let data: any;
  export let options: any = {};
  export let height: number = 400;
</script>

<Bar {data} {options} {height} /> 