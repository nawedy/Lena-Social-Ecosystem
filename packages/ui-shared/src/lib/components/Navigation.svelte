<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade, slide } from 'svelte/transition';

  export let platform: 'core' | 'discourse' | 'creators' | 'echo' | 'connect' | 'agora' = 'core';
  export let items: Array<{
    id: string;
    label: string;
    icon?: string;
    href?: string;
    badge?: number | string;
    disabled?: boolean;
  }>;
  export let activeId: string | null = null;
  export let vertical = false;
  export let mobile = false;
  export let collapsed = false;

  const platformThemes = {
    core: {
      bg: 'bg-black/90',
      border: 'border-primary-900/50',
      text: 'text-primary-500',
      hover: 'hover:bg-primary-900/20',
      active: 'bg-primary-900/30'
    },
    discourse: {
      bg: 'bg-[#3E1E1E]/90',
      border: 'border-[#C9A227]/50',
      text: 'text-[#C9A227]',
      hover: 'hover:bg-[#C9A227]/20',
      active: 'bg-[#C9A227]/30'
    },
    creators: {
      bg: 'bg-[#4B0082]/90',
      border: 'border-[#FF007F]/50',
      text: 'text-[#FF007F]',
      hover: 'hover:bg-[#FF007F]/20',
      active: 'bg-[#FF007F]/30'
    },
    echo: {
      bg: 'bg-[#0F0F0F]/90',
      border: 'border-[#FF003C]/50',
      text: 'text-[#FF003C]',
      hover: 'hover:bg-[#FF003C]/20',
      active: 'bg-[#FF003C]/30'
    },
    connect: {
      bg: 'bg-[#00274D]/90',
      border: 'border-[#D4AF37]/50',
      text: 'text-[#D4AF37]',
      hover: 'hover:bg-[#D4AF37]/20',
      active: 'bg-[#D4AF37]/30'
    },
    agora: {
      bg: 'bg-[#1F8A70]/90',
      border: 'border-[#F5F5F5]/50',
      text: 'text-[#F5F5F5]',
      hover: 'hover:bg-[#F5F5F5]/20',
      active: 'bg-[#F5F5F5]/30'
    }
  };

  const dispatch = createEventDispatcher<{
    select: { id: string };
  }>();

  function handleSelect(id: string) {
    if (items.find(item => item.id === id)?.disabled) return;
    dispatch('select', { id });
  }

  $: platformTheme = platformThemes[platform];

  $: containerClasses = [
    'backdrop-blur-sm border transition-all duration-200',
    platformTheme.bg,
    platformTheme.border,
    vertical ? 'flex flex-col' : 'flex items-center',
    mobile ? 'fixed bottom-0 left-0 right-0 border-t' : 'border-b',
    collapsed ? 'w-16' : '',
    '$$props.class'
  ].join(' ');

  $: itemClasses = (item: typeof items[number]) => [
    'flex items-center gap-3 px-4 py-3 transition-colors relative',
    platformTheme.text,
    !item.disabled && platformTheme.hover,
    item.id === activeId && platformTheme.active,
    item.disabled && 'opacity-50 cursor-not-allowed',
    vertical && 'w-full',
    collapsed && 'justify-center'
  ].join(' ');
</script>

<nav class={containerClasses} role="navigation">
  {#each items as item (item.id)}
    {#if item.href}
      <a
        href={item.disabled ? undefined : item.href}
        class={itemClasses(item)}
        aria-current={item.id === activeId ? 'page' : undefined}
      >
        {#if item.icon}
          <span class="text-xl">{item.icon}</span>
        {/if}
        {#if !collapsed}
          <span>{item.label}</span>
        {/if}
        {#if item.badge}
          <span
            class="absolute top-2 right-2 min-w-[1.25rem] h-5 flex items-center justify-center rounded-full text-xs font-medium bg-red-500 text-white px-1"
          >
            {item.badge}
          </span>
        {/if}
      </a>
    {:else}
      <button
        class={itemClasses(item)}
        disabled={item.disabled}
        on:click={() => handleSelect(item.id)}
      >
        {#if item.icon}
          <span class="text-xl">{item.icon}</span>
        {/if}
        {#if !collapsed}
          <span>{item.label}</span>
        {/if}
        {#if item.badge}
          <span
            class="absolute top-2 right-2 min-w-[1.25rem] h-5 flex items-center justify-center rounded-full text-xs font-medium bg-red-500 text-white px-1"
          >
            {item.badge}
          </span>
        {/if}
      </button>
    {/if}
  {/each}
</nav> 