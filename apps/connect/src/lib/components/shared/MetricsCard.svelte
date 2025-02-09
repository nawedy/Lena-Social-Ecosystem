<!-- MetricsCard.svelte -->
<script lang="ts">
  import { fade } from 'svelte/transition';

  export let title: string;
  export let value: number;
  export let format: 'number' | 'percent' | 'currency' | 'days' = 'number';
  export let icon: string;
  export let trend?: {
    value: number;
    direction: 'up' | 'down';
  };

  $: formattedValue = formatValue(value);
  $: trendClass = trend?.direction === 'up' ? 'trend-up' : 'trend-down';

  function formatValue(val: number): string {
    switch (format) {
      case 'percent':
        return `${(val * 100).toFixed(1)}%`;
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(val);
      case 'days':
        return `${val.toFixed(1)} days`;
      default:
        return new Intl.NumberFormat('en-US').format(val);
    }
  }
</script>

<div class="metrics-card" transition:fade>
  <div class="icon">
    <i class={`fas fa-${icon}`} />
  </div>
  <div class="content">
    <h4 class="title">{title}</h4>
    <div class="value">{formattedValue}</div>
    {#if trend}
      <div class="trend {trendClass}">
        <i class={`fas fa-arrow-${trend.direction}`} />
        <span>{trend.value}%</span>
      </div>
    {/if}
  </div>
</div>

<style lang="postcss">
  .metrics-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    background: var(--surface-2);
    border-radius: 8px;
    transition: transform 0.2s;

    &:hover {
      transform: translateY(-2px);
    }
  }

  .icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: var(--primary-color);
    border-radius: 12px;
    color: white;
    font-size: 20px;
  }

  .content {
    flex: 1;
  }

  .title {
    margin: 0;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-2);
  }

  .value {
    margin-top: 4px;
    font-size: 24px;
    font-weight: 600;
    color: var(--text-1);
  }

  .trend {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;

    &.trend-up {
      background: var(--success-light);
      color: var(--success);
    }

    &.trend-down {
      background: var(--error-light);
      color: var(--error);
    }

    i {
      font-size: 10px;
    }
  }
</style> 