&lt;script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { page } from '$app/stores';
  import { Button, Icon, Avatar } from '@tiktok-toe/ui-shared/components/ui';
  import { userStore } from '@tiktok-toe/shared/stores/user';
  import { themeStore } from '@tiktok-toe/shared/stores/theme';
  import { performanceService } from '@tiktok-toe/shared/services/optimization/PerformanceService';

  let mounted = false;
  let menuOpen = false;
  let searchOpen = false;
  let notificationsOpen = false;
  let profileMenuOpen = false;

  const navigationItems = [
    { href: '/', label: 'Home', icon: 'home' },
    { href: '/explore', label: 'Explore', icon: 'compass' },
    { href: '/create', label: 'Create', icon: 'plus-circle' },
    { href: '/messages', label: 'Messages', icon: 'message-circle' },
    { href: '/profile', label: 'Profile', icon: 'user' }
  ];

  onMount(() => {
    mounted = true;
    performanceService.optimizeForInteraction();
  });

  function toggleMenu() {
    menuOpen = !menuOpen;
  }

  function toggleSearch() {
    searchOpen = !searchOpen;
  }

  function toggleNotifications() {
    notificationsOpen = !notificationsOpen;
  }

  function toggleProfileMenu() {
    profileMenuOpen = !profileMenuOpen;
  }

  function toggleTheme() {
    $themeStore.darkMode = !$themeStore.darkMode;
  }
</script>

<div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
  <!-- Header -->
  <header class="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800">
    <div class="container mx-auto px-4 h-16 flex items-center justify-between">
      <!-- Logo -->
      <div class="flex items-center">
        <button
          class="lg:hidden mr-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          on:click={toggleMenu}
        >
          <Icon name={menuOpen ? 'x' : 'menu'} class="w-6 h-6" />
        </button>
        <a href="/" class="text-2xl font-bold text-primary-500">
          LensApp
        </a>
      </div>

      <!-- Search -->
      <div class="hidden lg:flex flex-1 max-w-2xl mx-8">
        <div class="relative w-full">
          <input
            type="text"
            placeholder="Search..."
            class="w-full h-10 pl-10 pr-4 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <Icon
            name="search"
            class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
          />
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-2">
        <button
          class="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          on:click={toggleSearch}
        >
          <Icon name="search" class="w-6 h-6" />
        </button>

        <button
          class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          on:click={toggleTheme}
        >
          <Icon
            name={$themeStore.darkMode ? 'sun' : 'moon'}
            class="w-6 h-6"
          />
        </button>

        <button
          class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 relative"
          on:click={toggleNotifications}
        >
          <Icon name="bell" class="w-6 h-6" />
          {#if $userStore.notifications > 0}
            <span
              class="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center"
              transition:fade
            >
              {$userStore.notifications}
            </span>
          {/if}
        </button>

        <button
          class="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          on:click={toggleProfileMenu}
        >
          <Avatar
            src={$userStore.avatar}
            alt={$userStore.name}
            size="sm"
          />
          <span class="hidden lg:block font-medium">
            {$userStore.name}
          </span>
          <Icon name="chevron-down" class="w-4 h-4" />
        </button>
      </div>
    </div>
  </header>

  <!-- Mobile Search Overlay -->
  {#if searchOpen}
    <div
      class="fixed inset-0 z-40 bg-white dark:bg-gray-900"
      transition:fade
    >
      <div class="container mx-auto px-4 py-4">
        <div class="relative">
          <input
            type="text"
            placeholder="Search..."
            class="w-full h-12 pl-12 pr-4 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
            autofocus
          />
          <Icon
            name="search"
            class="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400"
          />
          <button
            class="absolute right-4 top-1/2 -translate-y-1/2"
            on:click={toggleSearch}
          >
            <Icon name="x" class="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Mobile Menu -->
  {#if menuOpen}
    <div
      class="fixed inset-0 z-30 lg:hidden"
      transition:fade={{ duration: 200 }}
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/50"
        on:click={toggleMenu}
      />

      <!-- Menu -->
      <div
        class="absolute left-0 top-0 bottom-0 w-64 bg-white dark:bg-gray-900 shadow-xl"
        transition:fly={{ x: -100, duration: 300 }}
      >
        <div class="p-4">
          <div class="flex items-center justify-between mb-8">
            <span class="text-2xl font-bold text-primary-500">
              LensApp
            </span>
            <button
              class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              on:click={toggleMenu}
            >
              <Icon name="x" class="w-6 h-6" />
            </button>
          </div>

          <nav class="space-y-1">
            {#each navigationItems as item}
              <a
                href={item.href}
                class="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                class:text-primary-500={$page.url.pathname === item.href}
                on:click={toggleMenu}
              >
                <Icon name={item.icon} class="w-6 h-6" />
                <span>{item.label}</span>
              </a>
            {/each}
          </nav>
        </div>
      </div>
    </div>
  {/if}

  <!-- Notifications Overlay -->
  {#if notificationsOpen}
    <div
      class="fixed inset-0 z-40"
      transition:fade={{ duration: 200 }}
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/50"
        on:click={toggleNotifications}
      />

      <!-- Panel -->
      <div
        class="absolute right-4 top-20 w-96 max-h-[80vh] bg-white dark:bg-gray-900 rounded-lg shadow-xl overflow-hidden"
        transition:fly={{ y: -20, duration: 300 }}
      >
        <div class="p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 class="text-lg font-semibold">Notifications</h2>
        </div>

        <div class="overflow-y-auto max-h-[60vh]">
          {#if $userStore.notifications === 0}
            <div class="p-8 text-center text-gray-500">
              No new notifications
            </div>
          {:else}
            {#each Array($userStore.notifications) as _, i}
              <div
                class="p-4 border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <div class="flex items-start gap-4">
                  <Avatar
                    src="https://picsum.photos/seed/{i}/64"
                    alt="User"
                    size="sm"
                  />
                  <div>
                    <p class="font-medium">User {i + 1}</p>
                    <p class="text-sm text-gray-500">
                      Liked your photo
                    </p>
                    <p class="text-xs text-gray-400 mt-1">
                      {new Date().toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- Profile Menu -->
  {#if profileMenuOpen}
    <div
      class="fixed inset-0 z-40"
      transition:fade={{ duration: 200 }}
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0"
        on:click={toggleProfileMenu}
      />

      <!-- Menu -->
      <div
        class="absolute right-4 top-20 w-64 bg-white dark:bg-gray-900 rounded-lg shadow-xl overflow-hidden"
        transition:fly={{ y: -20, duration: 300 }}
      >
        <div class="p-4 border-b border-gray-200 dark:border-gray-800">
          <div class="flex items-center gap-3">
            <Avatar
              src={$userStore.avatar}
              alt={$userStore.name}
              size="md"
            />
            <div>
              <p class="font-medium">{$userStore.name}</p>
              <p class="text-sm text-gray-500">
                @{$userStore.username}
              </p>
            </div>
          </div>
        </div>

        <nav class="p-2">
          <a
            href="/profile"
            class="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            on:click={toggleProfileMenu}
          >
            <Icon name="user" class="w-5 h-5" />
            <span>Profile</span>
          </a>
          <a
            href="/settings"
            class="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            on:click={toggleProfileMenu}
          >
            <Icon name="settings" class="w-5 h-5" />
            <span>Settings</span>
          </a>
          <button
            class="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            on:click={() => {
              toggleProfileMenu();
              // Handle logout
            }}
          >
            <Icon name="log-out" class="w-5 h-5" />
            <span>Log out</span>
          </button>
        </nav>
      </div>
    </div>
  {/if}

  <!-- Main Content -->
  <main class="pt-16 min-h-screen">
    <slot />
  </main>

  <!-- Desktop Navigation -->
  <nav class="fixed bottom-0 left-0 right-0 lg:left-1/2 lg:-translate-x-1/2 z-40 p-4">
    <div class="container mx-auto max-w-lg bg-white dark:bg-gray-900 rounded-full shadow-lg border border-gray-200 dark:border-gray-800">
      <div class="flex items-center justify-around p-1">
        {#each navigationItems as item}
          <a
            href={item.href}
            class="flex flex-col items-center gap-1 p-3 rounded-full text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            class:text-primary-500={$page.url.pathname === item.href}
          >
            <Icon name={item.icon} class="w-6 h-6" />
            <span class="text-xs">{item.label}</span>
          </a>
        {/each}
      </div>
    </div>
  </nav>
</div>

<style lang="postcss">
  :global(html) {
    @apply antialiased;
  }

  :global(body) {
    @apply overflow-x-hidden;
  }

  :global(.dark) {
    color-scheme: dark;
  }
</style> 