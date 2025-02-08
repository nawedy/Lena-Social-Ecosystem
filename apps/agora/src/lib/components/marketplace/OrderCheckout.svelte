<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { supabase } from '$lib/supabaseClient';
  import { Button, Input, Select, Alert } from '$lib/components/ui';
  import { user } from '$lib/stores/auth';
  import { PaymentService } from '$lib/services/PaymentService';
  import { ShippingService } from '$lib/services/ShippingService';
  import { PrivacyService } from '$lib/services/PrivacyService';
  import { TokenGateService } from '$lib/services/TokenGateService';

  export let productId: string;
  export let onSuccess: (orderId: string) => void = () => {};

  let loading = false;
  let error: string | null = null;
  let product: any = null;
  let seller: any = null;
  let shippingRates: any[] = [];
  let paymentMethods: any[] = [];
  let tokenAccess = false;

  let formData = {
    quantity: 1,
    shippingAddress: {
      name: '',
      street: '',
      city: '',
      state: '',
      country: '',
      postalCode: '',
      phone: ''
    },
    billingAddress: {
      sameAsShipping: true,
      name: '',
      street: '',
      city: '',
      state: '',
      country: '',
      postalCode: ''
    },
    selectedShipping: '',
    paymentMethod: '',
    paymentDetails: {
      walletAddress: '',
      escrow: false,
      proxyShipping: false
    },
    notes: ''
  };

  const paymentService = new PaymentService();
  const shippingService = new ShippingService();
  const privacyService = new PrivacyService();
  const tokenGateService = new TokenGateService();

  onMount(async () => {
    await loadProduct();
    if ($user) {
      await loadUserDefaults();
    }
  });

  async function loadProduct() {
    try {
      loading = true;
      error = null;

      // Get product details
      const { data: productData, error: productError } = await supabase
        .from('marketplace_products')
        .select(`
          *,
          seller:seller_id (
            id,
            username,
            avatar_url,
            reputation
          )
        `)
        .eq('id', productId)
        .single();

      if (productError) throw productError;
      product = productData;
      seller = product.seller;

      // Check token gate if enabled
      if (product.token_gated && $user) {
        const verification = await tokenGateService.verifyAccess(
          productId,
          $user.wallet_address
        );
        tokenAccess = verification.isValid;
      }

      // Load available payment methods
      paymentMethods = await loadPaymentMethods();

      // Load shipping rates if physical product
      if (!product.is_digital && product.shipping_config.enabled) {
        await loadShippingRates();
      }
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function loadUserDefaults() {
    try {
      // Load user's saved addresses
      const { data: addresses, error: addressError } = await supabase
        .from('user_addresses')
        .select('*')
        .eq('user_id', $user.id)
        .eq('is_default', true)
        .single();

      if (addresses) {
        formData.shippingAddress = {
          name: addresses.name,
          street: addresses.street,
          city: addresses.city,
          state: addresses.state,
          country: addresses.country,
          postalCode: addresses.postal_code,
          phone: addresses.phone
        };
      }

      // Load user's preferred payment method
      const { data: payment, error: paymentError } = await supabase
        .from('user_payment_methods')
        .select('*')
        .eq('user_id', $user.id)
        .eq('is_default', true)
        .single();

      if (payment) {
        formData.paymentMethod = payment.method;
      }
    } catch (e) {
      console.error('Error loading user defaults:', e);
    }
  }

  async function loadPaymentMethods() {
    const methods = [];

    if (product.payment_options.fiat) {
      methods.push(
        { value: 'card', label: 'Credit/Debit Card' },
        { value: 'bank', label: 'Bank Transfer' }
      );
    }

    if (product.payment_options.crypto) {
      product.payment_options.acceptedTokens.forEach((token: string) => {
        methods.push({
          value: `crypto_${token.toLowerCase()}`,
          label: `Pay with ${token}`
        });
      });
    }

    return methods;
  }

  async function loadShippingRates() {
    if (!formData.shippingAddress.country) return;

    try {
      const rates = await shippingService.getShippingRates(
        {
          name: seller.username,
          street: '',
          city: '',
          state: '',
          country: product.shipping_config.origin_country,
          postalCode: '',
          phone: ''
        },
        formData.shippingAddress,
        {
          weight: {
            value: product.shipping_config.weight.value * formData.quantity,
            unit: product.shipping_config.weight.unit
          },
          dimensions: product.shipping_config.dimensions,
          value: product.price * formData.quantity
        }
      );

      shippingRates = rates.map(rate => ({
        value: rate.service,
        label: `${rate.carrier} ${rate.service} (${formatCurrency(rate.rate, rate.currency)}) - ${rate.estimatedDays} days`
      }));
    } catch (e) {
      console.error('Error loading shipping rates:', e);
      error = 'Failed to load shipping rates';
    }
  }

  function formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  async function validateAddress() {
    try {
      const validation = await shippingService.validateAddress(formData.shippingAddress);
      if (!validation.isValid) {
        error = 'Invalid shipping address';
        return false;
      }
      return true;
    } catch (e) {
      console.error('Address validation error:', e);
      return false;
    }
  }

  async function handleSubmit() {
    if (!$user) return;

    try {
      loading = true;
      error = null;

      // Validate token access if required
      if (product.token_gated && !tokenAccess) {
        throw new Error('You do not have the required tokens to purchase this item');
      }

      // Validate address for physical products
      if (!product.is_digital && product.shipping_config.enabled) {
        const isValidAddress = await validateAddress();
        if (!isValidAddress) return;
      }

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('marketplace_orders')
        .insert({
          buyer_id: $user.id,
          seller_id: seller.id,
          product_id: product.id,
          quantity: formData.quantity,
          unit_price: product.price,
          currency: product.currency,
          shipping_address: !product.is_digital ? formData.shippingAddress : null,
          billing_address: formData.billingAddress.sameAsShipping 
            ? formData.shippingAddress 
            : formData.billingAddress,
          shipping_method: formData.selectedShipping,
          payment_method: formData.paymentMethod,
          payment_details: formData.paymentDetails,
          notes: formData.notes,
          status: 'pending'
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Initialize payment
      await paymentService.initializePayment(order.id, {
        amount: order.unit_price * order.quantity,
        currency: order.currency,
        method: order.payment_method,
        escrow: formData.paymentDetails.escrow
      });

      // Set up proxy shipping if requested
      if (formData.paymentDetails.proxyShipping) {
        await privacyService.createProxyShippingAddress(
          $user.id,
          formData.shippingAddress
        );
      }

      onSuccess(order.id);
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  $: if (formData.shippingAddress.country && !product?.is_digital) {
    loadShippingRates();
  }
</script>

<div class="max-w-4xl mx-auto">
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
    <h2 class="text-2xl font-bold mb-6">Checkout</h2>

    {#if error}
      <Alert variant="error" title="Error" message={error} class="mb-6" />
    {/if}

    {#if loading && !product}
      <div class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    {:else if product}
      <form on:submit|preventDefault={handleSubmit} class="space-y-8">
        <!-- Order Summary -->
        <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <h3 class="text-lg font-medium mb-4">Order Summary</h3>
          
          <div class="space-y-2">
            <div class="flex justify-between">
              <span>Product</span>
              <span>{product.title}</span>
            </div>
            
            <div class="flex justify-between">
              <span>Price</span>
              <span>{formatCurrency(product.price, product.currency)}</span>
            </div>

            {#if !product.is_digital}
              <div class="flex justify-between">
                <span>Quantity</span>
                <Input
                  type="number"
                  bind:value={formData.quantity}
                  min="1"
                  max={product.stock}
                  class="w-24"
                />
              </div>
            {/if}

            {#if formData.selectedShipping}
              <div class="flex justify-between">
                <span>Shipping</span>
                <span>{formData.selectedShipping}</span>
              </div>
            {/if}

            <div class="border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
              <div class="flex justify-between font-bold">
                <span>Total</span>
                <span>
                  {formatCurrency(
                    product.price * formData.quantity,
                    product.currency
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {#if !product.is_digital}
          <!-- Shipping Address -->
          <div class="space-y-4">
            <h3 class="text-lg font-medium">Shipping Address</h3>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Full Name"
                bind:value={formData.shippingAddress.name}
                required
              />
              
              <Input
                label="Phone Number"
                bind:value={formData.shippingAddress.phone}
                required
              />
              
              <div class="md:col-span-2">
                <Input
                  label="Street Address"
                  bind:value={formData.shippingAddress.street}
                  required
                />
              </div>
              
              <Input
                label="City"
                bind:value={formData.shippingAddress.city}
                required
              />
              
              <Input
                label="State/Province"
                bind:value={formData.shippingAddress.state}
                required
              />
              
              <Input
                label="Postal Code"
                bind:value={formData.shippingAddress.postalCode}
                required
              />
              
              <Input
                label="Country"
                bind:value={formData.shippingAddress.country}
                required
              />
            </div>

            <!-- Shipping Method -->
            {#if shippingRates.length > 0}
              <div class="mt-4">
                <Select
                  label="Shipping Method"
                  options={shippingRates}
                  bind:value={formData.selectedShipping}
                  required
                />
              </div>
            {/if}
          </div>
        {/if}

        <!-- Billing Address -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-medium">Billing Address</h3>
            {#if !product.is_digital}
              <label class="flex items-center space-x-2">
                <input
                  type="checkbox"
                  bind:checked={formData.billingAddress.sameAsShipping}
                  class="rounded border-gray-300 dark:border-gray-600"
                />
                <span>Same as shipping address</span>
              </label>
            {/if}
          </div>

          {#if !formData.billingAddress.sameAsShipping}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Full Name"
                bind:value={formData.billingAddress.name}
                required
              />
              
              <div class="md:col-span-2">
                <Input
                  label="Street Address"
                  bind:value={formData.billingAddress.street}
                  required
                />
              </div>
              
              <Input
                label="City"
                bind:value={formData.billingAddress.city}
                required
              />
              
              <Input
                label="State/Province"
                bind:value={formData.billingAddress.state}
                required
              />
              
              <Input
                label="Postal Code"
                bind:value={formData.billingAddress.postalCode}
                required
              />
              
              <Input
                label="Country"
                bind:value={formData.billingAddress.country}
                required
              />
            </div>
          {/if}
        </div>

        <!-- Payment Method -->
        <div class="space-y-4">
          <h3 class="text-lg font-medium">Payment Method</h3>

          <Select
            label="Select Payment Method"
            options={paymentMethods}
            bind:value={formData.paymentMethod}
            required
          />

          {#if formData.paymentMethod.startsWith('crypto_')}
            <Input
              label="Wallet Address"
              bind:value={formData.paymentDetails.walletAddress}
              placeholder="0x..."
              required
            />

            <label class="flex items-center space-x-2">
              <input
                type="checkbox"
                bind:checked={formData.paymentDetails.escrow}
                class="rounded border-gray-300 dark:border-gray-600"
              />
              <span>Use Escrow Service</span>
            </label>
          {/if}

          {#if !product.is_digital}
            <label class="flex items-center space-x-2">
              <input
                type="checkbox"
                bind:checked={formData.paymentDetails.proxyShipping}
                class="rounded border-gray-300 dark:border-gray-600"
              />
              <span>Use Private Shipping Address</span>
            </label>
          {/if}
        </div>

        <!-- Order Notes -->
        <div>
          <label class="block text-sm font-medium mb-2">Order Notes (Optional)</label>
          <textarea
            bind:value={formData.notes}
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-3 h-32"
            placeholder="Any special instructions for the seller..."
          ></textarea>
        </div>

        <!-- Submit -->
        <div class="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            loading={loading}
          >
            Place Order
          </Button>
        </div>
      </form>
    {/if}
  </div>
</div>

<style>
  textarea {
    @apply focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-gray-700 dark:text-white;
  }

  input[type="checkbox"] {
    @apply text-emerald-500 focus:ring-emerald-500;
  }
</style> 