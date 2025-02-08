<!-- ShareModal.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  import { clickOutside } from '$lib/actions/clickOutside';
  import type { Post } from '$lib/types';
  import { social } from '$lib/services/social';
  import { analytics } from '$lib/services/analytics';

  const dispatch = createEventDispatcher();

  // Props
  export let post: Post;

  // State
  let isLoading = false;
  let error: string | null = null;
  let shareUrl = '';
  let copied = false;

  // Social platforms
  const platforms = [
    {
      id: 'atproto',
      name: 'Bluesky',
      icon: `
        <path 
          stroke-linecap="round" 
          stroke-linejoin="round" 
          stroke-width="2"
          d="M12 2l9 4.5v11L12 22l-9-4.5v-11L12 2z"
        />
      `
    },
    {
      id: 'activitypub',
      name: 'Mastodon',
      icon: `
        <path 
          stroke-linecap="round" 
          stroke-linejoin="round" 
          stroke-width="2"
          d="M21 12c0 1.268-.63 2.39-1.593 3.068-3.077 2.167-8.737 2.167-11.814 0C6.63 14.39 6 13.268 6 12V8c0-1.268.63-2.39 1.593-3.068 3.077-2.167 8.737-2.167 11.814 0C20.37 5.61 21 6.732 21 8v4z"
        />
      `,
    },
    {
      id: 'nostr',
      name: 'Nostr',
      icon: `
        <path 
          stroke-linecap="round" 
          stroke-linejoin="round" 
          stroke-width="2"
          d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"
        />
        <path 
          stroke-linecap="round" 
          stroke-linejoin="round" 
          stroke-width="2"
          d="M8 12h8M12 8v8"
        />
      `
    }
  ];

  // Lifecycle
  onMount(async () => {
    // Generate share URL
    shareUrl = `${window.location.origin}/post/${post.id}`;
  });

  // Event handlers
  async function handleShare(platform: string) {
    isLoading = true;
    error = null;

    try {
      const isConnected = await social.isProfileConnected(platform);
      if (!isConnected) {
        // Redirect to connect platform
        window.location.href = `/settings/social?platform=${platform}&redirect=/post/${post.id}`;
        return;
      }

      await social.crossPost({
        content: `${post.caption || ''}\n\n${shareUrl}`,
        attachments: post.media.map(m => ({
          type: m.type,
          url: m.url,
          alt: m.metadata?.alt
        })),
        platforms: [platform]
      });

      analytics.trackEvent({
        type: 'post_share',
        contentId: post.id,
        contentType: 'post',
        data: {
          platform,
          timestamp: Date.now()
        }
      });

      dispatch('close');
    } catch (err) {
      console.error('Failed to share post:', err);
      error = 'Failed to share post. Please try again.';
    } finally {
      isLoading = false;
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      copied = true;
      setTimeout(() => copied = false, 2000);

      analytics.trackEvent({
        type: 'post_share',
        contentId: post.id,
        contentType: 'post',
        data: {
          method: 'copy_link',
          timestamp: Date.now()
        }
      });
    } catch (err) {
      console.error('Failed to copy link:', err);
      error = 'Failed to copy link. Please try again.';
    }
  }
</script>

<div class="modal-backdrop" transition:fade>
  <div 
    class="modal"
    use:clickOutside
    on:clickoutside={() => dispatch('close')}
  >
    <header class="modal-header">
      <h2>Share Post</h2>
      <button
        class="close-button"
        on:click={() => dispatch('close')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </header>

    {#if error}
      <div class="error-message" transition:fade>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span>{error}</span>
      </div>
    {/if}

    <div class="share-options">
      <div class="platform-buttons">
        {#each platforms as platform}
          <button
            class="platform-button"
            disabled={isLoading}
            on:click={() => handleShare(platform.id)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              {@html platform.icon}
            </svg>
            <span>{platform.name}</span>
          </button>
        {/each}
      </div>

      <div class="divider">
        <span>or</span>
      </div>

      <div class="copy-link">
        <input
          type="text"
          value={shareUrl}
          readonly
        />
        <button
          class="copy-button"
          class:copied
          disabled={isLoading}
          on:click={copyLink}
        >
          {#if copied}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path 
                stroke-linecap="round" 
                stroke-linejoin="round" 
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
            Copied!
          {:else}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path 
                stroke-linecap="round" 
                stroke-linejoin="round" 
                stroke-width="2"
                d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
              />
            </svg>
            Copy Link
          {/if}
        </button>
      </div>
    </div>
  </div>
</div>

<style lang="postcss">
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .modal {
    width: 100%;
    max-width: 480px;
    background: var(--surface-color, #1a1a1a);
    border-radius: 12px;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);

    h2 {
      font-size: 18px;
      font-weight: 600;
      color: white;
      margin: 0;
    }
  }

  .close-button {
    padding: 8px;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    transition: color 0.2s;

    &:hover {
      color: white;
    }

    svg {
      width: 20px;
      height: 20px;
    }
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: rgba(255, 68, 68, 0.1);
    color: #ff4444;
    margin: 16px;
    border-radius: 8px;

    svg {
      width: 20px;
      height: 20px;
    }
  }

  .share-options {
    padding: 24px;
  }

  .platform-buttons {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 12px;
  }

  .platform-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 16px;
    background: rgba(255, 255, 255, 0.05);
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.1);
      transform: translateY(-2px);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    svg {
      width: 24px;
      height: 24px;
    }
  }

  .divider {
    position: relative;
    text-align: center;
    margin: 24px 0;

    &::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 0;
      right: 0;
      height: 1px;
      background: rgba(255, 255, 255, 0.1);
    }

    span {
      position: relative;
      padding: 0 12px;
      background: var(--surface-color, #1a1a1a);
      color: rgba(255, 255, 255, 0.5);
      font-size: 14px;
    }
  }

  .copy-link {
    display: flex;
    gap: 8px;

    input {
      flex: 1;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.05);
      border: none;
      border-radius: 8px;
      color: white;
      font-size: 14px;

      &:focus {
        outline: none;
        background: rgba(255, 255, 255, 0.1);
      }
    }
  }

  .copy-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: var(--primary-color, #00a8ff);
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      filter: brightness(1.1);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &.copied {
      background: #4caf50;
    }

    svg {
      width: 16px;
      height: 16px;
    }
  }
</style> 