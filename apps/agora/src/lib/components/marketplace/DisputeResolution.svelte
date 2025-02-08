<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { supabase } from '$lib/supabaseClient';
  import { Button, Input, Select, Alert, Badge } from '$lib/components/ui';
  import { user } from '$lib/stores/auth';
  import { DisputeService } from '$lib/services/DisputeService';
  import { PaymentService } from '$lib/services/PaymentService';

  export let orderId: string;
  export let onResolved: () => void = () => {};

  let loading = false;
  let error: string | null = null;
  let order: any = null;
  let dispute: any = null;
  let messages: any[] = [];
  let evidence: any[] = [];
  let newMessage = '';
  let newEvidence = {
    type: 'text',
    content: '',
    files: [] as File[]
  };

  const disputeService = new DisputeService();
  const paymentService = new PaymentService();

  const disputeReasons = [
    { value: 'not_received', label: 'Item Not Received' },
    { value: 'not_as_described', label: 'Item Not as Described' },
    { value: 'damaged', label: 'Item Damaged' },
    { value: 'wrong_item', label: 'Wrong Item Received' },
    { value: 'quality', label: 'Quality Issues' },
    { value: 'other', label: 'Other' }
  ];

  onMount(async () => {
    await loadDispute();
    setupRealtimeSubscription();
  });

  function setupRealtimeSubscription() {
    const channel = supabase
      .channel(`dispute_${orderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'marketplace_disputes',
          filter: `order_id=eq.${orderId}`
        },
        (payload) => {
          handleDisputeUpdate(payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'dispute_messages',
          filter: `dispute_id=eq.${dispute?.id}`
        },
        (payload) => {
          messages = [...messages, payload.new];
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'dispute_evidence',
          filter: `dispute_id=eq.${dispute?.id}`
        },
        (payload) => {
          evidence = [...evidence, payload.new];
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  function handleDisputeUpdate(payload: any) {
    const { eventType, new: newDispute } = payload;
    dispute = newDispute;
  }

  async function loadDispute() {
    try {
      loading = true;
      error = null;

      // Load order details
      const { data: orderData, error: orderError } = await supabase
        .from('marketplace_orders')
        .select(`
          *,
          product:product_id (*),
          buyer:buyer_id (*),
          seller:seller_id (*)
        `)
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;
      order = orderData;

      // Load dispute details
      const { data: disputeData, error: disputeError } = await supabase
        .from('marketplace_disputes')
        .select('*')
        .eq('order_id', orderId)
        .single();

      if (disputeError && disputeError.code !== 'PGRST116') throw disputeError;
      dispute = disputeData;

      if (dispute) {
        await Promise.all([
          loadMessages(),
          loadEvidence()
        ]);
      }
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function loadMessages() {
    const { data, error: messagesError } = await supabase
      .from('dispute_messages')
      .select('*')
      .eq('dispute_id', dispute.id)
      .order('created_at', { ascending: true });

    if (messagesError) throw messagesError;
    messages = data || [];
  }

  async function loadEvidence() {
    const { data, error: evidenceError } = await supabase
      .from('dispute_evidence')
      .select('*')
      .eq('dispute_id', dispute.id)
      .order('created_at', { ascending: true });

    if (evidenceError) throw evidenceError;
    evidence = data || [];
  }

  async function createDispute() {
    try {
      loading = true;
      error = null;

      dispute = await disputeService.createDispute(
        orderId,
        newEvidence.type === 'text' ? newEvidence.content : '',
        evidence
      );

      // Reset form
      newEvidence = {
        type: 'text',
        content: '',
        files: []
      };
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function sendMessage() {
    if (!newMessage.trim()) return;

    try {
      loading = true;
      error = null;

      await disputeService.sendMessage(dispute.id, {
        senderId: $user?.id,
        content: newMessage,
        timestamp: new Date().toISOString()
      });

      newMessage = '';
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function addEvidence() {
    try {
      loading = true;
      error = null;

      await disputeService.addEvidence(dispute.id, {
        type: newEvidence.type,
        content: newEvidence.content,
        timestamp: new Date().toISOString(),
        submittedBy: $user?.id
      });

      // Reset form
      newEvidence = {
        type: 'text',
        content: '',
        files: []
      };
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function resolveDispute(resolution: 'refund' | 'release' | 'partial_refund') {
    try {
      loading = true;
      error = null;

      await disputeService.resolveDispute(dispute.id, {
        decision: resolution,
        reason: 'Dispute resolved by agreement',
        mediatorId: null,
        timestamp: new Date().toISOString()
      });

      // Handle payment based on resolution
      if (resolution === 'refund') {
        await paymentService.refundPayment(orderId);
      } else if (resolution === 'release') {
        await paymentService.releaseEscrow(orderId);
      } else if (resolution === 'partial_refund') {
        await paymentService.partialRefund(orderId, dispute.partial_refund_amount);
      }

      onResolved();
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function escalateDispute() {
    try {
      loading = true;
      error = null;

      await disputeService.escalateDispute(dispute.id);
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
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

  function isOwnMessage(senderId: string): boolean {
    return senderId === $user?.id;
  }
</script>

<div class="max-w-4xl mx-auto">
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-8">
    {#if error}
      <Alert variant="error" title="Error" message={error} />
    {/if}

    {#if loading && !order}
      <div class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    {:else if order}
      <!-- Header -->
      <div class="flex justify-between items-start">
        <div>
          <h2 class="text-2xl font-bold mb-2">
            {dispute ? 'Dispute Resolution' : 'Open Dispute'}
          </h2>
          <p class="text-gray-500">Order #{order.id}</p>
        </div>
        {#if dispute}
          <Badge
            variant="outline"
            class="text-lg"
          >
            {dispute.status}
          </Badge>
        {/if}
      </div>

      <!-- Order Summary -->
      <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
        <h3 class="text-lg font-medium mb-4">Order Summary</h3>
        
        <div class="grid grid-cols-2 gap-4">
          <div>
            <div class="text-sm text-gray-500">Product</div>
            <div class="mt-1">{order.product.title}</div>
          </div>
          
          <div>
            <div class="text-sm text-gray-500">Price</div>
            <div class="mt-1">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: order.currency
              }).format(order.unit_price * order.quantity)}
            </div>
          </div>
          
          <div>
            <div class="text-sm text-gray-500">Seller</div>
            <div class="mt-1">{order.seller.name}</div>
          </div>
          
          <div>
            <div class="text-sm text-gray-500">Buyer</div>
            <div class="mt-1">{order.buyer.name}</div>
          </div>
        </div>
      </div>

      {#if !dispute}
        <!-- Open Dispute Form -->
        <form
          class="space-y-6"
          on:submit|preventDefault={createDispute}
        >
          <div>
            <Select
              label="Reason for Dispute"
              options={disputeReasons}
              bind:value={newEvidence.type}
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">
              Describe the Issue
            </label>
            <textarea
              bind:value={newEvidence.content}
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-3 min-h-[200px]"
              placeholder="Please provide details about your issue..."
              required
            ></textarea>
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">
              Supporting Evidence
            </label>
            <Input
              type="file"
              multiple
              accept="image/*,video/*,.pdf"
              on:change={(e) => {
                newEvidence.files = Array.from(e.target.files || []);
              }}
            />
            <p class="mt-1 text-sm text-gray-500">
              Upload photos, videos, or documents that support your case
            </p>
          </div>

          <div class="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              loading={loading}
            >
              Open Dispute
            </Button>
          </div>
        </form>
      {:else}
        <!-- Dispute Details -->
        <div class="space-y-8">
          <!-- Messages -->
          <div class="space-y-4">
            <h3 class="text-lg font-medium">Messages</h3>

            <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 h-96 overflow-y-auto">
              <div class="space-y-4">
                {#each messages as message}
                  <div
                    class="flex gap-4"
                    class:justify-end={isOwnMessage(message.sender_id)}
                  >
                    <div
                      class="max-w-[70%] rounded-lg p-3"
                      class:bg-emerald-500={isOwnMessage(message.sender_id)}
                      class:text-white={isOwnMessage(message.sender_id)}
                      class:bg-gray-200={!isOwnMessage(message.sender_id)}
                      class:dark:bg-gray-600={!isOwnMessage(message.sender_id)}
                    >
                      <div class="text-sm mb-1">
                        {isOwnMessage(message.sender_id) ? 'You' : message.sender_id === order.seller.id ? 'Seller' : 'Buyer'}
                      </div>
                      <div>{message.content}</div>
                      <div class="text-xs mt-1 opacity-75">
                        {formatDate(message.timestamp)}
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            </div>

            <div class="flex gap-4">
              <Input
                type="text"
                placeholder="Type your message..."
                bind:value={newMessage}
                class="flex-1"
              />
              <Button
                variant="primary"
                on:click={sendMessage}
                disabled={!newMessage.trim() || loading}
              >
                Send
              </Button>
            </div>
          </div>

          <!-- Evidence -->
          <div class="space-y-4">
            <h3 class="text-lg font-medium">Evidence</h3>

            <div class="space-y-4">
              {#each evidence as item}
                <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div class="flex justify-between items-start">
                    <div>
                      <div class="font-medium">
                        {item.type === 'text' ? 'Written Statement' : 'File Evidence'}
                      </div>
                      <div class="text-sm text-gray-500">
                        Submitted by {item.submitted_by === order.seller.id ? 'Seller' : 'Buyer'}
                      </div>
                    </div>
                    <div class="text-sm text-gray-500">
                      {formatDate(item.timestamp)}
                    </div>
                  </div>

                  {#if item.type === 'text'}
                    <div class="mt-2">{item.content}</div>
                  {:else}
                    <div class="mt-2">
                      <a
                        href={item.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        View Evidence →
                      </a>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>

            <!-- Add Evidence -->
            <div class="mt-4">
              <Button
                variant="outline"
                on:click={addEvidence}
                disabled={loading}
              >
                Add Evidence
              </Button>
            </div>
          </div>

          <!-- Actions -->
          <div class="space-y-4">
            <h3 class="text-lg font-medium">Resolution</h3>

            <div class="flex flex-wrap gap-4">
              <Button
                variant="primary"
                on:click={() => resolveDispute('refund')}
                disabled={loading}
              >
                Issue Full Refund
              </Button>

              <Button
                variant="primary"
                on:click={() => resolveDispute('release')}
                disabled={loading}
              >
                Release Payment
              </Button>

              <Button
                variant="outline"
                on:click={() => resolveDispute('partial_refund')}
                disabled={loading}
              >
                Partial Refund
              </Button>

              <Button
                variant="outline"
                on:click={escalateDispute}
                disabled={loading}
              >
                Escalate to Support
              </Button>
            </div>
          </div>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  /* Add any component-specific styles here */
</style> 