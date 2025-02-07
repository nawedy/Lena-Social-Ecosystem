<!-- VideoActions.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { gsap } from 'gsap';

  export let likes = 0;
  export let comments = 0;
  export let shares = 0;
  export let liked = false;

  const dispatch = createEventDispatcher<{
    like: void;
    comment: void;
    share: void;
  }>();

  function handleLike() {
    // Animate heart icon
    const heart = document.querySelector('.like-button');
    if (heart) {
      gsap.fromTo(
        heart,
        { scale: 1 },
        {
          scale: 1.5,
          duration: 0.2,
          yoyo: true,
          repeat: 1,
          ease: 'power2.out'
        }
      );
    }

    liked = !liked;
    dispatch('like');
  }

  function formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }
</script>

<div class="absolute right-4 bottom-20 flex flex-col items-center gap-6">
  <!-- Like Button -->
  <button
    class="like-button flex flex-col items-center gap-1"
    on:click={handleLike}
  >
    <div
      class="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-primary-900/50 transition-colors"
      class:text-primary-500={liked}
    >
      <span class="text-2xl">{liked ? '❤️' : '🤍'}</span>
    </div>
    <span class="text-sm font-medium">{formatNumber(likes)}</span>
  </button>

  <!-- Comment Button -->
  <button
    class="flex flex-col items-center gap-1"
    on:click={() => dispatch('comment')}
  >
    <div class="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-primary-900/50 transition-colors">
      <span class="text-2xl">💬</span>
    </div>
    <span class="text-sm font-medium">{formatNumber(comments)}</span>
  </button>

  <!-- Share Button -->
  <button
    class="flex flex-col items-center gap-1"
    on:click={() => dispatch('share')}
  >
    <div class="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-primary-900/50 transition-colors">
      <span class="text-2xl">↗️</span>
    </div>
    <span class="text-sm font-medium">{formatNumber(shares)}</span>
  </button>

  <!-- Token Reward Button -->
  <button class="flex flex-col items-center gap-1">
    <div class="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-primary-900/50 transition-colors">
      <span class="text-2xl">🪙</span>
    </div>
    <span class="text-sm font-medium">Earn</span>
  </button>
</div> 