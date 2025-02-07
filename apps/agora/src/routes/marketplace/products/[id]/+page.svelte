<!-- Product Details Page -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { fade } from 'svelte/transition';
  import { Button, Alert, Badge } from '$lib/components/ui';
  import { TokenGateService } from '$lib/services/TokenGateService';
  import { PaymentService } from '$lib/services/PaymentService';
  import { ShippingService } from '$lib/services/ShippingService';
  import { PrivacyService } from '$lib/services/PrivacyService';
  import { ipfsService } from '$lib/services/ipfs';
  import { supabase } from '$lib/supabaseClient';
  import { user } from '$lib/stores/auth';
  import ImageGallery from '$lib/components/marketplace/ImageGallery.svelte';
  import PurchaseModal from '$lib/components/marketplace/PurchaseModal.svelte';
  import TokenGateVerification from '$lib/components/marketplace/TokenGateVerification.svelte';
  import SellerInfo from '$lib/components/marketplace/SellerInfo.svelte';
  import ReviewSection from '$lib/components/marketplace/ReviewSection.svelte';
  import DisputeSection from '$lib/components/marketplace/DisputeSection.svelte';

  const productId = $page.params.id;
  let product: any = null;
  let loading = true;
  let error: string | null = null;
  let images: string[] = [];
  let showPurchaseModal = false;
  let tokenVerified = false;
  let privacyEnabled = false;

  // Services
  const tokenGateService = new TokenGateService();
  const paymentService = new PaymentService();
  const shippingService = new ShippingService();
  const privacyService = new PrivacyService();

  async function loadProduct() {
    try {
      loading = true;
      error = null;

      const { data, error: fetchError } = await supabase
        .from('marketplace_products')
        .select(`
          *,
          seller:seller_id(
            id,
            username,
            avatar_url,
            reputation,
            verified
          ),
          categories:marketplace_product_categories(
            category:category_id(name)
          )
        `)
        .eq('id', productId)
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error('Product not found');

      product = data;

      // Load IPFS images
      images = await Promise.all(
        product.images.map(async (url: string) => {
          if (url.startsWith('ipfs://')) {
            const cid = url.replace('ipfs://', '');
            return await ipfsService.getImageUrl(cid);
          }
          return url;
        })
      );

      // Verify token gate if needed
      if (product.token_gated && $user) {
        const result = await tokenGateService.verifyAccess(
          productId,
          await privacyService.getWalletAddress($user.id, privacyEnabled)
        );
        tokenVerified = result.isValid;
      }
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function handlePurchase(purchaseData: any) {
    try {
      // Create escrow if using crypto
      let escrowAddress;
      if (purchaseData.paymentMethod.startsWith('crypto_')) {
        escrowAddress = await paymentService.createEscrow(
          product.seller_id,
          product.price,
          product.currency
        );
      }

      // Create shipping label if physical product
      let shippingLabel;
      if (product.metadata?.shipping_required) {
        shippingLabel = await shippingService.createLabel(
          purchaseData.shippingAddress,
          product.metadata.shipping_info
        );
      }

      // Create order with privacy protection
      const { data: order, error: orderError } = await supabase
        .from('marketplace_orders')
        .insert([
          {
            buyer_id: $user?.id,
            seller_id: product.seller_id,
            product_id: productId,
            amount: product.price,
            currency: product.currency,
            payment_method: purchaseData.paymentMethod,
            escrow_address: escrowAddress,
            shipping_label: shippingLabel?.id,
            metadata: {
              ...purchaseData,
              privacy: {
                enabled: privacyEnabled,
                proxy_address: privacyEnabled ? 
                  await privacyService.createProxyAddress() : null
              }
            }
          }
        ])
        .select()
        .single();

      if (orderError) throw orderError;

      // Initialize payment
      await paymentService.initializePayment(order.id, purchaseData);

      // Redirect to payment/order confirmation
      goto(`/marketplace/orders/${order.id}`);
    } catch (e) {
      error = e.message;
    }
  }

  function togglePrivacy() {
    privacyEnabled = !privacyEnabled;
  }

  onMount(loadProduct);
</script>

<div class="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
  {#if loading}
    <div class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
    </div>
  {:else if error}
    <div class="max-w-3xl mx-auto">
      <Alert type="error">{error}</Alert>
    </div>
  {:else}
    <div class="max-w-7xl mx-auto">
      <div class="lg:grid lg:grid-cols-2 lg:gap-x-8 lg:items-start">
        <!-- Image Gallery -->
        <div class="aspect-w-1 aspect-h-1 rounded-lg overflow-hidden">
          <ImageGallery {images} />
        </div>

        <!-- Product Info -->
        <div class="mt-10 px-4 sm:px-0 sm:mt-16 lg:mt-0">
          <div class="flex items-center justify-between">
            <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
              {product.title}
            </h1>
            {#if product.token_gated}
              <Badge variant="primary">Token Gated</Badge>
            {/if}
          </div>

          <!-- Price -->
          <div class="mt-4 flex items-center">
            <p class="text-3xl text-emerald-600 dark:text-emerald-400">
              {product.price} {product.currency}
            </p>
            {#if product.stock !== null}
              <span class="ml-4 text-sm text-gray-500 dark:text-gray-400">
                {product.stock} available
              </span>
            {/if}
          </div>

          <!-- Categories -->
          {#if product.categories?.length > 0}
            <div class="mt-4 flex flex-wrap gap-2">
              {#each product.categories as { category }}
                <Badge variant="secondary">
                  {category.name}
                </Badge>
              {/each}
            </div>
          {/if}

          <!-- Description -->
          <div class="mt-6">
            <h3 class="sr-only">Description</h3>
            <div class="prose prose-sm dark:prose-invert">
              {product.description}
            </div>
          </div>

          <!-- Token Gate Verification -->
          {#if product.token_gated}
            <div class="mt-6">
              <TokenGateVerification
                contractAddress={product.nft_contract}
                chainId={product.chain_id}
                minTokenBalance={product.min_token_balance}
                requiredTokenIds={product.required_token_ids}
                verified={tokenVerified}
              />
            </div>
          {/if}

          <!-- Privacy Options -->
          <div class="mt-6">
            <label class="flex items-center space-x-2">
              <input
                type="checkbox"
                bind:checked={privacyEnabled}
                class="form-checkbox"
              />
              <span>Enable Privacy Mode</span>
            </label>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Your identity will be protected using a proxy address and encrypted communication
            </p>
          </div>

          <!-- Purchase Button -->
          <div class="mt-8 flex flex-col space-y-4">
            <Button
              variant="primary"
              size="lg"
              class="w-full"
              on:click={() => showPurchaseModal = true}
              disabled={product.token_gated && !tokenVerified}
            >
              Purchase Now
            </Button>
            {#if product.token_gated && !tokenVerified}
              <p class="text-sm text-red-600 dark:text-red-400">
                You must meet the token requirements to purchase this item
              </p>
            {/if}
          </div>

          <!-- Seller Info -->
          <div class="mt-8 border-t border-gray-200 dark:border-gray-700 pt-8">
            <SellerInfo seller={product.seller} />
          </div>
        </div>
      </div>

      <!-- Reviews & Disputes -->
      <div class="mt-16 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <ReviewSection productId={product.id} />
        <DisputeSection productId={product.id} />
      </div>
    </div>

    <!-- Purchase Modal -->
    {#if showPurchaseModal}
      <PurchaseModal
        {product}
        {privacyEnabled}
        onClose={() => showPurchaseModal = false}
        onPurchase={handlePurchase}
      />
    {/if}
  {/if}
</div> 