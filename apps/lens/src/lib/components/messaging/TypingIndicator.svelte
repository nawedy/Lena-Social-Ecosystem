<!-- TypingIndicator.svelte -->
<script lang="ts">
  import { fade } from 'svelte/transition';
  import type { UserProfile } from '$lib/types';
  import UserAvatar from '../shared/UserAvatar.svelte';

  // Props
  export let users: UserProfile[] = [];
  export let maxDisplayed = 3;

  // Computed
  $: displayedUsers = users.slice(0, maxDisplayed);
  $: remainingCount = Math.max(0, users.length - maxDisplayed);
  $: typingText = getTypingText(users.length);

  function getTypingText(count: number): string {
    if (count === 0) return '';
    if (count === 1) {
      return `${users[0].displayName || users[0].username} is typing`;
    }
    if (count <= maxDisplayed) {
      const names = users
        .map(u => u.displayName || u.username)
        .slice(0, -1)
        .join(', ');
      const lastName = users[users.length - 1].displayName || users[users.length - 1].username;
      return `${names} and ${lastName} are typing`;
    }
    return `${users.length} people are typing`;
  }
</script>

<div class="typing-indicator" transition:fade>
  <div class="avatars">
    {#each displayedUsers as user (user.id)}
      <div class="avatar" transition:fade>
        <UserAvatar {user} size="sm" />
      </div>
    {/each}
    {#if remainingCount > 0}
      <div class="remaining" transition:fade>
        +{remainingCount}
      </div>
    {/if}
  </div>

  <div class="typing-text">
    {typingText}
    <span class="dots">
      <span class="dot" />
      <span class="dot" />
      <span class="dot" />
    </span>
  </div>
</div>

<style lang="postcss">
  .typing-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--surface-2);
    border-radius: 8px;
  }

  .avatars {
    display: flex;
    align-items: center;
  }

  .avatar {
    margin-left: -8px;

    &:first-child {
      margin-left: 0;
    }
  }

  .remaining {
    margin-left: 4px;
    padding: 2px 6px;
    background: var(--surface-3);
    border-radius: 12px;
    color: var(--text-2);
    font-size: 12px;
    font-weight: 500;
  }

  .typing-text {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--text-2);
    font-size: 14px;
  }

  .dots {
    display: flex;
    align-items: center;
    gap: 2px;
    padding-top: 8px;
  }

  .dot {
    width: 4px;
    height: 4px;
    background: currentColor;
    border-radius: 50%;
    opacity: 0.5;
    animation: bounce 1.4s infinite;

    &:nth-child(2) {
      animation-delay: 0.2s;
    }

    &:nth-child(3) {
      animation-delay: 0.4s;
    }
  }

  @keyframes bounce {
    0%, 60%, 100% {
      transform: translateY(0);
      opacity: 0.5;
    }
    30% {
      transform: translateY(-4px);
      opacity: 1;
    }
  }
</style> 