<!-- UserAvatar.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  import type { UserProfile } from '$lib/types';

  const dispatch = createEventDispatcher();

  // Props
  export let user: UserProfile;
  export let size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'md';
  export let showStatus = false;
  export let showVerified = true;
  export let showBorder = false;
  export let isLink = false;

  // Computed
  $: dimensions = {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 56,
    xl: 80
  }[size];

  $: fontSize = {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 24,
    xl: 32
  }[size];

  $: verifiedBadgeSize = {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24
  }[size];

  $: statusDotSize = {
    xs: 6,
    sm: 8,
    md: 10,
    lg: 12,
    xl: 14
  }[size];

  $: initials = user.displayName
    ? user.displayName
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : user.username.slice(0, 2).toUpperCase();

  function handleClick() {
    if (isLink) {
      dispatch('click');
    }
  }

  function handleError(event: Event) {
    const target = event.target as HTMLImageElement;
    target.style.display = 'none';
  }
</script>

<div 
  class="avatar-wrapper"
  class:link={isLink}
  style="--size: {dimensions}px; --font-size: {fontSize}px"
  on:click={handleClick}
  on:keydown={(e) => e.key === 'Enter' && handleClick()}
  role={isLink ? 'button' : undefined}
  tabindex={isLink ? 0 : undefined}
>
  <div 
    class="avatar"
    class:with-border={showBorder}
  >
    {#if user.avatarUrl}
      <img
        src={user.avatarUrl}
        alt={user.displayName || user.username}
        on:error={handleError}
        transition:fade
      />
    {/if}
    <div class="initials" style="background-color: {user.profileColor || '#6366F1'}">
      {initials}
    </div>
  </div>

  {#if showVerified && user.isVerified}
    <div class="verified-badge" style="--badge-size: {verifiedBadgeSize}px">
      <svg viewBox="0 0 24 24" fill="none">
        <path 
          fill="var(--primary-color, #00a8ff)" 
          d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"
        />
        <path 
          stroke="white" 
          stroke-width="2" 
          stroke-linecap="round" 
          stroke-linejoin="round"
          d="M8 12l3 3 5-5"
        />
      </svg>
    </div>
  {/if}

  {#if showStatus}
    <div 
      class="status-dot"
      class:online={user.isOnline}
      style="--dot-size: {statusDotSize}px"
    />
  {/if}
</div>

<style lang="postcss">
  .avatar-wrapper {
    position: relative;
    width: var(--size);
    height: var(--size);

    &.link {
      cursor: pointer;
      transition: transform 0.2s;

      &:hover {
        transform: scale(1.05);
      }

      &:focus-visible {
        outline: 2px solid var(--primary-color, #00a8ff);
        outline-offset: 2px;
        border-radius: 50%;
      }
    }
  }

  .avatar {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    overflow: hidden;

    &.with-border {
      border: 2px solid var(--surface-color-light, #2a2a2a);
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .initials {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: var(--font-size);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .verified-badge {
    position: absolute;
    bottom: 0;
    right: 0;
    width: var(--badge-size);
    height: var(--badge-size);
    background: white;
    border-radius: 50%;
    border: 2px solid var(--surface-color, #1a1a1a);
    pointer-events: none;

    svg {
      width: 100%;
      height: 100%;
    }
  }

  .status-dot {
    position: absolute;
    bottom: 2px;
    right: 2px;
    width: var(--dot-size);
    height: var(--dot-size);
    border-radius: 50%;
    background: #9ca3af;
    border: 2px solid var(--surface-color, #1a1a1a);
    pointer-events: none;

    &.online {
      background: #10b981;
    }
  }
</style> 