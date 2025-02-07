<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';

  export let open = false;
  export let title = '';
  export let size: 'sm' | 'md' | 'lg' | 'xl' | 'full' = 'md';
  export let closeOnEscape = true;
  export let closeOnClickOutside = true;
  export let showClose = true;
  export let blur = true;

  const dispatch = createEventDispatcher<{
    close: void;
    open: void;
  }>();

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full mx-4'
  };

  let modalElement: HTMLDivElement;

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && closeOnEscape) {
      close();
    }
  }

  function handleClickOutside(event: MouseEvent) {
    if (closeOnClickOutside && event.target === event.currentTarget) {
      close();
    }
  }

  function close() {
    open = false;
    dispatch('close');
  }

  $: if (open) {
    dispatch('open');
  }

  onMount(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = '';
    };
  });

  $: if (open) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }

  $: containerClasses = [
    'fixed inset-0 z-50 flex items-center justify-center p-4',
    blur ? 'backdrop-blur-sm' : ''
  ].join(' ');

  $: modalClasses = [
    'bg-black/90 rounded-lg shadow-xl w-full overflow-hidden border border-primary-900/50',
    sizeClasses[size]
  ].join(' ');
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <div
    class={containerClasses}
    transition:fade={{ duration: 200 }}
    on:click={handleClickOutside}
  >
    <div
      bind:this={modalElement}
      class={modalClasses}
      transition:scale={{ duration: 200 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      {#if title || showClose}
        <div class="flex items-center justify-between p-4 border-b border-primary-900/50">
          {#if title}
            <h2 id="modal-title" class="text-lg font-medium">{title}</h2>
          {/if}
          {#if showClose}
            <button
              class="p-1 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-primary-900/50"
              on:click={close}
              aria-label="Close modal"
            >
              <svg class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fill-rule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
          {/if}
        </div>
      {/if}

      <div class="p-4">
        <slot />
      </div>

      {#if $$slots.footer}
        <div class="flex justify-end gap-2 p-4 border-t border-primary-900/50">
          <slot name="footer" />
        </div>
      {/if}
    </div>
  </div>
{/if} 