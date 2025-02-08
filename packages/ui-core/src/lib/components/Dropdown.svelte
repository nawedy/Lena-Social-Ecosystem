<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { cn } from '$lib/utils';
  import { Button } from './Button.svelte';

  export let trigger: string | undefined = undefined;
  export let items: {
    value: string;
    label: string;
    icon?: string;
    disabled?: boolean;
    divider?: boolean;
  }[] = [];
  export let value: string | undefined = undefined;
  export let position: 'top' | 'right' | 'bottom' | 'left' = 'bottom';
  export let align: 'start' | 'center' | 'end' = 'start';
  export let width: number | 'auto' | 'trigger' = 'auto';
  export let class: string = '';

  const dispatch = createEventDispatcher();
  let dropdownElement: HTMLDivElement;
  let triggerElement: HTMLElement;
  let open = false;

  const positions = {
    top: 'bottom-full mb-2',
    right: 'left-full ml-2',
    bottom: 'top-full mt-2',
    left: 'right-full mr-2'
  };

  const alignments = {
    start: position === 'left' || position === 'right' ? 'top-0' : 'left-0',
    center: position === 'left' || position === 'right' ? 'top-1/2 -translate-y-1/2' : 'left-1/2 -translate-x-1/2',
    end: position === 'left' || position === 'right' ? 'bottom-0' : 'right-0'
  };

  $: classes = cn(
    'absolute z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
    positions[position],
    alignments[align],
    class
  );

  $: style = width === 'auto'
    ? undefined
    : width === 'trigger' && triggerElement
    ? `width: ${triggerElement.offsetWidth}px`
    : `width: ${width}px`;

  function handleClick(item: typeof items[0]) {
    if (!item.disabled) {
      value = item.value;
      dispatch('select', { value: item.value });
      close();
    }
  }

  function toggle() {
    if (open) {
      close();
    } else {
      show();
    }
  }

  function show() {
    open = true;
    positionDropdown();
  }

  function close() {
    open = false;
  }

  function handleClickOutside(event: MouseEvent) {
    if (
      dropdownElement &&
      triggerElement &&
      !dropdownElement.contains(event.target as Node) &&
      !triggerElement.contains(event.target as Node)
    ) {
      close();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      close();
    }
  }

  function positionDropdown() {
    if (!dropdownElement || !triggerElement) return;

    const triggerRect = triggerElement.getBoundingClientRect();
    const dropdownRect = dropdownElement.getBoundingClientRect();

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = triggerRect.top - dropdownRect.height - 8;
        left = align === 'start'
          ? triggerRect.left
          : align === 'end'
          ? triggerRect.right - dropdownRect.width
          : triggerRect.left + (triggerRect.width - dropdownRect.width) / 2;
        break;
      case 'right':
        top = align === 'start'
          ? triggerRect.top
          : align === 'end'
          ? triggerRect.bottom - dropdownRect.height
          : triggerRect.top + (triggerRect.height - dropdownRect.height) / 2;
        left = triggerRect.right + 8;
        break;
      case 'bottom':
        top = triggerRect.bottom + 8;
        left = align === 'start'
          ? triggerRect.left
          : align === 'end'
          ? triggerRect.right - dropdownRect.width
          : triggerRect.left + (triggerRect.width - dropdownRect.width) / 2;
        break;
      case 'left':
        top = align === 'start'
          ? triggerRect.top
          : align === 'end'
          ? triggerRect.bottom - dropdownRect.height
          : triggerRect.top + (triggerRect.height - dropdownRect.height) / 2;
        left = triggerRect.left - dropdownRect.width - 8;
        break;
    }

    // Keep dropdown within viewport
    const viewport = {
      top: window.scrollY,
      left: window.scrollX,
      right: window.scrollX + window.innerWidth,
      bottom: window.scrollY + window.innerHeight
    };

    if (left < viewport.left) left = viewport.left + 8;
    if (left + dropdownRect.width > viewport.right) {
      left = viewport.right - dropdownRect.width - 8;
    }
    if (top < viewport.top) top = viewport.top + 8;
    if (top + dropdownRect.height > viewport.bottom) {
      top = viewport.bottom - dropdownRect.height - 8;
    }

    dropdownElement.style.top = `${top}px`;
    dropdownElement.style.left = `${left}px`;
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeydown);
    window.addEventListener('scroll', positionDropdown, true);
    window.addEventListener('resize', positionDropdown);
  });

  onDestroy(() => {
    document.removeEventListener('click', handleClickOutside);
    document.removeEventListener('keydown', handleKeydown);
    window.removeEventListener('scroll', positionDropdown, true);
    window.removeEventListener('resize', positionDropdown);
  });
</script>

<div class="relative inline-block">
  <div
    bind:this={triggerElement}
    on:click={toggle}
  >
    {#if trigger}
      <Button
        variant="outline"
        class="inline-flex items-center gap-2"
      >
        {trigger}
        <svg
          class="h-4 w-4 transition-transform"
          class:rotate-180={open}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M6 8l4 4 4-4"
          />
        </svg>
      </Button>
    {:else}
      <slot name="trigger" />
    {/if}
  </div>

  {#if open}
    <div
      bind:this={dropdownElement}
      class={classes}
      {style}
      role="menu"
      transition:fade={{ duration: 150 }}
    >
      {#each items as item}
        {#if item.divider}
          <div
            class="my-1 h-px bg-muted"
            role="separator"
          />
        {:else}
          <button
            type="button"
            class={cn(
              'relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
              item.disabled && 'pointer-events-none opacity-50',
              value === item.value && 'bg-accent text-accent-foreground'
            )}
            role="menuitem"
            disabled={item.disabled}
            on:click={() => handleClick(item)}
          >
            {#if item.icon}
              <span class="mr-2">
                {@html item.icon}
              </span>
            {/if}
            {item.label}
          </button>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  /* Add any component-specific styles here */
</style> 