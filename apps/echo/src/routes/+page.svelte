<!-- Echo Platform Main Page -->
<script lang="ts">
  import { isAuthenticated, auth } from '$lib/auth/store';
  import Button from '$lib/components/ui/Button.svelte';
  import { goto } from '$app/navigation';

  async function handleSignOut() {
    await auth.signOut();
    goto('/auth');
  }
</script>

<div class="container mx-auto px-4 py-8">
  {#if $isAuthenticated}
    <div class="max-w-4xl mx-auto">
      <div class="flex justify-between items-center mb-8">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          Welcome to Echo
        </h1>
        <Button variant="outline" on:click={handleSignOut}>
          Sign Out
        </Button>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <p class="text-gray-600 dark:text-gray-300">
          You are signed in. Start exploring or creating content!
        </p>
        <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Button variant="primary" on:click={() => goto('/create')}>
            Create Post
          </Button>
          <Button variant="outline" on:click={() => goto('/explore')}>
            Explore
          </Button>
        </div>
      </div>
    </div>
  {:else}
    <div class="max-w-4xl mx-auto text-center">
      <h1 class="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl md:text-6xl">
        <span class="block">Welcome to Echo</span>
        <span class="block text-primary-600">Your Decentralized Social Platform</span>
      </h1>
      <p class="mt-3 text-base text-gray-500 dark:text-gray-400 sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl">
        Join our community of creators and connect with others in a secure, decentralized environment.
      </p>
      <div class="mt-5 sm:mt-8 sm:flex sm:justify-center">
        <div class="rounded-md shadow">
          <Button
            variant="primary"
            size="lg"
            on:click={() => goto('/auth')}
          >
            Get Started
          </Button>
        </div>
        <div class="mt-3 sm:mt-0 sm:ml-3">
          <Button
            variant="outline"
            size="lg"
            on:click={() => goto('/about')}
          >
            Learn More
          </Button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style lang="postcss">
  :global(body) {
    @apply antialiased;
  }

  :global(.dark) {
    color-scheme: dark;
  }
</style> 