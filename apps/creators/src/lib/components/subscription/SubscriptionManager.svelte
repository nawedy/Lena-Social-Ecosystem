<!-- SubscriptionManager.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { subscriptionService } from '$lib/services/subscription/SubscriptionService';
  import { paymentService } from '$lib/services/payment/PaymentService';
  import Icon from '../shared/Icon.svelte';
  import Button from '../shared/Button.svelte';
  import Card from '../shared/Card.svelte';
  import Badge from '../shared/Badge.svelte';
  import Modal from '../shared/Modal.svelte';

  let subscription = subscriptionService.getSubscription();
  let tiers = subscriptionService.getTiers();
  let paymentMethods = subscriptionService.getPaymentMethods();
  let invoices = subscriptionService.getInvoices();
  let loading = false;
  let error: string | null = null;
  let showPaymentModal = false;
  let showCancelModal = false;
  let selectedTierId: string | null = null;
  let unsubscribe: () => void;

  onMount(() => {
    unsubscribe = subscriptionService.subscribe((data) => {
      subscription = data.subscription;
      tiers = data.tiers;
      paymentMethods = data.paymentMethods;
      invoices = data.invoices;
    });
  });

  onDestroy(() => {
    if (unsubscribe) unsubscribe();
  });

  async function handleSubscribe(tierId: string) {
    selectedTierId = tierId;
    if (!paymentMethods.length) {
      showPaymentModal = true;
    } else {
      await subscribe(tierId);
    }
  }

  async function handleAddPaymentMethod(e: CustomEvent) {
    try {
      loading = true;
      await paymentService.addPaymentMethod(e.detail.paymentMethodId, true);
      if (selectedTierId) {
        await subscribe(selectedTierId);
      }
      showPaymentModal = false;
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function subscribe(tierId: string) {
    try {
      loading = true;
      await subscriptionService.subscribe(tierId);
      selectedTierId = null;
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function handleCancel() {
    try {
      loading = true;
      await subscriptionService.cancelSubscription();
      showCancelModal = false;
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }
</script>

<div class="subscription-manager">
  <header class="header">
    <h1>Subscription Management</h1>
    <p class="subtitle">Manage your subscription and billing</p>
  </header>

  {#if error}
    <div class="error-message" transition:fade>
      <Icon name="alert-circle" />
      <p>{error}</p>
      <button on:click={() => error = null} aria-label="Dismiss">
        <Icon name="x" />
      </button>
    </div>
  {/if}

  <div class="content">
    {#if subscription}
      <Card>
        <div class="current-plan">
          <div class="plan-header">
            <h2>Current Plan</h2>
            <Badge type={subscription.status === 'active' ? 'success' : 'warning'}>
              {subscription.status}
            </Badge>
          </div>
          
          <div class="plan-details">
            <div class="detail">
              <span class="label">Plan</span>
              <span class="value">{tiers.find(t => t.id === subscription.tierId)?.name}</span>
            </div>
            <div class="detail">
              <span class="label">Billing Period</span>
              <span class="value">
                {formatDate(subscription.currentPeriodStart)} - {formatDate(subscription.currentPeriodEnd)}
              </span>
            </div>
            {#if subscription.cancelAtPeriodEnd}
              <div class="cancellation-notice">
                Your subscription will end on {formatDate(subscription.currentPeriodEnd)}
              </div>
            {:else}
              <Button
                variant="danger"
                on:click={() => showCancelModal = true}
              >
                Cancel Subscription
              </Button>
            {/if}
          </div>
        </div>
      </Card>

      <Card>
        <div class="payment-methods">
          <h2>Payment Methods</h2>
          <div class="methods-list">
            {#each paymentMethods as method}
              <div class="payment-method">
                <div class="method-info">
                  <Icon name={method.brand?.toLowerCase() || 'credit-card'} />
                  <span>•••• {method.last4}</span>
                  {#if method.isDefault}
                    <Badge type="info">Default</Badge>
                  {/if}
                </div>
                <div class="method-actions">
                  {#if !method.isDefault}
                    <Button
                      variant="text"
                      on:click={() => subscriptionService.setDefaultPaymentMethod(method.id)}
                    >
                      Make Default
                    </Button>
                  {/if}
                  <Button
                    variant="danger"
                    on:click={() => subscriptionService.removePaymentMethod(method.id)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            {/each}
            <Button
              variant="secondary"
              on:click={() => showPaymentModal = true}
            >
              Add Payment Method
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <div class="billing-history">
          <h2>Billing History</h2>
          <div class="invoices-list">
            {#each invoices as invoice}
              <div class="invoice">
                <div class="invoice-info">
                  <span class="date">{formatDate(invoice.createdAt)}</span>
                  <span class="amount">{formatCurrency(invoice.amount)}</span>
                  <Badge type={invoice.status === 'paid' ? 'success' : 'warning'}>
                    {invoice.status}
                  </Badge>
                </div>
                {#if invoice.pdfUrl}
                  <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer">
                    <Icon name="download" />
                    Download PDF
                  </a>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      </Card>
    {:else}
      <div class="plans-grid">
        {#each tiers as tier}
          <Card>
            <div class="plan">
              <div class="plan-header">
                <h3>{tier.name}</h3>
                {#if tier.isPopular}
                  <Badge type="primary">Popular</Badge>
                {/if}
              </div>
              <div class="price">
                <span class="amount">{formatCurrency(tier.price)}</span>
                <span class="period">/{tier.interval}</span>
              </div>
              <ul class="features">
                {#each tier.features as feature}
                  <li>
                    <Icon name="check" />
                    {feature}
                  </li>
                {/each}
              </ul>
              <Button
                variant="primary"
                fullWidth
                loading={loading && selectedTierId === tier.id}
                on:click={() => handleSubscribe(tier.id)}
              >
                Subscribe
              </Button>
            </div>
          </Card>
        {/each}
      </div>
    {/if}
  </div>
</div>

<Modal
  show={showPaymentModal}
  title="Add Payment Method"
  on:close={() => showPaymentModal = false}
>
  <div class="payment-form">
    <!-- Stripe Elements will be mounted here -->
    <div id="card-element"></div>
    <Button
      variant="primary"
      fullWidth
      loading={loading}
      on:click={() => {
        // Handle payment submission
      }}
    >
      Add Payment Method
    </Button>
  </div>
</Modal>

<Modal
  show={showCancelModal}
  title="Cancel Subscription"
  on:close={() => showCancelModal = false}
>
  <div class="cancel-confirmation">
    <p>Are you sure you want to cancel your subscription?</p>
    <p>Your subscription will remain active until the end of your current billing period.</p>
    <div class="modal-actions">
      <Button
        variant="text"
        on:click={() => showCancelModal = false}
      >
        Keep Subscription
      </Button>
      <Button
        variant="danger"
        loading={loading}
        on:click={handleCancel}
      >
        Cancel Subscription
      </Button>
    </div>
  </div>
</Modal>

<style lang="postcss">
  .subscription-manager {
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px;
  }

  .header {
    margin-bottom: 24px;

    h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }

    .subtitle {
      margin: 4px 0 0;
      color: var(--text-2);
    }
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: var(--error-light);
    color: var(--error);
    border-radius: 6px;
    margin-bottom: 24px;

    p {
      margin: 0;
      flex: 1;
    }

    button {
      color: inherit;
      opacity: 0.7;

      &:hover {
        opacity: 1;
      }
    }
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .current-plan {
    .plan-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;

      h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
      }
    }

    .plan-details {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .detail {
        display: flex;
        justify-content: space-between;
        align-items: center;

        .label {
          color: var(--text-2);
        }

        .value {
          font-weight: 500;
        }
      }

      .cancellation-notice {
        padding: 12px;
        background: var(--warning-light);
        color: var(--warning);
        border-radius: 6px;
        text-align: center;
      }
    }
  }

  .payment-methods {
    h2 {
      margin: 0 0 16px;
      font-size: 18px;
      font-weight: 600;
    }

    .methods-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .payment-method {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px;
      background: var(--surface-2);
      border-radius: 6px;

      .method-info {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .method-actions {
        display: flex;
        gap: 8px;
      }
    }
  }

  .billing-history {
    h2 {
      margin: 0 0 16px;
      font-size: 18px;
      font-weight: 600;
    }

    .invoices-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .invoice {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px;
      background: var(--surface-2);
      border-radius: 6px;

      .invoice-info {
        display: flex;
        align-items: center;
        gap: 16px;

        .date {
          color: var(--text-2);
        }

        .amount {
          font-weight: 500;
        }
      }

      a {
        display: flex;
        align-items: center;
        gap: 4px;
        color: var(--primary-color);
        text-decoration: none;

        &:hover {
          text-decoration: underline;
        }
      }
    }
  }

  .plans-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 24px;
  }

  .plan {
    display: flex;
    flex-direction: column;
    gap: 16px;

    .plan-header {
      display: flex;
      align-items: center;
      justify-content: space-between;

      h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
      }
    }

    .price {
      .amount {
        font-size: 32px;
        font-weight: 600;
      }

      .period {
        color: var(--text-2);
      }
    }

    .features {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;

      li {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--text-2);

        :global(svg) {
          color: var(--success);
        }
      }
    }
  }

  .payment-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .cancel-confirmation {
    text-align: center;

    p {
      margin: 0 0 16px;

      &:last-of-type {
        color: var(--text-2);
      }
    }

    .modal-actions {
      display: flex;
      justify-content: center;
      gap: 16px;
      margin-top: 24px;
    }
  }

  @media (max-width: 768px) {
    .subscription-manager {
      padding: 16px;
    }

    .payment-method,
    .invoice {
      flex-direction: column;
      gap: 12px;
      align-items: flex-start;
    }

    .invoice-info {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style> 