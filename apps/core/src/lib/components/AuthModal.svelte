<!-- Authentication Modal -->
<script lang="ts">
  import { auth } from '$lib/stores/auth';
  import { fade, scale } from 'svelte/transition';
  import { createEventDispatcher } from 'svelte';
  
  export let isOpen = false;
  export let mode: 'signin' | 'signup' = 'signin';
  
  const dispatch = createEventDispatcher();
  
  let email = '';
  let password = '';
  let username = '';
  let isLoading = false;
  let error: Error | null = null;
  
  async function handleSubmit() {
    try {
      isLoading = true;
      error = null;

      if (mode === 'signin') {
        await auth.signInWithEmail(email, password);
      } else {
        await auth.signUpWithEmail(email, password, username);
      }

      dispatch('success');
      close();
    } catch (err) {
      error = err instanceof Error ? err : new Error('An unknown error occurred');
    } finally {
      isLoading = false;
    }
  }
  
  async function handleWeb3Login() {
    try {
      isLoading = true;
      error = null;
      await auth.signInWithEthereum();
      dispatch('success');
      close();
    } catch (err) {
      error = err instanceof Error ? err : new Error('An unknown error occurred');
    } finally {
      isLoading = false;
    }
  }
  
  function close() {
    email = '';
    password = '';
    username = '';
    error = null;
    dispatch('close');
  }
  
  function switchMode() {
    mode = mode === 'signin' ? 'signup' : 'signin';
    error = null;
  }
</script>

{#if isOpen}
  <div
    class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    transition:fade={{ duration: 200 }}
    on:click|self={close}
  >
    <div
      class="bg-gray-900 rounded-lg shadow-xl w-full max-w-md p-6 space-y-6"
      transition:scale={{ duration: 200 }}
    >
      <div class="text-center">
        <h2 class="text-2xl font-bold text-white mb-2">
          {mode === 'signin' ? 'Sign In' : 'Create Account'}
        </h2>
        <p class="text-gray-400">
          {mode === 'signin'
            ? 'Welcome back! Sign in to continue.'
            : 'Join TikTokToe today!'}
        </p>
      </div>

      <button
        class="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center space-x-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        on:click={handleWeb3Login}
        disabled={isLoading}
      >
        <svg
          class="w-5 h-5"
          viewBox="0 0 784 784"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M392 0L385.76 21.16V536.72L392 542.96L633.28 400.44L392 0Z"
            fill="white"
            fill-opacity="0.85"
          />
          <path
            d="M392 0L150.72 400.44L392 542.96V290.64V0Z"
            fill="white"
          />
          <path
            d="M392 588.812L388.692 592.902V776.902L392 784.002L633.48 446.292L392 588.812Z"
            fill="white"
            fill-opacity="0.85"
          />
          <path
            d="M392 784.002V588.812L150.72 446.292L392 784.002Z"
            fill="white"
          />
          <path
            d="M392 542.959L633.28 400.439L392 290.639V542.959Z"
            fill="white"
            fill-opacity="0.5"
          />
          <path
            d="M150.72 400.439L392 542.959V290.639L150.72 400.439Z"
            fill="white"
            fill-opacity="0.85"
          />
        </svg>
        <span>Continue with Ethereum</span>
      </button>

      <div class="relative">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-gray-700" />
        </div>
        <div class="relative flex justify-center text-sm">
          <span class="px-2 bg-gray-900 text-gray-400">Or continue with</span>
        </div>
      </div>

      <form on:submit|preventDefault={handleSubmit} class="space-y-4">
        {#if mode === 'signup'}
          <div>
            <label for="username" class="block text-sm font-medium text-gray-400 mb-1">
              Username
            </label>
            <input
              type="text"
              id="username"
              bind:value={username}
              class="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400"
              placeholder="Choose a username"
              required
              disabled={isLoading}
            />
          </div>
        {/if}

        <div>
          <label for="email" class="block text-sm font-medium text-gray-400 mb-1">
            Email
          </label>
          <input
            type="email"
            id="email"
            bind:value={email}
            class="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400"
            placeholder="Enter your email"
            required
            disabled={isLoading}
          />
        </div>

        <div>
          <label for="password" class="block text-sm font-medium text-gray-400 mb-1">
            Password
          </label>
          <input
            type="password"
            id="password"
            bind:value={password}
            class="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400"
            placeholder="Enter your password"
            required
            disabled={isLoading}
          />
        </div>

        {#if error}
          <div class="text-red-500 text-sm">{error.message}</div>
        {/if}

        <button
          type="submit"
          class="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading}
        >
          {#if isLoading}
            <span class="flex items-center justify-center">
              <svg
                class="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                />
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Processing...
            </span>
          {:else}
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          {/if}
        </button>
      </form>

      <div class="text-center text-sm">
        <span class="text-gray-400">
          {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}
        </span>
        <button
          class="text-blue-500 hover:text-blue-400 font-medium ml-1"
          on:click={switchMode}
        >
          {mode === 'signin' ? 'Sign Up' : 'Sign In'}
        </button>
      </div>
    </div>
  </div>
{/if} 