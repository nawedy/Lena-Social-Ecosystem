<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { supabase } from '$lib/supabaseClient';
  import { Button, Input, Alert, Select } from '$lib/components/ui';
  import { user } from '$lib/stores/auth';

  export let onSuccess: () => void = () => {};

  let loading = false;
  let error: string | null = null;
  let formData = {
    title: '',
    company: '',
    description: '',
    location: '',
    type: 'full-time',
    remotePolicy: 'hybrid',
    salaryRange: {
      min: '',
      max: '',
      currency: 'USD',
      isPublic: true
    },
    requiredSkills: [] as string[],
    preferredSkills: [] as string[],
    experience: {
      min: 0,
      max: 0,
      level: 'entry'
    },
    benefits: [] as string[],
    applicationDeadline: '',
    isConfidential: false,
    requiresVerification: true
  };

  let skillInput = '';
  let benefitInput = '';

  const jobTypes = [
    { value: 'full-time', label: 'Full Time' },
    { value: 'part-time', label: 'Part Time' },
    { value: 'contract', label: 'Contract' },
    { value: 'internship', label: 'Internship' },
    { value: 'temporary', label: 'Temporary' }
  ];

  const remotePolicies = [
    { value: 'remote', label: 'Remote' },
    { value: 'hybrid', label: 'Hybrid' },
    { value: 'onsite', label: 'On-site' }
  ];

  const experienceLevels = [
    { value: 'entry', label: 'Entry Level' },
    { value: 'mid', label: 'Mid Level' },
    { value: 'senior', label: 'Senior Level' },
    { value: 'lead', label: 'Lead' },
    { value: 'executive', label: 'Executive' }
  ];

  const currencies = [
    { value: 'USD', label: 'USD' },
    { value: 'EUR', label: 'EUR' },
    { value: 'GBP', label: 'GBP' },
    { value: 'CAD', label: 'CAD' }
  ];

  function handleSkillInput(event: KeyboardEvent, type: 'required' | 'preferred') {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      const skill = skillInput.trim();
      
      if (skill && type === 'required' && !formData.requiredSkills.includes(skill)) {
        formData.requiredSkills = [...formData.requiredSkills, skill];
      } else if (skill && type === 'preferred' && !formData.preferredSkills.includes(skill)) {
        formData.preferredSkills = [...formData.preferredSkills, skill];
      }
      
      skillInput = '';
    }
  }

  function removeSkill(skill: string, type: 'required' | 'preferred') {
    if (type === 'required') {
      formData.requiredSkills = formData.requiredSkills.filter(s => s !== skill);
    } else {
      formData.preferredSkills = formData.preferredSkills.filter(s => s !== skill);
    }
  }

  function handleBenefitInput(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      const benefit = benefitInput.trim();
      
      if (benefit && !formData.benefits.includes(benefit)) {
        formData.benefits = [...formData.benefits, benefit];
      }
      
      benefitInput = '';
    }
  }

  function removeBenefit(benefit: string) {
    formData.benefits = formData.benefits.filter(b => b !== benefit);
  }

  async function handleSubmit() {
    if (!$user) return;

    try {
      loading = true;
      error = null;

      // Validate form data
      if (!formData.title || !formData.company || !formData.description) {
        throw new Error('Please fill in all required fields');
      }

      if (formData.salaryRange.isPublic && 
          (!formData.salaryRange.min || !formData.salaryRange.max)) {
        throw new Error('Please specify salary range or make it private');
      }

      // Create job listing
      const { data: job, error: jobError } = await supabase
        .from('job_listings')
        .insert({
          poster_id: $user.id,
          title: formData.title,
          company: formData.company,
          description: formData.description,
          location: formData.location,
          type: formData.type,
          remote_policy: formData.remotePolicy,
          salary_min: formData.salaryRange.isPublic ? formData.salaryRange.min : null,
          salary_max: formData.salaryRange.isPublic ? formData.salaryRange.max : null,
          salary_currency: formData.salaryRange.currency,
          required_skills: formData.requiredSkills,
          preferred_skills: formData.preferredSkills,
          experience_min: formData.experience.min,
          experience_max: formData.experience.max,
          experience_level: formData.experience.level,
          benefits: formData.benefits,
          application_deadline: formData.applicationDeadline,
          is_confidential: formData.isConfidential,
          requires_verification: formData.requiresVerification,
          status: 'active'
        })
        .select()
        .single();

      if (jobError) throw jobError;

      onSuccess();
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }
</script>

<div class="max-w-4xl mx-auto">
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
    <h2 class="text-2xl font-bold mb-6">Post a Job</h2>

    {#if error}
      <Alert variant="error" title="Error" message={error} class="mb-6" />
    {/if}

    <form on:submit|preventDefault={handleSubmit} class="space-y-6">
      <!-- Basic Information -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          label="Job Title"
          bind:value={formData.title}
          placeholder="e.g., Senior Software Engineer"
          required
        />

        <Input
          label="Company Name"
          bind:value={formData.company}
          placeholder="Your company name"
          required
        />

        <Input
          label="Location"
          bind:value={formData.location}
          placeholder="e.g., New York, NY or Remote"
        />

        <Select
          label="Job Type"
          options={jobTypes}
          bind:value={formData.type}
          required
        />

        <Select
          label="Remote Policy"
          options={remotePolicies}
          bind:value={formData.remotePolicy}
          required
        />

        <Select
          label="Experience Level"
          options={experienceLevels}
          bind:value={formData.experience.level}
          required
        />
      </div>

      <!-- Description -->
      <div>
        <label class="block text-sm font-medium mb-2">Job Description</label>
        <textarea
          bind:value={formData.description}
          class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-3 min-h-[200px]"
          placeholder="Describe the role, responsibilities, and requirements..."
          required
        ></textarea>
      </div>

      <!-- Salary Range -->
      <div class="space-y-4">
        <h3 class="text-lg font-medium">Salary Range</h3>
        
        <div class="flex items-center space-x-4">
          <label class="flex items-center space-x-2">
            <input
              type="checkbox"
              bind:checked={formData.salaryRange.isPublic}
              class="rounded border-gray-300 dark:border-gray-600"
            />
            <span>Display salary range publicly</span>
          </label>
        </div>

        {#if formData.salaryRange.isPublic}
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              type="number"
              label="Minimum Salary"
              bind:value={formData.salaryRange.min}
              min="0"
              step="1000"
            />

            <Input
              type="number"
              label="Maximum Salary"
              bind:value={formData.salaryRange.max}
              min="0"
              step="1000"
            />

            <Select
              label="Currency"
              options={currencies}
              bind:value={formData.salaryRange.currency}
            />
          </div>
        {/if}
      </div>

      <!-- Skills -->
      <div class="space-y-4">
        <h3 class="text-lg font-medium">Skills</h3>

        <!-- Required Skills -->
        <div>
          <label class="block text-sm font-medium mb-2">Required Skills</label>
          <Input
            bind:value={skillInput}
            placeholder="Add required skills (press Enter)"
            on:keydown={(e) => handleSkillInput(e, 'required')}
          />
          
          {#if formData.requiredSkills.length > 0}
            <div class="flex flex-wrap gap-2 mt-2">
              {#each formData.requiredSkills as skill}
                <div class="inline-flex items-center bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full px-3 py-1">
                  <span class="text-sm">{skill}</span>
                  <button
                    type="button"
                    class="ml-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                    on:click={() => removeSkill(skill, 'required')}
                  >
                    ×
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Preferred Skills -->
        <div>
          <label class="block text-sm font-medium mb-2">Preferred Skills</label>
          <Input
            bind:value={skillInput}
            placeholder="Add preferred skills (press Enter)"
            on:keydown={(e) => handleSkillInput(e, 'preferred')}
          />
          
          {#if formData.preferredSkills.length > 0}
            <div class="flex flex-wrap gap-2 mt-2">
              {#each formData.preferredSkills as skill}
                <div class="inline-flex items-center bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full px-3 py-1">
                  <span class="text-sm">{skill}</span>
                  <button
                    type="button"
                    class="ml-2 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
                    on:click={() => removeSkill(skill, 'preferred')}
                  >
                    ×
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <!-- Benefits -->
      <div class="space-y-4">
        <h3 class="text-lg font-medium">Benefits</h3>
        
        <Input
          bind:value={benefitInput}
          placeholder="Add benefits (press Enter)"
          on:keydown={handleBenefitInput}
        />
        
        {#if formData.benefits.length > 0}
          <div class="flex flex-wrap gap-2">
            {#each formData.benefits as benefit}
              <div class="inline-flex items-center bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full px-3 py-1">
                <span class="text-sm">{benefit}</span>
                <button
                  type="button"
                  class="ml-2 text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200"
                  on:click={() => removeBenefit(benefit)}
                >
                  ×
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Additional Options -->
      <div class="space-y-4">
        <h3 class="text-lg font-medium">Additional Options</h3>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            type="date"
            label="Application Deadline"
            bind:value={formData.applicationDeadline}
            min={new Date().toISOString().split('T')[0]}
          />

          <div class="space-y-2">
            <label class="flex items-center space-x-2">
              <input
                type="checkbox"
                bind:checked={formData.isConfidential}
                class="rounded border-gray-300 dark:border-gray-600"
              />
              <span>Confidential Listing</span>
            </label>

            <label class="flex items-center space-x-2">
              <input
                type="checkbox"
                bind:checked={formData.requiresVerification}
                class="rounded border-gray-300 dark:border-gray-600"
              />
              <span>Require Profile Verification</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Submit Button -->
      <div class="flex justify-end">
        <Button
          type="submit"
          variant="primary"
          loading={loading}
          disabled={loading}
        >
          Post Job
        </Button>
      </div>
    </form>
  </div>
</div>

<style>
  /* Add any component-specific styles here */
  textarea {
    @apply focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white;
  }

  input[type="checkbox"] {
    @apply text-blue-500 focus:ring-blue-500;
  }
</style> 