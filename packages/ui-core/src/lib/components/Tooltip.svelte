<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import { cn } from '$lib/utils';

  export let content: string;
  export let position: 'top' | 'right' | 'bottom' | 'left' = 'top';
  export let delay: number = 300;
  export let offset: number = 8;
  export let class: string = '';

  let tooltipElement: HTMLDivElement;
  let triggerElement: HTMLElement;
  let visible = false;
  let timeoutId: number;

  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2'
  };

  const arrows = {
    top: 'bottom-[-4px] left-1/2 -translate-x-1/2 border-t-2 border-r-2',
    right: 'left-[-4px] top-1/2 -translate-y-1/2 border-t-2 border-l-2',
    bottom: 'top-[-4px] left-1/2 -translate-x-1/2 border-b-2 border-l-2',
    left: 'right-[-4px] top-1/2 -translate-y-1/2 border-b-2 border-r-2'
  };

  $: classes = cn(
    'absolute z-50 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95',
    positions[position],
    class
  );

  $: arrowClasses = cn(
    'absolute h-2 w-2 rotate-45 bg-primary',
    arrows[position]
  );

  function show() {
    timeoutId = window.setTimeout(() => {
      visible = true;
      positionTooltip();
    }, delay);
  }

  function hide() {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
    visible = false;
  }

  function positionTooltip() {
    if (!tooltipElement || !triggerElement) return;

    const triggerRect = triggerElement.getBoundingClientRect();
    const tooltipRect = tooltipElement.getBoundingClientRect();

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = triggerRect.top - tooltipRect.height - offset;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'right':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.right + offset;
        break;
      case 'bottom':
        top = triggerRect.bottom + offset;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.left - tooltipRect.width - offset;
        break;
    }

    // Keep tooltip within viewport
    const viewport = {
      top: window.scrollY,
      left: window.scrollX,
      right: window.scrollX + window.innerWidth,
      bottom: window.scrollY + window.innerHeight
    };

    if (left < viewport.left) left = viewport.left + offset;
    if (left + tooltipRect.width > viewport.right) {
      left = viewport.right - tooltipRect.width - offset;
    }
    if (top < viewport.top) top = viewport.top + offset;
    if (top + tooltipRect.height > viewport.bottom) {
      top = viewport.bottom - tooltipRect.height - offset;
    }

    tooltipElement.style.top = `${top}px`;
    tooltipElement.style.left = `${left}px`;
  }

  onMount(() => {
    window.addEventListener('scroll', positionTooltip, true);
    window.addEventListener('resize', positionTooltip);
  });

  onDestroy(() => {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
    window.removeEventListener('scroll', positionTooltip, true);
    window.removeEventListener('resize', positionTooltip);
  });
</script>

<div class="inline-block">
  <div
    bind:this={triggerElement}
    on:mouseenter={show}
    on:mouseleave={hide}
    on:focusin={show}
    on:focusout={hide}
  >
    <slot />
  </div>

  {#if visible}
    <div
      bind:this={tooltipElement}
      class={classes}
      role="tooltip"
      transition:fade={{ duration: 150 }}
    >
      {content}
      <div class={arrowClasses} />
    </div>
  {/if}
</div>

<style>
  /* Add any component-specific styles here */
</style> 