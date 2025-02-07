<!-- Main app layout -->
<script lang="ts">
  import '@fontsource/exo';
  import '@fontsource/rajdhani';
  import '../app.css';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import Plausible from 'plausible-tracker';

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
</script>

<div class="min-h-screen bg-black text-white font-sans">
  <div class="fixed inset-0 bg-gradient-mesh opacity-20 pointer-events-none" />
  
  <main class="relative">
    <slot />
  </main>

  <footer class="fixed bottom-0 left-0 right-0 p-4 text-center text-sm text-gray-500">
    <p>Built with privacy and security in mind 🔒</p>
  </footer>
</div>

<style lang="postcss">
  :global(html) {
    background-color: theme(colors.black);
    color: theme(colors.white);
    overflow-x: hidden;
  }

  :global(::selection) {
    background-color: theme(colors.primary.500);
    color: theme(colors.black);
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
</style> 