<!-- LoadingScreen.svelte -->
<script lang="ts">
  import { Icon } from '$lib/components/ui';
  import { fade } from 'svelte/transition';
</script>

<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
  transition:fade={{ duration: 150 }}
>
  <div class="flex flex-col items-center space-y-4">
    <div class="relative h-16 w-16">
      <Icon
        name="loader-2"
        class="h-16 w-16 animate-spin text-primary"
      />
      <div class="absolute inset-0 flex items-center justify-center">
        <Icon
          name="shopping-bag"
          class="h-8 w-8 text-primary"
        />
      </div>
    </div>
    <p class="text-lg font-medium text-muted-foreground">
      Loading...
    </p>
  </div>
</div>

<style>
  /* Add any component-specific styles here */
</style> 