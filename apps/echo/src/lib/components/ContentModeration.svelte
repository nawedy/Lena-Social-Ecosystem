<!-- ContentModeration.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable, derived } from 'svelte/store';
  import { supabase } from '$lib/supabaseClient';
  import { fade, slide } from 'svelte/transition';
  import { browser } from '$app/environment';
  import type { User } from '@supabase/supabase-js';
  import { page } from '$app/stores';
  import { toast } from '$lib/stores/toast';
  import { formatDistanceToNow } from 'date-fns';
  import { Icon } from '$lib/components/ui';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Select } from '$lib/components/ui/select';
  import { Badge } from '$lib/components/ui/badge';
  import { Card } from '$lib/components/ui/card';
  import { Tabs } from '$lib/components/ui/tabs';
  import { MediaViewer } from '$lib/components/MediaViewer.svelte';
  import { RichTextViewer } from '$lib/components/RichTextViewer.svelte';

  // Types
  interface ModerationItem {
    id: string;
    content_id: string;
    content_type: 'post' | 'comment' | 'user';
    status: 'pending' | 'approved' | 'rejected' | 'flagged';
    assigned_to?: string;
    moderation_notes?: string;
    created_at: string;
    updated_at: string;
    content?: any;
    reports?: Report[];
    ai_analysis?: AIAnalysis;
  }

  interface Report {
    id: string;
    content_id: string;
    reporter_id: string;
    reason: string;
    details?: string;
    status: 'pending' | 'reviewed' | 'resolved';
    created_at: string;
    reporter?: {
      username: string;
      avatar_url: string;
    };
  }

  interface AIAnalysis {
    toxicity_score: number;
    spam_probability: number;
    adult_content_score: number;
    violence_score: number;
    hate_speech_score: number;
    detected_languages: string[];
    detected_entities: string[];
    content_categories: string[];
    recommendation: 'approve' | 'reject' | 'review';
    confidence: number;
  }

  // Props
  export let moderatorId: string;
  export let moderatorRole: 'admin' | 'moderator' = 'moderator';

  // Stores
  const moderationQueue = writable<ModerationItem[]>([]);
  const selectedItem = writable<ModerationItem | null>(null);
  const filters = writable({
    status: 'pending',
    contentType: 'all',
    timeRange: '24h',
    assignedTo: 'all',
    minToxicity: 0,
    searchQuery: ''
  });
  const isLoading = writable(false);
  const error = writable<string | null>(null);
  const moderationSettings = writable<any>(null);

  // Derived store for filtered queue
  const filteredQueue = derived(
    [moderationQueue, filters],
    ([$moderationQueue, $filters]) => {
      return $moderationQueue.filter(item => {
        const matchesStatus = $filters.status === 'all' || item.status === $filters.status;
        const matchesType = $filters.contentType === 'all' || item.content_type === $filters.contentType;
        const matchesAssigned = $filters.assignedTo === 'all' || item.assigned_to === $filters.assignedTo;
        const matchesSearch = !$filters.searchQuery || 
          item.content?.text?.toLowerCase().includes($filters.searchQuery.toLowerCase());
        const matchesToxicity = !item.ai_analysis || 
          item.ai_analysis.toxicity_score >= $filters.minToxicity;

        return matchesStatus && matchesType && matchesAssigned && matchesSearch && matchesToxicity;
      });
    }
  );

  onMount(() => {
    loadModerationQueue();
    loadModerationSettings();
    const unsubscribe = subscribeToUpdates();
    return () => {
      unsubscribe();
    };
  });

  async function loadModerationQueue() {
    try {
      isLoading.set(true);
      error.set(null);

      const { data: queueData, error: queueError } = await supabase
        .from('moderation_queue')
        .select(`
          *,
          content:content_id (*),
          reports:content_reports (*),
          ai_analysis:ai_content_analysis (*)
        `)
        .order('created_at', { ascending: false });

      if (queueError) throw queueError;
      moderationQueue.set(queueData);

    } catch (err) {
      error.set(err.message);
      toast.error('Failed to load moderation queue');
    } finally {
      isLoading.set(false);
    }
  }

  function subscribeToUpdates() {
    const subscription = supabase
      .channel('moderation_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'moderation_queue'
        },
        payload => {
          if (payload.eventType === 'INSERT') {
            moderationQueue.update(queue => [payload.new, ...queue]);
          } else if (payload.eventType === 'UPDATE') {
            moderationQueue.update(queue =>
              queue.map(item =>
                item.id === payload.new.id ? { ...item, ...payload.new } : item
              )
            );
          } else if (payload.eventType === 'DELETE') {
            moderationQueue.update(queue =>
              queue.filter(item => item.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }

  async function loadModerationSettings() {
    try {
      const { data, error: settingsError } = await supabase
        .from('moderation_settings')
        .select('*')
        .single();

      if (settingsError) throw settingsError;
      moderationSettings.set(data);

    } catch (err) {
      toast.error('Failed to load moderation settings');
    }
  }

  async function assignTask(itemId: string, moderatorId: string | null) {
    try {
      const { error: updateError } = await supabase
        .from('moderation_queue')
        .update({ assigned_to: moderatorId })
        .eq('id', itemId);

      if (updateError) throw updateError;
      toast.success('Task assigned successfully');

    } catch (err) {
      toast.error('Failed to assign task');
    }
  }

  async function updateStatus(
    itemId: string,
    newStatus: 'approved' | 'rejected' | 'flagged',
    notes?: string
  ) {
    try {
      const item = $moderationQueue.find(i => i.id === itemId);
      if (!item) return;

      const { error: actionError } = await supabase
        .from('moderation_actions')
        .insert({
          content_id: item.content_id,
          moderator_id: $page.data.session?.user.id,
          action: newStatus,
          reason: notes,
          previous_status: item.status
        });

      if (actionError) throw actionError;

      const { error: updateError } = await supabase
        .from('moderation_queue')
        .update({
          status: newStatus,
          moderation_notes: notes
        })
        .eq('id', itemId);

      if (updateError) throw updateError;
      toast.success(`Content ${newStatus} successfully`);

    } catch (err) {
      toast.error('Failed to update content status');
    }
  }

  async function handleRejectedContent(itemId: string) {
    const item = $moderationQueue.find(i => i.id === itemId);
    if (!item) return;

    try {
      if (item.content_type === 'post') {
        await supabase
          .from('posts')
          .update({ status: 'deleted' })
          .eq('id', item.content_id);
      } else if (item.content_type === 'comment') {
        await supabase
          .from('comments')
          .update({ status: 'deleted' })
          .eq('id', item.content_id);
      }

      await supabase.from('notifications').insert({
        user_id: item.content.user_id,
        type: 'content_rejected',
        content: `Your ${item.content_type} has been removed for violating our community guidelines.`,
        reference_id: item.content_id,
        reference_type: item.content_type
      });

    } catch (err) {
      toast.error('Failed to process rejected content');
    }
  }

  function getAISeverityClass(score: number): string {
    if (score >= 0.8) return 'severe';
    if (score >= 0.6) return 'high';
    if (score >= 0.4) return 'medium';
    return 'low';
  }
</script>

<div class="w-full h-full flex flex-col space-y-4 p-4">
  <!-- Header -->
  <div class="flex justify-between items-center">
    <h1 class="text-2xl font-bold">Content Moderation</h1>
    <div class="flex items-center space-x-4">
      <Select
        bind:value={$filters.status}
        options={[
          { value: 'all', label: 'All Status' },
          { value: 'pending', label: 'Pending' },
          { value: 'approved', label: 'Approved' },
          { value: 'rejected', label: 'Rejected' },
          { value: 'flagged', label: 'Flagged' }
        ]}
      />
      <Select
        bind:value={$filters.contentType}
        options={[
          { value: 'all', label: 'All Types' },
          { value: 'post', label: 'Posts' },
          { value: 'comment', label: 'Comments' },
          { value: 'user', label: 'Users' }
        ]}
      />
      <Input
        type="search"
        placeholder="Search content..."
        bind:value={$filters.searchQuery}
      />
    </div>
  </div>

  <!-- Main Content -->
  <div class="flex flex-1 space-x-4 overflow-hidden">
    <!-- Queue List -->
    <div class="w-1/3 overflow-y-auto">
      {#if $isLoading}
        <div class="flex justify-center items-center h-full">
          <Icon name="loader" class="animate-spin" />
        </div>
      {:else if $error}
        <div class="text-red-500 p-4">
          {$error}
        </div>
      {:else}
        {#each $filteredQueue as item (item.id)}
          <Card
            class="mb-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
            class:bg-primary-50={$selectedItem?.id === item.id}
            on:click={() => selectedItem.set(item)}
          >
            <div class="p-4">
              <div class="flex justify-between items-start mb-2">
                <Badge
                  variant={item.status === 'pending' ? 'warning' :
                          item.status === 'approved' ? 'success' :
                          item.status === 'rejected' ? 'destructive' : 'default'}
                >
                  {item.status}
                </Badge>
                <span class="text-sm text-gray-500">
                  {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                </span>
              </div>
              
              <div class="mb-2">
                <span class="text-sm font-medium">
                  {item.content_type.charAt(0).toUpperCase() + item.content_type.slice(1)}
                </span>
                {#if item.reports?.length}
                  <Badge variant="secondary" class="ml-2">
                    {item.reports.length} reports
                  </Badge>
                {/if}
              </div>

              {#if item.ai_analysis}
                <div class="flex flex-wrap gap-2 mt-2">
                  {#if item.ai_analysis.toxicity_score > 0.5}
                    <Badge variant="destructive">
                      Toxicity: {Math.round(item.ai_analysis.toxicity_score * 100)}%
                    </Badge>
                  {/if}
                  {#if item.ai_analysis.spam_probability > 0.5}
                    <Badge variant="destructive">
                      Spam: {Math.round(item.ai_analysis.spam_probability * 100)}%
                    </Badge>
                  {/if}
                </div>
              {/if}
            </div>
          </Card>
        {/each}
      {/if}
    </div>

    <!-- Content Details -->
    <div class="flex-1 overflow-y-auto">
      {#if $selectedItem}
        <Card class="h-full">
          <Tabs.Root value="content">
            <Tabs.List>
              <Tabs.Trigger value="content">Content</Tabs.Trigger>
              <Tabs.Trigger value="reports">
                Reports
                {#if $selectedItem.reports?.length}
                  <Badge variant="secondary" class="ml-2">
                    {$selectedItem.reports.length}
                  </Badge>
                {/if}
              </Tabs.Trigger>
              <Tabs.Trigger value="ai-analysis">AI Analysis</Tabs.Trigger>
              <Tabs.Trigger value="history">History</Tabs.Trigger>
            </Tabs.List>

            <div class="p-4">
              <Tabs.Content value="content">
                <div class="space-y-4">
                  <!-- Content Preview -->
                  {#if $selectedItem.content_type === 'post' || $selectedItem.content_type === 'comment'}
                    <div class="prose dark:prose-invert max-w-none">
                      <RichTextViewer content={$selectedItem.content.text} />
                    </div>
                    {#if $selectedItem.content.media_urls?.length}
                      <MediaViewer
                        mediaUrls={$selectedItem.content.media_urls}
                        aspectRatio="16:9"
                      />
                    {/if}
                  {:else if $selectedItem.content_type === 'user'}
                    <div class="flex items-center space-x-4">
                      <img
                        src={$selectedItem.content.avatar_url}
                        alt="User avatar"
                        class="w-16 h-16 rounded-full"
                      />
                      <div>
                        <h3 class="text-lg font-medium">
                          {$selectedItem.content.username}
                        </h3>
                        <p class="text-gray-500">
                          Joined {formatDistanceToNow(new Date($selectedItem.content.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  {/if}

                  <!-- Action Buttons -->
                  <div class="flex justify-end space-x-4 mt-4">
                    <Button
                      variant="outline"
                      on:click={() => assignTask($selectedItem.id, $page.data.session?.user.id)}
                    >
                      {$selectedItem.assigned_to === $page.data.session?.user.id ? 'Unassign' : 'Assign to me'}
                    </Button>
                    <Button
                      variant="destructive"
                      on:click={() => {
                        updateStatus($selectedItem.id, 'rejected');
                        handleRejectedContent($selectedItem.id);
                      }}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="default"
                      on:click={() => updateStatus($selectedItem.id, 'flagged')}
                    >
                      Flag for Review
                    </Button>
                    <Button
                      variant="success"
                      on:click={() => updateStatus($selectedItem.id, 'approved')}
                    >
                      Approve
                    </Button>
                  </div>
                </div>
              </Tabs.Content>

              <Tabs.Content value="reports">
                <div class="space-y-4">
                  {#each $selectedItem.reports || [] as report (report.id)}
                    <Card>
                      <div class="p-4">
                        <div class="flex items-center justify-between mb-2">
                          <div class="flex items-center space-x-2">
                            <img
                              src={report.reporter?.avatar_url}
                              alt="Reporter avatar"
                              class="w-8 h-8 rounded-full"
                            />
                            <span class="font-medium">
                              {report.reporter?.username}
                            </span>
                          </div>
                          <span class="text-sm text-gray-500">
                            {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p class="font-medium mb-2">{report.reason}</p>
                        {#if report.details}
                          <p class="text-gray-600 dark:text-gray-300">
                            {report.details}
                          </p>
                        {/if}
                      </div>
                    </Card>
                  {/each}
                </div>
              </Tabs.Content>

              <Tabs.Content value="ai-analysis">
                {#if $selectedItem.ai_analysis}
                  <div class="space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                      <Card>
                        <div class="p-4">
                          <h3 class="font-medium mb-2">Content Scores</h3>
                          <div class="space-y-2">
                            <div class="flex justify-between items-center">
                              <span>Toxicity</span>
                              <Badge
                                variant={$selectedItem.ai_analysis.toxicity_score > 0.7 ? 'destructive' :
                                        $selectedItem.ai_analysis.toxicity_score > 0.4 ? 'warning' : 'success'}
                              >
                                {Math.round($selectedItem.ai_analysis.toxicity_score * 100)}%
                              </Badge>
                            </div>
                            <div class="flex justify-between items-center">
                              <span>Spam Probability</span>
                              <Badge
                                variant={$selectedItem.ai_analysis.spam_probability > 0.7 ? 'destructive' :
                                        $selectedItem.ai_analysis.spam_probability > 0.4 ? 'warning' : 'success'}
                              >
                                {Math.round($selectedItem.ai_analysis.spam_probability * 100)}%
                              </Badge>
                            </div>
                            <div class="flex justify-between items-center">
                              <span>Adult Content</span>
                              <Badge
                                variant={$selectedItem.ai_analysis.adult_content_score > 0.7 ? 'destructive' :
                                        $selectedItem.ai_analysis.adult_content_score > 0.4 ? 'warning' : 'success'}
                              >
                                {Math.round($selectedItem.ai_analysis.adult_content_score * 100)}%
                              </Badge>
                            </div>
                            <div class="flex justify-between items-center">
                              <span>Violence</span>
                              <Badge
                                variant={$selectedItem.ai_analysis.violence_score > 0.7 ? 'destructive' :
                                        $selectedItem.ai_analysis.violence_score > 0.4 ? 'warning' : 'success'}
                              >
                                {Math.round($selectedItem.ai_analysis.violence_score * 100)}%
                              </Badge>
                            </div>
                            <div class="flex justify-between items-center">
                              <span>Hate Speech</span>
                              <Badge
                                variant={$selectedItem.ai_analysis.hate_speech_score > 0.7 ? 'destructive' :
                                        $selectedItem.ai_analysis.hate_speech_score > 0.4 ? 'warning' : 'success'}
                              >
                                {Math.round($selectedItem.ai_analysis.hate_speech_score * 100)}%
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </Card>

                      <Card>
                        <div class="p-4">
                          <h3 class="font-medium mb-2">Content Analysis</h3>
                          <div class="space-y-4">
                            <div>
                              <h4 class="text-sm font-medium mb-1">Languages</h4>
                              <div class="flex flex-wrap gap-2">
                                {#each $selectedItem.ai_analysis.detected_languages as language}
                                  <Badge variant="secondary">{language}</Badge>
                                {/each}
                              </div>
                            </div>
                            <div>
                              <h4 class="text-sm font-medium mb-1">Categories</h4>
                              <div class="flex flex-wrap gap-2">
                                {#each $selectedItem.ai_analysis.content_categories as category}
                                  <Badge variant="secondary">{category}</Badge>
                                {/each}
                              </div>
                            </div>
                            <div>
                              <h4 class="text-sm font-medium mb-1">Entities</h4>
                              <div class="flex flex-wrap gap-2">
                                {#each $selectedItem.ai_analysis.detected_entities as entity}
                                  <Badge variant="secondary">{entity}</Badge>
                                {/each}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </div>

                    <Card>
                      <div class="p-4">
                        <h3 class="font-medium mb-2">AI Recommendation</h3>
                        <div class="flex items-center space-x-4">
                          <Badge
                            variant={$selectedItem.ai_analysis.recommendation === 'approve' ? 'success' :
                                    $selectedItem.ai_analysis.recommendation === 'reject' ? 'destructive' : 'warning'}
                            class="text-lg"
                          >
                            {$selectedItem.ai_analysis.recommendation.toUpperCase()}
                          </Badge>
                          <span class="text-gray-500">
                            Confidence: {Math.round($selectedItem.ai_analysis.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    </Card>
                  </div>
                {:else}
                  <div class="text-center text-gray-500 py-8">
                    No AI analysis available for this content
                  </div>
                {/if}
              </Tabs.Content>

              <Tabs.Content value="history">
                <div class="space-y-4">
                  <!-- Implement moderation history view -->
                </div>
              </Tabs.Content>
            </div>
          </Tabs.Root>
        </Card>
      {:else}
        <div class="flex justify-center items-center h-full text-gray-500">
          Select an item from the queue to view details
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  :global(.success) {
    @apply bg-green-500 text-white;
  }
</style> 