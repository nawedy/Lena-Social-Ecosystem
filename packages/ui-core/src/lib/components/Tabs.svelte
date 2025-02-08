<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { cn } from '$lib/utils';

  export let value: string;
  export let tabs: {
    value: string;
    label: string;
    icon?: string;
    disabled?: boolean;
  }[] = [];
  export let variant: 'default' | 'outline' | 'pills' = 'default';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let fullWidth: boolean = false;
  export let class: string = '';

  const dispatch = createEventDispatcher();

  const variants = {
    default: 'border-b border-input',
    outline: 'border border-input rounded-lg',
    pills: 'bg-muted rounded-lg p-1'
  };

  const tabVariants = {
    default: 'border-b-2 border-transparent hover:border-foreground data-[state=active]:border-primary',
    outline: 'border-transparent hover:bg-accent hover:text-accent-foreground data-[state=active]:bg-background data-[state=active]:text-foreground',
    pills: 'rounded-md hover:bg-background hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground'
  };

  const sizes = {
    sm: 'h-8 text-sm',
    md: 'h-10 text-base',
    lg: 'h-12 text-lg'
  };

  $: listClasses = cn(
    'inline-flex items-center justify-center gap-1',
    variants[variant],
    fullWidth && 'w-full',
    class
  );

  $: tabClasses = cn(
    'inline-flex items-center justify-center whitespace-nowrap px-3 py-1.5 font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
    tabVariants[variant],
    sizes[size]
  );

  function handleClick(tab: typeof tabs[0]) {
    if (!tab.disabled) {
      value = tab.value;
      dispatch('change', { value: tab.value });
    }
  }
</script>

<div class="tabs" role="tablist" aria-orientation="horizontal">
  <div class={listClasses}>
    {#each tabs as tab}
      <button
        type="button"
        role="tab"
        class={tabClasses}
        aria-selected={value === tab.value}
        aria-controls={`panel-${tab.value}`}
        data-state={value === tab.value ? 'active' : 'inactive'}
        disabled={tab.disabled}
        on:click={() => handleClick(tab)}
      >
        {#if tab.icon}
          <span class="mr-2">
            {@html tab.icon}
          </span>
        {/if}
        {tab.label}
      </button>
    {/each}
  </div>

  <div class="mt-2">
    {#each tabs as tab}
      {#if value === tab.value}
        <div
          id={`panel-${tab.value}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab.value}`}
          tabindex="0"
          transition:fade={{ duration: 150 }}
        >
          <slot name={tab.value} />
        </div>
      {/if}
    {/each}
  </div>
</div>

<style>
  .tabs {
    position: relative;
    width: 100%;
  }

  button[role="tab"] {
    position: relative;
    cursor: pointer;
    outline: none;
  }

  button[role="tab"][data-state="active"] {
    font-weight: 600;
  }

  button[role="tab"][disabled] {
    cursor: not-allowed;
  }

  [role="tabpanel"] {
    outline: none;
  }

  [role="tabpanel"]:focus-visible {
    @apply ring-2 ring-ring ring-offset-2 ring-offset-background;
  }
</style> 