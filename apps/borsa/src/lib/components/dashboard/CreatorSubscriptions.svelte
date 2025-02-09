<!-- CreatorSubscriptions.svelte -->
<script lang="ts">
  import { fade, slide } from 'svelte/transition';
  import Icon from '$lib/components/shared/Icon.svelte';
  import { walletService } from '$lib/services/wallet/WalletService';
  import { formatCurrency } from '$lib/utils/currency';
  import { onMount } from 'svelte';

  interface Subscription {
    id: string;
    creatorId: string;
    creatorName: string;
    avatarUrl: string;
    tier: string;
    amount: number;
    currency: string;
    renewalDate: string;
    status: 'active' | 'expired' | 'cancelled';
  }

  let subscriptions: Subscription[] = [];
  let loading = true;

  onMount(async () => {
    await loadSubscriptions();
  });

  async function loadSubscriptions() {
    // TODO: Integrate with subscription service
    subscriptions = [
      {
        id: '1',
        creatorId: 'creator1',
        creatorName: 'Alice Creative',
        avatarUrl: '/avatars/alice.jpg',
        tier: 'Premium',
        amount: 9.99,
        currency: 'USD',
        renewalDate: '2024-03-01',
        status: 'active'
      },
      {
        id: '2',
        creatorId: 'creator2',
        creatorName: 'Bob Artist',
        avatarUrl: '/avatars/bob.jpg',
        tier: 'Pro',
        amount: 19.99,
        currency: 'USD',
        renewalDate: '2024-03-15',
        status: 'active'
      }
    ];
    loading = false;
  }

  async function handleTip(creatorId: string) {
    // TODO: Implement tipping
  }

  async function handleRenewal(subscriptionId: string) {
    // TODO: Implement renewal
  }

  async function handleCancel(subscriptionId: string) {
    // TODO: Implement cancellation
  }
</script>

<div class="creator-subscriptions" transition:fade>
  {#if loading}
    <div class="loading">Loading subscriptions...</div>
  {:else if subscriptions.length === 0}
    <div class="empty-state">
      <Icon name="star" size={48} />
      <p>No active subscriptions</p>
      <button class="discover-button">
        Discover Creators
      </button>
    </div>
  {:else}
    <div class="subscription-list">
      {#each subscriptions as subscription}
        <div 
          class="subscription-card"
          class:active={subscription.status === 'active'}
          class:expired={subscription.status === 'expired'}
          class:cancelled={subscription.status === 'cancelled'}
          transition:slide
        >
          <div class="creator-info">
            <img 
              src={subscription.avatarUrl} 
              alt={subscription.creatorName}
              class="avatar"
            />
            <div class="details">
              <h4>{subscription.creatorName}</h4>
              <span class="tier">{subscription.tier}</span>
            </div>
          </div>

          <div class="subscription-details">
            <div class="amount">
              {formatCurrency(subscription.amount, subscription.currency)}
              <span class="period">/month</span>
            </div>
            <div class="renewal">
              Renews {new Date(subscription.renewalDate).toLocaleDateString()}
            </div>
          </div>

          <div class="actions">
            <button 
              class="tip-button"
              on:click={() => handleTip(subscription.creatorId)}
            >
              <Icon name="gift" size={16} />
              Tip
            </button>
            {#if subscription.status === 'active'}
              <button 
                class="cancel-button"
                on:click={() => handleCancel(subscription.id)}
              >
                Cancel
              </button>
            {:else}
              <button 
                class="renew-button"
                on:click={() => handleRenewal(subscription.id)}
              >
                Renew
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style lang="postcss">
  .creator-subscriptions {
    @apply min-h-[200px];
  }

  .loading {
    @apply flex items-center justify-center h-full text-white text-opacity-60;
  }

  .empty-state {
    @apply flex flex-col items-center justify-center gap-4 p-8 text-center;
    @apply text-white text-opacity-60;

    .discover-button {
      @apply px-4 py-2 mt-2 text-sm font-medium rounded-lg;
      @apply bg-blue-500 bg-opacity-20 text-blue-300;
      @apply transition-colors duration-200;

      &:hover {
        @apply bg-opacity-30;
      }
    }
  }

  .subscription-list {
    @apply space-y-4;
  }

  .subscription-card {
    @apply flex items-center justify-between p-4 rounded-lg;
    @apply bg-white bg-opacity-5 backdrop-blur-lg;
    @apply border border-white border-opacity-10;
    @apply transition-all duration-200;

    &:hover {
      @apply bg-opacity-10;
    }

    &.expired {
      @apply opacity-75;
    }

    &.cancelled {
      @apply opacity-50;
    }
  }

  .creator-info {
    @apply flex items-center gap-3;

    .avatar {
      @apply w-10 h-10 rounded-full;
      @apply border-2 border-white border-opacity-10;
    }

    .details {
      h4 {
        @apply text-sm font-medium text-white;
      }

      .tier {
        @apply text-xs text-white text-opacity-60;
      }
    }
  }

  .subscription-details {
    @apply text-right;

    .amount {
      @apply text-sm font-medium text-white;

      .period {
        @apply text-xs text-white text-opacity-60;
      }
    }

    .renewal {
      @apply text-xs text-white text-opacity-60;
    }
  }

  .actions {
    @apply flex items-center gap-2;

    button {
      @apply px-3 py-1 text-sm font-medium rounded-lg;
      @apply transition-colors duration-200;
    }

    .tip-button {
      @apply flex items-center gap-1;
      @apply bg-green-500 bg-opacity-20 text-green-300;

      &:hover {
        @apply bg-opacity-30;
      }
    }

    .cancel-button {
      @apply bg-red-500 bg-opacity-20 text-red-300;

      &:hover {
        @apply bg-opacity-30;
      }
    }

    .renew-button {
      @apply bg-blue-500 bg-opacity-20 text-blue-300;

      &:hover {
        @apply bg-opacity-30;
      }
    }
  }
</style> 