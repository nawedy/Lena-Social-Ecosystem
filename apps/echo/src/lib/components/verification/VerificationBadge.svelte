<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { userVerification } from '$lib/services/verification/UserVerification';
  import type { VerificationStatus } from '$lib/types';
  import { Badge, Tooltip, Icon } from '$lib/components/ui';

  export let userId: string;
  export let showDetails = false;
  export let size: 'sm' | 'md' | 'lg' = 'md';

  let status: VerificationStatus | null = null;
  let loading = true;
  let error: string | null = null;

  const methodLabels = {
    ethereum: 'Ethereum',
    magic_link: 'Magic Link',
    oauth_github: 'GitHub',
    oauth_twitter: 'Twitter',
    oauth_google: 'Google',
    mfa_totp: 'Authenticator',
    mfa_sms: 'SMS'
  };

  const methodIcons = {
    ethereum: 'ethereum',
    magic_link: 'magic',
    oauth_github: 'github',
    oauth_twitter: 'twitter',
    oauth_google: 'google',
    mfa_totp: 'authenticator',
    mfa_sms: 'phone'
  };

  async function loadVerificationStatus() {
    try {
      loading = true;
      error = null;
      status = await userVerification.getVerificationStatus(userId);
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function getScoreColor(score: number): string {
    if (score >= 0.8) return 'success';
    if (score >= 0.5) return 'warning';
    return 'error';
  }

  onMount(() => {
    loadVerificationStatus();
  });
</script>

<div class="verification-badge" class:loading>
  {#if loading}
    <div class="loading-indicator" transition:fade>
      Loading verification status...
    </div>
  {:else if error}
    <div class="error" transition:fade>
      <Icon name="error" size={size} />
      <span class="error-text">Error loading verification status</span>
    </div>
  {:else if status}
    <div class="badge-container" transition:fade>
      <Tooltip text={showDetails ? undefined : 'Verification Status'}>
        <Badge
          variant={status.isVerified ? 'success' : 'neutral'}
          size={size}
          class="verification-status"
        >
          <div class="badge-content">
            <Icon
              name={status.isVerified ? 'verified' : 'unverified'}
              size={size}
            />
            {#if showDetails}
              <span class="score" style="color: var(--{getScoreColor(status.score)})">
                {Math.round(status.score * 100)}%
              </span>
            {/if}
          </div>
        </Badge>
      </Tooltip>

      {#if showDetails && status.methods.length > 0}
        <div class="verification-details" transition:fade>
          <h4>Verified with:</h4>
          <div class="methods-list">
            {#each status.methods as method}
              <Badge variant="info" size="sm">
                <Icon name={methodIcons[method]} size="sm" />
                <span>{methodLabels[method]}</span>
              </Badge>
            {/each}
          </div>
          {#if status.lastVerified}
            <div class="last-verified">
              Last verified: {status.lastVerified.toLocaleDateString()}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .verification-badge {
    display: inline-flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .badge-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .badge-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .verification-details {
    background: var(--surface-2);
    padding: 1rem;
    border-radius: 0.5rem;
    font-size: 0.9rem;
  }

  .verification-details h4 {
    margin: 0 0 0.5rem 0;
    color: var(--text-2);
  }

  .methods-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .last-verified {
    margin-top: 0.5rem;
    font-size: 0.8rem;
    color: var(--text-2);
  }

  .loading-indicator {
    color: var(--text-2);
    font-size: 0.9rem;
  }

  .error {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--error);
    font-size: 0.9rem;
  }

  .score {
    font-weight: 600;
  }
</style> 