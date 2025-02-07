<!-- TokenGateManager.svelte -->
<script lang="ts">
  import { TokenGateService } from '$lib/services/TokenGateService';
  import { Button, Input, Select, Alert } from '$lib/components/ui';
  import { onMount } from 'svelte';

  export let contentId: string;
  export let onUpdate: () => void = () => {};

  let tokenGateService = new TokenGateService();
  let loading = false;
  let error: string | null = null;
  let success: string | null = null;

  // Form state
  let contractAddress = '';
  let chainId = 1; // Default to Ethereum mainnet
  let tokenStandard: 'ERC721' | 'ERC1155' = 'ERC721';
  let minTokenBalance = '';
  let requiredTokenIds: string[] = [];
  let newTokenId = '';

  // Chain options
  const chains = [
    { value: '1', label: 'Ethereum Mainnet' },
    { value: '137', label: 'Polygon' },
    { value: '10', label: 'Optimism' },
    { value: '42161', label: 'Arbitrum One' }
  ];

  // Load existing token gate
  async function loadTokenGate() {
    try {
      loading = true;
      const { data, error } = await supabase
        .from('token_gates')
        .select()
        .eq('content_id', contentId)
        .single();

      if (error) throw error;

      if (data) {
        contractAddress = data.contract_address;
        chainId = data.chain_id;
        minTokenBalance = data.min_token_balance || '';
        requiredTokenIds = data.required_token_ids || [];
        tokenStandard = data.metadata?.tokenStandard || 'ERC721';
      }
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function handleSubmit() {
    try {
      loading = true;
      error = null;
      success = null;

      await tokenGateService.createTokenGate(contentId, {
        contractAddress,
        chainId,
        minTokenBalance: minTokenBalance || undefined,
        requiredTokenIds: requiredTokenIds.length > 0 ? requiredTokenIds : undefined,
        metadata: {
          tokenStandard,
          createdAt: new Date().toISOString()
        }
      });

      success = 'Token gate created successfully';
      onUpdate();
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function addTokenId() {
    if (newTokenId && !requiredTokenIds.includes(newTokenId)) {
      requiredTokenIds = [...requiredTokenIds, newTokenId];
      newTokenId = '';
    }
  }

  function removeTokenId(id: string) {
    requiredTokenIds = requiredTokenIds.filter(tokenId => tokenId !== id);
  }

  async function handleRemove() {
    try {
      loading = true;
      error = null;
      success = null;

      await tokenGateService.removeTokenGate(contentId);
      success = 'Token gate removed successfully';
      onUpdate();

      // Reset form
      contractAddress = '';
      minTokenBalance = '';
      requiredTokenIds = [];
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  onMount(loadTokenGate);
</script>

<div class="space-y-6">
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
    <h2 class="text-xl font-semibold mb-4">Token Gate Settings</h2>

    {#if error}
      <Alert type="error" class="mb-4">{error}</Alert>
    {/if}

    {#if success}
      <Alert type="success" class="mb-4">{success}</Alert>
    {/if}

    <form on:submit|preventDefault={handleSubmit} class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Input
            label="Contract Address"
            bind:value={contractAddress}
            placeholder="0x..."
            required
          />
        </div>

        <div>
          <Select
            label="Blockchain Network"
            options={chains}
            bind:value={chainId}
          />
        </div>
      </div>

      <div>
        <Select
          label="Token Standard"
          options={[
            { value: 'ERC721', label: 'ERC721 (NFT)' },
            { value: 'ERC1155', label: 'ERC1155 (Multi Token)' }
          ]}
          bind:value={tokenStandard}
        />
      </div>

      <div>
        <Input
          label="Minimum Token Balance"
          type="number"
          bind:value={minTokenBalance}
          placeholder="Minimum number of tokens required"
        />
      </div>

      <div class="space-y-2">
        <label class="block text-sm font-medium">Required Token IDs</label>
        <div class="flex gap-2">
          <Input
            bind:value={newTokenId}
            placeholder="Enter token ID"
            class="flex-1"
          />
          <Button
            type="button"
            variant="secondary"
            on:click={addTokenId}
            disabled={!newTokenId}
          >
            Add
          </Button>
        </div>

        {#if requiredTokenIds.length > 0}
          <div class="flex flex-wrap gap-2 mt-2">
            {#each requiredTokenIds as tokenId}
              <div class="inline-flex items-center bg-gray-100 dark:bg-gray-700 rounded-full px-3 py-1">
                <span class="text-sm">{tokenId}</span>
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
      </div>

      <div class="flex justify-between pt-4 border-t">
        <Button
          type="button"
          variant="destructive"
          on:click={handleRemove}
          disabled={loading}
        >
          Remove Token Gate
        </Button>

        <Button
          type="submit"
          variant="primary"
          loading={loading}
          disabled={loading || !contractAddress}
        >
          Save Token Gate
        </Button>
      </div>
    </form>
  </div>
</div> 