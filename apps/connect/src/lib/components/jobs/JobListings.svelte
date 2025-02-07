<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { supabase } from '$lib/supabaseClient';
  import { Button, Badge, Input, Alert } from '$lib/components/ui';
  import { user } from '$lib/stores/auth';

  let jobs: any[] = [];
  let loading = true;
  let error: string | null = null;
  let filters = {
    type: '',
    location: '',
    remote: '',
    industry: ''
  };
  let searchQuery = '';

  // Pagination
  let page = 1;
  let pageSize = 10;
  let totalJobs = 0;

  async function loadJobs() {
    try {
      loading = true;
      error = null;

      let query = supabase
        .from('job_listings')
        .select('*, poster:poster_id(full_name, company)', { count: 'exact' });

      // Apply filters
      if (filters.type) query = query.eq('type', filters.type);
      if (filters.location) query = query.ilike('location', `%${filters.location}%`);
      if (filters.remote) query = query.eq('remote_policy', filters.remote);
      if (filters.industry) query = query.ilike('industry', `%${filters.industry}%`);
      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      // Add pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      jobs = data || [];
      totalJobs = count || 0;
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function applyForJob(jobId: string) {
    if (!$user) return;

    try {
      const { error: applyError } = await supabase
        .from('job_applications')
        .insert({
          job_id: jobId,
          applicant_id: $user.id,
          status: 'submitted'
        });

      if (applyError) throw applyError;
      
      // Refresh jobs to update applicant count
      await loadJobs();
    } catch (e) {
      error = e.message;
    }
  }

  function resetFilters() {
    filters = {
      type: '',
      location: '',
      remote: '',
      industry: ''
    };
    searchQuery = '';
    page = 1;
    loadJobs();
  }

  onMount(loadJobs);
</script>

<div class="max-w-6xl mx-auto">
  <!-- Search and Filters -->
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Input
        type="search"
        placeholder="Search jobs..."
        bind:value={searchQuery}
        on:input={() => {
          page = 1;
          loadJobs();
        }}
      />

      <select
        class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2"
        bind:value={filters.type}
        on:change={() => {
          page = 1;
          loadJobs();
        }}
      >
        <option value="">All Job Types</option>
        <option value="full-time">Full-time</option>
        <option value="part-time">Part-time</option>
        <option value="contract">Contract</option>
        <option value="freelance">Freelance</option>
        <option value="internship">Internship</option>
      </select>

      <select
        class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2"
        bind:value={filters.remote}
        on:change={() => {
          page = 1;
          loadJobs();
        }}
      >
        <option value="">All Work Types</option>
        <option value="remote">Remote</option>
        <option value="hybrid">Hybrid</option>
        <option value="on-site">On-site</option>
      </select>

      <Button
        variant="outline"
        on:click={resetFilters}
      >
        Reset Filters
      </Button>
    </div>
  </div>

  {#if error}
    <Alert variant="error" title="Error" message={error} />
  {/if}

  <!-- Job Listings -->
  {#if loading}
    <div class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
    </div>
  {:else if jobs.length === 0}
    <div class="text-center py-12">
      <p class="text-gray-500 dark:text-gray-400">No jobs found matching your criteria</p>
    </div>
  {:else}
    <div class="space-y-6">
      {#each jobs as job (job.id)}
        <div
          class="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
          transition:fade
        >
          <div class="flex items-start justify-between">
            <div>
              <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
                {job.title}
              </h2>
              <p class="text-gray-600 dark:text-gray-300 mt-1">
                {job.poster.company}
              </p>
              <div class="flex items-center space-x-4 mt-2">
                <Badge variant="secondary">
                  {job.type}
                </Badge>
                <Badge variant="secondary">
                  {job.remote_policy}
                </Badge>
                {#if job.location}
                  <span class="text-gray-500 dark:text-gray-400">
                    {job.location}
                  </span>
                {/if}
              </div>
            </div>

            <Button
              variant="primary"
              on:click={() => applyForJob(job.id)}
              disabled={!$user}
            >
              Apply Now
            </Button>
          </div>

          <div class="mt-4 prose dark:prose-invert max-w-none">
            <p class="text-gray-600 dark:text-gray-400">
              {job.description}
            </p>
          </div>

          {#if job.required_skills?.length > 0}
            <div class="mt-4">
              <h3 class="text-sm font-medium mb-2">Required Skills</h3>
              <div class="flex flex-wrap gap-2">
                {#each job.required_skills as skill}
                  <Badge variant="secondary">
                    {skill}
                  </Badge>
                {/each}
              </div>
            </div>
          {/if}

          <div class="mt-4 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <div>
              Posted by {job.poster.full_name}
            </div>
            <div class="flex items-center space-x-4">
              <span>{job.applicant_count} applicants</span>
              <span>{new Date(job.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      {/each}
    </div>

    <!-- Pagination -->
    {#if totalJobs > pageSize}
      <div class="flex justify-center mt-8 space-x-2">
        <Button
          variant="outline"
          disabled={page === 1}
          on:click={() => {
            page--;
            loadJobs();
          }}
        >
          Previous
        </Button>
        <span class="py-2 px-4 text-gray-600 dark:text-gray-400">
          Page {page} of {Math.ceil(totalJobs / pageSize)}
        </span>
        <Button
          variant="outline"
          disabled={page >= Math.ceil(totalJobs / pageSize)}
          on:click={() => {
            page++;
            loadJobs();
          }}
        >
          Next
        </Button>
      </div>
    {/if}
  {/if}
</div>

<style>
  /* Add any component-specific styles here */
</style> 