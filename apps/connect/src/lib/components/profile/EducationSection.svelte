<script lang="ts">
  import { fade, slide } from 'svelte/transition';
  import { Button, Input, Alert } from '$lib/components/ui';
  import { supabase } from '$lib/supabaseClient';

  export let education: any[] = [];
  export let profileId: string;
  export let editable = false;
  export let editMode = false;

  let error: string | null = null;
  let addingEducation = false;
  let editingEducation: any = null;

  let newEducation = {
    school: '',
    degree: '',
    field: '',
    startDate: '',
    endDate: '',
    current: false,
    grade: '',
    activities: '',
    description: '',
    achievements: [] as string[],
    courses: [] as string[]
  };

  const degreeTypes = [
    { value: 'high_school', label: 'High School' },
    { value: 'associates', label: "Associate's Degree" },
    { value: 'bachelors', label: "Bachelor's Degree" },
    { value: 'masters', label: "Master's Degree" },
    { value: 'doctorate', label: 'Doctorate' },
    { value: 'certification', label: 'Certification' },
    { value: 'other', label: 'Other' }
  ];

  async function addEducation() {
    try {
      const educationEntry = {
        ...newEducation,
        endDate: newEducation.current ? null : newEducation.endDate
      };

      const updatedEducation = [...education, educationEntry];
      const { error: updateError } = await supabase
        .from('professional_profiles')
        .update({ education: updatedEducation })
        .eq('id', profileId);

      if (updateError) throw updateError;

      education = updatedEducation;
      addingEducation = false;
      resetForm();
    } catch (e) {
      error = e.message;
    }
  }

  async function updateEducation(index: number) {
    try {
      const updatedEntry = {
        ...editingEducation,
        endDate: editingEducation.current ? null : editingEducation.endDate
      };

      const updatedEducation = [...education];
      updatedEducation[index] = updatedEntry;

      const { error: updateError } = await supabase
        .from('professional_profiles')
        .update({ education: updatedEducation })
        .eq('id', profileId);

      if (updateError) throw updateError;

      education = updatedEducation;
      editingEducation = null;
    } catch (e) {
      error = e.message;
    }
  }

  async function removeEducation(index: number) {
    try {
      const updatedEducation = education.filter((_, i) => i !== index);
      const { error: updateError } = await supabase
        .from('professional_profiles')
        .update({ education: updatedEducation })
        .eq('id', profileId);

      if (updateError) throw updateError;
      education = updatedEducation;
    } catch (e) {
      error = e.message;
    }
  }

  function startEditing(educationEntry: any) {
    editingEducation = { ...educationEntry };
  }

  function resetForm() {
    newEducation = {
      school: '',
      degree: '',
      field: '',
      startDate: '',
      endDate: '',
      current: false,
      grade: '',
      activities: '',
      description: '',
      achievements: [],
      courses: []
    };
  }

  function formatDate(date: string | null): string {
    if (!date) return 'Present';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long'
    });
  }

  function getDegreeLabel(value: string): string {
    return degreeTypes.find(d => d.value === value)?.label || value;
  }
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
  <div class="flex items-center justify-between mb-6">
    <h2 class="text-xl font-semibold">Education</h2>
    {#if editable && !editMode && !addingEducation}
      <Button
        variant="outline"
        size="sm"
        on:click={() => addingEducation = true}
      >
        Add Education
      </Button>
    {/if}
  </div>

  {#if error}
    <Alert variant="error" title="Error" message={error} />
  {/if}

  <!-- Add/Edit Education Form -->
  {#if addingEducation || editingEducation}
    <div class="mb-8 space-y-4" transition:slide>
      <Input
        label="School"
        bind:value={editingEducation ? editingEducation.school : newEducation.school}
        placeholder="e.g. Stanford University"
        required
      />

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium mb-1">Degree</label>
          <select
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2"
            bind:value={editingEducation ? editingEducation.degree : newEducation.degree}
          >
            <option value="">Select a degree type</option>
            {#each degreeTypes as type}
              <option value={type.value}>{type.label}</option>
            {/each}
          </select>
        </div>

        <Input
          label="Field of Study"
          bind:value={editingEducation ? editingEducation.field : newEducation.field}
          placeholder="e.g. Computer Science"
        />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <Input
          type="month"
          label="Start Date"
          bind:value={editingEducation ? editingEducation.startDate : newEducation.startDate}
          required
        />

        {#if !(editingEducation ? editingEducation.current : newEducation.current)}
          <Input
            type="month"
            label="End Date"
            bind:value={editingEducation ? editingEducation.endDate : newEducation.endDate}
            required
          />
        {/if}
      </div>

      <div class="flex items-center space-x-2">
        <input
          type="checkbox"
          id="current-education"
          bind:checked={editingEducation ? editingEducation.current : newEducation.current}
          class="rounded border-gray-300 dark:border-gray-600"
        />
        <label for="current-education" class="text-sm">I am currently studying here</label>
      </div>

      <Input
        label="Grade"
        bind:value={editingEducation ? editingEducation.grade : newEducation.grade}
        placeholder="e.g. 3.8 GPA"
      />

      <div>
        <label class="block text-sm font-medium mb-1">Activities and Societies</label>
        <textarea
          class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2 h-24"
          bind:value={editingEducation ? editingEducation.activities : newEducation.activities}
          placeholder="List any clubs, organizations, or activities you participated in..."
        ></textarea>
      </div>

      <div>
        <label class="block text-sm font-medium mb-1">Description</label>
        <textarea
          class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2 h-24"
          bind:value={editingEducation ? editingEducation.description : newEducation.description}
          placeholder="Describe your studies, research, or notable projects..."
        ></textarea>
      </div>

      <div class="flex justify-end space-x-2">
        <Button
          variant="ghost"
          on:click={() => {
            if (editingEducation) {
              editingEducation = null;
            } else {
              addingEducation = false;
              resetForm();
            }
          }}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          on:click={() => {
            if (editingEducation) {
              updateEducation(education.findIndex(e => e === editingEducation));
            } else {
              addEducation();
            }
          }}
        >
          {editingEducation ? 'Save Changes' : 'Add Education'}
        </Button>
      </div>
    </div>
  {/if}

  <!-- Education List -->
  {#if education.length === 0}
    <p class="text-gray-500 dark:text-gray-400 text-center py-4">
      No education added yet
    </p>
  {:else}
    <div class="space-y-6">
      {#each education as edu, index (index)}
        <div
          class="border-b border-gray-200 dark:border-gray-700 last:border-0 pb-6 last:pb-0"
          transition:fade
        >
          <div class="flex items-start justify-between">
            <div class="space-y-1">
              <h3 class="font-medium">{edu.school}</h3>
              <p class="text-gray-600 dark:text-gray-400">
                {getDegreeLabel(edu.degree)}
                {#if edu.field}
                  · {edu.field}
                {/if}
              </p>
              <p class="text-sm text-gray-500 dark:text-gray-500">
                {formatDate(edu.startDate)} - {formatDate(edu.endDate)}
              </p>
              {#if edu.grade}
                <p class="text-sm text-gray-500 dark:text-gray-500">
                  Grade: {edu.grade}
                </p>
              {/if}
            </div>

            {#if editable}
              <div class="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  on:click={() => startEditing(edu)}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  class="text-red-500 hover:text-red-600"
                  on:click={() => removeEducation(index)}
                >
                  Remove
                </Button>
              </div>
            {/if}
          </div>

          {#if edu.description}
            <p class="mt-4 text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
              {edu.description}
            </p>
          {/if}

          {#if edu.activities}
            <div class="mt-4">
              <h4 class="text-sm font-medium mb-2">Activities and Societies</h4>
              <p class="text-gray-600 dark:text-gray-400">
                {edu.activities}
              </p>
            </div>
          {/if}

          {#if edu.achievements?.length > 0}
            <div class="mt-4">
              <h4 class="text-sm font-medium mb-2">Achievements</h4>
              <ul class="list-disc list-inside space-y-1">
                {#each edu.achievements as achievement}
                  <li class="text-gray-600 dark:text-gray-400">{achievement}</li>
                {/each}
              </ul>
            </div>
          {/if}

          {#if edu.courses?.length > 0}
            <div class="mt-4">
              <h4 class="text-sm font-medium mb-2">Relevant Courses</h4>
              <div class="flex flex-wrap gap-2">
                {#each edu.courses as course}
                  <span class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm">
                    {course}
                  </span>
                {/each}
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