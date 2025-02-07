<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { supabase } from '$lib/supabaseClient';
  import { Button, Input, Alert } from '$lib/components/ui';
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
      period: 'yearly'
    },
    requiredSkills: [] as string[],
    requiredExperience: '',
    benefits: {
      healthcare: false,
      dental: false,
      vision: false,
      retirement: false,
      pto: false,
      parental: false,
      remote: false,
      education: false,
      other: [] as string[]
    },
    applicationUrl: '',
    tokenRequirements: null
  };

  let newSkill = '';
  let newBenefit = '';

  const jobTypes = [
    { value: 'full-time', label: 'Full-time' },
    { value: 'part-time', label: 'Part-time' },
    { value: 'contract', label: 'Contract' },
    { value: 'freelance', label: 'Freelance' },
    { value: 'internship', label: 'Internship' }
  ];

  const remotePolicies = [
    { value: 'remote', label: 'Remote' },
    { value: 'hybrid', label: 'Hybrid' },
    { value: 'on-site', label: 'On-site' }
  ];

  async function handleSubmit() {
    if (!$user) return;

    try {
      loading = true;
      error = null;

      const { error: submitError } = await supabase
        .from('job_listings')
        .insert({
          poster_id: $user.id,
          title: formData.title,
          company: formData.company,
          description: formData.description,
          location: formData.location,
          type: formData.type,
          remote_policy: formData.remotePolicy,
          salary_range: formData.salaryRange,
          required_skills: formData.requiredSkills,
          required_experience: formData.requiredExperience,
          benefits: formData.benefits,
          application_url: formData.applicationUrl,
          token_requirements: formData.tokenRequirements,
          status: 'active'
        });

      if (submitError) throw submitError;

      onSuccess();
      resetForm();
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function addSkill() {
    if (!newSkill.trim()) return;
    formData.requiredSkills = [...new Set([...formData.requiredSkills, newSkill.trim()])];
    newSkill = '';
  }

  function removeSkill(skill: string) {
    formData.requiredSkills = formData.requiredSkills.filter(s => s !== skill);
  }

  function addBenefit() {
    if (!newBenefit.trim()) return;
    formData.benefits.other = [...new Set([...formData.benefits.other, newBenefit.trim()])];
    newBenefit = '';
  }

  function removeBenefit(benefit: string) {
    formData.benefits.other = formData.benefits.other.filter(b => b !== benefit);
  }

  function resetForm() {
    formData = {
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
        period: 'yearly'
      },
      requiredSkills: [],
      requiredExperience: '',
      benefits: {
        healthcare: false,
        dental: false,
        vision: false,
        retirement: false,
        pto: false,
        parental: false,
        remote: false,
        education: false,
        other: []
      },
      applicationUrl: '',
      tokenRequirements: null
    };
  }
</script>

<div class="max-w-3xl mx-auto">
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
    <h1 class="text-2xl font-bold mb-6">Post a New Job</h1>

    {#if error}
      <Alert variant="error" title="Error" message={error} class="mb-6" />
    {/if}

    <form on:submit|preventDefault={handleSubmit} class="space-y-6">
      <!-- Basic Information -->
      <div class="space-y-4">
        <h2 class="text-lg font-semibold">Basic Information</h2>

        <Input
          label="Job Title"
          bind:value={formData.title}
          placeholder="e.g. Senior Software Engineer"
          required
        />

        <Input
          label="Company"
          bind:value={formData.company}
          placeholder="e.g. Tech Corp"
          required
        />

        <div>
          <label class="block text-sm font-medium mb-1">
            Job Description
          </label>
          <textarea
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2 h-32"
            bind:value={formData.description}
            placeholder="Describe the role, responsibilities, and requirements..."
            required
          ></textarea>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-1">Job Type</label>
            <select
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2"
              bind:value={formData.type}
              required
            >
              {#each jobTypes as type}
                <option value={type.value}>{type.label}</option>
              {/each}
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium mb-1">Work Type</label>
            <select
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2"
              bind:value={formData.remotePolicy}
              required
            >
              {#each remotePolicies as policy}
                <option value={policy.value}>{policy.label}</option>
              {/each}
            </select>
          </div>
        </div>

        <Input
          label="Location"
          bind:value={formData.location}
          placeholder="e.g. San Francisco, CA"
          required={formData.remotePolicy !== 'remote'}
        />
      </div>

      <!-- Salary Range -->
      <div class="space-y-4">
        <h2 class="text-lg font-semibold">Salary Range</h2>

        <div class="grid grid-cols-2 gap-4">
          <Input
            type="number"
            label="Minimum"
            bind:value={formData.salaryRange.min}
            placeholder="e.g. 80000"
          />

          <Input
            type="number"
            label="Maximum"
            bind:value={formData.salaryRange.max}
            placeholder="e.g. 120000"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-1">Currency</label>
            <select
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2"
              bind:value={formData.salaryRange.currency}
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium mb-1">Period</label>
            <select
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2"
              bind:value={formData.salaryRange.period}
            >
              <option value="yearly">Yearly</option>
              <option value="monthly">Monthly</option>
              <option value="hourly">Hourly</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Required Skills -->
      <div class="space-y-4">
        <h2 class="text-lg font-semibold">Required Skills</h2>

        <div class="flex gap-2">
          <Input
            bind:value={newSkill}
            placeholder="Add a required skill..."
            class="flex-1"
          />
          <Button
            variant="outline"
            on:click={addSkill}
            disabled={!newSkill.trim()}
          >
            Add
          </Button>
        </div>

        {#if formData.requiredSkills.length > 0}
          <div class="flex flex-wrap gap-2">
            {#each formData.requiredSkills as skill}
              <div class="bg-gray-100 dark:bg-gray-700 rounded-full px-3 py-1 text-sm flex items-center">
                <span>{skill}</span>
                <button
                  class="ml-2 text-gray-500 hover:text-red-500"
                  on:click={() => removeSkill(skill)}
                >
                  ×
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Required Experience -->
      <div class="space-y-4">
        <h2 class="text-lg font-semibold">Required Experience</h2>

        <Input
          label="Experience Level"
          bind:value={formData.requiredExperience}
          placeholder="e.g. 3+ years of experience in software development"
        />
      </div>

      <!-- Benefits -->
      <div class="space-y-4">
        <h2 class="text-lg font-semibold">Benefits</h2>

        <div class="grid grid-cols-2 gap-4">
          <label class="flex items-center space-x-2">
            <input
              type="checkbox"
              bind:checked={formData.benefits.healthcare}
              class="rounded border-gray-300 dark:border-gray-600"
            />
            <span>Healthcare</span>
          </label>

          <label class="flex items-center space-x-2">
            <input
              type="checkbox"
              bind:checked={formData.benefits.dental}
              class="rounded border-gray-300 dark:border-gray-600"
            />
            <span>Dental</span>
          </label>

          <label class="flex items-center space-x-2">
            <input
              type="checkbox"
              bind:checked={formData.benefits.vision}
              class="rounded border-gray-300 dark:border-gray-600"
            />
            <span>Vision</span>
          </label>

          <label class="flex items-center space-x-2">
            <input
              type="checkbox"
              bind:checked={formData.benefits.retirement}
              class="rounded border-gray-300 dark:border-gray-600"
            />
            <span>401(k)</span>
          </label>

          <label class="flex items-center space-x-2">
            <input
              type="checkbox"
              bind:checked={formData.benefits.pto}
              class="rounded border-gray-300 dark:border-gray-600"
            />
            <span>Paid Time Off</span>
          </label>

          <label class="flex items-center space-x-2">
            <input
              type="checkbox"
              bind:checked={formData.benefits.parental}
              class="rounded border-gray-300 dark:border-gray-600"
            />
            <span>Parental Leave</span>
          </label>

          <label class="flex items-center space-x-2">
            <input
              type="checkbox"
              bind:checked={formData.benefits.remote}
              class="rounded border-gray-300 dark:border-gray-600"
            />
            <span>Remote Work</span>
          </label>

          <label class="flex items-center space-x-2">
            <input
              type="checkbox"
              bind:checked={formData.benefits.education}
              class="rounded border-gray-300 dark:border-gray-600"
            />
            <span>Education</span>
          </label>
        </div>

        <div class="mt-4">
          <div class="flex gap-2">
            <Input
              bind:value={newBenefit}
              placeholder="Add other benefits..."
              class="flex-1"
            />
            <Button
              variant="outline"
              on:click={addBenefit}
              disabled={!newBenefit.trim()}
            >
              Add
            </Button>
          </div>

          {#if formData.benefits.other.length > 0}
            <div class="flex flex-wrap gap-2 mt-2">
              {#each formData.benefits.other as benefit}
                <div class="bg-gray-100 dark:bg-gray-700 rounded-full px-3 py-1 text-sm flex items-center">
                  <span>{benefit}</span>
                  <button
                    class="ml-2 text-gray-500 hover:text-red-500"
                    on:click={() => removeBenefit(benefit)}
                  >
                    ×
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <!-- Application URL -->
      <div>
        <Input
          label="Application URL (Optional)"
          bind:value={formData.applicationUrl}
          placeholder="e.g. https://company.com/careers/job-123"
        />
      </div>

      <div class="flex justify-end space-x-4">
        <Button
          variant="ghost"
          on:click={resetForm}
          type="button"
        >
          Reset
        </Button>
        <Button
          variant="primary"
          type="submit"
          loading={loading}
        >
          Post Job
        </Button>
      </div>
    </form>
  </div>
</div>

<style>
  /* Add any component-specific styles here */
</style> 