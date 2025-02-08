<!-- Navbar.svelte -->
<script lang="ts">
  import { page } from '$app/stores';
  import { isAuthenticated, walletAddress } from '$lib/auth/store';
  import { Button } from '$lib/components/ui';
  import { Icon } from '$lib/components/ui';
  import { ThemeToggle } from '$lib/components/theme';
  import { WalletButton } from '$lib/components/web3';
  import { NotificationBell } from '$lib/components/notification';
  import { SearchBar } from '$lib/components/marketplace';
  import { goto } from '$app/navigation';

  const navigation = [
    { name: 'Explore', href: '/explore' },
    { name: 'Categories', href: '/categories' },
    { name: 'Trending', href: '/trending' },
    { name: 'New', href: '/new' }
  ];

  const userNavigation = [
    { name: 'Profile', href: '/profile' },
    { name: 'Listings', href: '/listings' },
    { name: 'Orders', href: '/orders' },
    { name: 'Wallet', href: '/wallet' },
    { name: 'Settings', href: '/settings' }
  ];

  let mobileMenuOpen = false;
  let userMenuOpen = false;

  $: isActive = (href: string) => $page.url.pathname.startsWith(href);
</script>

<header class="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
  <nav class="container mx-auto px-4 h-16 flex items-center justify-between">
    <!-- Logo -->
    <div class="flex items-center">
      <a href="/" class="flex items-center space-x-2">
        <Icon name="shopping-bag" class="h-8 w-8 text-emerald-500" />
        <span class="font-space-grotesk text-xl font-bold">Agora</span>
      </a>
    </div>

    <!-- Desktop Navigation -->
    <div class="hidden md:flex items-center space-x-8">
      {#each navigation as item}
        <a
          href={item.href}
          class="text-sm font-medium transition-colors hover:text-primary {isActive(item.href) ? 'text-primary' : 'text-muted-foreground'}"
        >
          {item.name}
        </a>
      {/each}
    </div>

    <!-- Search Bar -->
    <div class="hidden lg:block flex-1 px-8 max-w-2xl">
      <SearchBar />
    </div>

    <!-- Right Actions -->
    <div class="flex items-center space-x-4">
      <ThemeToggle />
      
      {#if $isAuthenticated}
        <NotificationBell />
        <WalletButton />
        
        <!-- User Menu -->
        <div class="relative">
          <Button
            variant="ghost"
            size="icon"
            on:click={() => userMenuOpen = !userMenuOpen}
          >
            <Icon name="user" class="h-5 w-5" />
          </Button>

          {#if userMenuOpen}
            <div
              class="absolute right-0 mt-2 w-48 rounded-md bg-card shadow-lg ring-1 ring-black ring-opacity-5"
              transition:fade
            >
              <div class="py-1" role="menu">
                {#each userNavigation as item}
                  <a
                    href={item.href}
                    class="block px-4 py-2 text-sm hover:bg-muted {isActive(item.href) ? 'text-primary' : 'text-foreground'}"
                    role="menuitem"
                  >
                    {item.name}
                  </a>
                {/each}
                <button
                  class="block w-full px-4 py-2 text-sm text-left text-destructive hover:bg-muted"
                  on:click={() => {
                    auth.signOut();
                    goto('/');
                  }}
                >
                  Sign Out
                </button>
              </div>
            </div>
          {/if}
        </div>
      {:else}
        <Button variant="ghost" on:click={() => goto('/auth')}>
          Sign In
        </Button>
        <Button variant="primary" on:click={() => goto('/auth?mode=signup')}>
          Get Started
        </Button>
      {/if}

      <!-- Mobile Menu Button -->
      <Button
        variant="ghost"
        size="icon"
        class="md:hidden"
        on:click={() => mobileMenuOpen = !mobileMenuOpen}
      >
        <Icon name={mobileMenuOpen ? 'x' : 'menu'} class="h-5 w-5" />
      </Button>
    </div>
  </nav>

  <!-- Mobile Menu -->
  {#if mobileMenuOpen}
    <div class="md:hidden" transition:slide>
      <div class="space-y-1 px-4 pb-3 pt-2">
        {#each navigation as item}
          <a
            href={item.href}
            class="block rounded-md px-3 py-2 text-base font-medium {isActive(item.href) ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'}"
          >
            {item.name}
          </a>
        {/each}
      </div>

      <!-- Mobile Search -->
      <div class="px-4 pb-3">
        <SearchBar />
      </div>

      {#if $isAuthenticated}
        <div class="border-t border-border px-4 pb-3 pt-4">
          <div class="space-y-1">
            {#each userNavigation as item}
              <a
                href={item.href}
                class="block rounded-md px-3 py-2 text-base font-medium {isActive(item.href) ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'}"
              >
                {item.name}
              </a>
            {/each}
            <button
              class="block w-full rounded-md px-3 py-2 text-base font-medium text-destructive hover:bg-accent text-left"
              on:click={() => {
                auth.signOut();
                goto('/');
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</header>

<style>
  /* Add any component-specific styles here */
</style> 