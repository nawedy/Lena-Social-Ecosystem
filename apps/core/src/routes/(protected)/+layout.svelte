<!-- Protected Layout -->
<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import { page } from '$app/stores';
  import { toasts } from '@lena/ui';
  import { onMount } from 'svelte';

  // Navigation items
  const navItems = [
    { href: '/feed', label: 'Feed', icon: '📱' },
    { href: '/explore', label: 'Explore', icon: '🔍' },
    { href: '/messages', label: 'Messages', icon: '💬' },
    { href: '/profile', label: 'Profile', icon: '👤' }
  ];

  // Handle sign out
  async function handleSignOut() {
    try {
      await auth.signOut();
      window.location.href = '/';
    } catch (error) {
      toasts.add({
        type: 'error',
        title: 'Sign Out Error',
        message: error instanceof Error ? error.message : 'Failed to sign out'
      });
    }
  }

  onMount(() => {
    if (browser && !$auth.user) {
      toasts.error('Please sign in to access this page');
      goto('/login');
    }
  });
</script>

{#if $auth.user}
  <!-- Desktop Navigation -->
  <nav class="fixed top-0 left-0 right-0 h-16 bg-black/50 backdrop-blur-sm border-b border-primary-900/50 z-40">
    <div class="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
      <!-- Logo -->
      <a href="/" class="text-2xl font-display font-bold text-gradient">
        Lena
      </a>
      
      <!-- Navigation Links -->
      <div class="hidden md:flex items-center space-x-8">
        {#each navItems as { href, label }}
          <a
            {href}
            class="nav-link"
            class:active={$page.url.pathname.startsWith(href)}
          >
            {label}
          </a>
        {/each}
      </div>
      
      <!-- User Menu -->
      <div class="relative group">
        <button class="flex items-center space-x-2">
          <img
            src={$auth.profile?.avatar_url || `https://api.dicebear.com/7.x/shapes/svg?seed=${$auth.user.id}`}
            alt={$auth.profile?.username || 'User avatar'}
            class="w-8 h-8 rounded-full bg-primary-900/50"
          />
          <span class="hidden md:block">{$auth.profile?.username || 'User'}</span>
        </button>
        
        <!-- Dropdown Menu -->
        <div class="absolute right-0 mt-2 w-48 py-2 bg-black/90 backdrop-blur-sm border border-primary-900/50 rounded-lg shadow-xl opacity-0 translate-y-2 invisible group-hover:opacity-100 group-hover:translate-y-0 group-hover:visible transition-all duration-200">
          <a href="/profile" class="block px-4 py-2 hover:bg-primary-900/20">Profile</a>
          <a href="/settings" class="block px-4 py-2 hover:bg-primary-900/20">Settings</a>
          <button
            class="w-full text-left px-4 py-2 text-red-400 hover:bg-red-900/20"
            on:click={handleSignOut}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  </nav>

  <!-- Mobile Navigation -->
  <nav class="fixed bottom-0 left-0 right-0 h-16 bg-black/50 backdrop-blur-sm border-t border-primary-900/50 md:hidden z-40">
    <div class="grid grid-cols-4 h-full">
      {#each navItems as { href, label, icon }}
        <a
          {href}
          class="flex flex-col items-center justify-center"
          class:active={$page.url.pathname.startsWith(href)}
        >
          <span class="text-xl">{icon}</span>
          <span class="text-xs">{label}</span>
        </a>
      {/each}
    </div>
  </nav>

  <!-- Main Content -->
  <main class="pt-16 pb-16 md:pb-0 min-h-screen">
    <slot />
  </main>
{/if}

<style lang="postcss">
  .nav-link {
    @apply text-gray-400 hover:text-white transition-colors;
    
    &.active {
      @apply text-white;
    }
  }
  
  .text-gradient {
    @apply bg-clip-text text-transparent bg-gradient-to-r from-primary-400 to-primary-600;
  }
</style> 