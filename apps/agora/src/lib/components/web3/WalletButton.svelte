<!-- WalletButton.svelte -->
<script lang="ts">
  import { walletAddress, chainId } from '$lib/auth/store';
  import { Button } from '$lib/components/ui';
  import { Icon } from '$lib/components/ui';
  import { ethers } from 'ethers';

  const CHAIN_NAMES = {
    1: 'Ethereum',
    5: 'Goerli',
    11155111: 'Sepolia',
    1337: 'Local'
  } as const;

  async function connectWallet() {
    if (!window.ethereum) {
      alert('Please install MetaMask to connect your wallet.');
      return;
    }

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });
      walletAddress.set(accounts[0]);
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  }

  function formatAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  function getChainName(id: number): string {
    return CHAIN_NAMES[id as keyof typeof CHAIN_NAMES] || 'Unknown';
  }
</script>

{#if $walletAddress}
  <Button
    variant="outline"
    class="flex items-center space-x-2"
  >
    <div class="flex items-center space-x-2">
      <Icon name="wallet" class="h-4 w-4" />
      <span>{formatAddress($walletAddress)}</span>
    </div>
    {#if $chainId}
      <span class="text-xs text-muted-foreground">
        ({getChainName($chainId)})
      </span>
    {/if}
  </Button>
{:else}
  <Button
    variant="outline"
    on:click={connectWallet}
    class="flex items-center space-x-2"
  >
    <Icon name="wallet" class="h-4 w-4" />
    <span>Connect Wallet</span>
  </Button>
{/if}

<style>
  /* Add any component-specific styles here */
</style> 