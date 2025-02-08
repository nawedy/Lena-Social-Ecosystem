<!-- Footer.svelte -->
<script lang="ts">
  import { Icon } from '$lib/components/ui';

  const navigation = {
    marketplace: [
      { name: 'Explore', href: '/explore' },
      { name: 'Categories', href: '/categories' },
      { name: 'Trending', href: '/trending' },
      { name: 'New', href: '/new' }
    ],
    support: [
      { name: 'Help Center', href: '/help' },
      { name: 'Safety', href: '/safety' },
      { name: 'Terms', href: '/terms' },
      { name: 'Privacy', href: '/privacy' }
    ],
    company: [
      { name: 'About', href: '/about' },
      { name: 'Blog', href: '/blog' },
      { name: 'Careers', href: '/careers' },
      { name: 'Contact', href: '/contact' }
    ],
    social: [
      {
        name: 'Twitter',
        href: 'https://twitter.com/lena_agora',
        icon: 'twitter'
      },
      {
        name: 'GitHub',
        href: 'https://github.com/lena-ecosystem',
        icon: 'github'
      },
      {
        name: 'Discord',
        href: 'https://discord.gg/lena-agora',
        icon: 'message-circle'
      }
    ]
  };
</script>

<footer class="bg-background border-t">
  <div class="container mx-auto px-4 py-12 lg:py-16">
    <div class="xl:grid xl:grid-cols-3 xl:gap-8">
      <!-- Brand -->
      <div class="space-y-8">
        <div class="flex items-center space-x-2">
          <Icon name="shopping-bag" class="h-8 w-8 text-emerald-500" />
          <span class="font-space-grotesk text-xl font-bold">Agora</span>
        </div>
        <p class="text-sm text-muted-foreground max-w-xs">
          A decentralized marketplace for digital goods and services, powered by blockchain technology.
        </p>
        <div class="flex space-x-6">
          {#each navigation.social as item}
            <a
              href={item.href}
              class="text-muted-foreground hover:text-foreground"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span class="sr-only">{item.name}</span>
              <Icon name={item.icon} class="h-6 w-6" />
            </a>
          {/each}
        </div>
      </div>

      <!-- Navigation -->
      <div class="mt-16 grid grid-cols-2 gap-8 xl:col-span-2 xl:mt-0">
        <div class="md:grid md:grid-cols-2 md:gap-8">
          <div>
            <h3 class="text-sm font-semibold">Marketplace</h3>
            <ul class="mt-4 space-y-4">
              {#each navigation.marketplace as item}
                <li>
                  <a
                    href={item.href}
                    class="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {item.name}
                  </a>
                </li>
              {/each}
            </ul>
          </div>
          <div class="mt-10 md:mt-0">
            <h3 class="text-sm font-semibold">Support</h3>
            <ul class="mt-4 space-y-4">
              {#each navigation.support as item}
                <li>
                  <a
                    href={item.href}
                    class="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {item.name}
                  </a>
                </li>
              {/each}
            </ul>
          </div>
        </div>
        <div class="md:grid md:grid-cols-2 md:gap-8">
          <div>
            <h3 class="text-sm font-semibold">Company</h3>
            <ul class="mt-4 space-y-4">
              {#each navigation.company as item}
                <li>
                  <a
                    href={item.href}
                    class="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {item.name}
                  </a>
                </li>
              {/each}
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom -->
    <div class="mt-12 border-t pt-8">
      <p class="text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} Lena Ecosystem. All rights reserved.
      </p>
    </div>
  </div>
</footer>

<style>
  /* Add any component-specific styles here */
</style> 