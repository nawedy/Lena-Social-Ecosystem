<!-- Main Layout -->
<script lang="ts">
  import '@fontsource/exo';
  import '@fontsource/rajdhani';
  import '../app.css';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { auth } from '$lib/stores/auth';
  import { ToastContainer } from '@lena/ui';
  import { goto } from '$app/navigation';

  // Navigation items
  const navItems = [
    { href: '/feed', label: 'For You', icon: '🎵' },
    { href: '/following', label: 'Following', icon: '👥' },
    { href: '/live', label: 'LIVE', icon: '🔴' },
    { href: '/profile', label: 'Profile', icon: '👤' }
  ];

  // Handle sign out
  async function handleSignOut() {
    try {
      await auth.signOut();
      window.location.href = '/';
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }

  onMount(() => {
    if (browser && !$auth.user && !$page.url.pathname.startsWith('/auth')) {
      goto('/auth/login');
    }
  });
</script>

<!-- Toast Container -->
<ToastContainer />

{#if $auth.user || $page.url.pathname.startsWith('/auth')}
  <!-- Mobile Navigation (Bottom) -->
  <nav class="fixed bottom-0 left-0 right-0 h-16 bg-black/90 backdrop-blur-sm border-t border-primary-900/50 z-40 md:hidden">
    <div class="grid grid-cols-4 h-full">
      {#each navItems as { href, label, icon }}
        <a
          {href}
          class="flex flex-col items-center justify-center text-gray-400 hover:text-white transition-colors"
          class:text-white={$page.url.pathname === href}
        >
          <span class="text-xl">{icon}</span>
          <span class="text-xs mt-1">{label}</span>
        </a>
      {/each}
    </div>
  </nav>

  <!-- Desktop Navigation (Side) -->
  <nav class="fixed top-0 left-0 bottom-0 w-64 bg-black/90 backdrop-blur-sm border-r border-primary-900/50 z-40 hidden md:flex flex-col">
    <!-- Logo -->
    <a href="/" class="p-6">
      <h1 class="text-2xl font-display font-bold text-gradient">Lena Shorts</h1>
    </a>

    <!-- Navigation Links -->
    <div class="flex-1 px-2">
      {#each navItems as { href, label, icon }}
        <a
          {href}
          class="flex items-center px-4 py-3 rounded-lg text-gray-400 hover:text-white hover:bg-primary-900/20 transition-all"
          class:text-white={$page.url.pathname === href}
        >
          <span class="text-xl mr-3">{icon}</span>
          <span>{label}</span>
        </a>
      {/each}
    </div>

    <!-- User Menu -->
    {#if $auth.user}
      <div class="p-4 border-t border-primary-900/50">
        <button
          class="flex items-center w-full px-4 py-3 rounded-lg text-gray-400 hover:text-white hover:bg-primary-900/20 transition-all"
          on:click={handleSignOut}
        >
          <span class="text-xl mr-3">👋</span>
          <span>Sign Out</span>
        </button>
      </div>
    {/if}
  </nav>

  <!-- Main Content -->
  <main class="min-h-screen pb-16 md:pb-0 md:pl-64">
    <slot />
  </main>
{:else}
  <slot />
{/if}

<style lang="postcss">
  .text-gradient {
    @apply bg-clip-text text-transparent bg-gradient-to-r from-primary-400 to-primary-600;
  }
</style> 