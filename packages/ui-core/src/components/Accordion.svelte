<!-- Accordion.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { slide } from 'svelte/transition';

  export let items: Array<{
    id: string;
    title: string;
    content: string;
    icon?: string;
    disabled?: boolean;
  }>;
  export let multiple = false;
  export let expandedItems: string[] = [];

  const dispatch = createEventDispatcher<{
    change: { expandedItems: string[] };
  }>();

  function toggleItem(itemId: string) {
    if (items.find(item => item.id === itemId)?.disabled) return;

    if (multiple) {
      expandedItems = expandedItems.includes(itemId)
        ? expandedItems.filter(id => id !== itemId)
        : [...expandedItems, itemId];
    } else {
      expandedItems = expandedItems.includes(itemId) ? [] : [itemId];
    }

    dispatch('change', { expandedItems });
  }

  function handleKeydown(event: KeyboardEvent, itemId: string) {
    const enabledItems = items.filter(item => !item.disabled);
    const currentIndex = enabledItems.findIndex(item => item.id === itemId);

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        if (currentIndex > 0) {
          const prevItem = enabledItems[currentIndex - 1];
          document.getElementById(`accordion-button-${prevItem.id}`)?.focus();
        }
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (currentIndex < enabledItems.length - 1) {
          const nextItem = enabledItems[currentIndex + 1];
          document.getElementById(`accordion-button-${nextItem.id}`)?.focus();
        }
        break;
      case 'Home':
        event.preventDefault();
        document.getElementById(`accordion-button-${enabledItems[0].id}`)?.focus();
        break;
      case 'End':
        event.preventDefault();
        document.getElementById(`accordion-button-${enabledItems[enabledItems.length - 1].id}`)?.focus();
        break;
    }
  }
</script>

<div class="space-y-2" role="presentation">
  {#each items as item (item.id)}
    {@const isExpanded = expandedItems.includes(item.id)}
    <div class="border border-gray-800 rounded-lg overflow-hidden">
      <h3>
        <button
          id="accordion-button-{item.id}"
          class="w-full flex items-center justify-between p-4 text-left font-medium transition-colors duration-200 {item.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-900'}"
          on:click={() => toggleItem(item.id)}
          on:keydown={(e) => handleKeydown(e, item.id)}
          aria-expanded={isExpanded}
          aria-controls="accordion-panel-{item.id}"
          disabled={item.disabled}
        >
          <span class="flex items-center">
            {#if item.icon}
              <span class="mr-2">{item.icon}</span>
            {/if}
            {item.title}
          </span>
          <svg
            class="w-5 h-5 transform transition-transform duration-200 {isExpanded ? 'rotate-180' : ''}"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </h3>
      {#if isExpanded}
        <div
          id="accordion-panel-{item.id}"
          role="region"
          aria-labelledby="accordion-button-{item.id}"
          transition:slide={{ duration: 200 }}
        >
          <div class="p-4 border-t border-gray-800">
            {item.content}
          </div>
        </div>
      {/if}
    </div>
  {/each}
</div> 