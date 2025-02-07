<!-- (protected)/profile/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/auth/store';
  import { supabase } from '$lib/supabaseClient';
  import Button from '$lib/components/ui/Button.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Alert from '$lib/components/ui/Alert.svelte';
  import { ipfsService } from '$lib/services/ipfs';

  let loading = false;
  let error: string | null = null;
  let success: string | null = null;

  // Profile data
  let username = '';
  let displayName = '';
  let bio = '';
  let avatarUrl = '';
  let web3Address = '';
  let ipfsHash = '';
  let encryptionEnabled = false;
  let mfaEnabled = false;

  // File upload
  let avatarFile: File | null = null;

  onMount(async () => {
    loading = true;
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', auth.user?.id)
        .single();

      if (profileError) throw profileError;

      if (profile) {
        username = profile.username;
        displayName = profile.display_name;
        bio = profile.bio;
        avatarUrl = profile.avatar_url;
        web3Address = profile.web3_address;
        ipfsHash = profile.ipfs_hash;
        encryptionEnabled = profile.encryption_enabled;
        mfaEnabled = profile.mfa_enabled;
      }
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  });

  async function handleAvatarChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    if (!file.type.startsWith('image/')) {
      error = 'Please select an image file';
      return;
    }

    avatarFile = file;
  }

  async function handleSubmit() {
    loading = true;
    error = null;
    success = null;

    try {
      // Upload avatar to IPFS if changed
      let newAvatarUrl = avatarUrl;
      if (avatarFile) {
        const result = await ipfsService.upload(avatarFile, {
          encrypt: encryptionEnabled,
          metadata: {
            type: 'avatar',
            userId: auth.user?.id
          }
        });
        newAvatarUrl = result.url;
        ipfsHash = result.cid;
      }

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          username,
          display_name: displayName,
          bio,
          avatar_url: newAvatarUrl,
          web3_address: web3Address,
          ipfs_hash: ipfsHash,
          encryption_enabled: encryptionEnabled,
          mfa_enabled: mfaEnabled,
          updated_at: new Date().toISOString()
        })
        .eq('id', auth.user?.id);

      if (updateError) throw updateError;

      success = 'Profile updated successfully';
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function enableMFA() {
    loading = true;
    error = null;

    try {
      // Generate TOTP secret
      const { data: mfaData, error: mfaError } = await supabase.auth.mfa.enroll({
        factorType: 'totp'
      });

      if (mfaError) throw mfaError;

      // Show QR code to user (you'll need to implement this UI)
      // For now, we'll just enable it
      mfaEnabled = true;
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }
</script>

<div class="container mx-auto px-4 py-8">
  <div class="max-w-2xl mx-auto">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <div class="p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
          Profile Settings
        </h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Manage your profile information and privacy settings
        </p>
      </div>

      <form class="p-6 space-y-6" on:submit|preventDefault={handleSubmit}>
        {#if error}
          <Alert type="error" dismissible>{error}</Alert>
        {/if}

        {#if success}
          <Alert type="success" dismissible>{success}</Alert>
        {/if}

        <!-- Basic Information -->
        <div class="space-y-4">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">
            Basic Information
          </h3>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Username"
              bind:value={username}
              placeholder="Your unique username"
              required
            />

            <Input
              label="Display Name"
              bind:value={displayName}
              placeholder="Your public display name"
            />
          </div>

          <div>
            <Input
              type="textarea"
              label="Bio"
              bind:value={bio}
              placeholder="Tell others about yourself"
            />
          </div>
        </div>

        <!-- Avatar -->
        <div class="space-y-4">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">
            Profile Picture
          </h3>

          <div class="flex items-center space-x-4">
            {#if avatarUrl}
              <img
                src={avatarUrl}
                alt="Profile"
                class="w-20 h-20 rounded-full object-cover"
              />
            {:else}
              <div class="w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            {/if}

            <Input
              type="file"
              accept="image/*"
              on:change={handleAvatarChange}
            />
          </div>
        </div>

        <!-- Web3 & Privacy -->
        <div class="space-y-4">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">
            Web3 & Privacy
          </h3>

          <Input
            label="Web3 Address"
            bind:value={web3Address}
            placeholder="Your Ethereum address"
          />

          <div class="flex items-center space-x-2">
            <input
              type="checkbox"
              id="encryption"
              bind:checked={encryptionEnabled}
              class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label for="encryption" class="text-sm text-gray-700 dark:text-gray-300">
              Enable end-to-end encryption for content
            </label>
          </div>
        </div>

        <!-- Security -->
        <div class="space-y-4">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">
            Security
          </h3>

          <div class="flex items-center justify-between">
            <div>
              <h4 class="text-sm font-medium text-gray-900 dark:text-white">
                Two-Factor Authentication
              </h4>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                Add an extra layer of security to your account
              </p>
            </div>
            <Button
              type="button"
              variant={mfaEnabled ? 'secondary' : 'primary'}
              on:click={enableMFA}
              disabled={loading || mfaEnabled}
            >
              {mfaEnabled ? 'Enabled' : 'Enable 2FA'}
            </Button>
          </div>
        </div>

        <!-- Submit -->
        <div class="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            disabled={loading}
          >
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  </div>
</div> 