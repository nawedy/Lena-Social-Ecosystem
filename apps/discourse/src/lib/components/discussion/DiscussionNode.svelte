<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { Button, Badge } from '$lib/components/ui';
  import { user } from '$lib/stores/auth';

  export let node: {
    id: string;
    content: string;
    evidence: string;
    sources: string[];
    type: string;
    author: {
      id: string;
      full_name: string;
      avatar_url: string;
    };
    reactions: {
      user_id: string;
      type: string;
    }[];
    created_at: string;
  };

  export let parentPosition: { x: number; y: number } | null = null;

  const dispatch = createEventDispatcher();
  let showEvidence = false;
  let position = { x: 0, y: 0 };

  // Calculate position based on parent and siblings
  $: {
    if (parentPosition) {
      position = {
        x: parentPosition.x + 200,
        y: parentPosition.y
      };
    }
  }

  function getReactionCount(type: string): number {
    return node.reactions.filter(r => r.type === type).length;
  }

  function getUserReaction(): string | null {
    if (!$user) return null;
    const reaction = node.reactions.find(r => r.user_id === $user.id);
    return reaction ? reaction.type : null;
  }

  function handleReaction(type: string) {
    dispatch('react', type);
  }
</script>

<div
  class="absolute bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 w-[300px]"
  style="left: {position.x}px; top: {position.y}px;"
  transition:fade
>
  <!-- Author Info -->
  <div class="flex items-center space-x-2 mb-3">
    <img
      src={node.author.avatar_url || '/default-avatar.png'}
      alt={node.author.full_name}
      class="w-8 h-8 rounded-full"
    />
    <div>
      <div class="font-medium">{node.author.full_name}</div>
      <div class="text-xs text-gray-500 dark:text-gray-400">
        {new Date(node.created_at).toLocaleString()}
      </div>
    </div>
  </div>

  <!-- Content -->
  <div class="prose dark:prose-invert max-w-none mb-4">
    <p>{node.content}</p>
  </div>

  <!-- Evidence Toggle -->
  {#if node.evidence || node.sources.length > 0}
    <button
      class="text-sm text-primary-600 dark:text-primary-400 hover:underline mb-2"
      on:click={() => showEvidence = !showEvidence}
    >
      {showEvidence ? 'Hide' : 'Show'} Evidence
    </button>
  {/if}

  <!-- Evidence Panel -->
  {#if showEvidence}
    <div
      class="bg-gray-50 dark:bg-gray-700/50 rounded p-3 mb-4"
      transition:slide
    >
      {#if node.evidence}
        <div class="text-sm mb-2">{node.evidence}</div>
      {/if}
      
      {#if node.sources.length > 0}
        <div class="text-xs text-gray-600 dark:text-gray-400">
          <div class="font-medium mb-1">Sources:</div>
          <ul class="list-disc list-inside">
            {#each node.sources as source}
              <li>
                <a
                  href={source}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="hover:underline"
                >
                  {source}
                </a>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Actions -->
  <div class="flex items-center justify-between">
    <div class="flex space-x-2">
      <!-- Reaction Buttons -->
      <button
        class="flex items-center space-x-1 text-sm px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        class:text-green-600={getUserReaction() === 'agree'}
        on:click={() => handleReaction('agree')}
      >
        <span>👍</span>
        <span>{getReactionCount('agree')}</span>
      </button>

      <button
        class="flex items-center space-x-1 text-sm px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        class:text-red-600={getUserReaction() === 'disagree'}
        on:click={() => handleReaction('disagree')}
      >
        <span>👎</span>
        <span>{getReactionCount('disagree')}</span>
      </button>

      <button
        class="flex items-center space-x-1 text-sm px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        class:text-yellow-600={getUserReaction() === 'insightful'}
        on:click={() => handleReaction('insightful')}
      >
        <span>💡</span>
        <span>{getReactionCount('insightful')}</span>
      </button>
    </div>

    <Button
      variant="outline"
      size="sm"
      on:click={() => dispatch('select')}
    >
      Reply
    </Button>
  </div>

  <!-- Type Badge -->
  <div class="absolute -top-2 -right-2">
    <Badge
      variant={node.type === 'point' ? 'primary' : 
              node.type === 'counter' ? 'error' :
              node.type === 'support' ? 'success' : 'warning'}
    >
      {node.type}
    </Badge>
  </div>

  <!-- Connection Line to Parent -->
  {#if parentPosition}
    <div
      class="absolute w-[200px] h-[2px] bg-gray-300 dark:bg-gray-600"
      style="
        left: -{200}px;
        top: 50%;
        transform: translateY(-50%);
      "
    ></div>
  {/if}
</div>

<style>
  /* Add any component-specific styles here */
</style> 