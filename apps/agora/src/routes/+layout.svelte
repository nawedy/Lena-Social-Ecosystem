<!-- apps/agora/src/routes/+layout.svelte -->
<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { auth, isAuthenticated } from '$lib/auth/store';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { Navbar } from '$lib/components/navigation';
  import { Footer } from '$lib/components/navigation';
  import { NotificationContainer } from '$lib/components/notification';
  import { Web3Provider } from '$lib/components/web3';
  import { LoadingScreen } from '$lib/components/ui';

  // Protected routes that require authentication
  const protectedRoutes = [
    '/profile',
    '/settings',
    '/listings/create',
    '/listings/edit',
    '/orders',
    '/wallet'
  ];

  let loading = true;

  onMount(async () => {
    try {
      // Initialize auth store
      await auth.init();

      // Check if current route requires authentication
      const currentPath = $page.url.pathname;
      const requiresAuth = protectedRoutes.some(route => currentPath.startsWith(route));

      if (requiresAuth && !$isAuthenticated) {
        goto('/auth');
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
    } finally {
      loading = false;
    }
  });
</script>

{#if loading}
  <LoadingScreen />
{:else}
  <div class="app min-h-screen bg-background font-manrope">
    <Web3Provider>
      <Navbar />
      <main class="container mx-auto px-4 py-8">
        <slot />
      </main>
      <Footer />
      <NotificationContainer />
    </Web3Provider>
  </div>
{/if}

<style>
  .app {
    display: flex;
    flex-direction: column;
  }

  main {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  :global(body) {
    @apply antialiased;
  }

  :global(.dark) {
    color-scheme: dark;
  }
</style> 