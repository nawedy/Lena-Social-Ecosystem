<!-- Landing Page -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { Canvas } from '@threlte/core';
  import { gsap } from 'gsap';
  import { auth } from '$lib/stores/auth';
  import { Button } from '@lena/ui';
  import HeroScene from '$lib/components/HeroScene.svelte';
  import AuthModal from '$lib/components/AuthModal.svelte';

  let heroSection: HTMLElement;
  let isAuthModalOpen = false;
  let authMode: 'signin' | 'signup' = 'signup';

  onMount(() => {
    // Animate hero section
    gsap.from(heroSection, {
      opacity: 0,
      y: 50,
      duration: 1,
      ease: 'power3.out'
    });
  });

  function handleAuthSuccess(event: CustomEvent) {
    const { provider, email, password } = event.detail;
    auth.signIn(provider, provider === 'email' ? { email, password } : undefined);
    isAuthModalOpen = false;
  }
</script>

<svelte:head>
  <title>Lena Shorts - Share Your Moments</title>
  <meta name="description" content="Share and discover short videos with privacy at its core." />
</svelte:head>

<div class="relative">
  <!-- Hero Section -->
  <section 
    bind:this={heroSection}
    class="min-h-screen flex flex-col items-center justify-center px-4 py-20"
  >
    <!-- 3D Background -->
    <div class="absolute inset-0 -z-10">
      <Canvas>
        <HeroScene />
      </Canvas>
    </div>

    <!-- Hero Content -->
    <div class="text-center max-w-4xl mx-auto space-y-8">
      <h1 class="text-6xl md:text-8xl font-display font-bold text-gradient">
        Share Your
        <span class="block">Moments</span>
      </h1>
      
      <p class="text-xl md:text-2xl text-gray-400">
        Create and share short videos with privacy and ownership at its core.
      </p>

      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <Button
          variant="primary"
          size="lg"
          on:click={() => {
            authMode = 'signup';
            isAuthModalOpen = true;
          }}
        >
          Get Started
        </Button>
        <Button
          variant="outline"
          size="lg"
          on:click={() => {
            authMode = 'signin';
            isAuthModalOpen = true;
          }}
        >
          Sign In
        </Button>
      </div>
    </div>
  </section>

  <!-- Features Section -->
  <section class="py-20 px-4">
    <div class="max-w-7xl mx-auto">
      <h2 class="text-4xl md:text-5xl font-display font-bold text-center mb-16">
        Why Choose <span class="text-gradient">Lena Shorts</span>
      </h2>

      <div class="grid md:grid-cols-3 gap-8">
        <!-- Feature 1 -->
        <div class="card">
          <div class="h-12 w-12 rounded-lg bg-primary-500/20 flex items-center justify-center mb-4">
            <span class="text-2xl">🎥</span>
          </div>
          <h3 class="text-xl font-bold mb-2">Full Ownership</h3>
          <p class="text-gray-400">Your content remains yours, stored on decentralized networks.</p>
        </div>

        <!-- Feature 2 -->
        <div class="card">
          <div class="h-12 w-12 rounded-lg bg-primary-500/20 flex items-center justify-center mb-4">
            <span class="text-2xl">🔒</span>
          </div>
          <h3 class="text-xl font-bold mb-2">Privacy First</h3>
          <p class="text-gray-400">End-to-end encryption and privacy controls for your content.</p>
        </div>

        <!-- Feature 3 -->
        <div class="card">
          <div class="h-12 w-12 rounded-lg bg-primary-500/20 flex items-center justify-center mb-4">
            <span class="text-2xl">💰</span>
          </div>
          <h3 class="text-xl font-bold mb-2">Token Rewards</h3>
          <p class="text-gray-400">Earn tokens for engagement and quality content.</p>
        </div>
      </div>
    </div>
  </section>
</div>

<!-- Auth Modal -->
<AuthModal
  bind:isOpen={isAuthModalOpen}
  bind:mode={authMode}
  on:success={handleAuthSuccess}
  on:close={() => isAuthModalOpen = false}
/>

<style lang="postcss">
  .text-gradient {
    @apply bg-clip-text text-transparent bg-gradient-to-r from-primary-400 to-primary-600;
  }

  .card {
    @apply bg-black/50 backdrop-blur-lg border border-primary-900/50 rounded-xl p-6
           hover:border-primary-700/50 transition-all duration-200;
  }
</style> 