<!-- IntersectionObserver.svelte -->
<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  // Props
  export let root: Element | null = null;
  export let rootMargin = '0px';
  export let threshold = 0;
  export let disabled = false;

  // State
  let element: HTMLElement;
  let observer: IntersectionObserver | null = null;

  // Lifecycle
  onMount(() => {
    if (!disabled) {
      setupObserver();
    }
  });

  onDestroy(() => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  });

  // Watch for prop changes
  $: if (observer && disabled) {
    observer.disconnect();
    observer = null;
  } else if (!observer && !disabled) {
    setupObserver();
  }

  // Methods
  function setupObserver() {
    if (!element || typeof IntersectionObserver === 'undefined') return;

    observer = new IntersectionObserver(
      (entries) => {
        dispatch('intersect', entries);
      },
      {
        root,
        rootMargin,
        threshold
      }
    );

    observer.observe(element);
  }
</script>

<div bind:this={element}>
  <slot />
</div>

<style>
  div {
    width: 100%;
    height: 100%;
  }
</style> 