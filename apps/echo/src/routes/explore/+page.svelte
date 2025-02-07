<!-- apps/echo/src/routes/explore/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';

  let mounted = false;

  onMount(() => {
    mounted = true;
  });

  const trendingTopics = [
    { name: 'Privacy', posts: 1234, trend: 'up' },
    { name: 'Web3', posts: 987, trend: 'up' },
    { name: 'Decentralization', posts: 856, trend: 'up' },
    { name: 'Blockchain', posts: 743, trend: 'down' },
    { name: 'Crypto', posts: 654, trend: 'up' },
    { name: 'NFTs', posts: 543, trend: 'down' }
  ];

  const featuredContent = [
    {
      title: 'The Future of Privacy in Social Media',
      author: 'Alice Johnson',
      excerpt: 'Exploring how decentralized platforms are reshaping online privacy...',
      engagement: { likes: 423, comments: 89, shares: 156 }
    },
    {
      title: 'Web3 Social: A New Paradigm',
      author: 'Bob Smith',
      excerpt: 'Understanding the shift from centralized to decentralized social networks...',
      engagement: { likes: 367, comments: 72, shares: 134 }
    },
    {
      title: 'Building Trust in Digital Communities',
      author: 'Carol White',
      excerpt: 'How zero-knowledge proofs are enabling trustless interactions...',
      engagement: { likes: 289, comments: 63, shares: 98 }
    }
  ];
</script>

<div class="container mx-auto px-4 py-8">
  {#if mounted}
    <div in:fade={{ duration: 300, delay: 150 }} class="space-y-8">
      <div class="text-center space-y-4">
        <h1 class="font-bebas text-5xl md:text-7xl text-primary">
          Explore Echo
        </h1>
        <p class="text-xl text-muted-foreground max-w-2xl mx-auto">
          Discover trending topics and engaging content from our community.
        </p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Trending Topics -->
        <div class="lg:col-span-1 space-y-4">
          <h2 class="text-2xl font-semibold">Trending Topics</h2>
          <div class="bg-card border border-border rounded-lg divide-y divide-border">
            {#each trendingTopics as topic}
              <div class="p-4 flex items-center justify-between">
                <div>
                  <span class="text-lg font-medium">#{topic.name}</span>
                  <p class="text-sm text-muted-foreground">{topic.posts} posts</p>
                </div>
                <div class="text-sm {topic.trend === 'up' ? 'text-green-500' : 'text-red-500'}">
                  {topic.trend === 'up' ? '↑' : '↓'}
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- Featured Content -->
        <div class="lg:col-span-2 space-y-4">
          <h2 class="text-2xl font-semibold">Featured Content</h2>
          <div class="space-y-4">
            {#each featuredContent as content}
              <div class="bg-card border border-border rounded-lg p-6">
                <h3 class="text-xl font-semibold mb-2">{content.title}</h3>
                <p class="text-sm text-muted-foreground mb-2">By {content.author}</p>
                <p class="text-muted-foreground mb-4">{content.excerpt}</p>
                <div class="flex gap-4 text-sm text-muted-foreground">
                  <span>{content.engagement.likes} likes</span>
                  <span>{content.engagement.comments} comments</span>
                  <span>{content.engagement.shares} shares</span>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>
  {/if}
</div> 