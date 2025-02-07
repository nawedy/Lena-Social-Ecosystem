<!-- auth/+page.svelte -->
<script lang="ts">
  import AuthForm from '$lib/components/auth/AuthForm.svelte';
  import { isAuthenticated } from '$lib/auth/store';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => {
    // Redirect to home if already authenticated
    if ($isAuthenticated) {
      goto('/');
    }
  });
</script>

<div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900">
  <div class="w-full max-w-md space-y-8">
    <div class="text-center">
      <h1 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
        Welcome to Echo
      </h1>
      <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Sign in to your account or create a new one
      </p>
    </div>

    <AuthForm />
  </div>
</div> 