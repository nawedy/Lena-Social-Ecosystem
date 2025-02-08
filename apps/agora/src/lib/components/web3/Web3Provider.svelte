<!-- Web3Provider.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { web3Provider, walletAddress, chainId } from '$lib/auth/store';
  import { ethers } from 'ethers';
  import { env } from '$env/dynamic/public';
  import { Alert } from '$lib/components/ui';

  const SUPPORTED_CHAINS = {
    mainnet: 1,
    goerli: 5,
    sepolia: 11155111,
    localhost: 1337
  };

  const CHAIN_NAMES = {
    1: 'Ethereum Mainnet',
    5: 'Goerli Testnet',
    11155111: 'Sepolia Testnet',
    1337: 'Local Network'
  };

  let error: string | null = null;

  onMount(async () => {
    if (!window.ethereum) {
      error = 'No Web3 provider found. Please install MetaMask.';
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      web3Provider.set(provider);

      // Get initial wallet state
      const accounts = await provider.listAccounts();
      walletAddress.set(accounts[0]?.address ?? null);
      const network = await provider.getNetwork();
      chainId.set(Number(network.chainId));

      // Listen for account changes
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        walletAddress.set(accounts[0] ?? null);
      });

      // Listen for chain changes
      window.ethereum.on('chainChanged', (chainId: string) => {
        chainId.set(Number(chainId));
      });

      // Check if we're on the right network
      const targetNetwork = env.VITE_WEB3_NETWORK;
      const targetChainId = SUPPORTED_CHAINS[targetNetwork as keyof typeof SUPPORTED_CHAINS];
      
      if (Number(network.chainId) !== targetChainId) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${targetChainId.toString(16)}` }]
          });
        } catch (switchError: any) {
          // This error code indicates that the chain has not been added to MetaMask
          if (switchError.code === 4902) {
            error = `Please add the ${CHAIN_NAMES[targetChainId]} to your wallet.`;
          } else {
            error = `Failed to switch to ${CHAIN_NAMES[targetChainId]}.`;
          }
        }
      }
    } catch (err) {
      console.error('Failed to initialize Web3:', err);
      error = 'Failed to initialize Web3 provider.';
    }
  });
</script>

{#if error}
  <Alert variant="destructive" dismissible>
    {error}
  </Alert>
{/if}

<slot />

<style>
  /* Add any component-specific styles here */
</style> 