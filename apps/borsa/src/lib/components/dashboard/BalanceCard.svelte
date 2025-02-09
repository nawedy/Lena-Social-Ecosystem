<!-- BalanceCard.svelte -->
<script lang="ts">
  import { fade } from 'svelte/transition';
  import { formatCurrency } from '$lib/utils/currency';
  import Icon from '$lib/components/shared/Icon.svelte';

  export let type: 'crypto' | 'fiat';
  export let balance: number;
  export let balances: Record<string, number>;

  $: formattedTotal = formatCurrency(balance, type === 'crypto' ? 'USD' : 'USD');
  $: icon = type === 'crypto' ? 'cryptocurrency' : 'wallet';
  $: gradientClass = type === 'crypto' 
    ? 'from-purple-500 to-blue-500' 
    : 'from-green-500 to-teal-500';
</script>

<div 
  class="balance-card"
  class:crypto={type === 'crypto'}
  class:fiat={type === 'fiat'}
  transition:fade
>
  <div class="card-header">
    <Icon name={icon} size={24} />
    <h3>{type === 'crypto' ? 'Crypto Balance' : 'Fiat Balance'}</h3>
  </div>

  <div class="total-balance">
    <span class="amount">{formattedTotal}</span>
    <div class="change-indicator" class:positive={true}>
      <Icon name={true ? 'trend-up' : 'trend-down'} size={16} />
      <span>2.5%</span>
    </div>
  </div>

  <div class="currency-list">
    {#each Object.entries(balances) as [currency, amount]}
      <div class="currency-item" transition:fade>
        <div class="currency-info">
          <Icon name={`currency-${currency.toLowerCase()}`} size={20} />
          <span class="currency-code">{currency}</span>
        </div>
        <span class="currency-amount">
          {formatCurrency(amount, currency)}
        </span>
      </div>
    {/each}
  </div>
</div>

<style lang="postcss">
  .balance-card {
    @apply p-6 rounded-xl backdrop-blur-lg;
    @apply bg-gradient-to-br bg-opacity-10;
    @apply border border-white border-opacity-10;
    @apply transition-all duration-300 ease-in-out;

    &:hover {
      @apply transform scale-[1.02] shadow-lg;
      border-opacity: 0.2;
    }

    &.crypto {
      @apply from-purple-500/10 to-blue-500/10;
    }

    &.fiat {
      @apply from-green-500/10 to-teal-500/10;
    }
  }

  .card-header {
    @apply flex items-center gap-3 mb-4;

    h3 {
      @apply text-lg font-medium text-white;
    }
  }

  .total-balance {
    @apply flex items-baseline justify-between mb-6;

    .amount {
      @apply text-3xl font-bold text-white;
    }
  }

  .change-indicator {
    @apply flex items-center gap-1 px-2 py-1 text-sm rounded-full;
    @apply bg-white bg-opacity-10;

    &.positive {
      @apply text-green-400;
    }

    &:not(.positive) {
      @apply text-red-400;
    }
  }

  .currency-list {
    @apply space-y-3;
  }

  .currency-item {
    @apply flex items-center justify-between p-3 rounded-lg;
    @apply bg-white bg-opacity-5;
    @apply transition-colors duration-200;

    &:hover {
      @apply bg-opacity-10;
    }
  }

  .currency-info {
    @apply flex items-center gap-2;

    .currency-code {
      @apply text-sm font-medium text-white;
    }
  }

  .currency-amount {
    @apply text-sm text-white text-opacity-90;
  }
</style> 