<!-- PurchaseModal.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { Button, Input, Select, Alert } from '$lib/components/ui';
  import { PaymentService } from '$lib/services/PaymentService';
  import { ShippingService } from '$lib/services/ShippingService';
  import { PrivacyService } from '$lib/services/PrivacyService';
  import { ethers } from 'ethers';

  export let product: any;
  export let privacyEnabled = false;
  export let onClose: () => void;
  export let onPurchase: (data: any) => void;

  const dispatch = createEventDispatcher();
  let loading = false;
  let error: string | null = null;
  let step = 1;
  let paymentMethod = '';
  let shippingRequired = product.metadata?.shipping_required || false;

  // Form state
  let shippingAddress = {
    name: '',
    street: '',
    city: '',
    state: '',
    zip: '',
    country: '',
    email: ''
  };

  let cryptoPayment = {
    wallet: '',
    network: '',
    proxyEnabled: false
  };

  // Services
  const paymentService = new PaymentService();
  const shippingService = new ShippingService();
  const privacyService = new PrivacyService();

  // Available payment methods
  const paymentMethods = [
    { value: 'crypto_eth', label: 'Ethereum (ETH)' },
    { value: 'crypto_matic', label: 'Polygon (MATIC)' },
    { value: 'crypto_usdc', label: 'USDC' },
    { value: 'crypto_dai', label: 'DAI' },
    { value: 'stripe', label: 'Credit Card' },
  ];

  // Shipping carriers
  const shippingCarriers = [
    { value: 'fedex', label: 'FedEx' },
    { value: 'ups', label: 'UPS' },
    { value: 'usps', label: 'USPS' },
    { value: 'dhl', label: 'DHL' }
  ];

  async function handleSubmit() {
    try {
      loading = true;
      error = null;

      // Validate form based on current step
      if (step === 1 && !paymentMethod) {
        error = 'Please select a payment method';
        return;
      }

      if (step === 2 && shippingRequired) {
        if (!shippingAddress.name || !shippingAddress.street || !shippingAddress.city) {
          error = 'Please fill in all required shipping fields';
          return;
        }
      }

      // Handle crypto payment setup
      if (paymentMethod.startsWith('crypto_')) {
        if (!cryptoPayment.wallet) {
          error = 'Please connect your wallet';
          return;
        }

        // Create proxy wallet if privacy enabled
        if (privacyEnabled) {
          cryptoPayment.proxyEnabled = true;
          const proxyWallet = await privacyService.createProxyWallet();
          cryptoPayment.wallet = proxyWallet.address;
        }

        // Validate network and switch if needed
        const network = paymentMethod.split('_')[1];
        await paymentService.switchNetwork(network);
      }

      // Move to next step or complete purchase
      if (step < (shippingRequired ? 3 : 2)) {
        step++;
      } else {
        await onPurchase({
          paymentMethod,
          shippingAddress: shippingRequired ? shippingAddress : null,
          cryptoPayment: paymentMethod.startsWith('crypto_') ? cryptoPayment : null,
          privacyEnabled,
          timestamp: new Date().toISOString()
        });
      }
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function connectWallet() {
    try {
      loading = true;
      error = null;

      if (typeof window.ethereum === 'undefined') {
        throw new Error('Please install a Web3 wallet like MetaMask');
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = provider.getSigner();
      cryptoPayment.wallet = await signer.getAddress();
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function calculateTotal() {
    let total = product.price;
    if (shippingRequired) {
      total += product.metadata.shipping_cost || 0;
    }
    return total;
  }
</script>

<!-- Modal Backdrop -->
<div
  class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
  on:click={onClose}
  transition:fade
>
  <!-- Modal Content -->
  <div
    class="fixed inset-x-4 top-8 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:max-w-2xl w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl"
    on:click|stopPropagation
    transition:fly={{ y: 50, duration: 300 }}
  >
    <!-- Header -->
    <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
        Complete Purchase
      </h2>
      <button
        class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
        on:click={onClose}
      >
        <span class="sr-only">Close</span>
        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Content -->
    <div class="p-6 space-y-6">
      {#if error}
        <Alert type="error">{error}</Alert>
      {/if}

      <!-- Step 1: Payment Method -->
      {#if step === 1}
        <div class="space-y-4">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">
            Select Payment Method
          </h3>

          <div class="space-y-4">
            {#each paymentMethods as method}
              <label class="flex items-center p-4 border rounded-lg cursor-pointer transition-colors"
                class:border-emerald-500={paymentMethod === method.value}
                class:bg-emerald-50={paymentMethod === method.value}
                class:dark:bg-emerald-900/20={paymentMethod === method.value}
                class:border-gray-200={paymentMethod !== method.value}
                class:dark:border-gray-700={paymentMethod !== method.value}
              >
                <input
                  type="radio"
                  name="payment"
                  value={method.value}
                  bind:group={paymentMethod}
                  class="form-radio"
                />
                <span class="ml-3">{method.label}</span>
              </label>
            {/each}
          </div>

          {#if paymentMethod.startsWith('crypto_')}
            <div class="mt-4 space-y-4">
              <Button
                variant="secondary"
                on:click={connectWallet}
                disabled={loading}
              >
                {cryptoPayment.wallet ? 'Wallet Connected' : 'Connect Wallet'}
              </Button>

              {#if cryptoPayment.wallet}
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Connected: {cryptoPayment.wallet}
                </p>
              {/if}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Step 2: Shipping (if required) -->
      {#if step === 2 && shippingRequired}
        <div class="space-y-4">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">
            Shipping Information
          </h3>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Full Name"
              bind:value={shippingAddress.name}
              required
            />
            <Input
              label="Email"
              type="email"
              bind:value={shippingAddress.email}
              required
            />
            <div class="md:col-span-2">
              <Input
                label="Street Address"
                bind:value={shippingAddress.street}
                required
              />
            </div>
            <Input
              label="City"
              bind:value={shippingAddress.city}
              required
            />
            <Input
              label="State/Province"
              bind:value={shippingAddress.state}
              required
            />
            <Input
              label="ZIP/Postal Code"
              bind:value={shippingAddress.zip}
              required
            />
            <Input
              label="Country"
              bind:value={shippingAddress.country}
              required
            />
          </div>

          <Select
            label="Shipping Carrier"
            options={shippingCarriers}
            bind:value={shippingAddress.carrier}
            required
          />
        </div>
      {/if}

      <!-- Step 3: Review & Confirm -->
      {#if step === (shippingRequired ? 3 : 2)}
        <div class="space-y-4">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">
            Review Order
          </h3>

          <div class="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-2">
            <div class="flex justify-between">
              <span>Product Price</span>
              <span>{product.price} {product.currency}</span>
            </div>

            {#if shippingRequired}
              <div class="flex justify-between">
                <span>Shipping</span>
                <span>{product.metadata.shipping_cost} {product.currency}</span>
              </div>
            {/if}

            <div class="pt-2 border-t border-gray-200 dark:border-gray-700">
              <div class="flex justify-between font-semibold">
                <span>Total</span>
                <span>{calculateTotal()} {product.currency}</span>
              </div>
            </div>
          </div>

          {#if privacyEnabled}
            <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <p class="text-sm text-blue-700 dark:text-blue-300">
                Privacy mode is enabled. Your identity will be protected using:
                {#if paymentMethod.startsWith('crypto_')}
                  <br>• Proxy wallet for transactions
                {/if}
                <br>• Encrypted communication
                <br>• Anonymous shipping (if applicable)
              </p>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Footer -->
    <div class="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-between">
      {#if step > 1}
        <Button
          variant="outline"
          on:click={() => step--}
          disabled={loading}
        >
          Back
        </Button>
      {:else}
        <Button
          variant="outline"
          on:click={onClose}
          disabled={loading}
        >
          Cancel
        </Button>
      {/if}

      <Button
        variant="primary"
        on:click={handleSubmit}
        loading={loading}
        disabled={loading}
      >
        {step === (shippingRequired ? 3 : 2) ? 'Complete Purchase' : 'Continue'}
      </Button>
    </div>
  </div>
</div> 