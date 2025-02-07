{#if variant === 'primary'}
  <button
    class="btn btn-primary"
    class:disabled
    on:click
    {...$$restProps}
  >
    <slot />
  </button>
{:else if variant === 'secondary'}
  <button
    class="btn btn-secondary"
    class:disabled
    on:click
    {...$$restProps}
  >
    <slot />
  </button>
{/if}

<script lang="ts">
  export let variant: 'primary' | 'secondary' = 'primary';
  export let disabled = false;
</script>

<style>
  .btn {
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease-in-out;
    border: none;
    outline: none;
  }

  .btn-primary {
    background: linear-gradient(135deg, #00FFFF 0%, #0A2540 100%);
    color: white;
    box-shadow: 0 4px 6px rgba(0, 255, 255, 0.1);
  }

  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 8px rgba(0, 255, 255, 0.2);
  }

  .btn-secondary {
    background: transparent;
    border: 2px solid #00FFFF;
    color: #00FFFF;
  }

  .btn-secondary:hover {
    background: rgba(0, 255, 255, 0.1);
  }

  .disabled {
    opacity: 0.6;
    cursor: not-allowed;
    pointer-events: none;
  }
</style> 