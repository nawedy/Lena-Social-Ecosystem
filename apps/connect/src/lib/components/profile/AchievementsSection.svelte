<script lang="ts">
  import { fade, slide } from 'svelte/transition';
  import { Button, Input, Alert, Badge } from '$lib/components/ui';
  import { supabase } from '$lib/supabaseClient';

  export let achievements: any[] = [];
  export let profileId: string;
  export let editable = false;
  export let editMode = false;

  let error: string | null = null;
  let addingAchievement = false;
  let editingAchievement: any = null;

  let newAchievement = {
    title: '',
    description: '',
    achievementDate: '',
    achievementUrl: '',
    achievementType: 'award',
    issuer: '',
    verificationStatus: 'unverified',
    verificationData: {}
  };

  const achievementTypes = [
    { value: 'award', label: 'Award' },
    { value: 'certification', label: 'Certification' },
    { value: 'publication', label: 'Publication' },
    { value: 'patent', label: 'Patent' },
    { value: 'other', label: 'Other' }
  ];

  async function addAchievement() {
    try {
      const achievementEntry = {
        ...newAchievement,
        achievementDate: newAchievement.achievementDate || null
      };

      const { data: achievement, error: insertError } = await supabase
        .from('professional_achievements')
        .insert({
          profile_id: profileId,
          title: achievementEntry.title,
          description: achievementEntry.description,
          achievement_date: achievementEntry.achievementDate,
          achievement_url: achievementEntry.achievementUrl,
          achievement_type: achievementEntry.achievementType,
          issuer: achievementEntry.issuer,
          verification_status: achievementEntry.verificationStatus,
          verification_data: achievementEntry.verificationData
        })
        .select()
        .single();

      if (insertError) throw insertError;

      achievements = [...achievements, achievement];
      addingAchievement = false;
      resetForm();
    } catch (e) {
      error = e.message;
    }
  }

  async function updateAchievement(achievementId: string) {
    try {
      const updatedEntry = {
        ...editingAchievement,
        achievementDate: editingAchievement.achievementDate || null
      };

      const { error: updateError } = await supabase
        .from('professional_achievements')
        .update({
          title: updatedEntry.title,
          description: updatedEntry.description,
          achievement_date: updatedEntry.achievementDate,
          achievement_url: updatedEntry.achievementUrl,
          achievement_type: updatedEntry.achievementType,
          issuer: updatedEntry.issuer,
          verification_data: updatedEntry.verificationData
        })
        .eq('id', achievementId);

      if (updateError) throw updateError;

      achievements = achievements.map(a =>
        a.id === achievementId ? { ...a, ...updatedEntry } : a
      );
      editingAchievement = null;
    } catch (e) {
      error = e.message;
    }
  }

  async function removeAchievement(achievementId: string) {
    try {
      const { error: deleteError } = await supabase
        .from('professional_achievements')
        .delete()
        .eq('id', achievementId);

      if (deleteError) throw deleteError;
      achievements = achievements.filter(a => a.id !== achievementId);
    } catch (e) {
      error = e.message;
    }
  }

  async function requestVerification(achievementId: string) {
    try {
      const { error: updateError } = await supabase
        .from('professional_achievements')
        .update({
          verification_status: 'pending'
        })
        .eq('id', achievementId);

      if (updateError) throw updateError;

      achievements = achievements.map(a =>
        a.id === achievementId ? { ...a, verification_status: 'pending' } : a
      );
    } catch (e) {
      error = e.message;
    }
  }

  function startEditing(achievementEntry: any) {
    editingAchievement = { ...achievementEntry };
  }

  function resetForm() {
    newAchievement = {
      title: '',
      description: '',
      achievementDate: '',
      achievementUrl: '',
      achievementType: 'award',
      issuer: '',
      verificationStatus: 'unverified',
      verificationData: {}
    };
  }

  function formatDate(date: string | null): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long'
    });
  }

  function getVerificationBadge(status: string) {
    switch (status) {
      case 'verified':
        return { variant: 'success', label: 'Verified' };
      case 'pending':
        return { variant: 'warning', label: 'Verification Pending' };
      case 'rejected':
        return { variant: 'error', label: 'Verification Failed' };
      default:
        return { variant: 'secondary', label: 'Not Verified' };
    }
  }
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
  <div class="flex items-center justify-between mb-6">
    <h2 class="text-xl font-semibold">Achievements & Certifications</h2>
    {#if editable && !editMode && !addingAchievement}
      <Button
        variant="outline"
        size="sm"
        on:click={() => addingAchievement = true}
      >
        Add Achievement
      </Button>
    {/if}
  </div>

  {#if error}
    <Alert variant="error" title="Error" message={error} />
  {/if}

  <!-- Add/Edit Achievement Form -->
  {#if addingAchievement || editingAchievement}
    <div class="mb-8 space-y-4" transition:slide>
      <Input
        label="Title"
        bind:value={editingAchievement ? editingAchievement.title : newAchievement.title}
        placeholder="e.g. AWS Certified Solutions Architect"
        required
      />

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium mb-1">Type</label>
          <select
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2"
            bind:value={editingAchievement ? editingAchievement.achievementType : newAchievement.achievementType}
          >
            {#each achievementTypes as type}
              <option value={type.value}>{type.label}</option>
            {/each}
          </select>
        </div>

        <Input
          label="Issuer"
          bind:value={editingAchievement ? editingAchievement.issuer : newAchievement.issuer}
          placeholder="e.g. Amazon Web Services"
        />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <Input
          type="date"
          label="Achievement Date"
          bind:value={editingAchievement ? editingAchievement.achievementDate : newAchievement.achievementDate}
        />

        <Input
          label="Verification URL"
          bind:value={editingAchievement ? editingAchievement.achievementUrl : newAchievement.achievementUrl}
          placeholder="e.g. https://verify.example.com/cert/123"
        />
      </div>

      <div>
        <label class="block text-sm font-medium mb-1">Description</label>
        <textarea
          class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2 h-24"
          bind:value={editingAchievement ? editingAchievement.description : newAchievement.description}
          placeholder="Describe your achievement, skills demonstrated, or impact..."
        ></textarea>
      </div>

      <div class="flex justify-end space-x-2">
        <Button
          variant="ghost"
          on:click={() => {
            if (editingAchievement) {
              editingAchievement = null;
            } else {
              addingAchievement = false;
              resetForm();
            }
          }}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          on:click={() => {
            if (editingAchievement) {
              updateAchievement(editingAchievement.id);
            } else {
              addAchievement();
            }
          }}
        >
          {editingAchievement ? 'Save Changes' : 'Add Achievement'}
        </Button>
      </div>
    </div>
  {/if}

  <!-- Achievements List -->
  {#if achievements.length === 0}
    <p class="text-gray-500 dark:text-gray-400 text-center py-4">
      No achievements added yet
    </p>
  {:else}
    <div class="space-y-6">
      {#each achievements as achievement (achievement.id)}
        <div
          class="border-b border-gray-200 dark:border-gray-700 last:border-0 pb-6 last:pb-0"
          transition:fade
        >
          <div class="flex items-start justify-between">
            <div class="space-y-1">
              <div class="flex items-center space-x-2">
                <h3 class="font-medium">{achievement.title}</h3>
                {#if achievement.verification_status}
                  {@const badge = getVerificationBadge(achievement.verification_status)}
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                {/if}
              </div>
              <p class="text-gray-600 dark:text-gray-400">
                {achievement.issuer}
                {#if achievement.achievementDate}
                  · {formatDate(achievement.achievementDate)}
                {/if}
              </p>
            </div>

            <div class="flex items-center space-x-2">
              {#if editable}
                <Button
                  variant="ghost"
                  size="sm"
                  on:click={() => startEditing(achievement)}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  class="text-red-500 hover:text-red-600"
                  on:click={() => removeAchievement(achievement.id)}
                >
                  Remove
                </Button>
              {/if}
              {#if achievement.verification_status === 'unverified'}
                <Button
                  variant="outline"
                  size="sm"
                  on:click={() => requestVerification(achievement.id)}
                >
                  Request Verification
                </Button>
              {/if}
            </div>
          </div>

          {#if achievement.description}
            <p class="mt-4 text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
              {achievement.description}
            </p>
          {/if}

          {#if achievement.achievementUrl}
            <div class="mt-4">
              <a
                href={achievement.achievementUrl}
                target="_blank"
                rel="noopener noreferrer"
                class="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                View Certificate →
              </a>
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