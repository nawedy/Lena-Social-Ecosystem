<!-- AuthForm.svelte -->
<script lang="ts">
  import { auth, isAuthenticated } from '$lib/auth/store';
  import { onMount } from 'svelte';
  import { Magic } from 'magic-sdk';
  import { ethers } from 'ethers';
  import { env } from '$env/dynamic/public';
  import { enhance } from '$app/forms';
  import { page } from '$app/stores';
  import Button from '../ui/Button.svelte';
  import Input from '../ui/Input.svelte';
  import Alert from '../ui/Alert.svelte';

  let email = '';
  let password = '';
  let loading = false;
  let error: string | null = null;
  let mode: 'signin' | 'signup' = 'signin';

  // Initialize Magic SDK
  const magic = new Magic(env.PUBLIC_MAGIC_PUBLISHABLE_KEY);

  async function handleSubmit() {
    loading = true;
    error = null;

    try {
      if (mode === 'signin') {
        await auth.signInWithEmail(email, password);
      } else {
        await auth.signUpWithEmail(email, password);
      }
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function handleMagicLink() {
    loading = true;
    error = null;

    try {
      await auth.signInWithMagic(email);
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function handleWeb3Login() {
    loading = true;
    error = null;

    try {
      await auth.signInWithWeb3();
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    // Check for redirect from OAuth providers
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      auth.handleRedirect();
    }
  });
</script>

<div class="auth-form">
  {#if $isAuthenticated}
    <div class="success">
      <Alert type="success">
        You are signed in! Redirecting...
      </Alert>
    </div>
  {:else}
    <form on:submit|preventDefault={handleSubmit} use:enhance>
      {#if error}
        <Alert type="error">
          {error}
        </Alert>
      {/if}

      <div class="form-group">
        <Input
          type="email"
          label="Email"
          bind:value={email}
          placeholder="Enter your email"
          required
        />
      </div>

      {#if mode === 'signin' || mode === 'signup'}
        <div class="form-group">
          <Input
            type="password"
            label="Password"
            bind:value={password}
            placeholder="Enter your password"
            required
          />
        </div>
      {/if}

      <div class="actions">
        <Button
          type="submit"
          variant="primary"
          loading={loading}
          disabled={loading}
        >
          {mode === 'signin' ? 'Sign In' : 'Sign Up'}
        </Button>

        <Button
          type="button"
          variant="outline"
          on:click={() => mode = mode === 'signin' ? 'signup' : 'signin'}
          disabled={loading}
        >
          {mode === 'signin' ? 'Need an account?' : 'Already have an account?'}
        </Button>
      </div>

      <div class="divider">
        <span>or continue with</span>
      </div>

      <div class="social-auth">
        <Button
          type="button"
          variant="outline"
          on:click={handleMagicLink}
          disabled={loading || !email}
        >
          Magic Link
        </Button>

        <Button
          type="button"
          variant="outline"
          on:click={handleWeb3Login}
          disabled={loading}
        >
          Web3 Wallet
        </Button>
      </div>
    </form>
  {/if}
</div>

<style lang="postcss">
  .auth-form {
    @apply w-full max-w-md mx-auto p-6 space-y-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg;
  }

  .form-group {
    @apply space-y-2;
  }

  .actions {
    @apply space-y-4;
  }

  .divider {
    @apply relative my-8;
  }

  .divider::before {
    content: '';
    @apply absolute inset-0 flex items-center;
  }

  .divider::before {
    content: '';
    @apply border-t border-gray-200 dark:border-gray-700;
  }

  .divider span {
    @apply relative z-10 px-3 text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800;
  }

  .social-auth {
    @apply grid grid-cols-2 gap-4;
  }

  .success {
    @apply text-center py-8;
  }
</style> 