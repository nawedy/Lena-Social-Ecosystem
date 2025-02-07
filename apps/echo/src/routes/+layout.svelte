<!-- apps/echo/src/routes/+layout.svelte -->
<script lang="ts">
  import '../app.postcss';
  import { onMount } from 'svelte';
  import { auth, isAuthenticated } from '$lib/auth/store';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';

  // Protected routes that require authentication
  const protectedRoutes = [
    '/profile',
    '/settings',
    '/create',
    '/messages'
  ];

  onMount(async () => {
    // Initialize auth store
    await auth.init();

    // Check if current route requires authentication
    const currentPath = $page.url.pathname;
    const requiresAuth = protectedRoutes.some(route => currentPath.startsWith(route));

    if (requiresAuth && !$isAuthenticated) {
      goto('/auth');
    }
  });
</script>

<div class="app min-h-screen bg-white dark:bg-gray-900">
  <main>
    <slot />
  </main>
</div>

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
</style> 