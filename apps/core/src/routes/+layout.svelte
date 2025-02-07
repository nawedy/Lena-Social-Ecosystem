<!-- Main Layout -->
<script lang="ts">
  import '@fontsource/exo';
  import '@fontsource/rajdhani';
  import '../app.css';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { auth } from '$lib/stores/auth';
  import { toasts } from '@lena/ui';
  import { ToastContainer } from '@lena/ui';
  import Plausible from 'plausible-tracker';
  import { goto } from '$app/navigation';

  let showUserMenu = false;

  // Initialize privacy-focused analytics
  onMount(() => {
    if (browser) {
      const plausible = Plausible({
        domain: 'lena.app',
        trackLocalhost: false,
        apiHost: 'https://analytics.lena.app'
      });
      plausible.enableAutoPageviews();
    }
  });

  // Handle authentication state
  $: if ($auth.error) {
    toasts.add({
      type: 'error',
      title: 'Authentication Error',
      message: $auth.error.message
    });
  }

  // Protected routes
  const protectedPaths = ['/feed', '/explore', '/messages', '/profile', '/settings'];
  $: isProtectedRoute = protectedPaths.some(path => $page.url.pathname.startsWith(path));

  // Redirect unauthenticated users
  $: if (isProtectedRoute && !$auth.isLoading && !$auth.user) {
    toasts.add({
      type: 'warning',
      message: 'Please sign in to access this page'
    });
    window.location.href = '/';
  }

  // Initialize auth store
  onMount(() => {
    auth.init();
  });
</script>

{#if $auth.isLoading}
  <div class="flex h-screen items-center justify-center">
    <div class="h-32 w-32 animate-spin rounded-full border-b-2 border-primary-500"></div>
  </div>
{:else}
  <div class="flex min-h-screen flex-col">
    {#if $auth.user}
      <header class="sticky top-0 z-50 border-b bg-white/80 backdrop-blur">
        <nav class="mx-auto flex max-w-7xl items-center justify-between p-4">
          <div class="flex items-center gap-8">
            <a href="/" class="text-2xl font-bold text-primary-500">TikTokToe</a>
            <div class="hidden items-center gap-4 md:flex">
              <a
                href="/feed"
                class="rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-100"
                class:text-primary-500={$page.url.pathname === '/feed'}
              >
                Feed
              </a>
              <a
                href="/explore"
                class="rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-100"
                class:text-primary-500={$page.url.pathname === '/explore'}
              >
                Explore
              </a>
              <a
                href="/messages"
                class="rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-100"
                class:text-primary-500={$page.url.pathname === '/messages'}
              >
                Messages
              </a>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <button
              type="button"
              class="rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
              on:click={() => goto('/new')}
            >
              New Post
            </button>
            <div class="relative">
              <button
                type="button"
                class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-100"
                on:click={() => (showUserMenu = !showUserMenu)}
              >
                <img
                  src={$auth.user.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${$auth.user.email}`}
                  alt="Avatar"
                  class="h-8 w-8 rounded-full"
                />
                <span class="hidden md:inline">{$auth.user.email}</span>
              </button>
              {#if showUserMenu}
                <div
                  class="absolute right-0 mt-2 w-48 rounded-lg border bg-white py-1 shadow-lg"
                  on:click={() => (showUserMenu = false)}
                  on:keydown={(e) => e.key === 'Escape' && (showUserMenu = false)}
                >
                  <a
                    href="/profile"
                    class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Profile
                  </a>
                  <a
                    href="/settings"
                    class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Settings
                  </a>
                  <button
                    type="button"
                    class="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100"
                    on:click={() => auth.signOut()}
                  >
                    Sign Out
                  </button>
                </div>
              {/if}
            </div>
          </div>
        </nav>
      </header>
    {:else}
      <header class="sticky top-0 z-50 border-b bg-white/80 backdrop-blur">
        <nav class="mx-auto flex max-w-7xl items-center justify-between p-4">
          <a href="/" class="text-2xl font-bold text-primary-500">TikTokToe</a>
          <div class="flex items-center gap-4">
            <a
              href="/login"
              class="rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-100"
            >
              Log In
            </a>
            <a
              href="/signup"
              class="rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
            >
              Sign Up
            </a>
          </div>
        </nav>
      </header>
    {/if}

    <main class="flex-1">
      <slot />
    </main>

    {#if !$auth.user}
      <footer class="border-t bg-gray-50">
        <div class="mx-auto max-w-7xl px-4 py-12">
          <div class="grid grid-cols-2 gap-8 md:grid-cols-4">
            <div>
              <h3 class="text-sm font-semibold uppercase tracking-wider text-gray-400">
                Company
              </h3>
              <div class="mt-4 flex flex-col gap-2">
                <a href="/about" class="text-sm text-gray-600 hover:text-gray-900">About</a>
                <a href="/blog" class="text-sm text-gray-600 hover:text-gray-900">Blog</a>
                <a href="/careers" class="text-sm text-gray-600 hover:text-gray-900">Careers</a>
              </div>
            </div>
            <div>
              <h3 class="text-sm font-semibold uppercase tracking-wider text-gray-400">
                Product
              </h3>
              <div class="mt-4 flex flex-col gap-2">
                <a href="/features" class="text-sm text-gray-600 hover:text-gray-900">Features</a>
                <a href="/pricing" class="text-sm text-gray-600 hover:text-gray-900">Pricing</a>
                <a href="/security" class="text-sm text-gray-600 hover:text-gray-900">Security</a>
              </div>
            </div>
            <div>
              <h3 class="text-sm font-semibold uppercase tracking-wider text-gray-400">
                Resources
              </h3>
              <div class="mt-4 flex flex-col gap-2">
                <a href="/docs" class="text-sm text-gray-600 hover:text-gray-900">Documentation</a>
                <a href="/guides" class="text-sm text-gray-600 hover:text-gray-900">Guides</a>
                <a href="/support" class="text-sm text-gray-600 hover:text-gray-900">Support</a>
              </div>
            </div>
            <div>
              <h3 class="text-sm font-semibold uppercase tracking-wider text-gray-400">
                Legal
              </h3>
              <div class="mt-4 flex flex-col gap-2">
                <a href="/privacy" class="text-sm text-gray-600 hover:text-gray-900">Privacy</a>
                <a href="/terms" class="text-sm text-gray-600 hover:text-gray-900">Terms</a>
                <a href="/cookies" class="text-sm text-gray-600 hover:text-gray-900">Cookies</a>
              </div>
            </div>
          </div>
          <div class="mt-8 border-t pt-8">
            <p class="text-center text-sm text-gray-400">
              &copy; {new Date().getFullYear()} TikTokToe. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    {/if}
  </div>
{/if}

<ToastContainer />

<style lang="postcss">
  :global(html) {
    @apply antialiased;
  }

  :global(::-webkit-scrollbar) {
    width: 8px;
  }

  :global(::-webkit-scrollbar-track) {
    background: theme(colors.black);
  }

  :global(::-webkit-scrollbar-thumb) {
    background: theme(colors.primary.700);
    border-radius: 4px;
  }

  :global(::-webkit-scrollbar-thumb:hover) {
    background: theme(colors.primary.600);
  }

  .nav-link {
    @apply text-gray-400 hover:text-white transition-colors;
  }

  .footer-link {
    @apply text-gray-400 hover:text-white transition-colors;
  }

  .text-gradient {
    @apply bg-clip-text text-transparent bg-gradient-to-r from-primary-400 to-primary-600;
  }
</style> 