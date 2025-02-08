<!-- WalletConnect.svelte -->
<script lang="ts">
  import { connectWallet, disconnectWallet } from '$lib/auth/store';
  import { userAddress, isConnected, chainId } from '$lib/auth/store';
  import { Button } from '$lib/components/ui';
  import { Icon } from '$lib/components/ui';
  import { truncateAddress } from '$lib/utils/address';
  import { onMount } from 'svelte';

  let loading = false;
  let error: string | null = null;

  async function handleConnect() {
    loading = true;
    error = null;

    try {
      await connectWallet();
    } catch (e: any) {
      error = e.message || 'Failed to connect wallet';
    } finally {
      loading = false;
    }
  }

  async function handleDisconnect() {
    disconnectWallet();
  }

  // Clear error after 5 seconds
  $: if (error) {
    setTimeout(() => {
      error = null;
    }, 5000);
  }
</script>

{#if $isConnected}
  <div class="flex items-center gap-2">
    <Button
      variant="outline"
      size="sm"
      class="flex items-center gap-2"
      on:click={handleDisconnect}
    >
      <Icon name="wallet" class="w-4 h-4" />
      <span class="hidden md:inline">{truncateAddress($userAddress || '')}</span>
      <span class="md:hidden">Wallet</span>
    </Button>
    
    {#if $chainId}
      <div class="flex items-center gap-2 text-sm">
        <span class="w-2 h-2 rounded-full bg-green-500"></span>
        <span class="hidden md:inline">
          {$chainId === 1 ? 'Mainnet' : 
           $chainId === 5 ? 'Goerli' :
           $chainId === 11155111 ? 'Sepolia' :
           `Chain ${$chainId}`}
        </span>
      </div>
    {/if}
  </div>
{:else}
  <Button
    variant="outline"
    size="sm"
    class="flex items-center gap-2"
    disabled={loading}
    on:click={handleConnect}
  >
    <Icon name="wallet" class="w-4 h-4" />
    <span class="hidden md:inline">Connect Wallet</span>
    <span class="md:hidden">Connect</span>
  </Button>
{/if}

{#if error}
  <div class="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg">
    {error}
  </div>
{/if}

<style>
  /* Fade in/out animation for error message */
  div:last-child {
    animation: fadeIn 0.3s ease-in-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(1rem);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style> 