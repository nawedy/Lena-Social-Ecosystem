<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import Avatar from './Avatar.svelte';
  import Badge from './Badge.svelte';

  export let creator: {
    id: string;
    name: string;
    avatar?: string;
    banner?: string;
    bio?: string;
    website?: string;
    social: {
      twitter?: string;
      instagram?: string;
      youtube?: string;
      tiktok?: string;
    };
    stats: {
      followers: number;
      subscribers: number;
      posts: number;
      revenue: number;
    };
    memberships: Array<{
      id: string;
      name: string;
      description: string;
      price: number;
      benefits: string[];
      nftAddress?: string;
      subscribers: number;
    }>;
    achievements: Array<{
      id: string;
      name: string;
      icon: string;
      description: string;
      unlockedAt: string;
    }>;
  };

  export let currentUserSubscription: string | null = null;
  export let currentUserFollowing = false;

  const dispatch = createEventDispatcher<{
    follow: void;
    unfollow: void;
    subscribe: { membershipId: string };
    tip: { amount: number };
  }>();

  let showTipModal = false;
  let tipAmount = 5;
  let selectedMembership: typeof creator.memberships[number] | null = null;

  function formatNumber(num: number): string {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  function handleFollow() {
    if (currentUserFollowing) {
      dispatch('unfollow');
    } else {
      dispatch('follow');
    }
  }

  function handleSubscribe(membership: typeof creator.memberships[number]) {
    selectedMembership = membership;
    dispatch('subscribe', { membershipId: membership.id });
  }

  function handleTip() {
    if (tipAmount > 0) {
      dispatch('tip', { amount: tipAmount });
      showTipModal = false;
      tipAmount = 5;
    }
  }
</script>

<div class="space-y-6">
  <!-- Banner -->
  <div class="relative h-48 rounded-lg overflow-hidden">
    {#if creator.banner}
      <img
        src={creator.banner}
        alt="Profile banner"
        class="w-full h-full object-cover"
      />
    {:else}
      <div class="w-full h-full bg-gradient-to-r from-primary-900 to-secondary-900" />
    {/if}

    <!-- Profile Picture -->
    <div class="absolute -bottom-16 left-6">
      <Avatar
        src={creator.avatar}
        alt={creator.name}
        size="xl"
        border
        verified
      />
    </div>
  </div>

  <!-- Profile Info -->
  <div class="pt-16 px-6">
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-bold">{creator.name}</h1>
        {#if creator.bio}
          <p class="mt-2 text-gray-400">{creator.bio}</p>
        {/if}
      </div>

      <div class="flex gap-2">
        <button
          class="px-4 py-2 rounded-lg font-medium transition-colors {currentUserFollowing ? 'bg-primary-900/50 hover:bg-primary-900/75' : 'bg-primary-500 hover:bg-primary-400'}"
          on:click={handleFollow}
        >
          {currentUserFollowing ? 'Following' : 'Follow'}
        </button>
        <button
          class="px-4 py-2 rounded-lg font-medium bg-secondary-500 hover:bg-secondary-400 transition-colors"
          on:click={() => (showTipModal = true)}
        >
          Tip
        </button>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-4 gap-4 mt-6">
      <div class="text-center">
        <div class="text-2xl font-bold">{formatNumber(creator.stats.followers)}</div>
        <div class="text-sm text-gray-400">Followers</div>
      </div>
      <div class="text-center">
        <div class="text-2xl font-bold">{formatNumber(creator.stats.subscribers)}</div>
        <div class="text-sm text-gray-400">Subscribers</div>
      </div>
      <div class="text-center">
        <div class="text-2xl font-bold">{formatNumber(creator.stats.posts)}</div>
        <div class="text-sm text-gray-400">Posts</div>
      </div>
      <div class="text-center">
        <div class="text-2xl font-bold">{formatCurrency(creator.stats.revenue)}</div>
        <div class="text-sm text-gray-400">Revenue</div>
      </div>
    </div>

    <!-- Social Links -->
    {#if Object.values(creator.social).some(Boolean)}
      <div class="flex gap-4 mt-6">
        {#if creator.social.twitter}
          <a
            href={`https://twitter.com/${creator.social.twitter}`}
            target="_blank"
            rel="noopener noreferrer"
            class="text-gray-400 hover:text-primary-400 transition-colors"
          >
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
            </svg>
          </a>
        {/if}
        {#if creator.social.instagram}
          <a
            href={`https://instagram.com/${creator.social.instagram}`}
            target="_blank"
            rel="noopener noreferrer"
            class="text-gray-400 hover:text-primary-400 transition-colors"
          >
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z" />
            </svg>
          </a>
        {/if}
        {#if creator.social.youtube}
          <a
            href={`https://youtube.com/${creator.social.youtube}`}
            target="_blank"
            rel="noopener noreferrer"
            class="text-gray-400 hover:text-primary-400 transition-colors"
          >
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
          </a>
        {/if}
        {#if creator.social.tiktok}
          <a
            href={`https://tiktok.com/@${creator.social.tiktok}`}
            target="_blank"
            rel="noopener noreferrer"
            class="text-gray-400 hover:text-primary-400 transition-colors"
          >
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
            </svg>
          </a>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Memberships -->
  <div class="mt-8">
    <h2 class="text-xl font-bold mb-4">Memberships</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each creator.memberships as membership (membership.id)}
        <div
          class="bg-black/50 backdrop-blur-sm rounded-lg p-6 border border-primary-900/50 hover:border-primary-500/50 transition-colors"
        >
          <div class="flex justify-between items-start mb-4">
            <div>
              <h3 class="font-bold">{membership.name}</h3>
              <p class="text-sm text-gray-400">{formatNumber(membership.subscribers)} subscribers</p>
            </div>
            <Badge variant="primary" glow>{formatCurrency(membership.price)}/mo</Badge>
          </div>

          <p class="text-sm mb-4">{membership.description}</p>

          <ul class="space-y-2 mb-4">
            {#each membership.benefits as benefit}
              <li class="flex items-center gap-2 text-sm">
                <span class="text-primary-500">✓</span>
                <span>{benefit}</span>
              </li>
            {/each}
          </ul>

          {#if membership.nftAddress}
            <div class="mb-4">
              <Badge variant="secondary" glow>NFT Membership</Badge>
            </div>
          {/if}

          <button
            class="w-full px-4 py-2 rounded-lg font-medium transition-colors {currentUserSubscription === membership.id ? 'bg-primary-900/50' : 'bg-primary-500 hover:bg-primary-400'}"
            disabled={currentUserSubscription === membership.id}
            on:click={() => handleSubscribe(membership)}
          >
            {currentUserSubscription === membership.id ? 'Subscribed' : 'Subscribe'}
          </button>
        </div>
      {/each}
    </div>
  </div>

  <!-- Achievements -->
  {#if creator.achievements.length > 0}
    <div class="mt-8">
      <h2 class="text-xl font-bold mb-4">Achievements</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {#each creator.achievements as achievement (achievement.id)}
          <div
            class="bg-black/50 backdrop-blur-sm rounded-lg p-4 border border-primary-900/50 text-center"
            title={achievement.description}
          >
            <span class="text-3xl">{achievement.icon}</span>
            <h3 class="mt-2 font-medium text-sm">{achievement.name}</h3>
            <time class="text-xs text-gray-400">
              {new Date(achievement.unlockedAt).toLocaleDateString()}
            </time>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<!-- Tip Modal -->
{#if showTipModal}
  <div
    class="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    transition:fade={{ duration: 200 }}
    on:click={() => (showTipModal = false)}
  >
    <div
      class="bg-black/90 rounded-lg p-6 border border-primary-900/50 w-full max-w-sm"
      transition:slide={{ duration: 200 }}
      on:click|stopPropagation
    >
      <h2 class="text-xl font-bold mb-4">Send a Tip</h2>
      <p class="text-gray-400 mb-4">Support {creator.name} with a one-time tip.</p>

      <div class="flex gap-2 mb-4">
        {#each [1, 5, 10, 20, 50, 100] as amount}
          <button
            class="px-3 py-1 rounded-lg font-medium transition-colors {tipAmount === amount ? 'bg-primary-500' : 'bg-primary-900/50 hover:bg-primary-900/75'}"
            on:click={() => (tipAmount = amount)}
          >
            ${amount}
          </button>
        {/each}
      </div>

      <div class="mb-4">
        <label for="custom-amount" class="block text-sm font-medium mb-1">Custom Amount</label>
        <input
          id="custom-amount"
          type="number"
          min="1"
          bind:value={tipAmount}
          class="w-full px-4 py-2 bg-black/50 border border-primary-900/50 rounded-lg focus:outline-none focus:border-primary-500"
        />
      </div>

      <div class="flex gap-2">
        <button
          class="flex-1 px-4 py-2 rounded-lg font-medium bg-gray-800 hover:bg-gray-700 transition-colors"
          on:click={() => (showTipModal = false)}
        >
          Cancel
        </button>
        <button
          class="flex-1 px-4 py-2 rounded-lg font-medium bg-primary-500 hover:bg-primary-400 transition-colors"
          on:click={handleTip}
        >
          Send ${tipAmount}
        </button>
      </div>
    </div>
  </div>
{/if} 