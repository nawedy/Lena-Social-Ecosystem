<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { supabase } from '$lib/supabaseClient';
  import { Button, Badge, Alert } from '$lib/components/ui';
  import { PaymentService } from '$lib/services/PaymentService';
  import { ShippingService } from '$lib/services/ShippingService';
  import { DisputeService } from '$lib/services/DisputeService';
  import { formatCurrency } from '$lib/utils/currency';
  import { ipfsToHttps } from '$lib/utils/ipfs';

  let order: any = null;
  let loading = true;
  let error: string | null = null;
  let trackingInfo: any = null;
  let showDisputeForm = false;
  let disputeReason = '';
  let disputeDescription = '';
  let disputeEvidence: File[] = [];

  const paymentService = new PaymentService();
  const shippingService = new ShippingService();
  const disputeService = new DisputeService();

  onMount(async () => {
    try {
      // Fetch order details
      const { data: orderData, error: orderError } = await supabase
        .from('marketplace_orders')
        .select(`
          *,
          product:product_id(*),
          buyer:buyer_id(*),
          seller:seller_id(*)
        `)
        .eq('id', $page.params.id)
        .single();

      if (orderError) throw orderError;
      order = orderData;

      // Get tracking info if available
      if (order.tracking_number) {
        trackingInfo = await shippingService.getTrackingInfo(
          order.shipping_carrier,
          order.tracking_number
        );
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  });

  async function handleDispute() {
    if (!order) return;
    
    try {
      const evidence = await Promise.all(
        disputeEvidence.map(async (file) => {
          const formData = new FormData();
          formData.append('file', file);
          
          const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
          });
          
          const { url } = await response.json();
          return {
            type: file.type.startsWith('image/') ? 'image' : 'document',
            content: url,
            timestamp: new Date().toISOString(),
            submittedBy: order.buyer_id
          };
        })
      );

      await disputeService.createDispute(
        order.id,
        disputeReason,
        disputeDescription,
        evidence
      );

      showDisputeForm = false;
      window.location.reload();
    } catch (e: any) {
      error = e.message;
    }
  }

  async function handleRefundRequest() {
    if (!order) return;
    
    try {
      // Generate return label
      const returnLabel = await shippingService.generateReturnLabel(
        order.id,
        order.shipping_address,
        order.seller.shipping_address
      );

      // Update order status
      await supabase
        .from('marketplace_orders')
        .update({
          status: 'return_pending',
          return_label_url: returnLabel.label_url
        })
        .eq('id', order.id);

      window.location.reload();
    } catch (e: any) {
      error = e.message;
    }
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'pending':
      case 'processing':
        return 'warning';
      case 'shipped':
      case 'completed':
        return 'success';
      case 'cancelled':
      case 'refunded':
        return 'error';
      case 'disputed':
        return 'error';
      default:
        return 'secondary';
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

<div class="container mx-auto px-4 py-8">
  {#if loading}
    <div class="flex justify-center items-center min-h-[400px]">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  {:else if error}
    <Alert variant="error" title="Error" message={error} />
  {:else if order}
    <div class="max-w-4xl mx-auto space-y-8">
      <!-- Order Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold">Order #{order.id}</h1>
          <p class="text-gray-600">Placed on {formatDate(order.created_at)}</p>
        </div>
        <Badge
          variant={getStatusColor(order.status)}
          label={order.status.replace('_', ' ').toUpperCase()}
        />
      </div>

      <!-- Product Details -->
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center space-x-4">
          <img
            src={ipfsToHttps(order.product.images[0])}
            alt={order.product.title}
            class="w-24 h-24 rounded-lg object-cover"
          />
          <div>
            <h2 class="text-xl font-semibold">{order.product.title}</h2>
            <p class="text-gray-600">{formatCurrency(order.amount, order.currency)}</p>
          </div>
        </div>
      </div>

      <!-- Shipping Information -->
      {#if order.shipping_address}
        <div class="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 class="text-xl font-semibold">Shipping Information</h2>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <h3 class="font-medium">Shipping Address</h3>
              <p>{order.shipping_address.name}</p>
              <p>{order.shipping_address.street}</p>
              <p>
                {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.postalCode}
              </p>
              <p>{order.shipping_address.country}</p>
            </div>
            {#if order.tracking_number}
              <div>
                <h3 class="font-medium">Tracking Information</h3>
                <p>Carrier: {order.shipping_carrier}</p>
                <p>Tracking Number: {order.tracking_number}</p>
                {#if trackingInfo}
                  <p>Status: {trackingInfo.status}</p>
                  <p>Location: {trackingInfo.location}</p>
                  <p>Last Update: {formatDate(trackingInfo.timestamp)}</p>
                {/if}
              </div>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Payment Information -->
      <div class="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 class="text-xl font-semibold">Payment Information</h2>
        <div class="space-y-2">
          <p>Payment Method: {order.payment_method}</p>
          {#if order.escrow_id}
            <p>Escrow ID: {order.escrow_id}</p>
          {/if}
          <p>Amount: {formatCurrency(order.amount, order.currency)}</p>
          {#if order.shipping_cost}
            <p>Shipping Cost: {formatCurrency(order.shipping_cost, order.currency)}</p>
          {/if}
          <p class="font-semibold">
            Total: {formatCurrency(order.amount + (order.shipping_cost || 0), order.currency)}
          </p>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex justify-end space-x-4">
        {#if order.status === 'shipped' && !order.disputed}
          <Button
            variant="secondary"
            on:click={() => showDisputeForm = true}
          >
            Open Dispute
          </Button>
        {/if}
        {#if order.status === 'shipped' && !order.return_requested}
          <Button
            variant="secondary"
            on:click={handleRefundRequest}
          >
            Request Refund
          </Button>
        {/if}
        {#if order.return_label_url}
          <Button
            variant="primary"
            href={order.return_label_url}
            target="_blank"
          >
            Download Return Label
          </Button>
        {/if}
      </div>

      <!-- Dispute Form -->
      {#if showDisputeForm}
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div class="bg-white rounded-lg p-6 max-w-lg w-full space-y-4">
            <h2 class="text-xl font-semibold">Open Dispute</h2>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium mb-1">Reason</label>
                <select
                  class="w-full rounded-lg border p-2"
                  bind:value={disputeReason}
                >
                  <option value="">Select a reason</option>
                  <option value="not_received">Item Not Received</option>
                  <option value="not_as_described">Item Not as Described</option>
                  <option value="damaged">Item Damaged</option>
                  <option value="wrong_item">Wrong Item Received</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">Description</label>
                <textarea
                  class="w-full rounded-lg border p-2 h-32"
                  bind:value={disputeDescription}
                  placeholder="Please provide details about your dispute..."
                />
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">Evidence</label>
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx"
                  on:change={(e) => disputeEvidence = Array.from(e.target.files)}
                />
              </div>
              <div class="flex justify-end space-x-4">
                <Button
                  variant="secondary"
                  on:click={() => showDisputeForm = false}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  disabled={!disputeReason || !disputeDescription}
                  on:click={handleDispute}
                >
                  Submit Dispute
                </Button>
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div> 