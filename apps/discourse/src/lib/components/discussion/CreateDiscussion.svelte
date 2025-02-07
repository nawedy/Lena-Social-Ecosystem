<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { Button, Input, Alert, Badge } from '$lib/components/ui';
  import { supabase } from '$lib/supabaseClient';
  import { user } from '$lib/stores/auth';

  export let onSuccess: (discussionId: string) => void = () => {};

  let loading = false;
  let error: string | null = null;
  let categories: any[] = [];
  let suggestedTopics: any[] = [];
  let formData = {
    title: '',
    description: '',
    categories: [] as string[],
    format: 'structured',
    rules: {
      requireEvidence: true,
      allowAnonymous: false,
      moderationLevel: 'standard',
      participantLimit: 0
    },
    initialPoint: {
      content: '',
      evidence: '',
      sources: [] as string[]
    }
  };

  async function loadCategories() {
    try {
      const { data, error: fetchError } = await supabase
        .from('discussion_categories')
        .select('*')
        .order('name');

      if (fetchError) throw fetchError;
      categories = data || [];
    } catch (e) {
      console.error('Error loading categories:', e);
    }
  }

  async function suggestTopics() {
    if (!formData.categories.length) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('discussion_topics')
        .select('*')
        .in('category_id', formData.categories)
        .limit(5);

      if (fetchError) throw fetchError;
      suggestedTopics = data || [];
    } catch (e) {
      console.error('Error loading suggested topics:', e);
    }
  }

  async function handleSubmit() {
    if (!$user) return;

    try {
      loading = true;
      error = null;

      // Create discussion
      const { data: discussion, error: discussionError } = await supabase
        .from('discussions')
        .insert({
          creator_id: $user.id,
          title: formData.title,
          description: formData.description,
          format: formData.format,
          rules: formData.rules,
          status: 'active'
        })
        .select()
        .single();

      if (discussionError) throw discussionError;

      // Link categories
      const categoryPromises = formData.categories.map(categoryId =>
        supabase
          .from('discussion_categories')
          .insert({
            discussion_id: discussion.id,
            category_id: categoryId
          })
      );

      await Promise.all(categoryPromises);

      // Add initial point if provided
      if (formData.initialPoint.content) {
        const { error: pointError } = await supabase
          .from('discussion_points')
          .insert({
            discussion_id: discussion.id,
            user_id: $user.id,
            content: formData.initialPoint.content,
            evidence: formData.initialPoint.evidence,
            sources: formData.initialPoint.sources,
            type: 'point'
          });

        if (pointError) throw pointError;
      }

      onSuccess(discussion.id);
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  $: if (formData.categories.length) {
    suggestTopics();
  }

  onMount(loadCategories);
</script>

<div class="max-w-3xl mx-auto">
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
    <h2 class="text-2xl font-bold mb-6">Start a New Discussion</h2>

    {#if error}
      <Alert variant="error" title="Error" message={error} class="mb-6" />
    {/if}

    <form on:submit|preventDefault={handleSubmit} class="space-y-6">
      <!-- Basic Information -->
      <div class="space-y-4">
        <Input
          label="Title"
          bind:value={formData.title}
          placeholder="What would you like to discuss?"
          required
        />

        <div>
          <label class="block text-sm font-medium mb-2">Description</label>
          <textarea
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2 h-32"
            bind:value={formData.description}
            placeholder="Provide context and background for the discussion..."
            required
          ></textarea>
        </div>

        <!-- Categories -->
        <div>
          <label class="block text-sm font-medium mb-2">Categories</label>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {#each categories as category}
              <label class="flex items-center space-x-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                <input
                  type="checkbox"
                  value={category.id}
                  bind:group={formData.categories}
                  class="rounded border-gray-300 dark:border-gray-600"
                />
                <span>{category.name}</span>
              </label>
            {/each}
          </div>
        </div>

        <!-- Suggested Topics -->
        {#if suggestedTopics.length > 0}
          <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h4 class="font-medium mb-2">Suggested Topics</h4>
            <div class="space-y-2">
              {#each suggestedTopics as topic}
                <button
                  type="button"
                  class="block w-full text-left p-2 rounded hover:bg-blue-100 dark:hover:bg-blue-800/50"
                  on:click={() => {
                    formData.title = topic.title;
                    formData.description = topic.description;
                  }}
                >
                  <div class="font-medium">{topic.title}</div>
                  <div class="text-sm text-gray-600 dark:text-gray-400">
                    {topic.description}
                  </div>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <!-- Discussion Format -->
      <div>
        <label class="block text-sm font-medium mb-2">Format</label>
        <select
          class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2"
          bind:value={formData.format}
          required
        >
          <option value="structured">Structured (Formal points with evidence)</option>
          <option value="casual">Casual (Open discussion)</option>
          <option value="moderated">Moderated (Expert-led)</option>
          <option value="roundtable">Roundtable (Equal speaking time)</option>
        </select>
      </div>

      <!-- Discussion Rules -->
      <div class="space-y-4">
        <h3 class="text-lg font-semibold">Rules & Settings</h3>

        <div class="space-y-2">
          <label class="flex items-center space-x-2">
            <input
              type="checkbox"
              bind:checked={formData.rules.requireEvidence}
              class="rounded border-gray-300 dark:border-gray-600"
            />
            <span>Require evidence for points</span>
          </label>

          <label class="flex items-center space-x-2">
            <input
              type="checkbox"
              bind:checked={formData.rules.allowAnonymous}
              class="rounded border-gray-300 dark:border-gray-600"
            />
            <span>Allow anonymous participation</span>
          </label>

          <div>
            <label class="block text-sm font-medium mb-2">Moderation Level</label>
            <select
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2"
              bind:value={formData.rules.moderationLevel}
            >
              <option value="minimal">Minimal (Community moderated)</option>
              <option value="standard">Standard (AI-assisted moderation)</option>
              <option value="strict">Strict (Expert moderation)</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">
              Participant Limit (0 for unlimited)
            </label>
            <Input
              type="number"
              bind:value={formData.rules.participantLimit}
              min="0"
              max="100"
            />
          </div>
        </div>
      </div>

      <!-- Initial Point -->
      <div class="space-y-4">
        <h3 class="text-lg font-semibold">Initial Point (Optional)</h3>

        <div>
          <label class="block text-sm font-medium mb-2">Your Position</label>
          <textarea
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2 h-32"
            bind:value={formData.initialPoint.content}
            placeholder="Present your initial point..."
          ></textarea>
        </div>

        <div>
          <label class="block text-sm font-medium mb-2">Evidence</label>
          <textarea
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2 h-24"
            bind:value={formData.initialPoint.evidence}
            placeholder="Support your point with evidence..."
          ></textarea>
        </div>
      </div>

      <div class="flex justify-end">
        <Button
          type="submit"
          variant="primary"
          loading={loading}
        >
          Create Discussion
        </Button>
      </div>
    </form>
  </div>
</div>

<style>
  /* Add any component-specific styles here */
</style> 