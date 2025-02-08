<!-- ThemeToggle.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import { Button } from '$lib/components/ui';
  import { Icon } from '$lib/components/ui';

  const theme = writable<'light' | 'dark'>('dark');

  onMount(() => {
    // Get initial theme from localStorage or system preference
    const savedTheme = localStorage.getItem('theme');
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const initialTheme = savedTheme || systemTheme;
    
    theme.set(initialTheme as 'light' | 'dark');
    document.documentElement.classList.toggle('dark', initialTheme === 'dark');

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('theme')) {
        const newTheme = e.matches ? 'dark' : 'light';
        theme.set(newTheme);
        document.documentElement.classList.toggle('dark', e.matches);
      }
    });
  });

  function toggleTheme() {
    theme.update(current => {
      const newTheme = current === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', newTheme);
      document.documentElement.classList.toggle('dark', newTheme === 'dark');
      return newTheme;
    });
  }
</script>

<Button
  variant="ghost"
  size="icon"
  on:click={toggleTheme}
  aria-label="Toggle theme"
>
  {#if $theme === 'dark'}
    <Icon name="sun" class="h-5 w-5" />
  {:else}
    <Icon name="moon" class="h-5 w-5" />
  {/if}
</Button>

<style>
  /* Add any component-specific styles here */
</style> 