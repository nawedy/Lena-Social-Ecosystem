<!-- (protected)/settings/security/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/auth/store';
  import { supabase } from '$lib/supabaseClient';
  import Button from '$lib/components/ui/Button.svelte';
  import Alert from '$lib/components/ui/Alert.svelte';

  let loading = false;
  let error: string | null = null;
  let success: string | null = null;

  // Security settings
  let encryptionEnabled = false;
  let mfaEnabled = false;
  let sessionTimeout = 60; // minutes
  let ipfsEncryption = true;
  let metadataStripping = true;
  let trackingProtection = true;
  let activeDevices: any[] = [];
  let loginHistory: any[] = [];

  onMount(async () => {
    loading = true;
    try {
      // Get security settings
      const { data: settings, error: settingsError } = await supabase
        .from('user_security_settings')
        .select('*')
        .eq('user_id', auth.user?.id)
        .single();

      if (settingsError) throw settingsError;

      if (settings) {
        encryptionEnabled = settings.encryption_enabled;
        mfaEnabled = settings.mfa_enabled;
        sessionTimeout = settings.session_timeout;
        ipfsEncryption = settings.ipfs_encryption;
        metadataStripping = settings.metadata_stripping;
        trackingProtection = settings.tracking_protection;
      }

      // Get active sessions
      const { data: sessions, error: sessionsError } = await supabase
        .from('active_sessions')
        .select('*')
        .eq('user_id', auth.user?.id)
        .order('created_at', { ascending: false });

      if (sessionsError) throw sessionsError;
      activeDevices = sessions || [];

      // Get login history
      const { data: history, error: historyError } = await supabase
        .from('auth_events')
        .select('*')
        .eq('user_id', auth.user?.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (historyError) throw historyError;
      loginHistory = history || [];
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  });

  async function updateSecuritySettings() {
    loading = true;
    error = null;
    success = null;

    try {
      const { error: updateError } = await supabase
        .from('user_security_settings')
        .upsert({
          user_id: auth.user?.id,
          encryption_enabled: encryptionEnabled,
          mfa_enabled: mfaEnabled,
          session_timeout: sessionTimeout,
          ipfs_encryption: ipfsEncryption,
          metadata_stripping: metadataStripping,
          tracking_protection: trackingProtection,
          updated_at: new Date().toISOString()
        });

      if (updateError) throw updateError;

      success = 'Security settings updated successfully';
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function revokeSession(sessionId: string) {
    loading = true;
    error = null;

    try {
      const { error: revokeError } = await supabase
        .from('active_sessions')
        .delete()
        .eq('id', sessionId);

      if (revokeError) throw revokeError;

      activeDevices = activeDevices.filter(device => device.id !== sessionId);
      success = 'Session revoked successfully';
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function revokeAllSessions() {
    loading = true;
    error = null;

    try {
      // Keep current session
      const currentSessionId = auth.session?.id;
      
      const { error: revokeError } = await supabase
        .from('active_sessions')
        .delete()
        .neq('id', currentSessionId);

      if (revokeError) throw revokeError;

      activeDevices = activeDevices.filter(device => device.id === currentSessionId);
      success = 'All other sessions revoked successfully';
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }
</script>

<div class="container mx-auto px-4 py-8">
  <div class="max-w-4xl mx-auto">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <div class="p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
          Security & Privacy Settings
        </h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Manage your security preferences and active sessions
        </p>
      </div>

      <div class="p-6 space-y-8">
        {#if error}
          <Alert type="error" dismissible>{error}</Alert>
        {/if}

        {#if success}
          <Alert type="success" dismissible>{success}</Alert>
        {/if}

        <!-- Privacy Settings -->
        <section class="space-y-4">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">
            Privacy Settings
          </h3>

          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-sm font-medium text-gray-900 dark:text-white">
                  End-to-End Encryption
                </h4>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Encrypt all your content before storing
                </p>
              </div>
              <div class="flex items-center">
                <input
                  type="checkbox"
                  id="encryption"
                  bind:checked={encryptionEnabled}
                  class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
              </div>
            </div>

            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-sm font-medium text-gray-900 dark:text-white">
                  IPFS Content Encryption
                </h4>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Encrypt files before uploading to IPFS
                </p>
              </div>
              <div class="flex items-center">
                <input
                  type="checkbox"
                  id="ipfs-encryption"
                  bind:checked={ipfsEncryption}
                  class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
              </div>
            </div>

            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-sm font-medium text-gray-900 dark:text-white">
                  Metadata Stripping
                </h4>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Remove metadata from uploaded files
                </p>
              </div>
              <div class="flex items-center">
                <input
                  type="checkbox"
                  id="metadata-stripping"
                  bind:checked={metadataStripping}
                  class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
              </div>
            </div>

            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-sm font-medium text-gray-900 dark:text-white">
                  Tracking Protection
                </h4>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Block third-party trackers and analytics
                </p>
              </div>
              <div class="flex items-center">
                <input
                  type="checkbox"
                  id="tracking-protection"
                  bind:checked={trackingProtection}
                  class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>
        </section>

        <!-- Session Management -->
        <section class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">
              Active Sessions
            </h3>
            <Button
              variant="outline"
              size="sm"
              on:click={revokeAllSessions}
              disabled={loading}
            >
              Revoke All Other Sessions
            </Button>
          </div>

          <div class="space-y-4">
            {#each activeDevices as device}
              <div class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <p class="text-sm font-medium text-gray-900 dark:text-white">
                    {device.device_type} - {device.browser}
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    Last active: {new Date(device.last_active).toLocaleString()}
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    IP: {device.ip_address}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  on:click={() => revokeSession(device.id)}
                  disabled={loading}
                >
                  Revoke
                </Button>
              </div>
            {/each}
          </div>
        </section>

        <!-- Login History -->
        <section class="space-y-4">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">
            Recent Login Activity
          </h3>

          <div class="space-y-4">
            {#each loginHistory as event}
              <div class="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p class="text-sm font-medium text-gray-900 dark:text-white">
                  {event.event_type}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  Time: {new Date(event.created_at).toLocaleString()}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  IP: {event.ip_address}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  Location: {event.location || 'Unknown'}
                </p>
              </div>
            {/each}
          </div>
        </section>

        <!-- Save Changes -->
        <div class="flex justify-end pt-6">
          <Button
            variant="primary"
            loading={loading}
            disabled={loading}
            on:click={updateSecuritySettings}
          >
            Save Security Settings
          </Button>
        </div>
      </div>
    </div>
  </div>
</div> 