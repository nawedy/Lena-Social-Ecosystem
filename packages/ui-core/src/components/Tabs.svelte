<!-- Tabs.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';

  export let tabs: Array<{
    id: string;
    label: string;
    icon?: string;
    disabled?: boolean;
  }>;
  export let activeTab = tabs[0]?.id;
  export let variant: 'default' | 'pills' | 'underline' = 'default';

  const dispatch = createEventDispatcher<{
    change: { tabId: string };
  }>();

  let tabsElement: HTMLElement;

  function handleKeydown(event: KeyboardEvent) {
    if (!tabsElement) return;

    const enabledTabs = tabs.filter(tab => !tab.disabled);
    const currentIndex = enabledTabs.findIndex(tab => tab.id === activeTab);

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        if (currentIndex > 0) {
          setActiveTab(enabledTabs[currentIndex - 1].id);
        }
        break;
      case 'ArrowRight':
        event.preventDefault();
        if (currentIndex < enabledTabs.length - 1) {
          setActiveTab(enabledTabs[currentIndex + 1].id);
        }
        break;
      case 'Home':
        event.preventDefault();
        setActiveTab(enabledTabs[0].id);
        break;
      case 'End':
        event.preventDefault();
        setActiveTab(enabledTabs[enabledTabs.length - 1].id);
        break;
    }
  }

  function setActiveTab(tabId: string) {
    if (tabs.find(tab => tab.id === tabId && !tab.disabled)) {
      activeTab = tabId;
      dispatch('change', { tabId });
    }
  }

  $: variantClasses = {
    default: 'border-b border-gray-800',
    pills: 'gap-2',
    underline: 'border-b border-gray-800 gap-4'
  }[variant];

  $: tabClasses = (tab: typeof tabs[number]) => [
    'px-4 py-2 font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
    variant === 'default' && 'border-b-2 -mb-px',
    variant === 'pills' && 'rounded-full',
    variant === 'underline' && 'border-b-2',
    tab.id === activeTab && [
      variant === 'default' && 'border-primary-500',
      variant === 'pills' && 'bg-primary-500 text-black',
      variant === 'underline' && 'border-primary-500'
    ],
    tab.id !== activeTab && [
      'text-gray-400 hover:text-white',
      variant === 'default' && 'border-transparent hover:border-gray-700',
      variant === 'pills' && 'hover:bg-primary-500/10',
      variant === 'underline' && 'border-transparent'
    ],
    tab.disabled && 'opacity-50 cursor-not-allowed pointer-events-none'
  ].flat().filter(Boolean).join(' ');
</script>

<div
  bind:this={tabsElement}
  class="flex {variant === 'pills' ? 'p-1 bg-gray-900/50 rounded-full' : ''} {variantClasses}"
  role="tablist"
  tabindex="0"
  on:keydown={handleKeydown}
>
  {#each tabs as tab (tab.id)}
    <button
      role="tab"
      aria-selected={activeTab === tab.id}
      aria-controls="tab-panel-{tab.id}"
      id="tab-{tab.id}"
      class={tabClasses(tab)}
      disabled={tab.disabled}
      tabindex={activeTab === tab.id ? 0 : -1}
      on:click={() => setActiveTab(tab.id)}
    >
      {#if tab.icon}
        <span class="mr-2" aria-hidden="true">{tab.icon}</span>
      {/if}
      {tab.label}
    </button>
  {/each}
</div>

<div class="mt-4">
  {#each tabs as tab (tab.id)}
    {#if activeTab === tab.id}
      <div
        id="tab-panel-{tab.id}"
        role="tabpanel"
        aria-labelledby="tab-{tab.id}"
        tabindex="0"
      >
        <slot {activeTab} />
      </div>
    {/if}
  {/each}
</div> 