<script lang="ts">
  import { fade } from 'svelte/transition';
  import { Button, Alert } from '$lib/components/ui';
  import { supabase } from '$lib/supabaseClient';
  import { user } from '$lib/stores/auth';

  export let isConnected = false;
  export let connectionStatus: string | null = null;
  export let targetUserId: string;

  let loading = false;
  let error: string | null = null;
  let showConnectOptions = false;
  let connectMessage = '';

  async function sendConnectionRequest() {
    if (!$user) return;

    try {
      loading = true;
      error = null;

      const { error: requestError } = await supabase
        .from('professional_connections')
        .insert({
          requester_id: $user.id,
          recipient_id: targetUserId,
          status: 'pending',
          message: connectMessage || null
        });

      if (requestError) throw requestError;

      connectionStatus = 'pending';
      showConnectOptions = false;
      connectMessage = '';
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function acceptConnection() {
    if (!$user) return;

    try {
      loading = true;
      error = null;

      const { error: acceptError } = await supabase
        .from('professional_connections')
        .update({ status: 'accepted' })
        .eq('requester_id', targetUserId)
        .eq('recipient_id', $user.id);

      if (acceptError) throw acceptError;

      isConnected = true;
      connectionStatus = 'accepted';
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function rejectConnection() {
    if (!$user) return;

    try {
      loading = true;
      error = null;

      const { error: rejectError } = await supabase
        .from('professional_connections')
        .update({ status: 'rejected' })
        .eq('requester_id', targetUserId)
        .eq('recipient_id', $user.id);

      if (rejectError) throw rejectError;

      connectionStatus = 'rejected';
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function removeConnection() {
    if (!$user) return;

    try {
      loading = true;
      error = null;

      const { error: removeError } = await supabase
        .from('professional_connections')
        .delete()
        .or(`requester_id.eq.${$user.id},recipient_id.eq.${$user.id}`)
        .or(`requester_id.eq.${targetUserId},recipient_id.eq.${targetUserId}`);

      if (removeError) throw removeError;

      isConnected = false;
      connectionStatus = null;
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function getButtonText() {
    if (loading) return 'Loading...';
    if (isConnected) return 'Connected';
    if (connectionStatus === 'pending') return 'Pending';
    if (connectionStatus === 'rejected') return 'Connect';
    return 'Connect';
  }

  function getButtonVariant() {
    if (isConnected) return 'success';
    if (connectionStatus === 'pending') return 'secondary';
    return 'primary';
  }
</script>

<div class="relative">
  {#if error}
    <Alert variant="error" title="Error" message={error} />
  {/if}

  <!-- Main Connection Button -->
  <Button
    variant={getButtonVariant()}
    disabled={loading}
    on:click={() => {
      if (isConnected) {
        removeConnection();
      } else if (connectionStatus === 'pending' && $user?.id === targetUserId) {
        // Do nothing - waiting for recipient to accept
      } else {
        showConnectOptions = true;
      }
    }}
  >
    {getButtonText()}
  </Button>

  <!-- Connection Options Dropdown -->
  {#if showConnectOptions}
    <div
      class="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 z-10"
      transition:fade={{ duration: 150 }}
    >
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1">
            Add a note to your connection request
          </label>
          <textarea
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2 h-24"
            bind:value={connectMessage}
            placeholder="Hi, I'd like to connect with you..."
          ></textarea>
        </div>

        <div class="flex justify-end space-x-2">
          <Button
            variant="ghost"
            on:click={() => {
              showConnectOptions = false;
              connectMessage = '';
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={loading}
            on:click={sendConnectionRequest}
          >
            Send Request
          </Button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Pending Connection Actions -->
  {#if connectionStatus === 'pending' && $user?.id !== targetUserId}
    <div
      class="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 z-10"
      transition:fade={{ duration: 150 }}
    >
      <div class="space-y-4">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          This person would like to connect with you
        </p>

        <div class="flex justify-end space-x-2">
          <Button
            variant="ghost"
            disabled={loading}
            on:click={rejectConnection}
          >
            Ignore
          </Button>
          <Button
            variant="primary"
            disabled={loading}
            on:click={acceptConnection}
          >
            Accept
          </Button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Connected Actions -->
  {#if isConnected}
    <div
      class="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden z-10"
      transition:fade={{ duration: 150 }}
    >
      <button
        class="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-700"
        on:click={removeConnection}
        disabled={loading}
      >
        Remove Connection
      </button>
    </div>
  {/if}
</div>

<style>
  /* Add any component-specific styles here */
</style> 