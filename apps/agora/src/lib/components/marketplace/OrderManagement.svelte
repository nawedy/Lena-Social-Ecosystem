<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { supabase } from '$lib/supabaseClient';
  import { Button, Input, Select, Alert, Badge } from '$lib/components/ui';
  import { user } from '$lib/stores/auth';
  import { PaymentService } from '$lib/services/PaymentService';
  import { ShippingService } from '$lib/services/ShippingService';
  import { DisputeService } from '$lib/services/DisputeService';

  export let view: 'seller' | 'buyer' = 'seller';

  let loading = false;
  let error: string | null = null;
  let orders: any[] = [];
  let selectedOrder: any = null;
  let filterStatus = 'all';
  let searchQuery = '';
  let page = 1;
  let hasMore = true;

  const PAGE_SIZE = 10;

  const orderStatuses = [
    { value: 'all', label: 'All Orders' },
    { value: 'pending', label: 'Pending' },
    { value: 'paid', label: 'Paid' },
    { value: 'processing', label: 'Processing' },
    { value: 'shipped', label: 'Shipped' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'disputed', label: 'Disputed' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  const paymentService = new PaymentService();
  const shippingService = new ShippingService();
  const disputeService = new DisputeService();

  onMount(async () => {
    await loadOrders();
    // Set up real-time updates
    setupRealtimeSubscription();
  });

  function setupRealtimeSubscription() {
    const channel = supabase
      .channel('order_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'marketplace_orders',
          filter: view === 'seller' 
            ? `seller_id=eq.${$user?.id}`
            : `buyer_id=eq.${$user?.id}`
        },
        (payload) => {
          handleOrderUpdate(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  function handleOrderUpdate(payload: any) {
    const { eventType, new: newOrder, old: oldOrder } = payload;

    switch (eventType) {
      case 'INSERT':
        orders = [newOrder, ...orders];
        break;
      case 'UPDATE':
        orders = orders.map(order => 
          order.id === newOrder.id ? newOrder : order
        );
        if (selectedOrder?.id === newOrder.id) {
          selectedOrder = newOrder;
        }
        break;
      case 'DELETE':
        orders = orders.filter(order => order.id !== oldOrder.id);
        if (selectedOrder?.id === oldOrder.id) {
          selectedOrder = null;
        }
        break;
    }
  }

  async function loadOrders(reset = false) {
    if (reset) {
      page = 1;
      orders = [];
      hasMore = true;
    }

    if (!hasMore || !$user) return;

    try {
      loading = true;
      error = null;

      let query = supabase
        .from('marketplace_orders')
        .select(`
          *,
          product:product_id (
            title,
            price,
            currency,
            is_digital
          ),
          ${view === 'seller' ? 'buyer:buyer_id (*)' : 'seller:seller_id (*)'}
        `)
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (view === 'seller') {
        query = query.eq('seller_id', $user.id);
      } else {
        query = query.eq('buyer_id', $user.id);
      }

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      if (searchQuery) {
        query = query.or(`
          product.title.ilike.%${searchQuery}%,
          id.eq.${searchQuery}
        `);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      orders = page === 1 ? data : [...orders, ...data];
      hasMore = data.length === PAGE_SIZE;
      page++;
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function handleAction(action: string, order: any) {
    try {
      loading = true;
      error = null;

      switch (action) {
        case 'accept':
          await acceptOrder(order);
          break;
        case 'reject':
          await rejectOrder(order);
          break;
        case 'ship':
          await shipOrder(order);
          break;
        case 'cancel':
          await cancelOrder(order);
          break;
        case 'refund':
          await refundOrder(order);
          break;
        case 'complete':
          await completeOrder(order);
          break;
        case 'dispute':
          await disputeOrder(order);
          break;
      }

      // Refresh order details
      const { data: updatedOrder, error: orderError } = await supabase
        .from('marketplace_orders')
        .select('*')
        .eq('id', order.id)
        .single();

      if (orderError) throw orderError;
      selectedOrder = updatedOrder;

    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function acceptOrder(order: any) {
    // Verify payment first
    const paymentVerified = await paymentService.verifyPayment(order.id);
    if (!paymentVerified) {
      throw new Error('Payment verification failed');
    }

    // Update order status
    const { error: updateError } = await supabase
      .from('marketplace_orders')
      .update({ status: 'processing' })
      .eq('id', order.id);

    if (updateError) throw updateError;
  }

  async function rejectOrder(order: any) {
    // Refund payment if already made
    if (order.payment_status === 'paid') {
      await paymentService.refundPayment(order.id);
    }

    // Update order status
    const { error: updateError } = await supabase
      .from('marketplace_orders')
      .update({ 
        status: 'rejected',
        rejection_reason: order.rejection_reason 
      })
      .eq('id', order.id);

    if (updateError) throw updateError;
  }

  async function shipOrder(order: any) {
    // Create shipping label
    const label = await shippingService.createShipment(
      order.id,
      order.shipping_address,
      order.shipping_method
    );

    // Update order with tracking info
    const { error: updateError } = await supabase
      .from('marketplace_orders')
      .update({
        status: 'shipped',
        tracking_number: label.tracking_number,
        tracking_url: label.tracking_url,
        shipped_at: new Date().toISOString()
      })
      .eq('id', order.id);

    if (updateError) throw updateError;
  }

  async function cancelOrder(order: any) {
    // Refund payment if already made
    if (order.payment_status === 'paid') {
      await paymentService.refundPayment(order.id);
    }

    // Update order status
    const { error: updateError } = await supabase
      .from('marketplace_orders')
      .update({ 
        status: 'cancelled',
        cancellation_reason: order.cancellation_reason 
      })
      .eq('id', order.id);

    if (updateError) throw updateError;
  }

  async function refundOrder(order: any) {
    // Process refund
    await paymentService.refundPayment(order.id);

    // Update order status
    const { error: updateError } = await supabase
      .from('marketplace_orders')
      .update({ 
        status: 'refunded',
        refund_reason: order.refund_reason 
      })
      .eq('id', order.id);

    if (updateError) throw updateError;
  }

  async function completeOrder(order: any) {
    // Release payment to seller if using escrow
    if (order.payment_details.escrow) {
      await paymentService.releaseEscrow(order.id);
    }

    // Update order status
    const { error: updateError } = await supabase
      .from('marketplace_orders')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', order.id);

    if (updateError) throw updateError;
  }

  async function disputeOrder(order: any) {
    // Create dispute
    await disputeService.createDispute(
      order.id,
      order.dispute_reason,
      order.dispute_description
    );

    // Update order status
    const { error: updateError } = await supabase
      .from('marketplace_orders')
      .update({ status: 'disputed' })
      .eq('id', order.id);

    if (updateError) throw updateError;
  }

  function formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'paid':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'processing':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'shipped':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200';
      case 'delivered':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'completed':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200';
      case 'disputed':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'cancelled':
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  }

  $: filteredOrders = orders;
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <h2 class="text-2xl font-bold">
      {view === 'seller' ? 'Manage Orders' : 'My Orders'}
    </h2>

    <div class="flex items-center gap-4">
      <Select
        options={orderStatuses}
        bind:value={filterStatus}
        class="w-40"
      />

      <Input
        type="search"
        placeholder="Search orders..."
        bind:value={searchQuery}
        class="w-64"
      />
    </div>
  </div>

  {#if error}
    <Alert variant="error" title="Error" message={error} />
  {/if}

  <!-- Orders List -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <!-- Orders List -->
    <div class="lg:col-span-1 space-y-4">
      {#each filteredOrders as order (order.id)}
        <button
          class="w-full text-left p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-emerald-500 dark:hover:border-emerald-500 transition-colors"
          class:bg-emerald-50={selectedOrder?.id === order.id}
          on:click={() => selectedOrder = order}
        >
          <div class="flex justify-between items-start">
            <div class="space-y-1">
              <div class="font-medium">{order.product.title}</div>
              <div class="text-sm text-gray-500">
                Order #{order.id.slice(0, 8)}
              </div>
              <div class="text-sm">
                {formatCurrency(
                  order.unit_price * order.quantity,
                  order.currency
                )}
              </div>
            </div>
            <Badge
              variant="outline"
              class={getStatusColor(order.status)}
            >
              {order.status}
            </Badge>
          </div>
        </button>
      {/each}

      {#if loading}
        <div class="flex justify-center py-4">
          <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500"></div>
        </div>
      {/if}

      {#if hasMore}
        <button
          class="w-full py-2 text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
          on:click={() => loadOrders()}
          disabled={loading}
        >
          Load More
        </button>
      {/if}
    </div>

    <!-- Order Details -->
    <div class="lg:col-span-2">
      {#if selectedOrder}
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-6">
          <div class="flex justify-between items-start">
            <div>
              <h3 class="text-xl font-bold mb-2">
                Order Details
              </h3>
              <p class="text-gray-500">
                Order #{selectedOrder.id}
              </p>
            </div>
            <Badge
              variant="outline"
              class={getStatusColor(selectedOrder.status)}
            >
              {selectedOrder.status}
            </Badge>
          </div>

          <!-- Product Details -->
          <div class="space-y-4">
            <h4 class="font-medium">Product Information</h4>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <div class="text-sm text-gray-500">Product</div>
                <div>{selectedOrder.product.title}</div>
              </div>
              <div>
                <div class="text-sm text-gray-500">Quantity</div>
                <div>{selectedOrder.quantity}</div>
              </div>
              <div>
                <div class="text-sm text-gray-500">Price</div>
                <div>
                  {formatCurrency(
                    selectedOrder.unit_price,
                    selectedOrder.currency
                  )}
                </div>
              </div>
              <div>
                <div class="text-sm text-gray-500">Total</div>
                <div>
                  {formatCurrency(
                    selectedOrder.unit_price * selectedOrder.quantity,
                    selectedOrder.currency
                  )}
                </div>
              </div>
            </div>
          </div>

          <!-- Customer/Seller Details -->
          <div class="space-y-4">
            <h4 class="font-medium">
              {view === 'seller' ? 'Customer' : 'Seller'} Information
            </h4>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <div class="text-sm text-gray-500">Name</div>
                <div>
                  {view === 'seller' 
                    ? selectedOrder.buyer.name 
                    : selectedOrder.seller.name}
                </div>
              </div>
              <div>
                <div class="text-sm text-gray-500">Email</div>
                <div>
                  {view === 'seller'
                    ? selectedOrder.buyer.email
                    : selectedOrder.seller.email}
                </div>
              </div>
            </div>
          </div>

          <!-- Shipping Information -->
          {#if !selectedOrder.product.is_digital}
            <div class="space-y-4">
              <h4 class="font-medium">Shipping Information</h4>
              <div class="grid grid-cols-2 gap-4">
                <div class="col-span-2">
                  <div class="text-sm text-gray-500">Address</div>
                  <div>
                    {selectedOrder.shipping_address.name}<br>
                    {selectedOrder.shipping_address.street}<br>
                    {selectedOrder.shipping_address.city}, {selectedOrder.shipping_address.state} {selectedOrder.shipping_address.postalCode}<br>
                    {selectedOrder.shipping_address.country}
                  </div>
                </div>
                <div>
                  <div class="text-sm text-gray-500">Method</div>
                  <div>{selectedOrder.shipping_method}</div>
                </div>
                {#if selectedOrder.tracking_number}
                  <div>
                    <div class="text-sm text-gray-500">Tracking</div>
                    <a
                      href={selectedOrder.tracking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      {selectedOrder.tracking_number}
                    </a>
                  </div>
                {/if}
              </div>
            </div>
          {/if}

          <!-- Payment Information -->
          <div class="space-y-4">
            <h4 class="font-medium">Payment Information</h4>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <div class="text-sm text-gray-500">Method</div>
                <div>{selectedOrder.payment_method}</div>
              </div>
              <div>
                <div class="text-sm text-gray-500">Status</div>
                <div>{selectedOrder.payment_status}</div>
              </div>
              {#if selectedOrder.payment_details.escrow}
                <div class="col-span-2">
                  <div class="text-sm text-gray-500">Escrow</div>
                  <div>Payment held in escrow</div>
                </div>
              {/if}
            </div>
          </div>

          <!-- Actions -->
          <div class="space-y-4">
            <h4 class="font-medium">Actions</h4>
            <div class="flex flex-wrap gap-4">
              {#if view === 'seller'}
                {#if selectedOrder.status === 'pending'}
                  <Button
                    variant="primary"
                    on:click={() => handleAction('accept', selectedOrder)}
                  >
                    Accept Order
                  </Button>
                  <Button
                    variant="outline"
                    on:click={() => handleAction('reject', selectedOrder)}
                  >
                    Reject Order
                  </Button>
                {:else if selectedOrder.status === 'processing'}
                  <Button
                    variant="primary"
                    on:click={() => handleAction('ship', selectedOrder)}
                  >
                    Mark as Shipped
                  </Button>
                {/if}
              {:else}
                {#if selectedOrder.status === 'delivered'}
                  <Button
                    variant="primary"
                    on:click={() => handleAction('complete', selectedOrder)}
                  >
                    Mark as Complete
                  </Button>
                {/if}
              {/if}

              {#if ['processing', 'shipped', 'delivered'].includes(selectedOrder.status)}
                <Button
                  variant="outline"
                  on:click={() => handleAction('dispute', selectedOrder)}
                >
                  Open Dispute
                </Button>
              {/if}

              {#if selectedOrder.status === 'pending'}
                <Button
                  variant="outline"
                  on:click={() => handleAction('cancel', selectedOrder)}
                >
                  Cancel Order
                </Button>
              {/if}
            </div>
          </div>
        </div>
      {:else}
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
          <p class="text-gray-500">
            Select an order to view details
          </p>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  /* Add any component-specific styles here */
</style> 