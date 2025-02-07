<!-- Tabs Component -->
<script lang="ts">
  import { cn } from '$lib/utils';
  import { createEventDispatcher } from 'svelte';

  export let value: string;
  export let class: string = '';

  const dispatch = createEventDispatcher();

  export function Root(props: { value: string; class?: string }) {
    return {
      value: props.value,
      class: props.class
    };
  }

  export function List({ class: className = '' }: { class?: string }) {
    return (
      <div
        class={cn(
          'inline-flex h-10 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground',
          className
        )}
        role="tablist"
        aria-orientation="horizontal"
      >
        <slot />
      </div>
    );
  }

  export function Trigger({
    value,
    disabled = false,
    class: className = ''
  }: {
    value: string;
    disabled?: boolean;
    class?: string;
  }) {
    const selected = value === value;
    return (
      <button
        type="button"
        role="tab"
        aria-selected={selected}
        aria-controls={`panel-${value}`}
        disabled={disabled}
        class={cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
          selected
            ? 'bg-background text-foreground shadow-sm'
            : 'hover:bg-background/50 hover:text-foreground',
          className
        )}
        onClick={() => dispatch('change', value)}
      >
        <slot />
      </button>
    );
  }

  export function Content({
    value: tabValue,
    class: className = ''
  }: {
    value: string;
    class?: string;
  }) {
    const selected = value === tabValue;
    return (
      <div
        role="tabpanel"
        hidden={!selected}
        aria-labelledby={`trigger-${tabValue}`}
        class={cn('mt-2', className, !selected && 'hidden')}
      >
        {#if selected}
          <slot />
        {/if}
      </div>
    );
  }
</script>

<div
  class={cn('', class)}
  data-orientation="horizontal"
  {...$$restProps}
>
  <slot />
</div> 