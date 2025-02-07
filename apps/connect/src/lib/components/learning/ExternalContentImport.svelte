<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { Button, Input, Alert, Badge } from '$lib/components/ui';
  import { ExternalContentService } from '$lib/services/ExternalContentService';
  import { user } from '$lib/stores/auth';

  export let onImport: (pathId: string) => void = () => {};

  let loading = false;
  let error: string | null = null;
  let platforms: any[] = [];
  let selectedPlatform: string = '';
  let contentUrl: string = '';
  let privacySettings = {
    shareProgress: false,
    allowTracking: false,
    storageLocation: 'local'
  };

  const externalContentService = new ExternalContentService();

  async function loadPlatforms() {
    platforms = externalContentService.getSupportedPlatforms();
  }

  function extractContentId(url: string, platformId: string): string | null {
    const patterns: Record<string, RegExp> = {
      linkedin_learning: /(?:\/learning\/|\/course\/)([^\/\?]+)/i,
      coursera: /(?:\/learn\/|\/course\/)([^\/\?]+)/i,
      google_upskill: /(?:\/course\/|\/program\/)([^\/\?]+)/i,
      udacity: /(?:\/course\/|\/nanodegree\-program\/)([^\/\?]+)/i,
      edx: /(?:\/course\/|\/program\/)([^\/\?]+)/i
    };

    const pattern = patterns[platformId];
    if (!pattern) return null;

    const match = url.match(pattern);
    return match ? match[1] : null;
  }

  async function handleImport() {
    if (!$user) return;

    try {
      loading = true;
      error = null;

      const contentId = extractContentId(contentUrl, selectedPlatform);
      if (!contentId) {
        throw new Error('Invalid content URL');
      }

      const pathId = await externalContentService.importContent(
        selectedPlatform,
        contentId,
        $user.id
      );

      onImport(pathId);
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  onMount(loadPlatforms);
</script>

<div class="max-w-2xl mx-auto">
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
    <h2 class="text-2xl font-bold mb-6">Import External Content</h2>

    {#if error}
      <Alert variant="error" title="Error" message={error} class="mb-6" />
    {/if}

    <form on:submit|preventDefault={handleImport} class="space-y-6">
      <!-- Platform Selection -->
      <div>
        <label class="block text-sm font-medium mb-2">Learning Platform</label>
        <select
          class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2"
          bind:value={selectedPlatform}
          required
        >
          <option value="">Select a platform...</option>
          {#each platforms as platform}
            <option value={platform.id}>{platform.name}</option>
          {/each}
        </select>
      </div>

      <!-- Content URL -->
      <Input
        label="Content URL"
        bind:value={contentUrl}
        placeholder="Paste the course or content URL"
        required
      />

      <!-- Privacy Settings -->
      <div class="space-y-4">
        <h3 class="text-lg font-semibold">Privacy Settings</h3>

        <div class="space-y-2">
          <label class="flex items-center space-x-2">
            <input
              type="checkbox"
              bind:checked={privacySettings.shareProgress}
              class="rounded border-gray-300 dark:border-gray-600"
            />
            <span>Share progress with original platform</span>
          </label>

          <label class="flex items-center space-x-2">
            <input
              type="checkbox"
              bind:checked={privacySettings.allowTracking}
              class="rounded border-gray-300 dark:border-gray-600"
            />
            <span>Allow content tracking</span>
          </label>

          <div>
            <label class="block text-sm font-medium mb-2">Content Storage</label>
            <select
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2"
              bind:value={privacySettings.storageLocation}
            >
              <option value="local">Store locally (Most Private)</option>
              <option value="hybrid">Hybrid Storage</option>
              <option value="external">External Platform (Least Private)</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Platform-specific Privacy Info -->
      {#if selectedPlatform}
        {#if platform = platforms.find(p => p.id === selectedPlatform)}
          <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h4 class="font-medium mb-2">Privacy Level: {platform.privacyLevel}</h4>
            <ul class="list-disc list-inside space-y-1 text-sm">
              {#if platform.privacyLevel === 'high'}
                <li>End-to-end encryption for content</li>
                <li>No personal data shared</li>
                <li>Anonymous progress tracking</li>
              {:else if platform.privacyLevel === 'medium'}
                <li>Content cached locally</li>
                <li>Limited data sharing</li>
                <li>Pseudonymized tracking</li>
              {:else}
                <li>Standard privacy protections</li>
                <li>Basic data sharing required</li>
              {/if}
            </ul>
          </div>
        {/if}
      {/if}

      <!-- Import Button -->
      <div class="flex justify-end">
        <Button
          type="submit"
          variant="primary"
          loading={loading}
        >
          Import Content
        </Button>
      </div>
    </form>
  </div>

  <!-- Integration Instructions -->
  <div class="mt-8 space-y-4">
    <h3 class="text-lg font-semibold">How to Import Content</h3>
    
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-4">
      <ol class="list-decimal list-inside space-y-2">
        <li>Select the learning platform from the dropdown</li>
        <li>Copy the course URL from the platform</li>
        <li>Paste the URL in the Content URL field</li>
        <li>Adjust privacy settings as needed</li>
        <li>Click Import Content to add it to your learning paths</li>
      </ol>

      <div class="mt-4">
        <h4 class="font-medium mb-2">Supported URL Formats:</h4>
        <div class="space-y-2 text-sm">
          <p><strong>LinkedIn Learning:</strong> https://www.linkedin.com/learning/course-name</p>
          <p><strong>Coursera:</strong> https://www.coursera.org/learn/course-name</p>
          <p><strong>Google Digital Skills:</strong> https://digitalskills.google.com/course/name</p>
          <p><strong>Udacity:</strong> https://www.udacity.com/course/course-name</p>
          <p><strong>edX:</strong> https://www.edx.org/course/course-name</p>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  /* Add any component-specific styles here */
</style> 