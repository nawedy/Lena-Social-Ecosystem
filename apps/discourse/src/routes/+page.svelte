<!-- apps/discourse/src/routes/+page.svelte -->
<script lang="ts">
  import { isAuthenticated, auth } from '$lib/auth/store';
  import { Button } from '@lena/ui-core';
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
          Welcome to Discourse
        </h1>
        <Button variant="outline" on:click={handleSignOut}>
          Sign Out
        </Button>
      </div>

      <div class="bg-card rounded-lg shadow-lg p-6">
        <p class="text-muted-foreground">
          You are signed in. Start exploring or creating debates!
        </p>
        <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Button variant="primary" on:click={() => goto('/debates/create')}>
            Create Debate
          </Button>
          <Button variant="outline" on:click={() => goto('/debates')}>
            Explore Debates
          </Button>
        </div>
      </div>
    </div>
  {:else}
    <div class="max-w-4xl mx-auto text-center">
      <h1 class="text-4xl font-playfair font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl md:text-6xl">
        <span class="block">Welcome to Discourse</span>
        <span class="block text-primary mt-2">Where Ideas Take Shape</span>
      </h1>
      <p class="mt-3 text-base text-muted-foreground sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl">
        Join our community of thinkers and engage in meaningful debates. Share your perspectives, challenge ideas, and contribute to thoughtful discussions.
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

<style>
  :global(body) {
    @apply antialiased;
  }

  :global(.dark) {
    color-scheme: dark;
  }
</style> 