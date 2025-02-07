<!-- apps/echo/src/routes/about/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';

  let mounted = false;

  onMount(() => {
    mounted = true;
  });

  const features = [
    {
      title: 'Privacy First',
      description: 'Your data belongs to you. We use end-to-end encryption and zero-knowledge proofs to ensure your privacy.'
    },
    {
      title: 'Decentralized',
      description: 'Built on decentralized protocols, ensuring no single point of failure and true data ownership.'
    },
    {
      title: 'Web3 Ready',
      description: 'Seamlessly integrate with your Web3 identity and digital assets.'
    },
    {
      title: 'Real-time Engagement',
      description: 'Experience lightning-fast updates and interactions with other users.'
    },
    {
      title: 'Content Control',
      description: 'Advanced content moderation tools that respect privacy while maintaining community standards.'
    },
    {
      title: 'Cross-Platform',
      description: 'Access Echo from any device with a consistent, beautiful experience.'
    }
  ];
</script>

<div class="container mx-auto px-4 py-8">
  {#if mounted}
    <div in:fade={{ duration: 300, delay: 150 }} class="space-y-12">
      <div class="text-center space-y-4">
        <h1 class="font-bebas text-5xl md:text-7xl text-primary">
          About Echo
        </h1>
        <p class="text-xl text-muted-foreground max-w-2xl mx-auto">
          Echo is redefining social media with a focus on privacy, security, and user empowerment.
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {#each features as feature}
          <div class="p-6 rounded-lg bg-card border border-border">
            <h3 class="text-xl font-semibold mb-2">{feature.title}</h3>
            <p class="text-muted-foreground">{feature.description}</p>
          </div>
        {/each}
      </div>

      <div class="text-center space-y-4">
        <h2 class="font-bebas text-3xl md:text-5xl text-primary">
          Join the Revolution
        </h2>
        <p class="text-lg text-muted-foreground max-w-2xl mx-auto">
          Be part of a community that values privacy, security, and genuine connections.
        </p>
        <div class="flex justify-center gap-4 mt-6">
          <a
            href="/explore"
            class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
          >
            Start Exploring
          </a>
        </div>
      </div>
    </div>
  {/if}
</div> 