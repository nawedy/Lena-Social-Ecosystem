<!-- WalletDashboard.svelte -->
<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { walletService } from '$lib/services/wallet/WalletService';
  import { kycService } from '$lib/services/compliance/KYCService';
  import BalanceCard from './BalanceCard.svelte';
  import QuickActions from './QuickActions.svelte';
  import RecentTransactions from './RecentTransactions.svelte';
  import CreatorSubscriptions from './CreatorSubscriptions.svelte';
  import { onMount } from 'svelte';

  let totalBalance = 0;
  let cryptoBalances: Record<string, number> = {};
  let fiatBalances: Record<string, number> = {};
  let kycLevel = 0;
  let loading = true;

  $: totalCryptoValue = Object.values(cryptoBalances).reduce((sum, val) => sum + val, 0);
  $: totalFiatValue = Object.values(fiatBalances).reduce((sum, val) => sum + val, 0);

  onMount(async () => {
    await loadData();
    setupRealtimeUpdates();
  });

  async function loadData() {
    const [balances, kyc] = await Promise.all([
      walletService.getBalances(),
      kycService.getCurrentLevel()
    ]);

    if (balances.data) {
      Object.entries(balances.data).forEach(([currency, balance]) => {
        if (balance.type === 'crypto') {
          cryptoBalances[currency] = balance.usdValue;
        } else {
          fiatBalances[currency] = balance.amount;
        }
      });
    }

    if (kyc.data) {
      kycLevel = kyc.data;
    }

    loading = false;
  }

  function setupRealtimeUpdates() {
    // Subscribe to real-time balance updates
    const unsubscribe = walletService.balances.subscribe(($balances) => {
      // Update balances when changes occur
      Object.entries($balances).forEach(([currency, balance]) => {
        if (balance.type === 'crypto') {
          cryptoBalances[currency] = balance.usdValue;
        } else {
          fiatBalances[currency] = balance.amount;
        }
      });
    });

    return () => {
      unsubscribe();
    };
  }
</script>

<div class="wallet-dashboard" transition:fade>
  {#if loading}
    <div class="loading-overlay">
      <div class="spinner"></div>
    </div>
  {:else}
    <header class="dashboard-header">
      <h1>Wallet Dashboard</h1>
      <div class="kyc-badge" class:verified={kycLevel > 0}>
        KYC Level {kycLevel}
      </div>
    </header>

    <div class="balance-overview" transition:fly={{ y: 20, duration: 400 }}>
      <BalanceCard
        type="crypto"
        balance={totalCryptoValue}
        balances={cryptoBalances}
      />
      <BalanceCard
        type="fiat"
        balance={totalFiatValue}
        balances={fiatBalances}
      />
    </div>

    <QuickActions />

    <div class="dashboard-content">
      <section class="recent-activity">
        <h2>Recent Activity</h2>
        <RecentTransactions limit={5} />
      </section>

      <section class="creator-subscriptions">
        <h2>Creator Subscriptions</h2>
        <CreatorSubscriptions />
      </section>
    </div>
  {/if}
</div>

<style lang="postcss">
  .wallet-dashboard {
    @apply relative min-h-screen p-6 bg-gradient-to-br from-gray-900 to-gray-800;
  }

  .dashboard-header {
    @apply flex items-center justify-between mb-8;

    h1 {
      @apply text-2xl font-bold text-white;
    }
  }

  .kyc-badge {
    @apply px-4 py-2 text-sm font-medium rounded-full bg-opacity-20;
    @apply bg-red-500 text-red-100;

    &.verified {
      @apply bg-green-500 text-green-100;
    }
  }

  .balance-overview {
    @apply grid gap-6 mb-8;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  }

  .dashboard-content {
    @apply grid gap-8 mt-8;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  }

  section {
    @apply p-6 rounded-lg backdrop-blur-lg bg-white bg-opacity-5;
    border: 1px solid rgba(255, 255, 255, 0.1);

    h2 {
      @apply mb-4 text-xl font-semibold text-white;
    }
  }

  .loading-overlay {
    @apply absolute inset-0 flex items-center justify-center;
    background: rgba(0, 0, 0, 0.5);
  }

  .spinner {
    @apply w-12 h-12 border-4 border-blue-500 rounded-full;
    border-top-color: transparent;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style> 