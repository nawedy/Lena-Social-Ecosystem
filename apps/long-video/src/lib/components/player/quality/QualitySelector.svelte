<!-- QualitySelector.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  import { clickOutside } from '$lib/actions/clickOutside';

  export let qualities: string[] = [];
  export let currentQuality: string = 'auto';

  const dispatch = createEventDispatcher();

  let isOpen = false;
  let buttonElement: HTMLButtonElement;

  function handleQualitySelect(quality: string) {
    if (quality !== currentQuality) {
      dispatch('change', { quality });
    }
    isOpen = false;
  }

  function toggleMenu() {
    isOpen = !isOpen;
  }

  function handleClickOutside() {
    isOpen = false;
  }
</script>

<div 
  class="quality-selector"
  use:clickOutside
  on:clickoutside={handleClickOutside}
>
  <button
    bind:this={buttonElement}
    class="quality-button"
    on:click={toggleMenu}
    title="Video quality"
  >
    <span class="quality-label">
      {currentQuality === 'auto' ? 'Auto' : currentQuality}
    </span>
    <svg 
      class="quality-icon" 
      class:open={isOpen}
      viewBox="0 0 24 24" 
      fill="none" 
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

  {#if isOpen}
    <div 
      class="quality-menu"
      transition:fade={{ duration: 100 }}
    >
      <button
        class="quality-option"
        class:active={currentQuality === 'auto'}
        on:click={() => handleQualitySelect('auto')}
      >
        Auto
      </button>
      
      {#each qualities as quality}
        <button
          class="quality-option"
          class:active={currentQuality === quality}
          on:click={() => handleQualitySelect(quality)}
        >
          {quality}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style lang="postcss">
  .quality-selector {
    position: relative;
    z-index: 3;
  }

  .quality-button {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 4px;
    color: white;
    font-size: 14px;
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  }

  .quality-label {
    font-weight: 500;
  }

  .quality-icon {
    width: 16px;
    height: 16px;
    transition: transform 0.2s;

    &.open {
      transform: rotate(180deg);
    }
  }

  .quality-menu {
    position: absolute;
    bottom: 100%;
    right: 0;
    margin-bottom: 8px;
    background: rgba(0, 0, 0, 0.9);
    border-radius: 4px;
    padding: 4px;
    min-width: 120px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .quality-option {
    display: block;
    width: 100%;
    padding: 8px 12px;
    text-align: left;
    background: transparent;
    border: none;
    border-radius: 2px;
    color: white;
    font-size: 14px;
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    &.active {
      background: var(--primary-color, #00a8ff);
      font-weight: 500;
    }
  }
</style> 