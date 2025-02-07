<!-- ContentWarning.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Button } from '@lena/ui';

  export let type: 'nsfw' | 'spoiler' | 'sensitive' = 'sensitive';
  export let message = '';
  export let blurStrength = '20px';

  const dispatch = createEventDispatcher();
  let acknowledged = false;

  const defaultMessages = {
    nsfw: 'This post contains adult content',
    spoiler: 'This post contains spoilers',
    sensitive: 'This post contains sensitive content'
  };

  function handleAcknowledge() {
    acknowledged = true;
    dispatch('acknowledge');
  }
</script>

<div class="relative w-full h-full">
  <slot />
  
  {#if !acknowledged}
    <div 
      class="absolute inset-0 backdrop-blur-[{blurStrength}] bg-black/50 
             flex items-center justify-center text-center p-4"
    >
      <div class="max-w-sm">
        <p class="text-lg font-medium mb-2">⚠️ Content Warning</p>
        <p class="text-gray-300 mb-4">{message || defaultMessages[type]}</p>
        <Button variant="primary" on:click={handleAcknowledge}>
          Show Content
        </Button>
      </div>
    </div>
  {/if}
</div> 