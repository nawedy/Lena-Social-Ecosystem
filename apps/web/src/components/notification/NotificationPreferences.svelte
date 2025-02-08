<!-- NotificationPreferences.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { NotificationService } from '@core/services/notification/notification.service';
  import type { NotificationPreferences } from '@core/services/notification/types';
  import { usePushNotifications } from '@/hooks/usePushNotifications';
  import { Switch } from '@/components/ui/switch';
  import { Select } from '@/components/ui/select';
  import { Button } from '@/components/ui/button';
  import { Card } from '@/components/ui/card';

  export let notificationService: NotificationService;
  export let class: string = '';

  let preferences: NotificationPreferences;
  let loading = true;
  let saving = false;
  let pushSupported: boolean;
  let pushSubscribed = false;

  const { isSupported, subscribe, unsubscribe, getSubscription } = usePushNotifications();
  pushSupported = isSupported;

  onMount(async () => {
    try {
      // Load preferences
      preferences = await notificationService.getPreferences();
      
      // Check push subscription status
      if (pushSupported) {
        const subscription = await getSubscription();
        pushSubscribed = !!subscription;
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
    } finally {
      loading = false;
    }
  });

  async function handleChannelToggle(channel: keyof NotificationPreferences['channels']) {
    if (saving) return;

    try {
      saving = true;
      const updatedChannels = {
        ...preferences.channels,
        [channel]: !preferences.channels[channel]
      };

      // Special handling for push notifications
      if (channel === 'webPush') {
        if (updatedChannels.webPush) {
          const subscription = await subscribe();
          if (subscription) {
            await notificationService.subscribeToPush(subscription);
            pushSubscribed = true;
          } else {
            updatedChannels.webPush = false;
          }
        } else {
          await unsubscribe();
          pushSubscribed = false;
        }
      }

      // Update preferences
      await notificationService.updatePreferences({
        channels: updatedChannels
      });

      preferences.channels = updatedChannels;
    } catch (error) {
      console.error('Failed to update notification channel:', error);
    } finally {
      saving = false;
    }
  }

  async function handleQuietHoursToggle() {
    if (saving) return;

    try {
      saving = true;
      const updatedQuietHours = {
        ...preferences.quiet_hours,
        enabled: !preferences.quiet_hours.enabled
      };

      await notificationService.updatePreferences({
        quiet_hours: updatedQuietHours
      });

      preferences.quiet_hours = updatedQuietHours;
    } catch (error) {
      console.error('Failed to update quiet hours:', error);
    } finally {
      saving = false;
    }
  }

  async function handleQuietHoursChange(field: keyof NotificationPreferences['quiet_hours'], value: string) {
    if (saving) return;

    try {
      saving = true;
      const updatedQuietHours = {
        ...preferences.quiet_hours,
        [field]: value
      };

      await notificationService.updatePreferences({
        quiet_hours: updatedQuietHours
      });

      preferences.quiet_hours = updatedQuietHours;
    } catch (error) {
      console.error('Failed to update quiet hours:', error);
    } finally {
      saving = false;
    }
  }

  const timezones = Intl.supportedValuesOf('timeZone');
</script>

<Card class={class}>
  <div class="p-6">
    <h2 class="text-lg font-semibold mb-4">Notification Preferences</h2>

    {#if loading}
      <div class="text-center py-4">Loading...</div>
    {:else}
      <div class="space-y-6">
        <!-- Notification Channels -->
        <div>
          <h3 class="text-sm font-medium mb-3">Notification Channels</h3>
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <div class="font-medium">In-App Notifications</div>
                <div class="text-sm text-gray-500">
                  Receive notifications within the application
                </div>
              </div>
              <Switch
                checked={preferences.channels.inApp}
                onCheckedChange={() => handleChannelToggle('inApp')}
                disabled={saving}
              />
            </div>

            <div class="flex items-center justify-between">
              <div>
                <div class="font-medium">Email Notifications</div>
                <div class="text-sm text-gray-500">
                  Receive notifications via email
                </div>
              </div>
              <Switch
                checked={preferences.channels.email}
                onCheckedChange={() => handleChannelToggle('email')}
                disabled={saving}
              />
            </div>

            {#if pushSupported}
              <div class="flex items-center justify-between">
                <div>
                  <div class="font-medium">Push Notifications</div>
                  <div class="text-sm text-gray-500">
                    Receive notifications even when the app is closed
                  </div>
                </div>
                <Switch
                  checked={preferences.channels.webPush}
                  onCheckedChange={() => handleChannelToggle('webPush')}
                  disabled={saving}
                />
              </div>
            {/if}
          </div>
        </div>

        <!-- Quiet Hours -->
        <div>
          <h3 class="text-sm font-medium mb-3">Quiet Hours</h3>
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <div class="font-medium">Enable Quiet Hours</div>
                <div class="text-sm text-gray-500">
                  Pause notifications during specified hours
                </div>
              </div>
              <Switch
                checked={preferences.quiet_hours.enabled}
                onCheckedChange={handleQuietHoursToggle}
                disabled={saving}
              />
            </div>

            {#if preferences.quiet_hours.enabled}
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="text-sm font-medium">Start Time</label>
                  <input
                    type="time"
                    class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                    value={preferences.quiet_hours.start}
                    on:change={(e) => handleQuietHoursChange('start', e.currentTarget.value)}
                    disabled={saving}
                  />
                </div>

                <div>
                  <label class="text-sm font-medium">End Time</label>
                  <input
                    type="time"
                    class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                    value={preferences.quiet_hours.end}
                    on:change={(e) => handleQuietHoursChange('end', e.currentTarget.value)}
                    disabled={saving}
                  />
                </div>

                <div class="col-span-2">
                  <label class="text-sm font-medium">Timezone</label>
                  <Select
                    value={preferences.quiet_hours.timezone}
                    onValueChange={(value) => handleQuietHoursChange('timezone', value)}
                    disabled={saving}
                  >
                    {#each timezones as timezone}
                      <option value={timezone}>{timezone}</option>
                    {/each}
                  </Select>
                </div>
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </div>
</Card>

<style>
  /* Add any component-specific styles here */
</style> 