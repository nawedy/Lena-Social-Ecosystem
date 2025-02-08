<!-- ToolPanel.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  // Props
  export let selectedTool: 'trim' | 'chapters' | 'captions' | 'thumbnails' = 'trim';
  export let canUndo = false;
  export let canRedo = false;

  const tools = [
    {
      id: 'trim',
      label: 'Trim',
      icon: `
        <path 
          stroke-linecap="round" 
          stroke-linejoin="round" 
          stroke-width="2" 
          d="M14 5l7 7m0 0l-7 7m7-7H3"
        />
      `
    },
    {
      id: 'chapters',
      label: 'Chapters',
      icon: `
        <path 
          stroke-linecap="round" 
          stroke-linejoin="round" 
          stroke-width="2" 
          d="M9 17l6-6-6-6m4 12h7M4 12h7"
        />
      `
    },
    {
      id: 'captions',
      label: 'Captions',
      icon: `
        <path 
          stroke-linecap="round" 
          stroke-linejoin="round" 
          stroke-width="2" 
          d="M7 8h10M7 12h4m1 4h5"
        />
        <rect x="3" y="4" width="18" height="16" rx="2" stroke-width="2" />
      `
    },
    {
      id: 'thumbnails',
      label: 'Thumbnails',
      icon: `
        <path 
          stroke-linecap="round" 
          stroke-linejoin="round" 
          stroke-width="2" 
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      `
    }
  ];

  function handleToolSelect(toolId: typeof selectedTool) {
    if (toolId !== selectedTool) {
      dispatch('toolchange', { tool: toolId });
    }
  }

  function handleUndo() {
    if (canUndo) {
      dispatch('undo');
    }
  }

  function handleRedo() {
    if (canRedo) {
      dispatch('redo');
    }
  }

  function handleTrim() {
    dispatch('trim');
  }
</script>

<div class="tool-panel">
  <div class="history-controls">
    <button
      class="history-button"
      disabled={!canUndo}
      on:click={handleUndo}
      title="Undo (Ctrl+Z)"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path 
          stroke-linecap="round" 
          stroke-linejoin="round" 
          stroke-width="2" 
          d="M3 10h10a4 4 0 014 4v2m-6-6l-3-3m0 0L5 4m3 3H3"
        />
      </svg>
    </button>

    <button
      class="history-button"
      disabled={!canRedo}
      on:click={handleRedo}
      title="Redo (Ctrl+Shift+Z)"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path 
          stroke-linecap="round" 
          stroke-linejoin="round" 
          stroke-width="2" 
          d="M21 10h-10a4 4 0 00-4 4v2m6-6l3-3m0 0l3-3m-3 3h-6"
        />
      </svg>
    </button>
  </div>

  <div class="tool-buttons">
    {#each tools as tool}
      <button
        class="tool-button"
        class:active={selectedTool === tool.id}
        on:click={() => handleToolSelect(tool.id)}
        title={tool.label}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          {@html tool.icon}
        </svg>
        <span class="tool-label">{tool.label}</span>
      </button>
    {/each}
  </div>

  {#if selectedTool === 'trim'}
    <div class="action-buttons">
      <button
        class="action-button primary"
        on:click={handleTrim}
      >
        Apply Trim
      </button>
    </div>
  {/if}
</div>

<style lang="postcss">
  .tool-panel {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .history-controls {
    display: flex;
    gap: 8px;
  }

  .history-button {
    background: transparent;
    border: none;
    color: white;
    padding: 8px;
    cursor: pointer;
    opacity: 0.8;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      opacity: 1;
      background: rgba(255, 255, 255, 0.1);
    }

    &:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    svg {
      width: 20px;
      height: 20px;
    }
  }

  .tool-buttons {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .tool-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: white;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.05);
    }

    &.active {
      background: var(--primary-color, #00a8ff);
      border-color: transparent;
    }

    svg {
      width: 24px;
      height: 24px;
    }
  }

  .tool-label {
    font-size: 12px;
    opacity: 0.8;
  }

  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .action-button {
    padding: 12px;
    border: none;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;

    &.primary {
      background: var(--primary-color, #00a8ff);
      color: white;

      &:hover {
        filter: brightness(1.1);
      }
    }
  }
</style> 