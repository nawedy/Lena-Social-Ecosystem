<!-- DebateThread.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Button, Icon, Avatar } from '@lena/ui';

  export let thread: {
    id: string;
    title: string;
    content: string;
    author: {
      id: string;
      username: string;
      avatar?: string;
      reputation?: number;
      credentials?: string[];
    };
    category?: string;
    tags?: string[];
    createdAt: Date;
    updatedAt: Date;
    stats: {
      views: number;
      upvotes: number;
      downvotes: number;
      replies: number;
      quality?: number;
    };
    status: 'open' | 'resolved' | 'locked' | 'archived';
    references?: Array<{
      url: string;
      title: string;
      type: 'source' | 'citation' | 'evidence';
    }>;
  };

  export let replies: Array<{
    id: string;
    content: string;
    author: {
      id: string;
      username: string;
      avatar?: string;
      reputation?: number;
      credentials?: string[];
    };
    createdAt: Date;
    updatedAt: Date;
    stats: {
      upvotes: number;
      downvotes: number;
      quality?: number;
    };
    type: 'argument' | 'counterargument' | 'question' | 'clarification' | 'evidence';
    stance: 'supporting' | 'opposing' | 'neutral';
    parentId?: string;
    references?: Array<{
      url: string;
      title: string;
      type: 'source' | 'citation' | 'evidence';
    }>;
  }> = [];

  export let currentUserStance: 'supporting' | 'opposing' | 'neutral' = 'neutral';
  export let showSortingOptions = true;
  export let showFilters = true;
  export let enableVoting = true;
  export let enableReplies = true;

  const dispatch = createEventDispatcher();
  let replyContent = '';
  let replyType: 'argument' | 'counterargument' | 'question' | 'clarification' | 'evidence' = 'argument';
  let replyStance: 'supporting' | 'opposing' | 'neutral' = currentUserStance;
  let selectedParentId: string | undefined;
  let sortBy: 'quality' | 'newest' | 'oldest' | 'votes' = 'quality';
  let filterByType: string[] = [];
  let filterByStance: string[] = [];
  let showReplyForm = false;
  let showReferences = false;

  $: sortedReplies = sortReplies(replies, sortBy);
  $: filteredReplies = filterReplies(sortedReplies, filterByType, filterByStance);
  $: threadQuality = calculateThreadQuality(thread, replies);

  function sortReplies(replies: typeof thread.replies, sortBy: string) {
    return [...replies].sort((a, b) => {
      switch (sortBy) {
        case 'quality':
          return (b.stats.quality || 0) - (a.stats.quality || 0);
        case 'newest':
          return b.createdAt.getTime() - a.createdAt.getTime();
        case 'oldest':
          return a.createdAt.getTime() - b.createdAt.getTime();
        case 'votes':
          return (b.stats.upvotes - b.stats.downvotes) - (a.stats.upvotes - a.stats.downvotes);
        default:
          return 0;
      }
    });
  }

  function filterReplies(replies: typeof thread.replies, types: string[], stances: string[]) {
    return replies.filter(reply => {
      const typeMatch = types.length === 0 || types.includes(reply.type);
      const stanceMatch = stances.length === 0 || stances.includes(reply.stance);
      return typeMatch && stanceMatch;
    });
  }

  function calculateThreadQuality(thread: typeof thread, replies: typeof thread.replies): number {
    // Factors to consider:
    // 1. Reference quality and quantity
    // 2. Reply diversity (types and stances)
    // 3. Engagement metrics
    // 4. Author reputation
    // 5. Content length and complexity
    
    const referenceScore = (thread.references?.length || 0) * 0.2;
    const replyDiversity = new Set(replies.map(r => r.type)).size * 0.15;
    const stanceDiversity = new Set(replies.map(r => r.stance)).size * 0.15;
    const engagementScore = Math.min((thread.stats.replies / 10), 1) * 0.2;
    const reputationScore = Math.min(((thread.author.reputation || 0) / 1000), 1) * 0.15;
    const contentScore = Math.min((thread.content.length / 1000), 1) * 0.15;

    return (referenceScore + replyDiversity + stanceDiversity + engagementScore + reputationScore + contentScore) / 1;
  }

  function handleVote(replyId: string | undefined, voteType: 'up' | 'down') {
    dispatch('vote', {
      threadId: thread.id,
      replyId,
      voteType
    });
  }

  function handleReply() {
    if (!replyContent.trim()) return;

    dispatch('reply', {
      threadId: thread.id,
      parentId: selectedParentId,
      content: replyContent,
      type: replyType,
      stance: replyStance
    });

    replyContent = '';
    showReplyForm = false;
  }

  function formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }
</script>

<div class="space-y-6">
  <!-- Thread Header -->
  <div class="space-y-4">
    <div class="flex items-start justify-between">
      <div class="flex-1">
        <h1 class="text-2xl font-bold">{thread.title}</h1>
        <div class="flex items-center gap-4 mt-2 text-sm text-gray-400">
          <span>{formatDate(thread.createdAt)}</span>
          <span>{thread.stats.views} views</span>
          <span>{thread.stats.replies} replies</span>
          {#if thread.category}
            <span class="px-2 py-0.5 bg-primary-500/20 text-primary-400 rounded">
              {thread.category}
            </span>
          {/if}
        </div>
      </div>
      <div class="flex items-center gap-2">
        {#if thread.status !== 'open'}
          <span class="px-2 py-1 text-sm rounded bg-gray-700">
            {thread.status}
          </span>
        {/if}
        <Button
          variant="outline"
          size="sm"
          on:click={() => dispatch('share', { threadId: thread.id })}
        >
          <Icon name="share" size={16} />
        </Button>
      </div>
    </div>

    <!-- Author Info -->
    <div class="flex items-center gap-3">
      <Avatar
        src={thread.author.avatar}
        alt={thread.author.username}
        size="md"
      />
      <div>
        <div class="flex items-center gap-2">
          <span class="font-medium">{thread.author.username}</span>
          {#if thread.author.reputation}
            <span class="text-sm text-primary-400">
              {thread.author.reputation.toLocaleString()} rep
            </span>
          {/if}
        </div>
        {#if thread.author.credentials}
          <div class="flex items-center gap-1 text-sm text-gray-400">
            {#each thread.author.credentials as credential}
              <span class="px-1.5 py-0.5 bg-gray-800 rounded">
                {credential}
              </span>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Thread Content -->
    <div class="prose prose-invert max-w-none">
      {thread.content}
    </div>

    <!-- References -->
    {#if thread.references && thread.references.length > 0}
      <div class="space-y-2">
        <button
          class="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
          on:click={() => showReferences = !showReferences}
        >
          <Icon
            name={showReferences ? 'chevron-down' : 'chevron-right'}
            size={16}
          />
          {thread.references.length} References
        </button>

        {#if showReferences}
          <div class="space-y-2 pl-6">
            {#each thread.references as ref}
              <a
                href={ref.url}
                target="_blank"
                rel="noopener noreferrer"
                class="block p-2 rounded bg-gray-800/50 hover:bg-gray-800 transition-colors"
              >
                <div class="flex items-center gap-2">
                  <span class="text-xs px-1.5 py-0.5 rounded bg-primary-500/20 text-primary-400">
                    {ref.type}
                  </span>
                  <span class="text-sm">{ref.title}</span>
                </div>
              </a>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Thread Actions -->
    <div class="flex items-center justify-between pt-4 border-t border-gray-800">
      <div class="flex items-center gap-4">
        {#if enableVoting}
          <div class="flex items-center gap-2">
            <button
              class="p-1.5 rounded hover:bg-gray-800 transition-colors"
              class:text-green-500={thread.stats.upvotes > thread.stats.downvotes}
              on:click={() => handleVote(undefined, 'up')}
            >
              <Icon name="arrow-up" size={20} />
            </button>
            <span class="text-sm">
              {thread.stats.upvotes - thread.stats.downvotes}
            </span>
            <button
              class="p-1.5 rounded hover:bg-gray-800 transition-colors"
              class:text-red-500={thread.stats.downvotes > thread.stats.upvotes}
              on:click={() => handleVote(undefined, 'down')}
            >
              <Icon name="arrow-down" size={20} />
            </button>
          </div>
        {/if}

        {#if enableReplies && thread.status === 'open'}
          <Button
            variant="ghost"
            size="sm"
            on:click={() => {
              showReplyForm = !showReplyForm;
              selectedParentId = undefined;
            }}
          >
            <Icon name="message-square" size={16} class="mr-1" />
            Reply
          </Button>
        {/if}
      </div>

      {#if thread.stats.quality !== undefined}
        <div class="flex items-center gap-1 text-sm">
          <span class="text-gray-400">Quality Score:</span>
          <span class="font-medium text-primary-400">
            {Math.round(thread.stats.quality * 100)}%
          </span>
        </div>
      {/if}
    </div>
  </div>

  <!-- Reply Controls -->
  {#if showSortingOptions || showFilters}
    <div class="flex items-center justify-between py-4 border-b border-gray-800">
      {#if showSortingOptions}
        <select
          bind:value={sortBy}
          class="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
        >
          <option value="quality">Sort by Quality</option>
          <option value="newest">Sort by Newest</option>
          <option value="oldest">Sort by Oldest</option>
          <option value="votes">Sort by Votes</option>
        </select>
      {/if}

      {#if showFilters}
        <div class="flex items-center gap-4">
          <select
            multiple
            bind:value={filterByType}
            class="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
          >
            <option value="argument">Arguments</option>
            <option value="counterargument">Counterarguments</option>
            <option value="question">Questions</option>
            <option value="clarification">Clarifications</option>
            <option value="evidence">Evidence</option>
          </select>

          <select
            multiple
            bind:value={filterByStance}
            class="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
          >
            <option value="supporting">Supporting</option>
            <option value="opposing">Opposing</option>
            <option value="neutral">Neutral</option>
          </select>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Reply Form -->
  {#if showReplyForm && enableReplies && thread.status === 'open'}
    <div class="space-y-4 p-4 rounded-lg bg-gray-800/50">
      <div class="flex items-center gap-4">
        <select
          bind:value={replyType}
          class="bg-gray-800 border border-gray-700 rounded px-2 py-1"
        >
          <option value="argument">Argument</option>
          <option value="counterargument">Counterargument</option>
          <option value="question">Question</option>
          <option value="clarification">Clarification</option>
          <option value="evidence">Evidence</option>
        </select>

        <select
          bind:value={replyStance}
          class="bg-gray-800 border border-gray-700 rounded px-2 py-1"
        >
          <option value="supporting">Supporting</option>
          <option value="opposing">Opposing</option>
          <option value="neutral">Neutral</option>
        </select>
      </div>

      <textarea
        bind:value={replyContent}
        placeholder="Write your reply..."
        class="w-full h-32 p-3 bg-gray-900/50 border border-gray-700 rounded resize-none"
      />

      <div class="flex justify-end gap-2">
        <Button
          variant="ghost"
          on:click={() => showReplyForm = false}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={!replyContent.trim()}
          on:click={handleReply}
        >
          Post Reply
        </Button>
      </div>
    </div>
  {/if}

  <!-- Replies -->
  <div class="space-y-6">
    {#each filteredReplies as reply (reply.id)}
      <div class="relative pl-6 {reply.parentId ? 'ml-6 border-l-2 border-gray-800' : ''}">
        <!-- Reply Content -->
        <div class="space-y-4 p-4 rounded-lg bg-gray-800/30">
          <!-- Reply Header -->
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-3">
              <Avatar
                src={reply.author.avatar}
                alt={reply.author.username}
                size="sm"
              />
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-medium">{reply.author.username}</span>
                  {#if reply.author.reputation}
                    <span class="text-sm text-primary-400">
                      {reply.author.reputation.toLocaleString()} rep
                    </span>
                  {/if}
                </div>
                <div class="flex items-center gap-2 text-sm text-gray-400">
                  <span>{formatDate(reply.createdAt)}</span>
                  <span class="px-1.5 py-0.5 rounded bg-gray-700">
                    {reply.type}
                  </span>
                  <span class="px-1.5 py-0.5 rounded {
                    reply.stance === 'supporting' ? 'bg-green-500/20 text-green-400' :
                    reply.stance === 'opposing' ? 'bg-red-500/20 text-red-400' :
                    'bg-gray-700'
                  }">
                    {reply.stance}
                  </span>
                </div>
              </div>
            </div>

            {#if enableVoting}
              <div class="flex items-center gap-2">
                <button
                  class="p-1.5 rounded hover:bg-gray-700 transition-colors"
                  class:text-green-500={reply.stats.upvotes > reply.stats.downvotes}
                  on:click={() => handleVote(reply.id, 'up')}
                >
                  <Icon name="arrow-up" size={16} />
                </button>
                <span class="text-sm">
                  {reply.stats.upvotes - reply.stats.downvotes}
                </span>
                <button
                  class="p-1.5 rounded hover:bg-gray-700 transition-colors"
                  class:text-red-500={reply.stats.downvotes > reply.stats.upvotes}
                  on:click={() => handleVote(reply.id, 'down')}
                >
                  <Icon name="arrow-down" size={16} />
                </button>
              </div>
            {/if}
          </div>

          <!-- Reply Content -->
          <div class="prose prose-sm prose-invert max-w-none">
            {reply.content}
          </div>

          <!-- Reply References -->
          {#if reply.references && reply.references.length > 0}
            <div class="pt-2 border-t border-gray-700">
              <div class="text-sm text-gray-400">References:</div>
              <div class="space-y-1 mt-1">
                {#each reply.references as ref}
                  <a
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="block text-sm hover:text-primary-400 transition-colors"
                  >
                    {ref.title}
                  </a>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Reply Actions -->
          {#if enableReplies && thread.status === 'open'}
            <div class="flex items-center gap-2 pt-2 border-t border-gray-700">
              <Button
                variant="ghost"
                size="sm"
                on:click={() => {
                  showReplyForm = true;
                  selectedParentId = reply.id;
                }}
              >
                <Icon name="corner-down-right" size={16} class="mr-1" />
                Reply
              </Button>
            </div>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div> 