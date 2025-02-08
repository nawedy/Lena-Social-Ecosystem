<!-- SocialShare.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  import type { VideoMetadata } from '$lib/types';

  const dispatch = createEventDispatcher();

  // Props
  export let video: VideoMetadata;
  export let url: string;

  // State
  let embedCode = '';
  let showEmbedCode = false;
  let copied = false;
  let shareData: {
    platform: string;
    title: string;
    description: string;
    image: string;
    tags: string[];
  } = {
    platform: 'twitter',
    title: video.title,
    description: video.description || '',
    image: video.thumbnailUrl,
    tags: video.tags || []
  };

  // Available platforms
  const platforms = [
    {
      id: 'twitter',
      name: 'Twitter',
      icon: `
        <path 
          d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"
        />
      `,
      maxLength: 280,
      hashtagPrefix: '#'
    },
    {
      id: 'facebook',
      name: 'Facebook',
      icon: `
        <path 
          d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"
        />
      `,
      maxLength: 63206,
      hashtagPrefix: '#'
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      icon: `
        <path 
          d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"
        />
        <rect x="2" y="9" width="4" height="12" />
        <circle cx="4" cy="4" r="2" />
      `,
      maxLength: 3000,
      hashtagPrefix: '#'
    },
    {
      id: 'reddit',
      name: 'Reddit',
      icon: `
        <circle cx="12" cy="12" r="9" />
        <path 
          d="M15 11a2 2 0 0 0-2-2 2 2 0 0 0-2 2m-2 0a2 2 0 0 0-2-2 2 2 0 0 0-2 2m10 0a2 2 0 0 0-2-2 2 2 0 0 0-2 2"
        />
        <path d="M9 16c1.5 1 3.5 1 5 0" />
      `,
      maxLength: 40000,
      hashtagPrefix: 'r/'
    }
  ];

  function generateShareText(platform: string) {
    const { title, description, tags } = shareData;
    const platformConfig = platforms.find(p => p.id === platform);
    if (!platformConfig) return '';

    const hashtagStr = tags
      .map(tag => `${platformConfig.hashtagPrefix}${tag}`)
      .join(' ');

    let text = `${title}\n\n${description}\n\n${url}`;
    if (hashtagStr) {
      text += `\n\n${hashtagStr}`;
    }

    // Truncate if needed
    if (text.length > platformConfig.maxLength) {
      return text.slice(0, platformConfig.maxLength - 3) + '...';
    }

    return text;
  }

  function share(platform: string) {
    const text = generateShareText(platform);
    let shareUrl = '';

    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
        break;
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
        break;
      case 'reddit':
        shareUrl = `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(shareData.title)}`;
        break;
    }

    window.open(shareUrl, '_blank', 'width=600,height=400');
    dispatch('share', { platform });
  }

  function generateEmbedCode() {
    embedCode = `<iframe
  width="560"
  height="315"
  src="${url}/embed"
  title="${shareData.title}"
  frameborder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
  allowfullscreen
></iframe>`;
    showEmbedCode = true;
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      setTimeout(() => copied = false, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  function updateShareData() {
    dispatch('update', { shareData });
  }
</script>

<div class="social-share">
  <div class="share-customization">
    <div class="form-group">
      <label for="shareTitle">Title</label>
      <input
        id="shareTitle"
        type="text"
        bind:value={shareData.title}
        on:input={updateShareData}
        maxlength="100"
      />
    </div>

    <div class="form-group">
      <label for="shareDescription">Description</label>
      <textarea
        id="shareDescription"
        bind:value={shareData.description}
        on:input={updateShareData}
        rows="3"
        maxlength="500"
      />
    </div>

    <div class="form-group">
      <label>Tags</label>
      <div class="tags-input">
        {#each shareData.tags as tag, i}
          <span class="tag" transition:fade>
            {tag}
            <button
              type="button"
              class="remove-tag"
              on:click={() => {
                shareData.tags = shareData.tags.filter((_, index) => index !== i);
                updateShareData();
              }}
            >
              ×
            </button>
          </span>
        {/each}
      </div>
    </div>
  </div>

  <div class="share-buttons">
    {#each platforms as platform}
      <button
        class="share-button {platform.id}"
        on:click={() => share(platform.id)}
      >
        <svg 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          {@html platform.icon}
        </svg>
        Share on {platform.name}
      </button>
    {/each}
  </div>

  <div class="embed-section">
    <button
      class="embed-button"
      on:click={generateEmbedCode}
    >
      Generate Embed Code
    </button>

    {#if showEmbedCode}
      <div class="embed-code" transition:fade>
        <pre>{embedCode}</pre>
        <button
          class="copy-button"
          on:click={() => copyToClipboard(embedCode)}
        >
          {#if copied}
            Copied!
          {:else}
            Copy Code
          {/if}
        </button>
      </div>
    {/if}
  </div>

  <div class="direct-link">
    <input
      type="text"
      readonly
      value={url}
    />
    <button
      class="copy-button"
      on:click={() => copyToClipboard(url)}
    >
      {#if copied}
        Copied!
      {:else}
        Copy Link
      {/if}
    </button>
  </div>
</div>

<style lang="postcss">
  .social-share {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .share-customization {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;

    label {
      font-size: 14px;
      font-weight: 500;
      color: white;
    }

    input,
    textarea {
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      color: white;
      font-size: 14px;
      resize: vertical;

      &:focus {
        outline: none;
        border-color: var(--primary-color, #00a8ff);
      }
    }
  }

  .tags-input {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }

  .tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: rgba(var(--primary-color-rgb, 0, 168, 255), 0.2);
    border-radius: 4px;
    font-size: 12px;
    color: white;
  }

  .remove-tag {
    padding: 0;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    font-size: 16px;
    line-height: 1;
    cursor: pointer;

    &:hover {
      color: white;
    }
  }

  .share-buttons {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
  }

  .share-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    border: none;
    border-radius: 4px;
    color: white;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;

    svg {
      width: 20px;
      height: 20px;
    }

    &.twitter {
      background: #1da1f2;
      &:hover { background: #0c85d0; }
    }

    &.facebook {
      background: #1877f2;
      &:hover { background: #0c5dc7; }
    }

    &.linkedin {
      background: #0a66c2;
      &:hover { background: #084c8f; }
    }

    &.reddit {
      background: #ff4500;
      &:hover { background: #cc3700; }
    }
  }

  .embed-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .embed-button {
    padding: 12px;
    background: var(--primary-color, #00a8ff);
    border: none;
    border-radius: 4px;
    color: white;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      filter: brightness(1.1);
    }
  }

  .embed-code {
    position: relative;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 4px;
    overflow: hidden;

    pre {
      margin: 0;
      padding: 12px;
      font-family: monospace;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.7);
      white-space: pre-wrap;
      word-break: break-all;
    }
  }

  .direct-link {
    display: flex;
    gap: 8px;

    input {
      flex: 1;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      color: white;
      font-size: 14px;
      cursor: text;

      &:focus {
        outline: none;
        border-color: var(--primary-color, #00a8ff);
      }
    }
  }

  .copy-button {
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 4px;
    color: white;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    min-width: 100px;
    text-align: center;

    &:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  }
</style> 