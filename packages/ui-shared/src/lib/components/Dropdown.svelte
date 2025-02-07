<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade, slide } from 'svelte/transition';

  export let items: Array<{
    id: string;
    label: string;
    icon?: string;
    disabled?: boolean;
    divider?: boolean;
  }>;
  export let value: string | null = null;
  export let placement: 'top' | 'bottom' | 'left' | 'right' = 'bottom';
  export let align: 'start' | 'end' = 'start';
  export let width = 'w-48';
  export let disabled = false;

  const dispatch = createEventDispatcher<{
    select: { id: string };
  }>();

  let open = false;
  let trigger: HTMLElement;
  let dropdown: HTMLElement;

  function handleSelect(id: string) {
    if (items.find(item => item.id === id)?.disabled) return;
    value = id;
    dispatch('select', { id });
    open = false;
  }

  function handleClickOutside(event: MouseEvent) {
    if (!trigger?.contains(event.target as Node) && !dropdown?.contains(event.target as Node)) {
      open = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      open = false;
      return;
    }

    if (!open) return;

    const enabledItems = items.filter(item => !item.disabled && !item.divider);
    const currentIndex = value ? enabledItems.findIndex(item => item.id === value) : -1;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (currentIndex < enabledItems.length - 1) {
          handleSelect(enabledItems[currentIndex + 1].id);
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (currentIndex > 0) {
          handleSelect(enabledItems[currentIndex - 1].id);
        }
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (value) {
          handleSelect(value);
        }
        break;
    }
  }

  $: placementClasses = {
    top: 'bottom-full mb-2',
    bottom: 'top-full mt-2',
    left: 'right-full mr-2',
    right: 'left-full ml-2'
  }[placement];

  $: alignmentClasses = {
    start: placement === 'left' || placement === 'right' ? 'top-0' : 'left-0',
    end: placement === 'left' || placement === 'right' ? 'bottom-0' : 'right-0'
  }[align];

  $: selectedItem = items.find(item => item.id === value);
</script>

<svelte:window on:click={handleClickOutside} on:keydown={handleKeydown} />

<div class="relative inline-block" class:cursor-not-allowed={disabled}>
  <div
    bind:this={trigger}
    class="inline-flex items-center gap-2 cursor-pointer"
    class:opacity-50={disabled}
    on:click={() => !disabled && (open = !open)}
    role="button"
    tabindex="0"
  >
    <slot name="trigger" selected={selectedItem}>
      <span>{selectedItem?.label || 'Select an option'}</span>
      <svg
        class="w-4 h-4 transition-transform duration-200"
        class:rotate-180={open}
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
          clip-rule="evenodd"
        />
      </svg>
    </slot>
  </div>

  {#if open}
    <div
      bind:this={dropdown}
      class="absolute z-50 {placementClasses} {alignmentClasses} {width} bg-black/90 backdrop-blur-sm rounded-lg shadow-xl border border-primary-900/50 py-1"
      transition:fade={{ duration: 100 }}
      role="listbox"
    >
      {#each items as item (item.id)}
        {#if item.divider}
          <div class="h-px bg-primary-900/50 my-1" role="separator" />
        {:else}
          <button
            class="w-full px-4 py-2 text-left flex items-center gap-2 transition-colors hover:bg-primary-900/50 focus:outline-none focus:bg-primary-900/50"
            class:opacity-50={item.disabled}
            class:cursor-not-allowed={item.disabled}
            class:text-primary-500={item.id === value}
            disabled={item.disabled}
            role="option"
            aria-selected={item.id === value}
            on:click={() => handleSelect(item.id)}
          >
            {#if item.icon}
              <span class="text-lg">{item.icon}</span>
            {/if}
            {item.label}
          </button>
        {/if}
      {/each}
    </div>
  {/if}
</div> 