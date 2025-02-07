<!-- AuthModal.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Modal, Input, Button } from '@lena/ui';

  export let isOpen = false;
  export let mode: 'signin' | 'signup' = 'signin';

  const dispatch = createEventDispatcher<{
    success: { provider: string; email?: string; password?: string };
    close: void;
  }>();

  let email = '';
  let password = '';
  let confirmPassword = '';
  let loading = false;
  let error = '';

  $: isValid = email && password && (mode === 'signin' || password === confirmPassword);

  function handleSubmit() {
    if (!isValid) return;

    loading = true;
    error = '';

    // Dispatch success event
    dispatch('success', {
      provider: 'email',
      email,
      password
    });
  }

  function handleClose() {
    isOpen = false;
    email = '';
    password = '';
    confirmPassword = '';
    error = '';
    dispatch('close');
  }
</script>

<Modal
  bind:open={isOpen}
  title={mode === 'signin' ? 'Sign In' : 'Create Account'}
  size="sm"
  on:close={handleClose}
>
  <div class="space-y-6">
    <!-- Email Input -->
    <div class="space-y-2">
      <label for="email" class="block text-sm font-medium">
        Email
      </label>
      <Input
        id="email"
        type="email"
        bind:value={email}
        placeholder="Enter your email"
        required
      />
    </div>

    <!-- Password Input -->
    <div class="space-y-2">
      <label for="password" class="block text-sm font-medium">
        Password
      </label>
      <Input
        id="password"
        type="password"
        bind:value={password}
        placeholder="Enter your password"
        required
      />
    </div>

    <!-- Confirm Password (Sign Up Only) -->
    {#if mode === 'signup'}
      <div class="space-y-2">
        <label for="confirm-password" class="block text-sm font-medium">
          Confirm Password
        </label>
        <Input
          id="confirm-password"
          type="password"
          bind:value={confirmPassword}
          placeholder="Confirm your password"
          required
        />
      </div>
    {/if}

    <!-- Error Message -->
    {#if error}
      <p class="text-sm text-red-500">{error}</p>
    {/if}

    <!-- Web3 Sign In -->
    <div class="space-y-4">
      <div class="relative">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-gray-800" />
        </div>
        <div class="relative flex justify-center text-sm">
          <span class="px-2 bg-black text-gray-400">Or continue with</span>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <button
          class="flex items-center justify-center px-4 py-2 border border-primary-900/50 rounded-lg hover:bg-primary-900/20 transition-colors"
          on:click={() => dispatch('success', { provider: 'metamask' })}
        >
          <span class="text-xl mr-2">🦊</span>
          MetaMask
        </button>
        <button
          class="flex items-center justify-center px-4 py-2 border border-primary-900/50 rounded-lg hover:bg-primary-900/20 transition-colors"
          on:click={() => dispatch('success', { provider: 'at-protocol' })}
        >
          <span class="text-xl mr-2">🔑</span>
          AT Protocol
        </button>
      </div>
    </div>
  </div>

  <svelte:fragment slot="footer">
    <button
      class="px-4 py-2 text-gray-400 hover:text-white transition-colors"
      on:click={handleClose}
    >
      Cancel
    </button>
    <Button
      variant="primary"
      disabled={!isValid || loading}
      on:click={handleSubmit}
    >
      {loading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
    </Button>
  </svelte:fragment>
</Modal>

<style lang="postcss">
  :global(.modal-content) {
    @apply bg-black/90 backdrop-blur-sm;
  }
</style> 