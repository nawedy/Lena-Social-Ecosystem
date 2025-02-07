<!-- Settings Page -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { DatabaseService } from '$lib/services/database';
  import { auth } from '$lib/stores/auth';
  import { toasts } from '@lena/ui';
  import type { Profile } from '$lib/types/supabase';

  let profile: Profile | null = null;
  let isLoading = true;
  let isSaving = false;

  // Form states
  let accountForm = {
    username: '',
    email: '',
    eth_address: ''
  };

  let notificationSettings = {
    email_likes: true,
    email_comments: true,
    email_follows: true,
    push_likes: true,
    push_comments: true,
    push_follows: true
  };

  let privacySettings = {
    private_account: false,
    show_activity: true,
    allow_mentions: true,
    allow_messages: true
  };

  onMount(async () => {
    try {
      const userId = $auth.user?.id;
      if (!userId) throw new Error('User not authenticated');

      const userProfile = await DatabaseService.getProfile(userId);
      profile = userProfile;

      if (profile) {
        accountForm = {
          username: profile.username || '',
          email: $auth.user?.email || '',
          eth_address: profile.eth_address || ''
        };
      }

      // TODO: Load actual notification and privacy settings from the database
      // For now, we'll use default values

      isLoading = false;
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to load settings');
    }
  });

  async function handleUpdateAccount() {
    try {
      if (!profile) return;
      isSaving = true;

      const updatedProfile = await DatabaseService.updateProfile({
        username: accountForm.username,
        eth_address: accountForm.eth_address
      });

      if (accountForm.email !== $auth.user?.email) {
        // Update email through auth service
        await auth.updateEmail(accountForm.email);
      }

      profile = updatedProfile;
      toasts.success('Account settings updated successfully');
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to update account settings');
    } finally {
      isSaving = false;
    }
  }

  async function handleUpdateNotifications() {
    try {
      isSaving = true;
      // TODO: Save notification settings to the database
      toasts.success('Notification settings updated successfully');
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to update notification settings');
    } finally {
      isSaving = false;
    }
  }

  async function handleUpdatePrivacy() {
    try {
      isSaving = true;
      // TODO: Save privacy settings to the database
      toasts.success('Privacy settings updated successfully');
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to update privacy settings');
    } finally {
      isSaving = false;
    }
  }

  async function handleDeleteAccount() {
    const confirmed = window.confirm(
      'Are you sure you want to delete your account? This action cannot be undone.'
    );

    if (confirmed) {
      try {
        isSaving = true;
        await DatabaseService.deleteAccount();
        await auth.signOut();
        window.location.href = '/';
      } catch (error) {
        toasts.error(error instanceof Error ? error.message : 'Failed to delete account');
      } finally {
        isSaving = false;
      }
    }
  }
</script>

<svelte:head>
  <title>Settings | TikTokToe</title>
</svelte:head>

<div class="max-w-2xl mx-auto px-4 py-8">
  <h1 class="text-2xl font-bold mb-8">Settings</h1>

  {#if isLoading}
    <div class="space-y-8">
      {#each Array(3) as _}
        <div class="animate-pulse space-y-4">
          <div class="h-6 bg-primary-900/50 rounded w-1/4"></div>
          <div class="h-12 bg-primary-900/50 rounded"></div>
        </div>
      {/each}
    </div>
  {:else}
    <!-- Account Settings -->
    <section class="card p-6 mb-8">
      <h2 class="text-xl font-bold mb-6">Account Settings</h2>
      <form class="space-y-6" on:submit|preventDefault={handleUpdateAccount}>
        <div>
          <label for="username" class="block text-sm font-medium mb-1">Username</label>
          <input
            type="text"
            id="username"
            bind:value={accountForm.username}
            class="input"
            placeholder="Enter your username"
          />
        </div>

        <div>
          <label for="email" class="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            id="email"
            bind:value={accountForm.email}
            class="input"
            placeholder="Enter your email"
          />
        </div>

        <div>
          <label for="eth_address" class="block text-sm font-medium mb-1">ETH Address</label>
          <input
            type="text"
            id="eth_address"
            bind:value={accountForm.eth_address}
            class="input"
            placeholder="Enter your ETH address"
          />
        </div>

        <div class="flex justify-end">
          <button type="submit" class="btn-primary" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </section>

    <!-- Notification Settings -->
    <section class="card p-6 mb-8">
      <h2 class="text-xl font-bold mb-6">Notification Settings</h2>
      <form class="space-y-6" on:submit|preventDefault={handleUpdateNotifications}>
        <div class="space-y-4">
          <h3 class="font-medium">Email Notifications</h3>
          <div class="space-y-2">
            <label class="flex items-center">
              <input
                type="checkbox"
                bind:checked={notificationSettings.email_likes}
                class="form-checkbox"
              />
              <span class="ml-2">Likes on your posts</span>
            </label>
            <label class="flex items-center">
              <input
                type="checkbox"
                bind:checked={notificationSettings.email_comments}
                class="form-checkbox"
              />
              <span class="ml-2">Comments on your posts</span>
            </label>
            <label class="flex items-center">
              <input
                type="checkbox"
                bind:checked={notificationSettings.email_follows}
                class="form-checkbox"
              />
              <span class="ml-2">New followers</span>
            </label>
          </div>
        </div>

        <div class="space-y-4">
          <h3 class="font-medium">Push Notifications</h3>
          <div class="space-y-2">
            <label class="flex items-center">
              <input
                type="checkbox"
                bind:checked={notificationSettings.push_likes}
                class="form-checkbox"
              />
              <span class="ml-2">Likes on your posts</span>
            </label>
            <label class="flex items-center">
              <input
                type="checkbox"
                bind:checked={notificationSettings.push_comments}
                class="form-checkbox"
              />
              <span class="ml-2">Comments on your posts</span>
            </label>
            <label class="flex items-center">
              <input
                type="checkbox"
                bind:checked={notificationSettings.push_follows}
                class="form-checkbox"
              />
              <span class="ml-2">New followers</span>
            </label>
          </div>
        </div>

        <div class="flex justify-end">
          <button type="submit" class="btn-primary" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </section>

    <!-- Privacy Settings -->
    <section class="card p-6 mb-8">
      <h2 class="text-xl font-bold mb-6">Privacy Settings</h2>
      <form class="space-y-6" on:submit|preventDefault={handleUpdatePrivacy}>
        <div class="space-y-4">
          <label class="flex items-center">
            <input
              type="checkbox"
              bind:checked={privacySettings.private_account}
              class="form-checkbox"
            />
            <span class="ml-2">Private Account</span>
          </label>
          <label class="flex items-center">
            <input
              type="checkbox"
              bind:checked={privacySettings.show_activity}
              class="form-checkbox"
            />
            <span class="ml-2">Show Activity Status</span>
          </label>
          <label class="flex items-center">
            <input
              type="checkbox"
              bind:checked={privacySettings.allow_mentions}
              class="form-checkbox"
            />
            <span class="ml-2">Allow @mentions</span>
          </label>
          <label class="flex items-center">
            <input
              type="checkbox"
              bind:checked={privacySettings.allow_messages}
              class="form-checkbox"
            />
            <span class="ml-2">Allow Direct Messages</span>
          </label>
        </div>

        <div class="flex justify-end">
          <button type="submit" class="btn-primary" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </section>

    <!-- Danger Zone -->
    <section class="card p-6 border-red-500/50">
      <h2 class="text-xl font-bold text-red-500 mb-6">Danger Zone</h2>
      <p class="text-gray-400 mb-6">
        Once you delete your account, there is no going back. Please be certain.
      </p>
      <button
        class="btn-danger"
        on:click={handleDeleteAccount}
        disabled={isSaving}
      >
        Delete Account
      </button>
    </section>
  {/if}
</div>

<style lang="postcss">
  .card {
    @apply bg-primary-900/20 rounded-lg border border-primary-900/50;
  }

  .input {
    @apply w-full bg-black/50 border border-primary-900/50 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500/50 focus:border-transparent;
  }

  .form-checkbox {
    @apply rounded border-primary-900/50 bg-black/50 text-primary-500 focus:ring-primary-500/50;
  }

  .btn-primary {
    @apply inline-flex items-center justify-center px-6 py-2 rounded-lg font-medium transition-all duration-200 bg-gradient-to-r from-primary-500 to-primary-600 text-black hover:from-primary-400 hover:to-primary-500 hover:shadow-neon disabled:opacity-50 disabled:cursor-not-allowed;
  }

  .btn-danger {
    @apply inline-flex items-center justify-center px-6 py-2 rounded-lg font-medium transition-all duration-200 bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-400 hover:to-red-500 hover:shadow-neon disabled:opacity-50 disabled:cursor-not-allowed;
  }
</style> 