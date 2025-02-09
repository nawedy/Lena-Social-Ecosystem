<!-- apps/echo/src/routes/+layout.svelte -->
<script lang="ts">
  import '../app.postcss';
  import { onMount, onDestroy } from 'svelte';
  import { auth, isAuthenticated } from '$lib/auth/store';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { mobileOptimizationService } from '$lib/services/optimization/MobileOptimizationService';
  import { performanceOptimizationService } from '$lib/services/optimization/PerformanceOptimizationService';

  // Protected routes that require authentication
  const protectedRoutes = [
    '/profile',
    '/settings',
    '/create',
    '/messages'
  ];

  // Performance metrics store
  const metrics = performanceOptimizationService.getMetrics();

  // Prefetch critical resources
  const criticalResources = [
    '/api/user-data',
    '/api/notifications',
    '/assets/fonts/inter-var.woff2',
    '/assets/icons/sprite.svg'
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

    // Prefetch critical resources
    await performanceOptimizationService.prefetchResources(criticalResources, 'high');

    // Cache common data
    const commonData = await fetch('/api/common-data').then(res => res.json());
    await performanceOptimizationService.cacheData('common-data', commonData);

    // Report performance metrics
    metrics.subscribe(value => {
      if (value) {
        console.log('Performance Metrics:', {
          FCP: value.fcp,
          LCP: value.lcp,
          FID: value.fid,
          CLS: value.cls,
          TTFB: value.ttfb
        });
      }
    });
  });

  onDestroy(() => {
    mobileOptimizationService.cleanup();
    performanceOptimizationService.cleanup();
  });
</script>

<svelte:head>
  <!-- Preload critical assets -->
  <link rel="preload" href="/assets/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/assets/icons/sprite.svg" as="image">
  
  <!-- Preconnect to critical domains -->
  <link rel="preconnect" href="https://api.echo.com">
  <link rel="preconnect" href="https://cdn.echo.com">
  
  <!-- Meta viewport for mobile optimization -->
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  
  <!-- Theme color for mobile browsers -->
  <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)">
  <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
</svelte:head>

<div class="app min-h-screen bg-background text-foreground">
  <main class="flex-1">
    <slot />
  </main>
</div>

<style>
  :global(html) {
    overflow-y: scroll;
    scroll-behavior: smooth;
  }

  :global(body) {
    min-height: 100vh;
    /* Prevent pull-to-refresh on mobile */
    overscroll-behavior-y: none;
    /* Enable smooth scrolling */
    -webkit-overflow-scrolling: touch;
    /* Improve text rendering */
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    /* Prevent text size adjustment */
    -webkit-text-size-adjust: 100%;
  }

  .app {
    display: flex;
    flex-direction: column;
    /* Safe area insets for notched devices */
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  }

  main {
    flex: 1;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 100vw;
    /* Prevent horizontal overflow */
    overflow-x: hidden;
  }

  /* High-contrast mode improvements */
  @media (forced-colors: active) {
    :global(*) {
      forced-color-adjust: none;
    }
  }

  /* Reduced motion preferences */
  @media (prefers-reduced-motion: reduce) {
    :global(*) {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }

  /* Print styles */
  @media print {
    :global(body) {
      background: none !important;
      color: black !important;
    }
    main {
      width: 100% !important;
      max-width: none !important;
    }
  }
</style> 