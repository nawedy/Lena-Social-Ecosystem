<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import { toasts } from '@lena/ui';
  import { onMount } from 'svelte';

  let email = '';
  let password = '';
  let isLoading = false;

  onMount(() => {
    if (browser && $auth.user) {
      goto('/feed');
    }
  });

  async function handleEmailLogin() {
    try {
      isLoading = true;
      await auth.signIn(email, password);
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to sign in');
    } finally {
      isLoading = false;
    }
  }

  async function handleEthereumLogin() {
    try {
      isLoading = true;
      // Check if MetaMask is installed
      if (typeof window.ethereum === 'undefined') {
        throw new Error('Please install MetaMask to use this feature');
      }

      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const address = accounts[0];

      // Sign message with MetaMask
      const message = `Sign this message to prove you own this wallet and sign in to TikTokToe\n\nWallet address: ${address}\nTimestamp: ${Date.now()}`;
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, address]
      });

      // TODO: Implement Ethereum login with signature
      toasts.info('Ethereum login coming soon!');
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to sign in with Ethereum');
    } finally {
      isLoading = false;
    }
  }

  async function handleMagicLogin() {
    try {
      isLoading = true;
      // TODO: Implement Magic.link login
      toasts.info('Magic.link login coming soon!');
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to sign in with Magic.link');
    } finally {
      isLoading = false;
    }
  }
</script>

<svelte:head>
  <title>Log In - TikTokToe</title>
  <meta name="description" content="Log in to your TikTokToe account." />
</svelte:head>

<div class="flex min-h-full flex-1">
  <div class="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
    <div class="mx-auto w-full max-w-sm lg:w-96">
      <div>
        <h2 class="mt-8 text-2xl font-bold leading-9 tracking-tight">
          Sign in to your account
        </h2>
        <p class="mt-2 text-sm leading-6 text-gray-500">
          Don't have an account?
          <a href="/signup" class="font-semibold text-primary-500 hover:text-primary-600">
            Sign up
          </a>
        </p>
      </div>

      <div class="mt-10">
        <div>
          <form class="space-y-6" on:submit|preventDefault={handleEmailLogin}>
            <div>
              <label for="email" class="block text-sm font-medium leading-6">
                Email address
              </label>
              <div class="mt-2">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autocomplete="email"
                  required
                  bind:value={email}
                  class="block w-full rounded-md border-0 py-1.5 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm sm:leading-6"
                />
              </div>
            </div>

            <div>
              <label for="password" class="block text-sm font-medium leading-6">
                Password
              </label>
              <div class="mt-2">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autocomplete="current-password"
                  required
                  bind:value={password}
                  class="block w-full rounded-md border-0 py-1.5 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm sm:leading-6"
                />
              </div>
            </div>

            <div class="flex items-center justify-between">
              <div class="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  class="h-4 w-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                />
                <label for="remember-me" class="ml-3 block text-sm leading-6">
                  Remember me
                </label>
              </div>

              <div class="text-sm leading-6">
                <a href="/reset-password" class="font-semibold text-primary-500 hover:text-primary-600">
                  Forgot password?
                </a>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                class="flex w-full justify-center rounded-md bg-primary-500 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-primary-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {#if isLoading}
                  Signing in...
                {:else}
                  Sign in
                {/if}
              </button>
            </div>
          </form>
        </div>

        <div class="mt-10">
          <div class="relative">
            <div class="absolute inset-0 flex items-center" aria-hidden="true">
              <div class="w-full border-t border-gray-200" />
            </div>
            <div class="relative flex justify-center text-sm font-medium leading-6">
              <span class="bg-white px-6 text-gray-900">Or continue with</span>
            </div>
          </div>

          <div class="mt-6 grid grid-cols-2 gap-4">
            <button
              type="button"
              disabled={isLoading}
              on:click={handleEthereumLogin}
              class="flex w-full items-center justify-center gap-3 rounded-md bg-white px-3 py-2 text-sm font-semibold shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z" />
              </svg>
              <span class="text-sm font-semibold leading-6">Ethereum</span>
            </button>

            <button
              type="button"
              disabled={isLoading}
              on:click={handleMagicLogin}
              class="flex w-full items-center justify-center gap-3 rounded-md bg-white px-3 py-2 text-sm font-semibold shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-8.414l-3.293-3.293-1.414 1.414L12 17.414l7.707-7.707-1.414-1.414L12 14.586z" />
              </svg>
              <span class="text-sm font-semibold leading-6">Magic Link</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="relative hidden w-0 flex-1 lg:block">
    <img
      class="absolute inset-0 h-full w-full object-cover"
      src="https://images.unsplash.com/photo-1496917756835-20cb06e75b4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=1908&q=80"
      alt=""
    />
  </div>
</div> 