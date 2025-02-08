<!-- VideoForm.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  import type { VideoMetadata } from '$lib/types';
  import { supabase } from '$lib/supabase';
  import ThumbnailGenerator from './ThumbnailGenerator.svelte';

  const dispatch = createEventDispatcher();

  // Props
  export let ipfsHash: string;
  export let filename: string;
  export let filesize: number;
  export let filetype: string;
  export let videoUrl: string;

  // Form state
  let title = '';
  let description = '';
  let tags: string[] = [];
  let tagInput = '';
  let monetizationType: VideoMetadata['monetizationType'] = 'free';
  let price: number | null = null;
  let isProcessing = false;
  let error: string | null = null;

  // Additional form state
  let privacyStatus: 'private' | 'unlisted' | 'published' = 'private';
  let isScheduled = false;
  let scheduleDate: string = '';
  let scheduleTime: string = '';
  let selectedChannelId: string | null = null;
  let channels: any[] = [];
  let thumbnail: string | null = null;

  // Advanced monetization settings
  let enableAds = false;
  let adTypes = {
    preRoll: false,
    midRoll: false,
    overlay: false
  };
  let sponsorshipEnabled = false;
  let sponsorshipTiers = [
    { price: 4.99, benefits: '' }
  ];

  // Validation
  $: isValid = title.trim().length > 0 && 
    title.length <= 100 && 
    description.length <= 5000 && 
    (monetizationType !== 'pay_per_view' || (price && price > 0));

  $: isScheduleValid = !isScheduled || (scheduleDate && scheduleTime);
  $: scheduledDateTime = isScheduled && scheduleDate && scheduleTime
    ? new Date(`${scheduleDate}T${scheduleTime}`).toISOString()
    : null;

  function handleTagInput(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      const tag = tagInput.trim().toLowerCase();
      
      if (tag && !tags.includes(tag) && tags.length < 10) {
        tags = [...tags, tag];
      }
      
      tagInput = '';
    }
  }

  function removeTag(index: number) {
    tags = tags.filter((_, i) => i !== index);
  }

  async function handleSubmit() {
    if (!isValid) return;

    isProcessing = true;
    error = null;

    try {
      // Get the user's channel
      if (!selectedChannelId) throw new Error('No channel selected');

      // Create video record
      const { data: video, error: videoError } = await supabase
        .from('videos')
        .insert({
          channel_id: selectedChannelId,
          title,
          description,
          ipfs_hash: ipfsHash,
          status: isScheduled ? 'scheduled' : privacyStatus,
          monetization_type: monetizationType,
          price: price || null,
          tags,
          thumbnail_url: thumbnail,
          metadata: {
            originalFilename: filename,
            filesize,
            filetype,
            adSettings: enableAds ? adTypes : null,
            sponsorship: sponsorshipEnabled ? {
              enabled: true,
              tiers: sponsorshipTiers
            } : null
          },
          is_premiere: isScheduled,
          premiere_scheduled_at: scheduledDateTime
        })
        .select()
        .single();

      if (videoError) throw videoError;

      dispatch('success', { video });
    } catch (err) {
      console.error('Failed to create video:', err);
      error = 'Failed to save video details. Please try again.';
    } finally {
      isProcessing = false;
    }
  }

  onMount(async () => {
    // Fetch user's channels
    const { data, error } = await supabase
      .from('channels')
      .select('id, name, handle, avatar_url');

    if (error) {
      console.error('Failed to fetch channels:', error);
    } else {
      channels = data;
      if (channels.length > 0) {
        selectedChannelId = channels[0].id;
      }
    }
  });

  function addSponsorshipTier() {
    sponsorshipTiers = [...sponsorshipTiers, { price: 4.99, benefits: '' }];
  }

  function removeSponsorshipTier(index: number) {
    sponsorshipTiers = sponsorshipTiers.filter((_, i) => i !== index);
  }

  function handleThumbnailSelect(event: CustomEvent) {
    thumbnail = event.detail.thumbnail;
  }
</script>

<form 
  class="video-form"
  on:submit|preventDefault={handleSubmit}
>
  <div class="form-group">
    <label for="title">Title *</label>
    <input
      id="title"
      type="text"
      bind:value={title}
      maxlength="100"
      placeholder="Enter video title"
      required
    />
    <span class="character-count">
      {title.length}/100
    </span>
  </div>

  <div class="form-group">
    <label for="description">Description</label>
    <textarea
      id="description"
      bind:value={description}
      maxlength="5000"
      rows="5"
      placeholder="Enter video description"
    />
    <span class="character-count">
      {description.length}/5000
    </span>
  </div>

  <div class="form-group">
    <label>Tags</label>
    <div class="tags-input">
      {#each tags as tag, i}
        <span class="tag" transition:fade>
          {tag}
          <button
            type="button"
            class="remove-tag"
            on:click={() => removeTag(i)}
          >
            ×
          </button>
        </span>
      {/each}
      <input
        type="text"
        bind:value={tagInput}
        on:keydown={handleTagInput}
        placeholder={tags.length < 10 ? "Add tags (press Enter)" : ""}
        disabled={tags.length >= 10}
      />
    </div>
    <span class="hint">
      Up to 10 tags, separated by Enter or comma
    </span>
  </div>

  <div class="form-group">
    <label>Channel</label>
    <div class="channel-select">
      {#each channels as channel}
        <label class="channel-option">
          <input
            type="radio"
            name="channel"
            value={channel.id}
            bind:group={selectedChannelId}
          />
          <div class="channel-info">
            {#if channel.avatar_url}
              <img src={channel.avatar_url} alt={channel.name} class="channel-avatar" />
            {:else}
              <div class="channel-avatar placeholder">
                {channel.name[0].toUpperCase()}
              </div>
            {/if}
            <div class="channel-details">
              <span class="channel-name">{channel.name}</span>
              <span class="channel-handle">@{channel.handle}</span>
            </div>
          </div>
        </label>
      {/each}
    </div>
  </div>

  <div class="form-group">
    <label>Thumbnail</label>
    <ThumbnailGenerator
      {videoUrl}
      {duration}
      on:select={handleThumbnailSelect}
    />
  </div>

  <div class="form-group">
    <label>Privacy</label>
    <div class="privacy-options">
      <label class="radio-label">
        <input
          type="radio"
          name="privacy"
          value="private"
          bind:group={privacyStatus}
        />
        <span>Private</span>
        <span class="hint">Only you can view</span>
      </label>

      <label class="radio-label">
        <input
          type="radio"
          name="privacy"
          value="unlisted"
          bind:group={privacyStatus}
        />
        <span>Unlisted</span>
        <span class="hint">Anyone with the link can view</span>
      </label>

      <label class="radio-label">
        <input
          type="radio"
          name="privacy"
          value="published"
          bind:group={privacyStatus}
        />
        <span>Public</span>
        <span class="hint">Everyone can view</span>
      </label>
    </div>

    <label class="checkbox-label">
      <input
        type="checkbox"
        bind:checked={isScheduled}
      />
      <span>Schedule for later</span>
    </label>

    {#if isScheduled}
      <div class="schedule-inputs" transition:fade>
        <input
          type="date"
          bind:value={scheduleDate}
          min={new Date().toISOString().split('T')[0]}
        />
        <input
          type="time"
          bind:value={scheduleTime}
        />
      </div>
    {/if}
  </div>

  <div class="form-group">
    <label>Monetization</label>
    <div class="monetization-options">
      <label class="radio-label">
        <input
          type="radio"
          name="monetization"
          value="free"
          bind:group={monetizationType}
        />
        <span>Free</span>
      </label>

      <label class="radio-label">
        <input
          type="radio"
          name="monetization"
          value="premium"
          bind:group={monetizationType}
        />
        <span>Premium</span>
      </label>

      <label class="radio-label">
        <input
          type="radio"
          name="monetization"
          value="pay_per_view"
          bind:group={monetizationType}
        />
        <span>Pay per view</span>
      </label>
    </div>

    {#if monetizationType === 'pay_per_view'}
      <div class="price-input" transition:fade>
        <input
          type="number"
          bind:value={price}
          min="0.01"
          step="0.01"
          placeholder="Enter price"
          required
        />
        <span class="currency">USD</span>
      </div>
    {/if}
  </div>

  {#if monetizationType !== 'free'}
    <div class="advanced-monetization" transition:fade>
      <div class="form-group">
        <label class="checkbox-label">
          <input
            type="checkbox"
            bind:checked={enableAds}
          />
          <span>Enable advertisements</span>
        </label>

        {#if enableAds}
          <div class="ad-options" transition:fade>
            <label class="checkbox-label">
              <input
                type="checkbox"
                bind:checked={adTypes.preRoll}
              />
              <span>Pre-roll ads</span>
            </label>

            <label class="checkbox-label">
              <input
                type="checkbox"
                bind:checked={adTypes.midRoll}
              />
              <span>Mid-roll ads</span>
            </label>

            <label class="checkbox-label">
              <input
                type="checkbox"
                bind:checked={adTypes.overlay}
              />
              <span>Overlay ads</span>
            </label>
          </div>
        {/if}
      </div>

      <div class="form-group">
        <label class="checkbox-label">
          <input
            type="checkbox"
            bind:checked={sponsorshipEnabled}
          />
          <span>Enable channel sponsorship</span>
        </label>

        {#if sponsorshipEnabled}
          <div class="sponsorship-tiers" transition:fade>
            {#each sponsorshipTiers as tier, i}
              <div class="tier-inputs">
                <input
                  type="number"
                  min="0.99"
                  step="0.01"
                  bind:value={tier.price}
                  placeholder="Price per month"
                />
                <input
                  type="text"
                  bind:value={tier.benefits}
                  placeholder="Tier benefits"
                />
                {#if sponsorshipTiers.length > 1}
                  <button
                    type="button"
                    class="remove-tier"
                    on:click={() => removeSponsorshipTier(i)}
                  >
                    ×
                  </button>
                {/if}
              </div>
            {/each}

            <button
              type="button"
              class="add-tier"
              on:click={addSponsorshipTier}
            >
              Add tier
            </button>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  {#if error}
    <div class="error-message" transition:fade>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path 
          stroke-linecap="round" 
          stroke-linejoin="round" 
          stroke-width="2"
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>{error}</span>
    </div>
  {/if}

  <div class="form-actions">
    <button
      type="submit"
      class="submit-button"
      disabled={!isValid || isProcessing}
    >
      {#if isProcessing}
        <svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2"
            d="M12 6v4m0 4v4m-4-8h8M6 12h12"
          />
        </svg>
        Processing...
      {:else}
        Create Video
      {/if}
    </button>
  </div>
</form>

<style lang="postcss">
  .video-form {
    display: flex;
    flex-direction: column;
    gap: 24px;
    max-width: 800px;
    margin: 0 auto;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  label {
    font-size: 14px;
    font-weight: 500;
    color: white;
  }

  input[type="text"],
  input[type="number"],
  textarea {
    padding: 12px;
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

    &::placeholder {
      color: rgba(255, 255, 255, 0.5);
    }
  }

  .character-count {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    text-align: right;
  }

  .tags-input {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;

    input {
      flex: 1;
      min-width: 120px;
      padding: 4px;
      background: transparent;
      border: none;
      color: white;
      font-size: 14px;

      &:focus {
        outline: none;
      }

      &:disabled {
        cursor: not-allowed;
      }
    }
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

  .hint {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
  }

  .monetization-options {
    display: flex;
    gap: 16px;
  }

  .radio-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;

    input {
      width: 16px;
      height: 16px;
      margin: 0;
      cursor: pointer;
    }

    span {
      font-size: 14px;
      font-weight: normal;
    }
  }

  .price-input {
    position: relative;
    max-width: 200px;

    input {
      width: 100%;
      padding-right: 48px;
    }

    .currency {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 14px;
      color: rgba(255, 255, 255, 0.5);
    }
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: rgba(255, 68, 68, 0.1);
    border-radius: 4px;
    color: #ff4444;

    svg {
      width: 20px;
      height: 20px;
    }
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }

  .submit-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    background: var(--primary-color, #00a8ff);
    border: none;
    border-radius: 4px;
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
  }

  .spinner {
    width: 20px;
    height: 20px;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .channel-select {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .channel-option {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    cursor: pointer;

    input {
      width: 16px;
      height: 16px;
    }
  }

  .channel-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .channel-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;

    &.placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--primary-color, #00a8ff);
      color: white;
      font-size: 20px;
      font-weight: 500;
    }
  }

  .channel-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .channel-name {
    font-size: 14px;
    font-weight: 500;
    color: white;
  }

  .channel-handle {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
  }

  .privacy-options {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;

    input {
      width: 16px;
      height: 16px;
    }
  }

  .schedule-inputs {
    display: flex;
    gap: 12px;
    margin-top: 12px;

    input {
      flex: 1;
    }
  }

  .advanced-monetization {
    margin-top: 24px;
    padding-top: 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .ad-options {
    margin-top: 12px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sponsorship-tiers {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .tier-inputs {
    display: flex;
    gap: 8px;

    input {
      flex: 1;
    }
  }

  .remove-tier {
    padding: 0 8px;
    background: rgba(255, 68, 68, 0.1);
    border: none;
    border-radius: 4px;
    color: #ff4444;
    font-size: 18px;
    cursor: pointer;

    &:hover {
      background: rgba(255, 68, 68, 0.2);
    }
  }

  .add-tier {
    padding: 8px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 4px;
    color: white;
    font-size: 14px;
    cursor: pointer;

    &:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  }
</style> 