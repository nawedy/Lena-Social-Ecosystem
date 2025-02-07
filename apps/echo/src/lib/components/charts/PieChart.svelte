<!-- PieChart Component -->
<script lang="ts">
  import { Pie } from 'svelte-chartjs';
  import {
    Chart as ChartJS,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    CategoryScale
  } from 'chart.js';

  ChartJS.register(
    Title,
    Tooltip,
    Legend,
    ArcElement,
    CategoryScale
  );

  export let data: any;
  export let options: any = {};
  export let height: number = 400;
</script>

<Pie {data} {options} {height} /> 