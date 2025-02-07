<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  import { Button, Input, Alert } from '$lib/components/ui';
  import { supabase } from '$lib/supabaseClient';
  import { user } from '$lib/stores/auth';

  export let discussionId: string;
  export let parentId: string | null = null;
  export let rules: {
    requireEvidence: boolean;
    allowAnonymous: boolean;
  };

  const dispatch = createEventDispatcher();
  let loading = false;
  let error: string | null = null;
  let isAnonymous = false;

  let formData = {
    type: 'point',
    content: '',
    evidence: '',
    sources: [''],
    position: { x: 0, y: 0 }
  };

  async function validateSources(): Promise<boolean> {
    const validSources = formData.sources.filter(url => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    });

    formData.sources = validSources;
    return true;
  }

  function addSourceField() {
    formData.sources = [...formData.sources, ''];
  }

  function removeSourceField(index: number) {
    formData.sources = formData.sources.filter((_, i) => i !== index);
  }

  async function handleSubmit() {
    if (!$user) return;

    try {
      loading = true;
      error = null;

      // Validate required fields
      if (!formData.content.trim()) {
        throw new Error('Point content is required');
      }

      if (rules.requireEvidence && !formData.evidence.trim()) {
        throw new Error('Evidence is required for this discussion');
      }

      // Validate sources
      await validateSources();

      // Create point
      const { data: point, error: pointError } = await supabase
        .from('discussion_points')
        .insert({
          discussion_id: discussionId,
          parent_id: parentId,
          user_id: isAnonymous ? null : $user.id,
          type: formData.type,
          content: formData.content,
          evidence: formData.evidence,
          sources: formData.sources.filter(Boolean),
          position: formData.position
        })
        .select()
        .single();

      if (pointError) throw pointError;

      dispatch('submit', point);
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }
</script>

<div class="space-y-6" transition:fade>
  {#if error}
    <Alert variant="error" title="Error" message={error} />
  {/if}

  <form on:submit|preventDefault={handleSubmit} class="space-y-4">
    <!-- Point Type -->
    <div>
      <label class="block text-sm font-medium mb-2">Type</label>
      <select
        class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2"
        bind:value={formData.type}
        required
      >
        <option value="point">Point</option>
        <option value="counter">Counter-Point</option>
        <option value="support">Supporting Evidence</option>
        <option value="question">Clarifying Question</option>
      </select>
    </div>

    <!-- Content -->
    <div>
      <label class="block text-sm font-medium mb-2">
        Your Point
        <span class="text-red-500">*</span>
      </label>
      <textarea
        class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2 h-32"
        bind:value={formData.content}
        placeholder="Present your point clearly and concisely..."
        required
      ></textarea>
    </div>

    <!-- Evidence -->
    <div>
      <label class="block text-sm font-medium mb-2">
        Evidence
        {#if rules.requireEvidence}
          <span class="text-red-500">*</span>
        {/if}
      </label>
      <textarea
        class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2 h-24"
        bind:value={formData.evidence}
        placeholder="Support your point with evidence..."
        required={rules.requireEvidence}
      ></textarea>
    </div>

    <!-- Sources -->
    <div>
      <label class="block text-sm font-medium mb-2">Sources</label>
      <div class="space-y-2">
        {#each formData.sources as source, i}
          <div class="flex space-x-2">
            <Input
              type="url"
              bind:value={formData.sources[i]}
              placeholder="https://..."
              class="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              on:click={() => removeSourceField(i)}
            >
              Remove
            </Button>
          </div>
        {/each}
        <Button
          type="button"
          variant="outline"
          size="sm"
          on:click={addSourceField}
        >
          Add Source
        </Button>
      </div>
    </div>

    <!-- Anonymous Option -->
    {#if rules.allowAnonymous}
      <label class="flex items-center space-x-2">
        <input
          type="checkbox"
          bind:checked={isAnonymous}
          class="rounded border-gray-300 dark:border-gray-600"
        />
        <span>Post anonymously</span>
      </label>
    {/if}

    <!-- Actions -->
    <div class="flex justify-end space-x-4">
      <Button
        type="button"
        variant="outline"
        on:click={() => dispatch('cancel')}
      >
        Cancel
      </Button>
      <Button
        type="submit"
        variant="primary"
        loading={loading}
      >
        Submit Point
      </Button>
    </div>
  </form>
</div>

<style>
  /* Add any component-specific styles here */
</style> 