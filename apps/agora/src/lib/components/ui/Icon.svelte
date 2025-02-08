<!-- Icon.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import * as lucide from 'lucide-svelte';

  export let name: keyof typeof lucide;
  export let size: number = 24;
  export let strokeWidth: number = 2;
  export let class: string = '';

  let Icon: any;

  onMount(async () => {
    if (browser) {
      Icon = lucide[name];
    }
  });
</script>

{#if Icon}
  <Icon
    {size}
    strokeWidth={strokeWidth}
    class={class}
    {...$$restProps}
  />
{/if}

<style>
  /* Add any component-specific styles here */
</style> 