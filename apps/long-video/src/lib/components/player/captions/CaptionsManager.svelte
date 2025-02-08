<!-- CaptionsManager.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  import { clickOutside } from '$lib/actions/clickOutside';
  import type { Caption } from '$lib/types';

  export let captions: Caption[] = [];
  export let currentLanguage: string | null = null;
  export let fontSize: number = 16;
  export let position: 'bottom' | 'top' = 'bottom';
  export let background: boolean = true;

  const dispatch = createEventDispatcher();

  let isOpen = false;
  let buttonElement: HTMLButtonElement;

  $: availableLanguages = [
    { code: null, name: 'Off' },
    ...captions.map(caption => ({
      code: caption.language,
      name: new Intl.DisplayNames([caption.language], { type: 'language' })
        .of(caption.language)
    }))
  ];

  function handleLanguageSelect(languageCode: string | null) {
    if (languageCode !== currentLanguage) {
      dispatch('change', { language: languageCode });
    }
    isOpen = false;
  }

  function handleFontSizeChange(delta: number) {
    const newSize = Math.max(12, Math.min(24, fontSize + delta));
    dispatch('fontsize', { size: newSize });
  }

  function togglePosition() {
    dispatch('position', { position: position === 'bottom' ? 'top' : 'bottom' });
  }

  function toggleBackground() {
    dispatch('background', { enabled: !background });
  }

  function toggleMenu() {
    isOpen = !isOpen;
  }

  function handleClickOutside() {
    isOpen = false;
  }
</script>

<div 
  class="captions-manager"
  use:clickOutside
  on:clickoutside={handleClickOutside}
>
  <button
    bind:this={buttonElement}
    class="captions-button"
    on:click={toggleMenu}
    title="Captions settings"
  >
    <svg 
      class="captions-icon" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor"
    >
      <path 
        stroke-linecap="round" 
        stroke-linejoin="round" 
        stroke-width="2" 
        d="M7 8h10M7 12h4m1 4h5"
      />
      <rect x="3" y="4" width="18" height="16" rx="2" stroke-width="2" />
    </svg>
    <span class="captions-label">
      {currentLanguage ? availableLanguages.find(l => l.code === currentLanguage)?.name : 'CC'}
    </span>
  </button>

  {#if isOpen}
    <div 
      class="captions-menu"
      transition:fade={{ duration: 100 }}
    >
      <div class="menu-section">
        <h3>Subtitles</h3>
        {#each availableLanguages as language}
          <button
            class="caption-option"
            class:active={currentLanguage === language.code}
            on:click={() => handleLanguageSelect(language.code)}
          >
            {language.name}
          </button>
        {/each}
      </div>

      {#if currentLanguage}
        <div class="menu-section">
          <h3>Font Size</h3>
          <div class="font-size-controls">
            <button
              class="control-button"
              on:click={() => handleFontSizeChange(-2)}
              disabled={fontSize <= 12}
            >
              A-
            </button>
            <span class="font-size-value">{fontSize}px</span>
            <button
              class="control-button"
              on:click={() => handleFontSizeChange(2)}
              disabled={fontSize >= 24}
            >
              A+
            </button>
          </div>
        </div>

        <div class="menu-section">
          <h3>Position</h3>
          <button
            class="option-button"
            on:click={togglePosition}
          >
            {position === 'bottom' ? 'Bottom' : 'Top'}
          </button>
        </div>

        <div class="menu-section">
          <h3>Background</h3>
          <button
            class="option-button"
            class:active={background}
            on:click={toggleBackground}
          >
            {background ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style lang="postcss">
  .captions-manager {
    position: relative;
    z-index: 3;
  }

  .captions-button {
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

  .captions-icon {
    width: 16px;
    height: 16px;
  }

  .captions-label {
    font-weight: 500;
  }

  .captions-menu {
    position: absolute;
    bottom: 100%;
    right: 0;
    margin-bottom: 8px;
    background: rgba(0, 0, 0, 0.9);
    border-radius: 4px;
    padding: 8px;
    min-width: 200px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .menu-section {
    & + .menu-section {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    h3 {
      margin: 0 0 8px;
      font-size: 12px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.7);
      text-transform: uppercase;
    }
  }

  .caption-option {
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

  .font-size-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .control-button {
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 2px;
    color: white;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.2);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .font-size-value {
    min-width: 40px;
    text-align: center;
  }

  .option-button {
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
      color: var(--primary-color, #00a8ff);
      font-weight: 500;
    }
  }
</style> 