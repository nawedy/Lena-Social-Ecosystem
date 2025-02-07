# script
<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { supabase } from '$lib/supabaseClient';
  import { Button, Badge, Alert } from '$lib/components/ui';
  import { PurchaseModal } from '$lib/components/marketplace';
  import { PaymentService } from '$lib/services/PaymentService';
  import { ShippingService } from '$lib/services/ShippingService';
  import { PrivacyService } from '$lib/services/PrivacyService';
  import { formatCurrency } from '$lib/utils/currency';
  import { ipfsToHttps } from '$lib/utils/ipfs';

  let product: any = null;
  let seller: any = null;
  let loading = true;
  let error: string | null = null;
  let showPurchaseModal = false;
  let selectedImage: string | null = null;

  const paymentService = new PaymentService();
  const shippingService = new ShippingService();
  const privacyService = new PrivacyService();

  onMount(async () => {
    try {
      // Fetch product details
      const { data: productData, error: productError } = await supabase
        .from('marketplace_products')
        .select(`
          *,
          seller:seller_id(
            id,
            username,
            avatar_url,
            wallet_address,
            reputation
          ),
          categories:marketplace_product_categories(
            category:category_id(*)
          )
        `)
        .eq('id', $page.params.id)
        .single();

      if (productError) throw productError;
      product = productData;
      seller = product.seller;
      selectedImage = product.images[0];

      // Increment view count
      await supabase.rpc('increment_product_views', {
        product_id: product.id
      });
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  });

  async function handlePurchase() {
    if (!product) return;
    showPurchaseModal = true;
  }

  function handleImageSelect(image: string) {
    selectedImage = image;
  }

  async function checkTokenGating(): Promise<boolean> {
    if (!product.token_gated) return true;
    
    try {
      // Connect wallet if not connected
      if (!window.ethereum) {
        throw new Error('Please install a Web3 wallet to purchase this product');
      }

      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const address = await signer.getAddress();

      // Check token balance
      const contract = new ethers.Contract(
        product.nft_contract,
        ['function balanceOf(address owner) view returns (uint256)'],
        provider
      );

      const balance = await contract.balanceOf(address);
      return balance.gt(0);
    } catch (error) {
      console.error('Token gating check failed:', error);
      return false;
    }
  }
</script>

# template
<div class="container mx-auto px-4 py-8">
  {#if loading}
    <div class="flex justify-center items-center min-h-[400px]">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  {:else if error}
    <Alert variant="error" title="Error" message={error} />
  {:else if product}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <!-- Product Images -->
      <div class="space-y-4">
        <div class="aspect-square rounded-lg overflow-hidden bg-gray-100">
          <img
            src={ipfsToHttps(selectedImage)}
            alt={product.title}
            class="w-full h-full object-cover"
          />
        </div>
        <div class="grid grid-cols-4 gap-4">
          {#each product.images as image}
            <button
              class="aspect-square rounded-lg overflow-hidden bg-gray-100 hover:opacity-75 transition
                {selectedImage === image ? 'ring-2 ring-primary' : ''}"
              on:click={() => handleImageSelect(image)}
            >
              <img
                src={ipfsToHttps(image)}
                alt={product.title}
                class="w-full h-full object-cover"
              />
            </button>
          {/each}
        </div>
      </div>

      <!-- Product Info -->
      <div class="space-y-6">
        <div class="space-y-2">
          <h1 class="text-3xl font-bold">{product.title}</h1>
          <div class="flex items-center space-x-4">
            <span class="text-2xl font-bold text-primary">
              {formatCurrency(product.price, product.currency)}
            </span>
            {#if product.stock !== null}
              <Badge
                variant={product.stock > 0 ? 'success' : 'error'}
                label={product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
              />
            {/if}
          </div>
        </div>

        <!-- Categories -->
        <div class="flex flex-wrap gap-2">
          {#each product.categories as { category }}
            <Badge variant="secondary" label={category.name} />
          {/each}
        </div>

        <!-- Token Gating Info -->
        {#if product.token_gated}
          <div class="bg-secondary/10 rounded-lg p-4 space-y-2">
            <h3 class="font-semibold">Token Gated Product</h3>
            <p class="text-sm">
              This product requires ownership of specific tokens to purchase.
              Contract: {product.nft_contract}
            </p>
          </div>
        {/if}

        <!-- Description -->
        <div class="prose max-w-none">
          {product.description}
        </div>

        <!-- Seller Info -->
        <div class="border rounded-lg p-4 space-y-4">
          <div class="flex items-center space-x-4">
            <img
              src={seller.avatar_url || '/default-avatar.png'}
              alt={seller.username}
              class="w-12 h-12 rounded-full"
            />
            <div>
              <h3 class="font-semibold">{seller.username}</h3>
              <div class="flex items-center space-x-2 text-sm text-gray-600">
                <span>Reputation: {seller.reputation}</span>
                <span>•</span>
                <span>Wallet: {seller.wallet_address.slice(0, 6)}...{seller.wallet_address.slice(-4)}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Purchase Button -->
        <Button
          variant="primary"
          size="lg"
          class="w-full"
          disabled={product.stock === 0}
          on:click={handlePurchase}
        >
          {product.stock === 0 ? 'Out of Stock' : 'Purchase Now'}
        </Button>
      </div>
    </div>

    <!-- Purchase Modal -->
    {#if showPurchaseModal}
      <PurchaseModal
        {product}
        privacyEnabled={true}
        onClose={() => showPurchaseModal = false}
        onPurchase={async (data) => {
          // Handle purchase completion
          showPurchaseModal = false;
          // Redirect to order confirmation
          goto(`/orders/${data.orderId}`);
        }}
      />
    {/if}
  {/if}
</div>

# styles
<style>
  :global(.prose) {
    @apply text-gray-700;
  }
  :global(.prose p) {
    @apply mb-4;
  }
  :global(.prose ul) {
    @apply list-disc list-inside mb-4;
  }
  :global(.prose ol) {
    @apply list-decimal list-inside mb-4;
  }
</style> 