<!-- DebateDiscovery.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Button, Icon, Card } from '@lena/ui';

  export let debates: Array<{
    id: string;
    title: string;
    summary: string;
    category: string;
    tags: string[];
    status: 'open' | 'resolved' | 'locked' | 'archived';
    createdAt: Date;
    updatedAt: Date;
    author: {
      id: string;
      username: string;
      avatar?: string;
      reputation?: number;
      credentials?: string[];
    };
    participants: Array<{
      id: string;
      username: string;
      avatar?: string;
      stance: 'supporting' | 'opposing' | 'neutral';
      reputation?: number;
    }>;
    stats: {
      views: number;
      replies: number;
      quality: number;
      activity: number;
      engagement: number;
    };
    requiredCredentials?: string[];
    aiSummary?: {
      mainPoints: string[];
      controversialPoints: string[];
      consensusLevel: number;
      complexityLevel: number;
    };
  }> = [];

  export let categories: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    count: number;
  }> = [];

  export let popularTags: Array<{
    id: string;
    name: string;
    count: number;
    trending?: boolean;
  }> = [];

  export let userInterests: string[] = [];
  export let userCredentials: string[] = [];
  export let showAIInsights = true;

  const dispatch = createEventDispatcher();
  let searchQuery = '';
  let selectedCategory = '';
  let selectedTags: string[] = [];
  let sortBy: 'quality' | 'activity' | 'engagement' | 'newest' = 'activity';
  let filterByStatus: ('open' | 'resolved' | 'locked' | 'archived')[] = ['open'];
  let showOnlyQualified = false;
  let viewMode: 'grid' | 'list' = 'grid';
  let expandedDebateId: string | null = null;

  $: filteredDebates = filterDebates(debates, {
    query: searchQuery,
    category: selectedCategory,
    tags: selectedTags,
    status: filterByStatus,
    qualified: showOnlyQualified
  });

  $: sortedDebates = sortDebates(filteredDebates, sortBy);
  $: recommendedDebates = getRecommendedDebates(debates);

  function filterDebates(
    debates: typeof debates,
    filters: {
      query: string;
      category: string;
      tags: string[];
      status: string[];
      qualified: boolean;
    }
  ) {
    return debates.filter(debate => {
      // Text search
      if (filters.query) {
        const searchText = `${debate.title} ${debate.summary} ${debate.tags.join(' ')}`.toLowerCase();
        if (!searchText.includes(filters.query.toLowerCase())) return false;
      }

      // Category filter
      if (filters.category && debate.category !== filters.category) return false;

      // Tags filter
      if (filters.tags.length > 0 && !filters.tags.some(tag => debate.tags.includes(tag))) return false;

      // Status filter
      if (filters.status.length > 0 && !filters.status.includes(debate.status)) return false;

      // Qualification filter
      if (filters.qualified && debate.requiredCredentials) {
        if (!debate.requiredCredentials.every(cred => userCredentials.includes(cred))) return false;
      }

      return true;
    });
  }

  function sortDebates(debates: typeof debates, sortBy: string) {
    return [...debates].sort((a, b) => {
      switch (sortBy) {
        case 'quality':
          return b.stats.quality - a.stats.quality;
        case 'activity':
          return b.stats.activity - a.stats.activity;
        case 'engagement':
          return b.stats.engagement - a.stats.engagement;
        case 'newest':
          return b.createdAt.getTime() - a.createdAt.getTime();
        default:
          return 0;
      }
    });
  }

  function getRecommendedDebates(debates: typeof debates) {
    // Score each debate based on:
    // 1. User interests match
    // 2. User credentials match
    // 3. Debate quality and activity
    // 4. Participation balance (prefer debates needing the user's perspective)
    return debates
      .map(debate => {
        let score = 0;
        
        // Interest match
        const interestMatch = debate.tags.filter(tag => userInterests.includes(tag)).length;
        score += interestMatch * 2;

        // Credential match
        if (debate.requiredCredentials) {
          const credentialMatch = debate.requiredCredentials.filter(cred => 
            userCredentials.includes(cred)
          ).length;
          score += credentialMatch * 3;
        }

        // Quality and activity
        score += debate.stats.quality * 2;
        score += Math.min(debate.stats.activity / 100, 1) * 2;

        // Participation balance
        const stances = debate.participants.map(p => p.stance);
        const supporting = stances.filter(s => s === 'supporting').length;
        const opposing = stances.filter(s => s === 'opposing').length;
        const balance = Math.abs(supporting - opposing);
        score -= balance * 0.5; // Prefer balanced debates

        return { debate, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ debate }) => debate);
  }

  function formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  function handleJoinDebate(debateId: string, stance: 'supporting' | 'opposing' | 'neutral') {
    dispatch('join', { debateId, stance });
  }

  function handleSaveDebate(debateId: string) {
    dispatch('save', { debateId });
  }

  function handleShareDebate(debateId: string) {
    dispatch('share', { debateId });
  }
</script>

<div class="space-y-8">
  <!-- Search and Filters -->
  <div class="space-y-4">
    <div class="flex items-center gap-4">
      <div class="flex-1 relative">
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Search debates..."
          class="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg"
        />
        <Icon
          name="search"
          size={20}
          class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
      </div>

      <div class="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          class:text-primary-400={viewMode === 'grid'}
          on:click={() => viewMode = 'grid'}
        >
          <Icon name="grid" size={20} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          class:text-primary-400={viewMode === 'list'}
          on:click={() => viewMode = 'list'}
        >
          <Icon name="list" size={20} />
        </Button>
      </div>
    </div>

    <div class="flex items-center gap-4">
      <select
        bind:value={selectedCategory}
        class="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5"
      >
        <option value="">All Categories</option>
        {#each categories as category}
          <option value={category.id}>
            {category.name} ({category.count})
          </option>
        {/each}
      </select>

      <select
        bind:value={sortBy}
        class="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5"
      >
        <option value="activity">Most Active</option>
        <option value="quality">Highest Quality</option>
        <option value="engagement">Most Engaging</option>
        <option value="newest">Newest First</option>
      </select>

      <div class="flex items-center gap-2">
        {#each ['open', 'resolved', 'locked', 'archived'] as status}
          <label class="flex items-center gap-1.5">
            <input
              type="checkbox"
              bind:group={filterByStatus}
              value={status}
              class="rounded border-gray-700 bg-gray-800"
            />
            <span class="text-sm capitalize">{status}</span>
          </label>
        {/each}
      </div>

      <label class="flex items-center gap-1.5">
        <input
          type="checkbox"
          bind:checked={showOnlyQualified}
          class="rounded border-gray-700 bg-gray-800"
        />
        <span class="text-sm">Show Only Qualified</span>
      </label>
    </div>

    <div class="flex flex-wrap gap-2">
      {#each popularTags as tag}
        <button
          class="px-2 py-1 text-sm rounded-full transition-colors {
            selectedTags.includes(tag.name)
              ? 'bg-primary-500 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }"
          on:click={() => {
            selectedTags = selectedTags.includes(tag.name)
              ? selectedTags.filter(t => t !== tag.name)
              : [...selectedTags, tag.name];
          }}
        >
          {tag.name}
          {#if tag.trending}
            <Icon name="trending-up" size={12} class="ml-1" />
          {/if}
          <span class="ml-1 text-xs">({tag.count})</span>
        </button>
      {/each}
    </div>
  </div>

  <!-- Recommended Debates -->
  {#if recommendedDebates.length > 0}
    <div class="space-y-4">
      <h2 class="text-lg font-medium">Recommended for You</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {#each recommendedDebates as debate}
          <Card
            variant="hover"
            class="flex flex-col"
          >
            <div class="p-4 space-y-4">
              <div class="flex items-start justify-between">
                <div>
                  <h3 class="font-medium line-clamp-2">
                    {debate.title}
                  </h3>
                  <div class="flex items-center gap-2 mt-1 text-sm text-gray-400">
                    <span>{formatDate(debate.createdAt)}</span>
                    <span>•</span>
                    <span>{debate.stats.replies} replies</span>
                  </div>
                </div>
                <div class="flex items-center gap-1">
                  {#if debate.requiredCredentials}
                    <Icon name="shield" size={16} class="text-primary-400" />
                  {/if}
                  <span class="px-2 py-0.5 text-xs rounded bg-primary-500/20 text-primary-400">
                    {debate.category}
                  </span>
                </div>
              </div>

              <p class="text-sm text-gray-400 line-clamp-2">
                {debate.summary}
              </p>

              {#if showAIInsights && debate.aiSummary}
                <div class="space-y-2 pt-2 border-t border-gray-700">
                  <div class="flex items-center gap-2 text-sm">
                    <Icon name="brain" size={16} class="text-primary-400" />
                    <span class="text-gray-400">AI Insights:</span>
                  </div>
                  <div class="space-y-1">
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-gray-400">Consensus:</span>
                      <div class="flex-1 h-1.5 rounded-full bg-gray-700">
                        <div
                          class="h-full rounded-full bg-primary-500"
                          style="width: {debate.aiSummary.consensusLevel * 100}%"
                        />
                      </div>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-gray-400">Complexity:</span>
                      <div class="flex-1 h-1.5 rounded-full bg-gray-700">
                        <div
                          class="h-full rounded-full bg-primary-500"
                          style="width: {debate.aiSummary.complexityLevel * 100}%"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              {/if}

              <div class="flex items-center justify-between pt-4 mt-auto">
                <div class="flex -space-x-2">
                  {#each debate.participants.slice(0, 5) as participant}
                    <img
                      src={participant.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${participant.username}`}
                      alt={participant.username}
                      class="w-6 h-6 rounded-full border-2 border-gray-900"
                    />
                  {/each}
                  {#if debate.participants.length > 5}
                    <div class="w-6 h-6 rounded-full border-2 border-gray-900 bg-gray-800 flex items-center justify-center text-xs">
                      +{debate.participants.length - 5}
                    </div>
                  {/if}
                </div>

                <div class="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    on:click={() => handleSaveDebate(debate.id)}
                  >
                    <Icon name="bookmark" size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    on:click={() => handleShareDebate(debate.id)}
                  >
                    <Icon name="share" size={16} />
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    on:click={() => dispatch('view', { debateId: debate.id })}
                  >
                    Join Debate
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Debate List -->
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-medium">
        {filteredDebates.length} {filteredDebates.length === 1 ? 'Debate' : 'Debates'}
      </h2>
      {#if filteredDebates.length === 0}
        <Button
          variant="ghost"
          size="sm"
          on:click={() => {
            searchQuery = '';
            selectedCategory = '';
            selectedTags = [];
            filterByStatus = ['open'];
            showOnlyQualified = false;
          }}
        >
          Clear Filters
        </Button>
      {/if}
    </div>

    {#if viewMode === 'grid'}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {#each sortedDebates as debate (debate.id)}
          <Card
            variant="hover"
            class="flex flex-col"
          >
            <div class="p-4 space-y-4">
              <div class="flex items-start justify-between">
                <div>
                  <h3 class="font-medium line-clamp-2">
                    {debate.title}
                  </h3>
                  <div class="flex items-center gap-2 mt-1 text-sm text-gray-400">
                    <span>{formatDate(debate.createdAt)}</span>
                    <span>•</span>
                    <span>{debate.stats.replies} replies</span>
                  </div>
                </div>
                <div class="flex items-center gap-1">
                  {#if debate.requiredCredentials}
                    <Icon name="shield" size={16} class="text-primary-400" />
                  {/if}
                  <span class="px-2 py-0.5 text-xs rounded bg-primary-500/20 text-primary-400">
                    {debate.category}
                  </span>
                </div>
              </div>

              <p class="text-sm text-gray-400 line-clamp-2">
                {debate.summary}
              </p>

              <div class="flex flex-wrap gap-1">
                {#each debate.tags.slice(0, 3) as tag}
                  <span class="px-1.5 py-0.5 text-xs rounded bg-gray-800">
                    {tag}
                  </span>
                {/each}
                {#if debate.tags.length > 3}
                  <span class="px-1.5 py-0.5 text-xs rounded bg-gray-800">
                    +{debate.tags.length - 3}
                  </span>
                {/if}
              </div>

              <div class="flex items-center justify-between pt-4 mt-auto">
                <div class="flex -space-x-2">
                  {#each debate.participants.slice(0, 5) as participant}
                    <img
                      src={participant.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${participant.username}`}
                      alt={participant.username}
                      class="w-6 h-6 rounded-full border-2 border-gray-900"
                    />
                  {/each}
                  {#if debate.participants.length > 5}
                    <div class="w-6 h-6 rounded-full border-2 border-gray-900 bg-gray-800 flex items-center justify-center text-xs">
                      +{debate.participants.length - 5}
                    </div>
                  {/if}
                </div>

                <div class="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    on:click={() => handleSaveDebate(debate.id)}
                  >
                    <Icon name="bookmark" size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    on:click={() => handleShareDebate(debate.id)}
                  >
                    <Icon name="share" size={16} />
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    on:click={() => dispatch('view', { debateId: debate.id })}
                  >
                    Join Debate
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        {/each}
      </div>
    {:else}
      <div class="space-y-4">
        {#each sortedDebates as debate (debate.id)}
          <div
            class="p-4 rounded-lg bg-gray-800/30 hover:bg-gray-800/50 transition-colors cursor-pointer"
            on:click={() => expandedDebateId = expandedDebateId === debate.id ? null : debate.id}
          >
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <h3 class="font-medium">{debate.title}</h3>
                  {#if debate.requiredCredentials}
                    <Icon name="shield" size={16} class="text-primary-400" />
                  {/if}
                </div>
                <div class="flex items-center gap-2 mt-1 text-sm text-gray-400">
                  <span>{formatDate(debate.createdAt)}</span>
                  <span>•</span>
                  <span>{debate.stats.replies} replies</span>
                  <span>•</span>
                  <span class="px-2 py-0.5 rounded bg-primary-500/20 text-primary-400">
                    {debate.category}
                  </span>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  on:click|stopPropagation={() => handleSaveDebate(debate.id)}
                >
                  <Icon name="bookmark" size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  on:click|stopPropagation={() => handleShareDebate(debate.id)}
                >
                  <Icon name="share" size={16} />
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  on:click|stopPropagation={() => dispatch('view', { debateId: debate.id })}
                >
                  Join Debate
                </Button>
              </div>
            </div>

            {#if expandedDebateId === debate.id}
              <div class="mt-4 space-y-4 pt-4 border-t border-gray-700">
                <p class="text-gray-400">
                  {debate.summary}
                </p>

                <div class="flex flex-wrap gap-1">
                  {#each debate.tags as tag}
                    <span class="px-1.5 py-0.5 text-xs rounded bg-gray-700">
                      {tag}
                    </span>
                  {/each}
                </div>

                {#if showAIInsights && debate.aiSummary}
                  <div class="space-y-2">
                    <div class="flex items-center gap-2">
                      <Icon name="brain" size={16} class="text-primary-400" />
                      <span class="text-sm">AI Insights:</span>
                    </div>
                    <div class="space-y-2 pl-6">
                      <div>
                        <div class="text-sm font-medium">Main Points:</div>
                        <ul class="list-disc pl-4 text-sm text-gray-400">
                          {#each debate.aiSummary.mainPoints as point}
                            <li>{point}</li>
                          {/each}
                        </ul>
                      </div>
                      {#if debate.aiSummary.controversialPoints.length > 0}
                        <div>
                          <div class="text-sm font-medium">Controversial Points:</div>
                          <ul class="list-disc pl-4 text-sm text-gray-400">
                            {#each debate.aiSummary.controversialPoints as point}
                              <li>{point}</li>
                            {/each}
                          </ul>
                        </div>
                      {/if}
                    </div>
                  </div>
                {/if}

                <div class="flex items-center justify-between">
                  <div class="flex -space-x-2">
                    {#each debate.participants as participant}
                      <img
                        src={participant.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${participant.username}`}
                        alt={participant.username}
                        class="w-6 h-6 rounded-full border-2 border-gray-900"
                      />
                    {/each}
                  </div>

                  <div class="flex items-center gap-4">
                    <div class="flex items-center gap-2 text-sm">
                      <span class="text-gray-400">Quality:</span>
                      <div class="w-20 h-1.5 rounded-full bg-gray-700">
                        <div
                          class="h-full rounded-full bg-primary-500"
                          style="width: {debate.stats.quality * 100}%"
                        />
                      </div>
                    </div>
                    <div class="flex items-center gap-2 text-sm">
                      <span class="text-gray-400">Activity:</span>
                      <div class="w-20 h-1.5 rounded-full bg-gray-700">
                        <div
                          class="h-full rounded-full bg-primary-500"
                          style="width: {Math.min(debate.stats.activity / 100, 1) * 100}%"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div> 