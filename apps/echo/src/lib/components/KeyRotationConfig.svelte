<!-- KeyRotationConfig.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { Button, Input, Select, Alert } from '$lib/components/ui';
  import { supabase } from '$lib/supabaseClient';

  export let userId: string;

  let loading = false;
  let error: string | null = null;
  let success: string | null = null;

  // Form state
  let rotationInterval = 90; // Default to 90 days
  let backupEnabled = true;
  let notifyOnRotation = true;
  let autoRotation = true;
  let recoveryCodesCount = 10;
  let backupLocations = ['ipfs', 'local'];

  // Load existing configuration
  async function loadConfig() {
    try {
      loading = true;
      const { data, error } = await supabase
        .from('user_security_settings')
        .select('metadata->key_rotation')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      if (data?.key_rotation) {
        const config = data.key_rotation;
        rotationInterval = config.rotationInterval;
        backupEnabled = config.backupEnabled;
        notifyOnRotation = config.notifyOnRotation;
        autoRotation = config.autoRotation;
        recoveryCodesCount = config.recoveryCodesCount;
        backupLocations = config.backupLocations;
      }
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function handleSubmit() {
    try {
      loading = true;
      error = null;
      success = null;

      const config = {
        rotationInterval,
        backupEnabled,
        notifyOnRotation,
        autoRotation,
        recoveryCodesCount,
        backupLocations,
        lastUpdated: new Date().toISOString()
      };

      const { error: updateError } = await supabase
        .from('user_security_settings')
        .upsert({
          user_id: userId,
          metadata: {
            key_rotation: config
          }
        });

      if (updateError) throw updateError;

      if (autoRotation) {
        // Schedule next rotation
        const { error: scheduleError } = await supabase.rpc('schedule_key_rotation', {
          p_user_id: userId,
          p_interval_days: rotationInterval
        });

        if (scheduleError) throw scheduleError;
      }

      success = 'Key rotation settings updated successfully';
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function generateRecoveryCodes() {
    try {
      loading = true;
      error = null;
      success = null;

      const { error: genError } = await supabase.rpc('generate_recovery_codes', {
        p_user_id: userId,
        p_count: recoveryCodesCount
      });

      if (genError) throw genError;

      success = 'Recovery codes generated successfully';
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  onMount(loadConfig);
</script>

<div class="space-y-6">
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
    <h2 class="text-xl font-semibold mb-4">Key Rotation Settings</h2>

    {#if error}
      <Alert type="error" class="mb-4">{error}</Alert>
    {/if}

    {#if success}
      <Alert type="success" class="mb-4">{success}</Alert>
    {/if}

    <form on:submit|preventDefault={handleSubmit} class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Input
            type="number"
            label="Rotation Interval (days)"
            bind:value={rotationInterval}
            min="1"
            max="365"
            required
          />
        </div>

        <div>
          <Input
            type="number"
            label="Recovery Codes Count"
            bind:value={recoveryCodesCount}
            min="5"
            max="20"
            required
          />
        </div>
      </div>

      <div class="space-y-4">
        <label class="flex items-center space-x-2">
          <input
            type="checkbox"
            bind:checked={autoRotation}
            class="form-checkbox"
          />
          <span>Enable automatic key rotation</span>
        </label>

        <label class="flex items-center space-x-2">
          <input
            type="checkbox"
            bind:checked={backupEnabled}
            class="form-checkbox"
          />
          <span>Enable key backups</span>
        </label>

        <label class="flex items-center space-x-2">
          <input
            type="checkbox"
            bind:checked={notifyOnRotation}
            class="form-checkbox"
          />
          <span>Notify me when keys are rotated</span>
        </label>
      </div>

      {#if backupEnabled}
        <div class="space-y-2">
          <label class="block text-sm font-medium">Backup Locations</label>
          <div class="space-y-2">
            <label class="flex items-center space-x-2">
              <input
                type="checkbox"
                bind:group={backupLocations}
                value="ipfs"
                class="form-checkbox"
              />
              <span>IPFS (Encrypted)</span>
            </label>

            <label class="flex items-center space-x-2">
              <input
                type="checkbox"
                bind:group={backupLocations}
                value="local"
                class="form-checkbox"
              />
              <span>Local Storage (Encrypted)</span>
            </label>
          </div>
        </div>
      {/if}

      <div class="flex justify-between pt-4 border-t">
        <Button
          type="button"
          variant="secondary"
          on:click={generateRecoveryCodes}
          disabled={loading}
        >
          Generate Recovery Codes
        </Button>

        <Button
          type="submit"
          variant="primary"
          loading={loading}
          disabled={loading}
        >
          Save Settings
        </Button>
      </div>
    </form>
  </div>
</div> 