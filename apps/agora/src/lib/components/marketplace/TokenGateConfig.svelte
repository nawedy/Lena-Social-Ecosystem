<!-- TokenGateConfig.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { Button, Input, Select, Alert } from '$lib/components/ui';
  import { TokenGateService } from '$lib/services/TokenGateService';

  export let config = {
    contractAddress: '',
    chainId: 1,
    minTokenBalance: '',
    requiredTokenIds: [] as string[]
  };

  let loading = false;
  let error: string | null = null;
  let newTokenId = '';
  let tokenStandard: string | null = null;

  const tokenGateService = new TokenGateService();

  const chains = [
    { value: '1', label: 'Ethereum Mainnet' },
    { value: '137', label: 'Polygon' },
    { value: '10', label: 'Optimism' },
    { value: '42161', label: 'Arbitrum One' }
  ];

  async function detectTokenStandard() {
    if (!config.contractAddress) return;

    try {
      loading = true;
      error = null;
      tokenStandard = await tokenGateService.detectTokenStandard(config.contractAddress);
    } catch (e) {
      error = e.message;
      tokenStandard = null;
    } finally {
      loading = false;
    }
  }

  function addTokenId() {
    if (newTokenId && !config.requiredTokenIds.includes(newTokenId)) {
      config.requiredTokenIds = [...config.requiredTokenIds, newTokenId];
      newTokenId = '';
    }
  }

  function removeTokenId(id: string) {
    config.requiredTokenIds = config.requiredTokenIds.filter(tokenId => tokenId !== id);
  }

  $: {
    if (config.contractAddress) {
      detectTokenStandard();
    } else {
      tokenStandard = null;
      error = null;
    }
  }
</script>

<div class="space-y-6">
  {#if error}
    <Alert type="error">{error}</Alert>
  {/if}

  <!-- Contract Address -->
  <div class="space-y-4">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Input
        label="Contract Address"
        bind:value={config.contractAddress}
        placeholder="0x..."
        required
        disabled={loading}
      />

      <Select
        label="Blockchain Network"
        options={chains}
        bind:value={config.chainId}
        required
        disabled={loading}
      />
    </div>

    {#if loading}
      <div class="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
        <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-500"></div>
        <span>Detecting token standard...</span>
      </div>
    {:else if tokenStandard}
      <div class="flex items-center space-x-2">
        <div class="px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-sm">
          {tokenStandard}
        </div>
        <span class="text-sm text-gray-500 dark:text-gray-400">
          token detected
        </span>
      </div>
    {/if}
  </div>

  <!-- Token Requirements -->
  <div class="space-y-4">
    <h3 class="text-lg font-medium text-gray-900 dark:text-white">
      Token Requirements
    </h3>

    <Input
      type="number"
      label="Minimum Token Balance"
      bind:value={config.minTokenBalance}
      min="0"
      step="0.000000000000000001"
      placeholder="Leave empty for any balance"
      disabled={loading}
    />

    <div class="space-y-2">
      <label class="block text-sm font-medium">
        Required Token IDs
        <span class="text-gray-500 dark:text-gray-400 text-xs">
          (Optional)
        </span>
      </label>

      <div class="flex gap-2">
        <Input
          bind:value={newTokenId}
          placeholder="Enter token ID"
          class="flex-1"
          disabled={loading}
        />
        <Button
          type="button"
          variant="secondary"
          on:click={addTokenId}
          disabled={loading || !newTokenId}
        >
          Add
        </Button>
      </div>

      {#if config.requiredTokenIds.length > 0}
        <div class="flex flex-wrap gap-2 mt-2">
          {#each config.requiredTokenIds as tokenId}
            <div class="inline-flex items-center bg-gray-100 dark:bg-gray-700 rounded-full px-3 py-1">
              <span class="text-sm">Token #{tokenId}</span>
              <button
                type="button"
                class="ml-2 text-gray-500 hover:text-red-500"
                on:click={() => removeTokenId(tokenId)}
              >
                ×
              </button>
            </div>
          {/each}
        </div>
      {/if}

      <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
        {#if config.requiredTokenIds.length > 0}
          Users must own at least one of these specific tokens
        {:else}
          Add specific token IDs that users must own to access this content
        {/if}
      </p>
    </div>
  </div>

  <!-- Help Text -->
  <div class="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-4">
    <div class="flex">
      <div class="flex-shrink-0">
        <Icon
          name="info"
          class="h-5 w-5 text-blue-400"
        />
      </div>
      <div class="ml-3">
        <h3 class="text-sm font-medium text-blue-800 dark:text-blue-300">
          About Token Gating
        </h3>
        <div class="mt-2 text-sm text-blue-700 dark:text-blue-200">
          <p>
            Token gating restricts access to your content based on token ownership.
            Users must either:
          </p>
          <ul class="list-disc list-inside mt-2 space-y-1">
            <li>Hold the minimum required balance of tokens, or</li>
            <li>Own one of the specific token IDs you've listed</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</div> 