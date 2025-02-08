<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { userVerification } from '$lib/services/verification/UserVerification';
  import type { VerificationStatus } from '$lib/types';
  import {
    Button,
    Card,
    Icon,
    Input,
    Alert,
    Badge,
    Spinner
  } from '$lib/components/ui';
  import VerificationBadge from './VerificationBadge.svelte';

  export let userId: string;

  let status: VerificationStatus | null = null;
  let loading = false;
  let error: string | null = null;
  let activeMethod: string | null = null;
  let verificationData = {
    email: '',
    code: '',
    provider: ''
  };

  const verificationMethods = [
    {
      id: 'ethereum',
      label: 'Ethereum Wallet',
      description: 'Verify your identity using your Ethereum wallet',
      icon: 'ethereum'
    },
    {
      id: 'magic_link',
      label: 'Magic Link',
      description: 'Verify using a secure magic link sent to your email',
      icon: 'magic'
    },
    {
      id: 'oauth_github',
      label: 'GitHub',
      description: 'Verify using your GitHub account',
      icon: 'github'
    },
    {
      id: 'oauth_twitter',
      label: 'Twitter',
      description: 'Verify using your Twitter account',
      icon: 'twitter'
    },
    {
      id: 'oauth_google',
      label: 'Google',
      description: 'Verify using your Google account',
      icon: 'google'
    },
    {
      id: 'mfa_totp',
      label: 'Authenticator App',
      description: 'Use a two-factor authentication app',
      icon: 'authenticator'
    },
    {
      id: 'mfa_sms',
      label: 'SMS Authentication',
      description: 'Verify using SMS codes',
      icon: 'phone'
    }
  ];

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

  async function startVerification(methodId: string) {
    activeMethod = methodId;
    verificationData = {
      email: '',
      code: '',
      provider: ''
    };
  }

  async function verifyWithEthereum() {
    try {
      loading = true;
      error = null;

      if (!window.ethereum) {
        throw new Error('Please install MetaMask or another Ethereum wallet');
      }

      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      await userVerification.verifyWithEthereum(accounts[0]);
      await loadVerificationStatus();
      activeMethod = null;
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function verifyWithMagicLink() {
    try {
      loading = true;
      error = null;

      if (!verificationData.email) {
        throw new Error('Please enter your email address');
      }

      await userVerification.verifyWithMagicLink(verificationData.email);
      await loadVerificationStatus();
      activeMethod = null;
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function verifyWithOAuth(provider: string) {
    try {
      loading = true;
      error = null;

      const width = 600;
      const height = 600;
      const left = window.innerWidth / 2 - width / 2;
      const top = window.innerHeight / 2 - height / 2;

      const popup = window.open(
        `/api/auth/oauth/${provider}`,
        `Verify with ${provider}`,
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!popup) {
        throw new Error('Please allow popups for this site');
      }

      const result = await new Promise((resolve, reject) => {
        window.addEventListener('message', async (event) => {
          if (event.origin !== window.location.origin) return;

          if (event.data.type === 'oauth_callback') {
            if (event.data.error) {
              reject(new Error(event.data.error));
            } else {
              const proof = await userVerification.verifyWithOAuth(
                provider,
                event.data.code
              );
              resolve(proof);
            }
          }
        });
      });

      await loadVerificationStatus();
      activeMethod = null;
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function verifyWithMFA(method: 'totp' | 'sms') {
    try {
      loading = true;
      error = null;

      if (!verificationData.code) {
        throw new Error('Please enter the verification code');
      }

      await userVerification.verifyWithMFA(
        userId,
        verificationData.code,
        method
      );
      await loadVerificationStatus();
      activeMethod = null;
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function revokeVerification(method?: string) {
    try {
      loading = true;
      error = null;

      await userVerification.revokeVerification(userId, method);
      await loadVerificationStatus();
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadVerificationStatus();
  });
</script>

<div class="verification-settings">
  <header class="settings-header">
    <h2>Verification Settings</h2>
    <VerificationBadge {userId} showDetails />
  </header>

  {#if error}
    <Alert variant="error" class="error-alert" transition:fade>
      {error}
    </Alert>
  {/if}

  <div class="methods-grid">
    {#each verificationMethods as method}
      {@const isVerified = status?.methods.includes(method.id)}
      <Card class="method-card" interactive={!isVerified}>
        <div class="method-header">
          <Icon name={method.icon} size="lg" />
          <div class="method-info">
            <h3>{method.label}</h3>
            <p>{method.description}</p>
          </div>
          {#if isVerified}
            <Badge variant="success" size="sm">Verified</Badge>
          {/if}
        </div>

        <div class="method-actions">
          {#if isVerified}
            <Button
              variant="danger"
              size="sm"
              on:click={() => revokeVerification(method.id)}
              disabled={loading}
            >
              Revoke
            </Button>
          {:else}
            <Button
              variant="primary"
              size="sm"
              on:click={() => startVerification(method.id)}
              disabled={loading}
            >
              Verify
            </Button>
          {/if}
        </div>

        {#if activeMethod === method.id}
          <div class="verification-form" transition:slide>
            {#if method.id === 'ethereum'}
              <Button
                variant="primary"
                on:click={verifyWithEthereum}
                disabled={loading}
                class="full-width"
              >
                Connect Wallet
              </Button>
            {:else if method.id === 'magic_link'}
              <Input
                type="email"
                placeholder="Enter your email"
                bind:value={verificationData.email}
              />
              <Button
                variant="primary"
                on:click={verifyWithMagicLink}
                disabled={loading}
                class="full-width"
              >
                Send Magic Link
              </Button>
            {:else if method.id.startsWith('oauth_')}
              <Button
                variant="primary"
                on:click={() => verifyWithOAuth(method.id.split('_')[1])}
                disabled={loading}
                class="full-width"
              >
                Continue with {method.label}
              </Button>
            {:else if method.id.startsWith('mfa_')}
              <Input
                type="text"
                placeholder="Enter verification code"
                bind:value={verificationData.code}
              />
              <Button
                variant="primary"
                on:click={() => verifyWithMFA(method.id.split('_')[1] as 'totp' | 'sms')}
                disabled={loading}
                class="full-width"
              >
                Verify Code
              </Button>
            {/if}
          </div>
        {/if}
      </Card>
    {/each}
  </div>

  {#if loading}
    <div class="loading-overlay" transition:fade>
      <Spinner size="lg" />
    </div>
  {/if}
</div>

<style>
  .verification-settings {
    position: relative;
    padding: 2rem;
  }

  .settings-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  .settings-header h2 {
    margin: 0;
    font-size: 1.5rem;
  }

  .error-alert {
    margin-bottom: 1rem;
  }

  .methods-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1rem;
  }

  .method-card {
    padding: 1.5rem;
  }

  .method-header {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .method-info {
    flex: 1;
  }

  .method-info h3 {
    margin: 0 0 0.25rem 0;
    font-size: 1.1rem;
  }

  .method-info p {
    margin: 0;
    color: var(--text-2);
    font-size: 0.9rem;
  }

  .method-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .verification-form {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(var(--background-rgb), 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }

  .full-width {
    width: 100%;
  }
</style> 