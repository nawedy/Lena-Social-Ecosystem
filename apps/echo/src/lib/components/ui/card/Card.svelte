<!-- Card Component -->
<script lang="ts">
  import { cn } from '$lib/utils';

  export let class: string = '';
</script>

<div
  class={cn(
    'rounded-lg border bg-card text-card-foreground shadow-sm',
    class
  )}
  {...$$restProps}
>
  <slot />
</div> 