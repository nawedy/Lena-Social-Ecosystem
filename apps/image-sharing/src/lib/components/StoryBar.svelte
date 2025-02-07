<!-- StoryBar.svelte -->
<script lang="ts">
  import { Avatar } from '@lena/ui';
  import { auth } from '$lib/stores/auth';

  export let stories: Array<{
    id: number;
    username: string;
    avatar: string | null;
    hasUnseenStories: boolean;
  }> = [];

  function handleStoryClick(storyId: number) {
    // TODO: Open story viewer modal
    console.log('View story:', storyId);
  }

  function handleCreateStory() {
    // TODO: Open story creation modal
    console.log('Create new story');
  }
</script>

<div class="relative">
  <div class="flex gap-4 overflow-x-auto pb-4 scrollbar-none">
    {#if $auth.user}
      <!-- Create Story Button -->
      <div class="flex flex-col items-center gap-1 min-w-[64px]">
        <button
          on:click={handleCreateStory}
          class="relative w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors"
          aria-label="Create story"
        >
          <div class="absolute inset-0.5 rounded-full bg-gray-900 flex items-center justify-center">
            <span class="text-2xl font-medium text-primary-500">+</span>
          </div>
        </button>
        <span class="text-xs text-center truncate w-full">Your story</span>
      </div>
    {/if}

    <!-- Story List -->
    {#each stories as story (story.id)}
      <button
        on:click={() => handleStoryClick(story.id)}
        class="flex flex-col items-center gap-1 min-w-[64px]"
      >
        <div class={`p-0.5 rounded-full ${story.hasUnseenStories ? 'bg-gradient-to-tr from-yellow-500 to-pink-500' : 'bg-gray-700'}`}>
          <div class="p-0.5 rounded-full bg-gray-900">
            <Avatar
              src={story.avatar}
              alt={story.username}
              size="lg"
              class={story.hasUnseenStories ? '' : 'opacity-75'}
            />
          </div>
        </div>
        <span class="text-xs text-center truncate w-full">{story.username}</span>
      </button>
    {/each}
  </div>

  <!-- Fade Effect -->
  <div class="absolute right-0 top-0 bottom-4 w-12 bg-gradient-to-l from-gray-900 to-transparent pointer-events-none" />
</div>

<style>
  .scrollbar-none {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-none::-webkit-scrollbar {
    display: none;
  }
</style> 