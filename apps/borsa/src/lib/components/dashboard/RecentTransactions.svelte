<!-- RecentTransactions.svelte -->
<script lang="ts">
  import { fade, slide } from 'svelte/transition';
  import Icon from '$lib/components/shared/Icon.svelte';
  import { formatCurrency, formatCompactNumber } from '$lib/utils/currency';
  import { walletService } from '$lib/services/wallet/WalletService';
  import { onMount } from 'svelte';

  export let limit: number = 5;

  let transactions: any[] = [];
  let loading = true;

  onMount(async () => {
    const unsubscribe = walletService.transactionHistory.subscribe(($transactions) => {
      transactions = $transactions.slice(0, limit);
      loading = false;
    });

    return () => {
      unsubscribe();
    };
  });

  function getTransactionIcon(type: string): string {
    switch (type) {
      case 'send':
        return 'send';
      case 'receive':
        return 'receive';
      case 'exchange':
        return 'exchange';
      case 'stake':
        return 'lock';
      case 'unstake':
        return 'unlock';
      case 'reward':
        return 'gift';
      default:
        return 'transaction';
    }
  }

  function getTransactionColor(type: string): string {
    switch (type) {
      case 'send':
        return 'red';
      case 'receive':
        return 'green';
      case 'exchange':
        return 'purple';
      case 'stake':
        return 'blue';
      case 'unstake':
        return 'yellow';
      case 'reward':
        return 'pink';
      default:
        return 'gray';
    }
  }
</script>

<div class="recent-transactions" transition:fade>
  {#if loading}
    <div class="loading">Loading transactions...</div>
  {:else if transactions.length === 0}
    <div class="empty-state">
      <Icon name="list" size={48} />
      <p>No recent transactions</p>
    </div>
  {:else}
    <div class="transaction-list">
      {#each transactions as tx}
        <div 
          class="transaction-item"
          class:pending={tx.status === 'pending'}
          class:failed={tx.status === 'failed'}
          transition:slide
        >
          <div class="tx-icon" class:color={getTransactionColor(tx.type)}>
            <Icon name={getTransactionIcon(tx.type)} size={20} />
          </div>

          <div class="tx-details">
            <div class="tx-type">
              {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
              {#if tx.status === 'pending'}
                <span class="status pending">Pending</span>
              {:else if tx.status === 'failed'}
                <span class="status failed">Failed</span>
              {/if}
            </div>
            <div class="tx-meta">
              {new Date(tx.timestamp).toLocaleString()}
            </div>
          </div>

          <div class="tx-amount" class:negative={tx.type === 'send'}>
            <div class="amount">
              {tx.type === 'send' ? '-' : ''}{formatCurrency(tx.amount, tx.currency)}
            </div>
            {#if tx.fee > 0}
              <div class="fee">
                Fee: {formatCurrency(tx.fee, tx.currency)}
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style lang="postcss">
  .recent-transactions {
    @apply min-h-[200px];
  }

  .loading {
    @apply flex items-center justify-center h-full text-white text-opacity-60;
  }

  .empty-state {
    @apply flex flex-col items-center justify-center gap-4 p-8 text-center;
    @apply text-white text-opacity-60;
  }

  .transaction-list {
    @apply space-y-2;
  }

  .transaction-item {
    @apply flex items-center gap-4 p-3 rounded-lg;
    @apply bg-white bg-opacity-5;
    @apply transition-colors duration-200;

    &:hover {
      @apply bg-opacity-10;
    }

    &.pending {
      @apply opacity-75;
    }

    &.failed {
      @apply opacity-50;
    }
  }

  .tx-icon {
    @apply p-2 rounded-lg;

    &.color-red {
      @apply bg-red-500 bg-opacity-20 text-red-300;
    }

    &.color-green {
      @apply bg-green-500 bg-opacity-20 text-green-300;
    }

    &.color-purple {
      @apply bg-purple-500 bg-opacity-20 text-purple-300;
    }

    &.color-blue {
      @apply bg-blue-500 bg-opacity-20 text-blue-300;
    }

    &.color-yellow {
      @apply bg-yellow-500 bg-opacity-20 text-yellow-300;
    }

    &.color-pink {
      @apply bg-pink-500 bg-opacity-20 text-pink-300;
    }

    &.color-gray {
      @apply bg-gray-500 bg-opacity-20 text-gray-300;
    }
  }

  .tx-details {
    @apply flex-1;

    .tx-type {
      @apply text-sm font-medium text-white;
    }

    .tx-meta {
      @apply text-xs text-white text-opacity-60;
    }
  }

  .status {
    @apply ml-2 px-2 py-0.5 text-xs rounded-full;

    &.pending {
      @apply bg-yellow-500 bg-opacity-20 text-yellow-300;
    }

    &.failed {
      @apply bg-red-500 bg-opacity-20 text-red-300;
    }
  }

  .tx-amount {
    @apply text-right;

    .amount {
      @apply text-sm font-medium text-white;

      &.negative {
        @apply text-red-300;
      }
    }

    .fee {
      @apply text-xs text-white text-opacity-60;
    }
  }
</style> 