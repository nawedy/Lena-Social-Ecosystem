<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { cn } from '$lib/utils';
  import { Button } from './Button.svelte';

  export let open: boolean = false;
  export let title: string | undefined = undefined;
  export let description: string | undefined = undefined;
  export let size: 'sm' | 'md' | 'lg' | 'xl' | 'full' = 'md';
  export let closeOnEscape: boolean = true;
  export let closeOnOutsideClick: boolean = true;
  export let showCloseButton: boolean = true;
  export let class: string = '';

  const dispatch = createEventDispatcher();
  let modalElement: HTMLDivElement;

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full mx-4'
  };

  $: classes = cn(
    'relative w-full rounded-lg bg-background p-6 shadow-lg',
    'focus:outline-none',
    sizes[size],
    class
  );

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && closeOnEscape) {
      close();
    }
  }

  function handleOutsideClick(event: MouseEvent) {
    if (
      closeOnOutsideClick &&
      modalElement &&
      !modalElement.contains(event.target as Node)
    ) {
      close();
    }
  }

  function close() {
    open = false;
    dispatch('close');
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeydown);
    if (open) {
      document.body.style.overflow = 'hidden';
    }
  });

  onDestroy(() => {
    document.removeEventListener('keydown', handleKeydown);
    document.body.style.overflow = '';
  });

  $: if (open) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
</script>

{#if open}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center"
    transition:fade={{ duration: 200 }}
  >
    <!-- Backdrop -->
    <div
      class="fixed inset-0 bg-background/80 backdrop-blur-sm"
      on:click={handleOutsideClick}
      transition:fade={{ duration: 200 }}
    />

    <!-- Modal -->
    <div
      bind:this={modalElement}
      class={classes}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      aria-describedby={description ? 'modal-description' : undefined}
      transition:scale={{ duration: 200, start: 0.95 }}
    >
      {#if showCloseButton}
        <button
          type="button"
          class="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          on:click={close}
        >
          <svg
            class="h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
          <span class="sr-only">Close</span>
        </button>
      {/if}

      {#if title}
        <div class="mb-4">
          <h2
            id="modal-title"
            class="text-lg font-semibold leading-none tracking-tight"
          >
            {title}
          </h2>
          {#if description}
            <p
              id="modal-description"
              class="mt-2 text-sm text-muted-foreground"
            >
              {description}
            </p>
          {/if}
        </div>
      {/if}

      <div class="relative">
        <slot />
      </div>

      <slot name="footer">
        <div class="mt-6 flex justify-end gap-4">
          <Button
            variant="outline"
            on:click={close}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            on:click={() => dispatch('confirm')}
          >
            Confirm
          </Button>
        </div>
      </slot>
    </div>
  </div>
{/if}

<style>
  /* Add any component-specific styles here */
</style> 