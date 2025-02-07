<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { Button, Badge, Alert } from '$lib/components/ui';
  import { supabase } from '$lib/supabaseClient';
  import { user } from '$lib/stores/auth';
  import SkillEndorsements from './SkillEndorsements.svelte';
  import ExperienceSection from './ExperienceSection.svelte';
  import EducationSection from './EducationSection.svelte';
  import AchievementsSection from './AchievementsSection.svelte';
  import ConnectionButton from './ConnectionButton.svelte';
  import VerificationBadge from './VerificationBadge.svelte';

  export let userId: string;
  export let isOwnProfile: boolean = false;

  let profile: any = null;
  let loading = true;
  let error: string | null = null;
  let editMode = false;
  let activeTab = 'about';

  // Form data for editing
  let formData = {
    headline: '',
    bio: '',
    currentPosition: '',
    company: '',
    industry: '',
    location: '',
    skills: [] as string[],
    availability: 'open',
    privacySettings: {
      showEmail: true,
      showConnections: true,
      showEndorsements: true
    }
  };

  async function loadProfile() {
    try {
      loading = true;
      error = null;

      const { data, error: err } = await supabase
        .from('professional_profiles')
        .select(`
          *,
          user:user_id (
            email,
            avatar_url,
            full_name
          ),
          connections:professional_connections (
            count
          ),
          endorsements:skill_endorsements (
            skill,
            endorser:endorser_id (
              id,
              full_name,
              avatar_url
            )
          )
        `)
        .eq('user_id', userId)
        .single();

      if (err) throw err;
      profile = data;
      
      // Initialize form data
      if (profile) {
        formData = {
          headline: profile.headline || '',
          bio: profile.bio || '',
          currentPosition: profile.current_position || '',
          company: profile.company || '',
          industry: profile.industry || '',
          location: profile.location || '',
          skills: profile.skills || [],
          availability: profile.availability || 'open',
          privacySettings: profile.privacy_settings || {
            showEmail: true,
            showConnections: true,
            showEndorsements: true
          }
        };
      }
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function handleSave() {
    try {
      loading = true;
      error = null;

      const { error: err } = await supabase
        .from('professional_profiles')
        .update({
          headline: formData.headline,
          bio: formData.bio,
          current_position: formData.currentPosition,
          company: formData.company,
          industry: formData.industry,
          location: formData.location,
          skills: formData.skills,
          availability: formData.availability,
          privacy_settings: formData.privacySettings,
          updated_at: new Date()
        })
        .eq('user_id', userId);

      if (err) throw err;
      editMode = false;
      await loadProfile();
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  onMount(loadProfile);
</script>

<div class="max-w-4xl mx-auto">
  {#if loading}
    <div class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
    </div>
  {:else if error}
    <div class="bg-red-50 dark:bg-red-900/50 p-4 rounded-lg text-red-600 dark:text-red-400">
      {error}
    </div>
  {:else if profile}
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
      <!-- Cover Image -->
      <div class="h-48 bg-gradient-to-r from-blue-500 to-purple-600"></div>

      <!-- Profile Header -->
      <div class="relative px-6 pb-6">
        <div class="flex justify-between items-end -mt-16">
          <div class="flex items-end">
            <div class="relative">
              <img
                src={profile.user.avatar_url || '/default-avatar.png'}
                alt={profile.user.full_name}
                class="w-32 h-32 rounded-lg border-4 border-white dark:border-gray-800 object-cover"
              />
              {#if profile.verified}
                <div class="absolute -bottom-2 -right-2">
                  <VerificationBadge size="lg" />
                </div>
              {/if}
            </div>
            <div class="ml-6">
              <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
                {profile.user.full_name}
              </h1>
              <p class="text-gray-600 dark:text-gray-300 mt-1">
                {profile.headline}
              </p>
            </div>
          </div>

          {#if isOwnProfile}
            <div class="flex gap-2">
              <Button
                variant={editMode ? 'outline' : 'primary'}
                on:click={() => editMode = !editMode}
              >
                {editMode ? 'Cancel' : 'Edit Profile'}
              </Button>
              {#if editMode}
                <Button
                  variant="primary"
                  on:click={handleSave}
                  loading={loading}
                >
                  Save Changes
                </Button>
              {/if}
            </div>
          {:else}
            <Button variant="primary">
              Connect
            </Button>
          {/if}
        </div>

        <!-- Quick Info -->
        <div class="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <span class="text-gray-500 dark:text-gray-400 text-sm">Location</span>
            <p class="text-gray-900 dark:text-white">{profile.location || 'Not specified'}</p>
          </div>
          <div>
            <span class="text-gray-500 dark:text-gray-400 text-sm">Industry</span>
            <p class="text-gray-900 dark:text-white">{profile.industry || 'Not specified'}</p>
          </div>
          <div>
            <span class="text-gray-500 dark:text-gray-400 text-sm">Current Company</span>
            <p class="text-gray-900 dark:text-white">{profile.company || 'Not specified'}</p>
          </div>
          <div>
            <span class="text-gray-500 dark:text-gray-400 text-sm">Availability</span>
            <Badge
              variant={profile.availability === 'open' ? 'success' : 'secondary'}
              class="mt-1"
            >
              {profile.availability === 'open' ? 'Open to Opportunities' : 'Not Looking'}
            </Badge>
          </div>
        </div>

        <!-- Tabs -->
        <div class="mt-8 border-b border-gray-200 dark:border-gray-700">
          <nav class="-mb-px flex space-x-8">
            {#each ['about', 'experience', 'skills', 'achievements'] as tab}
              <button
                class="py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors"
                class:border-blue-500={activeTab === tab}
                class:text-blue-600={activeTab === tab}
                class:border-transparent={activeTab !== tab}
                class:text-gray-500={activeTab !== tab}
                class:dark:text-gray-400={activeTab !== tab}
                on:click={() => activeTab = tab}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            {/each}
          </nav>
        </div>

        <!-- Tab Content -->
        <div class="mt-6">
          {#if activeTab === 'about'}
            <div class="prose dark:prose-invert max-w-none">
              {#if editMode}
                <textarea
                  bind:value={formData.bio}
                  class="w-full h-32 p-3 border rounded-lg"
                  placeholder="Tell us about yourself..."
                />
              {:else}
                <p>{profile.bio || 'No bio available.'}</p>
              {/if}
            </div>
          {:else if activeTab === 'experience'}
            <!-- Experience section will be implemented separately -->
            <div class="text-center py-8 text-gray-500 dark:text-gray-400">
              Experience section coming soon
            </div>
          {:else if activeTab === 'skills'}
            <!-- Skills section will be implemented separately -->
            <div class="text-center py-8 text-gray-500 dark:text-gray-400">
              Skills section coming soon
            </div>
          {:else if activeTab === 'achievements'}
            <!-- Achievements section will be implemented separately -->
            <div class="text-center py-8 text-gray-500 dark:text-gray-400">
              Achievements section coming soon
            </div>
          {/if}
        </div>
      </div>
    </div>
  {:else}
    <div class="text-center py-12">
      <p class="text-gray-500 dark:text-gray-400">Profile not found</p>
    </div>
  {/if}
</div>

<style>
  :global(.verified-badge) {
    @apply bg-blue-500 text-white p-1 rounded-full;
  }
</style> 