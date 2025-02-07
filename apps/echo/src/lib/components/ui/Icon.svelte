<!-- Icon Component -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import Lucide from 'lucide-svelte';

  export let name: string;
  export let size: number = 24;
  export let strokeWidth: number = 2;
  export let class: string = '';

  let Icon: any;

  onMount(async () => {
    if (browser) {
      const icons = await import('lucide-svelte');
      const iconName = name.charAt(0).toUpperCase() + name.slice(1);
      Icon = icons[iconName];
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