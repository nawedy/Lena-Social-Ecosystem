<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { supabase } from '$lib/supabaseClient';
  import { Button, Input, Alert, Badge } from '$lib/components/ui';
  import { user } from '$lib/stores/auth';

  export let onSuccess: () => void = () => {};

  let loading = false;
  let error: string | null = null;
  let formData = {
    title: '',
    description: '',
    type: 'course',
    difficulty: 'beginner',
    estimatedHours: '',
    prerequisites: [] as string[],
    targetSkills: [] as string[],
    modules: [] as any[],
    assessments: [] as any[],
    visibility: 'draft'
  };

  let newPrerequisite = '';
  let newSkill = '';
  let availableSkills: any[] = [];
  let isInstructor = false;

  async function checkInstructorStatus() {
    if (!$user) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('instructors')
        .select('verified')
        .eq('user_id', $user.id)
        .single();

      if (fetchError) throw fetchError;
      isInstructor = data?.verified || false;
    } catch (e) {
      console.error('Error checking instructor status:', e);
    }
  }

  async function loadSkills() {
    try {
      const { data, error: fetchError } = await supabase
        .from('skills')
        .select('*')
        .order('name');

      if (fetchError) throw fetchError;
      availableSkills = data || [];
    } catch (e) {
      console.error('Error loading skills:', e);
    }
  }

  async function handleSubmit() {
    if (!$user || !isInstructor) return;

    try {
      loading = true;
      error = null;

      // Create learning path
      const { data: path, error: pathError } = await supabase
        .from('learning_paths')
        .insert({
          creator_id: $user.id,
          title: formData.title,
          description: formData.description,
          type: formData.type,
          difficulty: formData.difficulty,
          estimated_hours: formData.estimatedHours,
          prerequisites: formData.prerequisites,
          status: 'pending_review',
          visibility: formData.visibility
        })
        .select()
        .single();

      if (pathError) throw pathError;

      // Create modules
      const modulePromises = formData.modules.map(module =>
        supabase
          .from('learning_modules')
          .insert({
            path_id: path.id,
            ...module
          })
      );

      await Promise.all(modulePromises);

      // Create assessments
      const assessmentPromises = formData.assessments.map(assessment =>
        supabase
          .from('skill_assessments')
          .insert({
            path_id: path.id,
            ...assessment
          })
      );

      await Promise.all(assessmentPromises);

      // Link target skills
      const skillPromises = formData.targetSkills.map(skillId =>
        supabase
          .from('path_skills')
          .insert({
            path_id: path.id,
            skill_id: skillId
          })
      );

      await Promise.all(skillPromises);

      // Submit for review
      const { error: reviewError } = await supabase
        .from('content_reviews')
        .insert({
          content_id: path.id,
          content_type: 'learning_path',
          status: 'pending',
          submitted_by: $user.id
        });

      if (reviewError) throw reviewError;

      onSuccess();
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function addModule() {
    formData.modules = [
      ...formData.modules,
      {
        title: '',
        description: '',
        type: 'video',
        content: '',
        duration: 0,
        order: formData.modules.length
      }
    ];
  }

  function removeModule(index: number) {
    formData.modules = formData.modules.filter((_, i) => i !== index);
  }

  function addAssessment() {
    formData.assessments = [
      ...formData.assessments,
      {
        title: '',
        description: '',
        passing_score: 70,
        time_limit: 30,
        questions: []
      }
    ];
  }

  function removeAssessment(index: number) {
    formData.assessments = formData.assessments.filter((_, i) => i !== index);
  }

  function addPrerequisite() {
    if (!newPrerequisite.trim()) return;
    formData.prerequisites = [...new Set([...formData.prerequisites, newPrerequisite.trim()])];
    newPrerequisite = '';
  }

  function removePrerequisite(prerequisite: string) {
    formData.prerequisites = formData.prerequisites.filter(p => p !== prerequisite);
  }

  function addSkill() {
    if (!newSkill) return;
    formData.targetSkills = [...new Set([...formData.targetSkills, newSkill])];
    newSkill = '';
  }

  function removeSkill(skillId: string) {
    formData.targetSkills = formData.targetSkills.filter(id => id !== skillId);
  }

  onMount(() => {
    checkInstructorStatus();
    loadSkills();
  });
</script>

<div class="max-w-4xl mx-auto">
  {#if !$user}
    <Alert variant="warning" title="Authentication Required" message="Please sign in to create content." />
  {:else if !isInstructor}
    <Alert variant="warning" title="Instructor Status Required" message="You need to be a verified instructor to create content." />
  {:else}
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h1 class="text-2xl font-bold mb-6">Create Educational Content</h1>

      {#if error}
        <Alert variant="error" title="Error" message={error} class="mb-6" />
      {/if}

      <form on:submit|preventDefault={handleSubmit} class="space-y-6">
        <!-- Basic Information -->
        <div class="space-y-4">
          <h2 class="text-lg font-semibold">Basic Information</h2>

          <Input
            label="Title"
            bind:value={formData.title}
            placeholder="e.g. Advanced Web Development"
            required
          />

          <div>
            <label class="block text-sm font-medium mb-1">
              Description
            </label>
            <textarea
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2 h-32"
              bind:value={formData.description}
              placeholder="Describe what learners will achieve..."
              required
            ></textarea>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1">Content Type</label>
              <select
                class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2"
                bind:value={formData.type}
                required
              >
                <option value="course">Course</option>
                <option value="workshop">Workshop</option>
                <option value="tutorial">Tutorial</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium mb-1">Difficulty Level</label>
              <select
                class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2"
                bind:value={formData.difficulty}
                required
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>

          <Input
            type="number"
            label="Estimated Hours"
            bind:value={formData.estimatedHours}
            placeholder="e.g. 10"
            required
          />
        </div>

        <!-- Prerequisites -->
        <div class="space-y-4">
          <h2 class="text-lg font-semibold">Prerequisites</h2>

          <div class="flex gap-2">
            <Input
              bind:value={newPrerequisite}
              placeholder="Add a prerequisite..."
              class="flex-1"
            />
            <Button
              variant="outline"
              on:click={addPrerequisite}
              disabled={!newPrerequisite.trim()}
            >
              Add
            </Button>
          </div>

          {#if formData.prerequisites.length > 0}
            <div class="flex flex-wrap gap-2">
              {#each formData.prerequisites as prerequisite}
                <div class="bg-gray-100 dark:bg-gray-700 rounded-full px-3 py-1 text-sm flex items-center">
                  <span>{prerequisite}</span>
                  <button
                    class="ml-2 text-gray-500 hover:text-red-500"
                    on:click={() => removePrerequisite(prerequisite)}
                  >
                    ×
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Target Skills -->
        <div class="space-y-4">
          <h2 class="text-lg font-semibold">Target Skills</h2>

          <div class="flex gap-2">
            <select
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2"
              bind:value={newSkill}
            >
              <option value="">Select a skill...</option>
              {#each availableSkills as skill}
                {#if !formData.targetSkills.includes(skill.id)}
                  <option value={skill.id}>{skill.name}</option>
                {/if}
              {/each}
            </select>
            <Button
              variant="outline"
              on:click={addSkill}
              disabled={!newSkill}
            >
              Add
            </Button>
          </div>

          {#if formData.targetSkills.length > 0}
            <div class="flex flex-wrap gap-2">
              {#each formData.targetSkills as skillId}
                {#if skill = availableSkills.find(s => s.id === skillId)}
                  <Badge variant="primary" class="flex items-center">
                    {skill.name}
                    <button
                      class="ml-2 text-white hover:text-red-200"
                      on:click={() => removeSkill(skillId)}
                    >
                      ×
                    </button>
                  </Badge>
                {/if}
              {/each}
            </div>
          {/if}
        </div>

        <!-- Modules -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold">Modules</h2>
            <Button
              variant="outline"
              on:click={addModule}
            >
              Add Module
            </Button>
          </div>

          {#each formData.modules as module, i}
            <div class="border rounded-lg p-4 space-y-4">
              <div class="flex justify-between items-start">
                <h3 class="font-medium">Module {i + 1}</h3>
                <button
                  class="text-red-500 hover:text-red-600"
                  on:click={() => removeModule(i)}
                >
                  Remove
                </button>
              </div>

              <Input
                label="Title"
                bind:value={module.title}
                placeholder="Module title"
                required
              />

              <div>
                <label class="block text-sm font-medium mb-1">
                  Description
                </label>
                <textarea
                  class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2 h-24"
                  bind:value={module.description}
                  placeholder="Module description"
                  required
                ></textarea>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium mb-1">Content Type</label>
                  <select
                    class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2"
                    bind:value={module.type}
                    required
                  >
                    <option value="video">Video</option>
                    <option value="article">Article</option>
                    <option value="quiz">Quiz</option>
                    <option value="exercise">Exercise</option>
                  </select>
                </div>

                <Input
                  type="number"
                  label="Duration (minutes)"
                  bind:value={module.duration}
                  required
                />
              </div>

              <div>
                <label class="block text-sm font-medium mb-1">
                  Content
                </label>
                <textarea
                  class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2 h-32"
                  bind:value={module.content}
                  placeholder="Module content or URL"
                  required
                ></textarea>
              </div>
            </div>
          {/each}
        </div>

        <!-- Assessments -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold">Assessments</h2>
            <Button
              variant="outline"
              on:click={addAssessment}
            >
              Add Assessment
            </Button>
          </div>

          {#each formData.assessments as assessment, i}
            <div class="border rounded-lg p-4 space-y-4">
              <div class="flex justify-between items-start">
                <h3 class="font-medium">Assessment {i + 1}</h3>
                <button
                  class="text-red-500 hover:text-red-600"
                  on:click={() => removeAssessment(i)}
                >
                  Remove
                </button>
              </div>

              <Input
                label="Title"
                bind:value={assessment.title}
                placeholder="Assessment title"
                required
              />

              <div>
                <label class="block text-sm font-medium mb-1">
                  Description
                </label>
                <textarea
                  class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2 h-24"
                  bind:value={assessment.description}
                  placeholder="Assessment description"
                  required
                ></textarea>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <Input
                  type="number"
                  label="Passing Score (%)"
                  bind:value={assessment.passing_score}
                  min="0"
                  max="100"
                  required
                />

                <Input
                  type="number"
                  label="Time Limit (minutes)"
                  bind:value={assessment.time_limit}
                  min="1"
                  required
                />
              </div>
            </div>
          {/each}
        </div>

        <!-- Visibility -->
        <div>
          <label class="block text-sm font-medium mb-1">Visibility</label>
          <select
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2"
            bind:value={formData.visibility}
            required
          >
            <option value="draft">Draft</option>
            <option value="private">Private</option>
            <option value="public">Public</option>
          </select>
        </div>

        <div class="flex justify-end space-x-4">
          <Button
            variant="ghost"
            type="button"
            on:click={() => {
              formData = {
                title: '',
                description: '',
                type: 'course',
                difficulty: 'beginner',
                estimatedHours: '',
                prerequisites: [],
                targetSkills: [],
                modules: [],
                assessments: [],
                visibility: 'draft'
              };
            }}
          >
            Reset
          </Button>
          <Button
            variant="primary"
            type="submit"
            loading={loading}
          >
            Submit for Review
          </Button>
        </div>
      </form>
    </div>
  {/if}
</div>

<style>
  /* Add any component-specific styles here */
</style> 