<!-- ShareModal.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Modal, Button, Icon } from '@lena/ui';
  import { browser } from '$app/environment';

  export let post: {
    id: string;
    url: string;
    title?: string;
    media_url: string;
  };

  const dispatch = createEventDispatcher();
  let copied = false;

  const shareOptions = [
    {
      id: 'copy',
      label: 'Copy Link',
      icon: 'link',
      action: copyLink
    },
    {
      id: 'twitter',
      label: 'Twitter',
      icon: 'twitter',
      action: () => shareToSocial('twitter')
    },
    {
      id: 'facebook',
      label: 'Facebook',
      icon: 'facebook',
      action: () => shareToSocial('facebook')
    },
    {
      id: 'telegram',
      label: 'Telegram',
      icon: 'send',
      action: () => shareToSocial('telegram')
    }
  ];

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(post.url);
      copied = true;
      setTimeout(() => copied = false, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  async function shareToSocial(platform: string) {
    const text = post.title || 'Check out this post!';
    const url = encodeURIComponent(post.url);
    
    const urls = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${url}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      telegram: `https://t.me/share/url?url=${url}&text=${encodeURIComponent(text)}`
    };

    if (browser) {
      window.open(urls[platform], '_blank', 'width=550,height=450');
    }
  }

  async function handleNativeShare() {
    try {
      await navigator.share({
        title: post.title,
        text: 'Check out this post!',
        url: post.url
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  }
</script>

<Modal on:close={() => dispatch('close')}>
  <div class="p-6 max-w-sm mx-auto">
    <h2 class="text-xl font-medium mb-6">Share Post</h2>

    <!-- Native Share Button -->
    {#if browser && navigator.share}
      <Button
        variant="primary"
        class="w-full mb-6"
        on:click={handleNativeShare}
      >
        Share
      </Button>
    {/if}

    <!-- Share Options -->
    <div class="grid grid-cols-2 gap-4">
      {#each shareOptions as option}
        <button
          class="flex flex-col items-center gap-2 p-4 rounded-lg bg-gray-800 
                 hover:bg-gray-700 transition-colors"
          on:click={option.action}
        >
          <Icon name={option.icon} size={24} />
          <span class="text-sm">
            {option.id === 'copy' && copied ? 'Copied!' : option.label}
          </span>
        </button>
      {/each}
    </div>

    <!-- QR Code -->
    <div class="mt-6 p-4 bg-white rounded-lg">
      <img
        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(post.url)}`}
        alt="QR Code"
        class="w-full"
      />
    </div>
  </div>
</Modal> 