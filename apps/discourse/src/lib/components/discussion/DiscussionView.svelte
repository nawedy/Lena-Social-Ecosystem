<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import { Button, Input, Alert, Badge } from '$lib/components/ui';
  import { supabase } from '$lib/supabaseClient';
  import { user } from '$lib/stores/auth';
  import DiscussionNode from './DiscussionNode.svelte';
  import DiscussionForm from './DiscussionForm.svelte';
  import { createEventDispatcher } from 'svelte';

  export let discussionId: string;
  
  const dispatch = createEventDispatcher();
  let discussion: any = null;
  let points: any[] = [];
  let loading = false;
  let error: string | null = null;
  let realtimeSubscription: any = null;
  let selectedNode: string | null = null;
  let showReplyForm = false;

  // State for visualization
  let zoomLevel = 1;
  let panPosition = { x: 0, y: 0 };
  
  async function loadDiscussion() {
    try {
      loading = true;
      error = null;

      // Load discussion details
      const { data: discussionData, error: discussionError } = await supabase
        .from('discussions')
        .select(`
          *,
          creator:creator_id(id, full_name, avatar_url),
          categories:discussion_categories(
            category:category_id(id, name)
          )
        `)
        .eq('id', discussionId)
        .single();

      if (discussionError) throw discussionError;
      discussion = discussionData;

      // Load discussion points
      const { data: pointsData, error: pointsError } = await supabase
        .from('discussion_points')
        .select(`
          *,
          author:user_id(id, full_name, avatar_url),
          reactions:point_reactions(
            user_id,
            type
          )
        `)
        .eq('discussion_id', discussionId)
        .order('created_at');

      if (pointsError) throw pointsError;
      points = pointsData || [];

    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function setupRealtimeSubscription() {
    // Subscribe to discussion changes
    realtimeSubscription = supabase
      .channel(`discussion:${discussionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'discussion_points',
          filter: `discussion_id=eq.${discussionId}`
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            // Fetch complete node data including relations
            const { data: newNode } = await supabase
              .from('discussion_points')
              .select(`
                *,
                author:user_id(id, full_name, avatar_url),
                reactions:point_reactions(
                  user_id,
                  type
                )
              `)
              .eq('id', payload.new.id)
              .single();

            if (newNode) {
              points = [...points, newNode];
            }
          } else if (payload.eventType === 'UPDATE') {
            points = points.map(point =>
              point.id === payload.new.id ? { ...point, ...payload.new } : point
            );
          } else if (payload.eventType === 'DELETE') {
            points = points.filter(point => point.id !== payload.old.id);
          }
        }
      )
      .subscribe();
  }

  async function handleReaction(nodeId: string, type: string) {
    if (!$user) return;

    try {
      const existingReaction = points
        .find(point => point.id === nodeId)
        ?.reactions
        ?.find(r => r.user_id === $user.id);

      if (existingReaction) {
        if (existingReaction.type === type) {
          // Remove reaction
          await supabase
            .from('point_reactions')
            .delete()
            .eq('user_id', $user.id)
            .eq('point_id', nodeId);
        } else {
          // Update reaction
          await supabase
            .from('point_reactions')
            .update({ type })
            .eq('user_id', $user.id)
            .eq('point_id', nodeId);
        }
      } else {
        // Add new reaction
        await supabase
          .from('point_reactions')
          .insert({
            user_id: $user.id,
            point_id: nodeId,
            type
          });
      }
    } catch (e) {
      console.error('Error handling reaction:', e);
    }
  }

  function handleNodeSelect(nodeId: string) {
    selectedNode = nodeId;
    showReplyForm = true;
  }

  function handleZoom(delta: number) {
    const newZoom = zoomLevel + delta;
    if (newZoom >= 0.5 && newZoom <= 2) {
      zoomLevel = newZoom;
    }
  }

  onMount(() => {
    loadDiscussion();
    setupRealtimeSubscription();
  });

  onDestroy(() => {
    if (realtimeSubscription) {
      realtimeSubscription.unsubscribe();
    }
  });
</script>

<div class="max-w-6xl mx-auto p-4">
  {#if loading}
    <div class="flex justify-center p-8">
      <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
    </div>
  {:else if error}
    <Alert variant="error" title="Error" message={error} />
  {:else if discussion}
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <!-- Discussion Header -->
      <div class="p-6 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-start justify-between">
          <div>
            <h1 class="text-3xl font-bold mb-2">{discussion.title}</h1>
            <div class="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
              <div class="flex items-center space-x-2">
                <img
                  src={discussion.creator.avatar_url || '/default-avatar.png'}
                  alt={discussion.creator.full_name}
                  class="w-6 h-6 rounded-full"
                />
                <span>{discussion.creator.full_name}</span>
              </div>
              <span>•</span>
              <span>{new Date(discussion.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          
          <div class="flex space-x-2">
            {#each discussion.categories as { category }}
              <Badge>{category.name}</Badge>
            {/each}
          </div>
        </div>

        <p class="mt-4 text-gray-700 dark:text-gray-300">{discussion.description}</p>

        <div class="mt-4 flex items-center space-x-4 text-sm">
          <div class="flex items-center space-x-2">
            <span class="font-medium">Format:</span>
            <Badge variant="outline">{discussion.format}</Badge>
          </div>
          {#if discussion.rules.requireEvidence}
            <Badge variant="success">Evidence Required</Badge>
          {/if}
          {#if discussion.rules.allowAnonymous}
            <Badge variant="warning">Anonymous Allowed</Badge>
          {/if}
        </div>
      </div>

      <!-- Point Tree Visualization -->
      <div class="relative h-[600px] border-b border-gray-200 dark:border-gray-700">
        <div class="absolute top-4 right-4 flex space-x-2 z-10">
          <Button
            variant="outline"
            size="sm"
            on:click={() => handleZoom(-0.1)}
          >
            -
          </Button>
          <Button
            variant="outline"
            size="sm"
            on:click={() => handleZoom(0.1)}
          >
            +
          </Button>
        </div>

        <div
          class="absolute inset-0 overflow-auto"
          style="transform: scale({zoomLevel}) translate({panPosition.x}px, {panPosition.y}px)"
        >
          <div class="relative p-8">
            {#each points as point (point.id)}
              <DiscussionNode
                node={point}
                parentPosition={point.parent_id ? 
                  points.find(n => n.id === point.parent_id)?.position : null}
                on:select={() => handleNodeSelect(point.id)}
                on:react={(e) => handleReaction(point.id, e.detail)}
              />
            {/each}
          </div>
        </div>
      </div>

      <!-- Reply Form -->
      {#if showReplyForm}
        <div class="p-6">
          <DiscussionForm
            {discussionId}
            parentId={selectedNode}
            rules={discussion.rules}
            on:submit={() => {
              showReplyForm = false;
              selectedNode = null;
            }}
            on:cancel={() => {
              showReplyForm = false;
              selectedNode = null;
            }}
          />
        </div>
      {:else}
        <div class="p-6 text-center">
          <Button
            variant="primary"
            on:click={() => {
              selectedNode = null;
              showReplyForm = true;
            }}
          >
            Start New Thread
          </Button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* Add any component-specific styles here */
</style> 