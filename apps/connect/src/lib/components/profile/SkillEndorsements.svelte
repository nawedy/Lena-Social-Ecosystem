<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { Button, Badge, Input, Alert } from '$lib/components/ui';
  import { supabase } from '$lib/supabaseClient';
  import { user } from '$lib/stores/auth';

  export let skills: string[] = [];
  export let profileId: string;
  export let editable = false;
  export let editMode = false;

  let loading = true;
  let error: string | null = null;
  let endorsements: Record<string, any[]> = {};
  let newSkill = '';
  let endorsingSkill: string | null = null;
  let endorsementLevel = 3;
  let endorsementComment = '';

  async function loadEndorsements() {
    try {
      const { data, error: fetchError } = await supabase
        .from('skill_endorsements')
        .select(`
          *,
          endorser:endorser_id(
            id,
            user_metadata
          )
        `)
        .eq('profile_id', profileId);

      if (fetchError) throw fetchError;

      // Group endorsements by skill
      endorsements = (data || []).reduce((acc, endorsement) => {
        if (!acc[endorsement.skill]) {
          acc[endorsement.skill] = [];
        }
        acc[endorsement.skill].push(endorsement);
        return acc;
      }, {});
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function addSkill() {
    if (!newSkill.trim()) return;

    try {
      const updatedSkills = [...new Set([...skills, newSkill.trim()])];
      const { error: updateError } = await supabase
        .from('professional_profiles')
        .update({ skills: updatedSkills })
        .eq('id', profileId);

      if (updateError) throw updateError;
      skills = updatedSkills;
      newSkill = '';
    } catch (e) {
      error = e.message;
    }
  }

  async function removeSkill(skill: string) {
    try {
      const updatedSkills = skills.filter(s => s !== skill);
      const { error: updateError } = await supabase
        .from('professional_profiles')
        .update({ skills: updatedSkills })
        .eq('id', profileId);

      if (updateError) throw updateError;
      skills = updatedSkills;
    } catch (e) {
      error = e.message;
    }
  }

  async function addEndorsement(skill: string) {
    if (!$user) return;

    try {
      const { error: endorseError } = await supabase
        .from('skill_endorsements')
        .insert({
          profile_id: profileId,
          endorser_id: $user.id,
          skill,
          level: endorsementLevel,
          comment: endorsementComment.trim() || null
        });

      if (endorseError) throw endorseError;

      endorsingSkill = null;
      endorsementLevel = 3;
      endorsementComment = '';
      await loadEndorsements();
    } catch (e) {
      error = e.message;
    }
  }

  async function removeEndorsement(endorsementId: string) {
    try {
      const { error: deleteError } = await supabase
        .from('skill_endorsements')
        .delete()
        .eq('id', endorsementId);

      if (deleteError) throw deleteError;
      await loadEndorsements();
    } catch (e) {
      error = e.message;
    }
  }

  function getEndorsementCount(skill: string): number {
    return endorsements[skill]?.length || 0;
  }

  function getAverageEndorsementLevel(skill: string): number {
    const skillEndorsements = endorsements[skill] || [];
    if (skillEndorsements.length === 0) return 0;
    const sum = skillEndorsements.reduce((acc, e) => acc + e.level, 0);
    return Math.round((sum / skillEndorsements.length) * 10) / 10;
  }

  function hasEndorsed(skill: string): boolean {
    if (!$user) return false;
    return endorsements[skill]?.some(e => e.endorser_id === $user.id) || false;
  }

  onMount(loadEndorsements);
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
  <div class="flex items-center justify-between mb-6">
    <h2 class="text-xl font-semibold">Skills & Endorsements</h2>
    {#if editable && !editMode}
      <Button
        variant="outline"
        size="sm"
        on:click={() => editMode = true}
      >
        Add Skills
      </Button>
    {/if}
  </div>

  {#if error}
    <Alert variant="error" title="Error" message={error} />
  {/if}

  {#if editMode}
    <div class="mb-6 space-y-4" transition:slide>
      <div class="flex gap-2">
        <Input
          bind:value={newSkill}
          placeholder="Add a skill..."
          class="flex-1"
        />
        <Button
          variant="primary"
          disabled={!newSkill.trim()}
          on:click={addSkill}
        >
          Add
        </Button>
      </div>
    </div>
  {/if}

  {#if loading}
    <div class="flex justify-center py-4">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  {:else if skills.length === 0}
    <p class="text-gray-500 dark:text-gray-400 text-center py-4">
      No skills added yet
    </p>
  {:else}
    <div class="space-y-6">
      {#each skills as skill (skill)}
        <div
          class="border-b border-gray-200 dark:border-gray-700 last:border-0 pb-4 last:pb-0"
          transition:fade
        >
          <div class="flex items-start justify-between">
            <div class="space-y-2">
              <div class="flex items-center space-x-2">
                <h3 class="font-medium">{skill}</h3>
                <Badge variant="secondary">
                  {getEndorsementCount(skill)} endorsements
                </Badge>
                {#if getEndorsementCount(skill) > 0}
                  <span class="text-sm text-gray-500 dark:text-gray-400">
                    Avg. Level: {getAverageEndorsementLevel(skill)}
                  </span>
                {/if}
              </div>

              {#if endorsements[skill]?.length > 0}
                <div class="flex flex-wrap gap-2">
                  {#each endorsements[skill] as endorsement (endorsement.id)}
                    <div
                      class="flex items-center bg-gray-100 dark:bg-gray-700 rounded-full px-3 py-1"
                      transition:fade
                    >
                      <img
                        src={endorsement.endorser.user_metadata.avatar_url || '/default-avatar.png'}
                        alt={endorsement.endorser.user_metadata.full_name}
                        class="w-5 h-5 rounded-full mr-2"
                      />
                      <span class="text-sm">
                        {endorsement.endorser.user_metadata.full_name}
                      </span>
                      {#if endorsement.endorser_id === $user?.id}
                        <button
                          class="ml-2 text-gray-500 hover:text-red-500"
                          on:click={() => removeEndorsement(endorsement.id)}
                        >
                          ×
                        </button>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}
            </div>

            <div class="flex items-center space-x-2">
              {#if editMode}
                <Button
                  variant="ghost"
                  size="sm"
                  class="text-red-500 hover:text-red-600"
                  on:click={() => removeSkill(skill)}
                >
                  Remove
                </Button>
              {:else if !hasEndorsed(skill) && $user && profileId !== $user.id}
                <Button
                  variant="outline"
                  size="sm"
                  on:click={() => endorsingSkill = skill}
                >
                  Endorse
                </Button>
              {/if}
            </div>
          </div>

          <!-- Endorsement Form -->
          {#if endorsingSkill === skill}
            <div
              class="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
              transition:slide
            >
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium mb-1">
                    Skill Level
                  </label>
                  <div class="flex gap-2">
                    {#each Array(5) as _, i}
                      <button
                        class="w-8 h-8 rounded-full border-2 transition-colors"
                        class:bg-primary={i < endorsementLevel}
                        class:border-primary={i < endorsementLevel}
                        class:text-white={i < endorsementLevel}
                        class:border-gray-300={i >= endorsementLevel}
                        on:click={() => endorsementLevel = i + 1}
                      >
                        {i + 1}
                      </button>
                    {/each}
                  </div>
                </div>

                <div>
                  <label class="block text-sm font-medium mb-1">
                    Comment (Optional)
                  </label>
                  <Input
                    type="text"
                    bind:value={endorsementComment}
                    placeholder="Add a comment about their skill level..."
                  />
                </div>

                <div class="flex justify-end space-x-2">
                  <Button
                    variant="ghost"
                    on:click={() => endorsingSkill = null}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    on:click={() => addEndorsement(skill)}
                  >
                    Submit Endorsement
                  </Button>
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  /* Add any component-specific styles here */
</style> 