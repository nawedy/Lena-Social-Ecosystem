<script lang="ts">
  import { fade, slide } from 'svelte/transition';
  import { Button, Input, Alert } from '$lib/components/ui';
  import { supabase } from '$lib/supabaseClient';

  export let experience: any[] = [];
  export let profileId: string;
  export let editable = false;
  export let editMode = false;

  let error: string | null = null;
  let addingExperience = false;
  let editingExperience: any = null;

  let newExperience = {
    title: '',
    company: '',
    location: '',
    type: 'full-time',
    startDate: '',
    endDate: '',
    current: false,
    description: '',
    skills: [] as string[],
    achievements: [] as string[]
  };

  const employmentTypes = [
    { value: 'full-time', label: 'Full-time' },
    { value: 'part-time', label: 'Part-time' },
    { value: 'contract', label: 'Contract' },
    { value: 'freelance', label: 'Freelance' },
    { value: 'internship', label: 'Internship' }
  ];

  async function addExperience() {
    try {
      const experienceEntry = {
        ...newExperience,
        endDate: newExperience.current ? null : newExperience.endDate
      };

      const updatedExperience = [...experience, experienceEntry];
      const { error: updateError } = await supabase
        .from('professional_profiles')
        .update({ experience: updatedExperience })
        .eq('id', profileId);

      if (updateError) throw updateError;

      experience = updatedExperience;
      addingExperience = false;
      resetForm();
    } catch (e) {
      error = e.message;
    }
  }

  async function updateExperience(index: number) {
    try {
      const updatedEntry = {
        ...editingExperience,
        endDate: editingExperience.current ? null : editingExperience.endDate
      };

      const updatedExperience = [...experience];
      updatedExperience[index] = updatedEntry;

      const { error: updateError } = await supabase
        .from('professional_profiles')
        .update({ experience: updatedExperience })
        .eq('id', profileId);

      if (updateError) throw updateError;

      experience = updatedExperience;
      editingExperience = null;
    } catch (e) {
      error = e.message;
    }
  }

  async function removeExperience(index: number) {
    try {
      const updatedExperience = experience.filter((_, i) => i !== index);
      const { error: updateError } = await supabase
        .from('professional_profiles')
        .update({ experience: updatedExperience })
        .eq('id', profileId);

      if (updateError) throw updateError;
      experience = updatedExperience;
    } catch (e) {
      error = e.message;
    }
  }

  function startEditing(experienceEntry: any) {
    editingExperience = { ...experienceEntry };
  }

  function resetForm() {
    newExperience = {
      title: '',
      company: '',
      location: '',
      type: 'full-time',
      startDate: '',
      endDate: '',
      current: false,
      description: '',
      skills: [],
      achievements: []
    };
  }

  function formatDate(date: string | null): string {
    if (!date) return 'Present';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long'
    });
  }

  function getDuration(startDate: string, endDate: string | null): string {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;

    if (years === 0) {
      return `${remainingMonths} mo${remainingMonths !== 1 ? 's' : ''}`;
    } else if (remainingMonths === 0) {
      return `${years} yr${years !== 1 ? 's' : ''}`;
    } else {
      return `${years} yr${years !== 1 ? 's' : ''} ${remainingMonths} mo${remainingMonths !== 1 ? 's' : ''}`;
    }
  }
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
  <div class="flex items-center justify-between mb-6">
    <h2 class="text-xl font-semibold">Experience</h2>
    {#if editable && !editMode && !addingExperience}
      <Button
        variant="outline"
        size="sm"
        on:click={() => addingExperience = true}
      >
        Add Experience
      </Button>
    {/if}
  </div>

  {#if error}
    <Alert variant="error" title="Error" message={error} />
  {/if}

  <!-- Add/Edit Experience Form -->
  {#if addingExperience || editingExperience}
    <div class="mb-8 space-y-4" transition:slide>
      <Input
        label="Title"
        bind:value={editingExperience ? editingExperience.title : newExperience.title}
        placeholder="e.g. Software Engineer"
        required
      />

      <Input
        label="Company"
        bind:value={editingExperience ? editingExperience.company : newExperience.company}
        placeholder="e.g. Tech Corp"
        required
      />

      <Input
        label="Location"
        bind:value={editingExperience ? editingExperience.location : newExperience.location}
        placeholder="e.g. San Francisco, CA"
      />

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium mb-1">Employment Type</label>
          <select
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2"
            bind:value={editingExperience ? editingExperience.type : newExperience.type}
          >
            {#each employmentTypes as type}
              <option value={type.value}>{type.label}</option>
            {/each}
          </select>
        </div>

        <div class="flex items-center space-x-2 pt-6">
          <input
            type="checkbox"
            id="current"
            bind:checked={editingExperience ? editingExperience.current : newExperience.current}
            class="rounded border-gray-300 dark:border-gray-600"
          />
          <label for="current" class="text-sm">I currently work here</label>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <Input
          type="month"
          label="Start Date"
          bind:value={editingExperience ? editingExperience.startDate : newExperience.startDate}
          required
        />

        {#if !(editingExperience ? editingExperience.current : newExperience.current)}
          <Input
            type="month"
            label="End Date"
            bind:value={editingExperience ? editingExperience.endDate : newExperience.endDate}
            required
          />
        {/if}
      </div>

      <div>
        <label class="block text-sm font-medium mb-1">Description</label>
        <textarea
          class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2 h-32"
          bind:value={editingExperience ? editingExperience.description : newExperience.description}
          placeholder="Describe your role and achievements..."
        ></textarea>
      </div>

      <div class="flex justify-end space-x-2">
        <Button
          variant="ghost"
          on:click={() => {
            if (editingExperience) {
              editingExperience = null;
            } else {
              addingExperience = false;
              resetForm();
            }
          }}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          on:click={() => {
            if (editingExperience) {
              updateExperience(experience.findIndex(e => e === editingExperience));
            } else {
              addExperience();
            }
          }}
        >
          {editingExperience ? 'Save Changes' : 'Add Experience'}
        </Button>
      </div>
    </div>
  {/if}

  <!-- Experience List -->
  {#if experience.length === 0}
    <p class="text-gray-500 dark:text-gray-400 text-center py-4">
      No experience added yet
    </p>
  {:else}
    <div class="space-y-6">
      {#each experience as exp, index (index)}
        <div
          class="border-b border-gray-200 dark:border-gray-700 last:border-0 pb-6 last:pb-0"
          transition:fade
        >
          <div class="flex items-start justify-between">
            <div class="space-y-1">
              <h3 class="font-medium">{exp.title}</h3>
              <p class="text-gray-600 dark:text-gray-400">{exp.company}</p>
              <p class="text-sm text-gray-500 dark:text-gray-500">
                {formatDate(exp.startDate)} - {formatDate(exp.endDate)}
                · {getDuration(exp.startDate, exp.endDate)}
              </p>
              {#if exp.location}
                <p class="text-sm text-gray-500 dark:text-gray-500">{exp.location}</p>
              {/if}
            </div>

            {#if editable}
              <div class="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  on:click={() => startEditing(exp)}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  class="text-red-500 hover:text-red-600"
                  on:click={() => removeExperience(index)}
                >
                  Remove
                </Button>
              </div>
            {/if}
          </div>

          {#if exp.description}
            <p class="mt-4 text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
              {exp.description}
            </p>
          {/if}

          {#if exp.skills?.length > 0}
            <div class="mt-4">
              <h4 class="text-sm font-medium mb-2">Skills</h4>
              <div class="flex flex-wrap gap-2">
                {#each exp.skills as skill}
                  <span class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm">
                    {skill}
                  </span>
                {/each}
              </div>
            </div>
          {/if}

          {#if exp.achievements?.length > 0}
            <div class="mt-4">
              <h4 class="text-sm font-medium mb-2">Key Achievements</h4>
              <ul class="list-disc list-inside space-y-1">
                {#each exp.achievements as achievement}
                  <li class="text-gray-600 dark:text-gray-400">{achievement}</li>
                {/each}
              </ul>
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