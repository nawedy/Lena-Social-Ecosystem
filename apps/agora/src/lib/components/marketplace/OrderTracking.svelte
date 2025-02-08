<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { supabase } from '$lib/supabaseClient';
  import { Button, Alert, Badge } from '$lib/components/ui';
  import { ShippingService } from '$lib/services/ShippingService';

  export let orderId: string;

  let loading = false;
  let error: string | null = null;
  let order: any = null;
  let trackingInfo: any = null;
  let estimatedDelivery: string | null = null;

  const shippingService = new ShippingService();

  const steps = [
    { status: 'pending', label: 'Order Placed' },
    { status: 'paid', label: 'Payment Confirmed' },
    { status: 'processing', label: 'Processing' },
    { status: 'shipped', label: 'Shipped' },
    { status: 'delivered', label: 'Delivered' },
    { status: 'completed', label: 'Completed' }
  ];

  onMount(async () => {
    await loadOrder();
    if (order?.tracking_number) {
      await loadTrackingInfo();
    }
    setupRealtimeSubscription();
  });

  function setupRealtimeSubscription() {
    const channel = supabase
      .channel(`order_${orderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'marketplace_orders',
          filter: `id=eq.${orderId}`
        },
        async (payload) => {
          const { new: newOrder } = payload;
          order = newOrder;
          if (newOrder.tracking_number) {
            await loadTrackingInfo();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  async function loadOrder() {
    try {
      loading = true;
      error = null;

      const { data, error: fetchError } = await supabase
        .from('marketplace_orders')
        .select(`
          *,
          product:product_id (*),
          seller:seller_id (*)
        `)
        .eq('id', orderId)
        .single();

      if (fetchError) throw fetchError;
      order = data;

      // Calculate estimated delivery if shipped
      if (order.shipped_at) {
        const estimate = await shippingService.estimateDeliveryTime(
          order.shipping_address,
          order.shipping_method
        );
        estimatedDelivery = estimate.guaranteedDate;
      }
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function loadTrackingInfo() {
    try {
      const info = await shippingService.getTrackingInfo(
        order.shipping_carrier,
        order.tracking_number
      );
      trackingInfo = info;
    } catch (e) {
      console.error('Error loading tracking info:', e);
    }
  }

  function getStepStatus(status: string): 'completed' | 'current' | 'upcoming' {
    const currentIndex = steps.findIndex(step => step.status === order.status);
    const stepIndex = steps.findIndex(step => step.status === status);

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'upcoming';
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500';
      case 'current':
        return 'bg-blue-500';
      default:
        return 'bg-gray-300 dark:bg-gray-600';
    }
  }

  function formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
</script>

<div class="max-w-3xl mx-auto">
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-8">
    {#if error}
      <Alert variant="error" title="Error" message={error} />
    {/if}

    {#if loading && !order}
      <div class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    {:else if order}
      <!-- Order Info -->
      <div class="flex justify-between items-start">
        <div>
          <h2 class="text-2xl font-bold mb-2">Order Tracking</h2>
          <p class="text-gray-500">Order #{order.id}</p>
        </div>
        <Badge
          variant="outline"
          class="text-lg"
        >
          {order.status}
        </Badge>
      </div>

      <!-- Progress Timeline -->
      <div class="relative">
        <div class="absolute left-0 top-5 w-full h-0.5 bg-gray-200 dark:bg-gray-700"></div>
        
        <div class="relative flex justify-between">
          {#each steps as step}
            {@const status = getStepStatus(step.status)}
            <div class="flex flex-col items-center">
              <div
                class={`w-10 h-10 rounded-full flex items-center justify-center relative z-10 ${getStatusColor(status)}`}
              >
                {#if status === 'completed'}
                  <svg class="w-6 h-6 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                {:else if status === 'current'}
                  <div class="w-3 h-3 bg-white rounded-full"></div>
                {/if}
              </div>
              <div class="mt-2 text-sm text-center">
                {step.label}
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Shipping Details -->
      {#if !order.product.is_digital}
        <div class="space-y-4">
          <h3 class="text-lg font-medium">Shipping Details</h3>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <div class="text-sm text-gray-500">Delivery Address</div>
              <div class="mt-1">
                {order.shipping_address.name}<br>
                {order.shipping_address.street}<br>
                {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.postalCode}<br>
                {order.shipping_address.country}
              </div>
            </div>

            <div>
              <div class="text-sm text-gray-500">Shipping Method</div>
              <div class="mt-1">{order.shipping_method}</div>

              {#if estimatedDelivery}
                <div class="mt-4">
                  <div class="text-sm text-gray-500">Estimated Delivery</div>
                  <div class="mt-1">{formatDate(estimatedDelivery)}</div>
                </div>
              {/if}
            </div>
          </div>

          {#if order.tracking_number}
            <div class="mt-6 space-y-4">
              <div class="flex justify-between items-center">
                <div>
                  <div class="text-sm text-gray-500">Tracking Number</div>
                  <div class="mt-1">{order.tracking_number}</div>
                </div>
                
                <a
                  href={order.tracking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Track Package →
                </a>
              </div>

              {#if trackingInfo}
                <div class="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                  <h4 class="font-medium mb-4">Tracking Updates</h4>
                  
                  <div class="space-y-4">
                    {#each trackingInfo.updates as update}
                      <div class="flex items-start gap-4">
                        <div class="w-32 flex-shrink-0 text-sm text-gray-500">
                          {formatDate(update.timestamp)}
                        </div>
                        <div>
                          <div class="font-medium">{update.status}</div>
                          {#if update.location}
                            <div class="text-sm text-gray-500">{update.location}</div>
                          {/if}
                        </div>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Digital Product -->
      {#if order.product.is_digital && order.status === 'completed'}
        <div class="space-y-4">
          <h3 class="text-lg font-medium">Download</h3>
          <p class="text-gray-500">Your digital product is ready for download</p>
          
          <Button
            variant="primary"
            href={order.download_url}
            target="_blank"
          >
            Download Product
          </Button>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  /* Add any component-specific styles here */
</style> 