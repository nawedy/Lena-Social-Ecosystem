&lt;script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { Button, Icon, Switch, Slider } from '@tiktok-toe/ui-shared/components/ui';
  import { userStore } from '@tiktok-toe/shared/stores/user';
  import { themeStore } from '@tiktok-toe/shared/stores/theme';
  import { arFilterService } from '@tiktok-toe/shared/services/ar/ARFilterService';
  import { performanceService } from '@tiktok-toe/shared/services/optimization/PerformanceService';

  let saving = false;
  let error: string | null = null;
  let success: string | null = null;

  // Settings sections
  const sections = [
    {
      id: 'account',
      label: 'Account',
      icon: 'user',
      settings: [
        {
          id: 'notifications',
          label: 'Push Notifications',
          description: 'Receive notifications about likes, comments, and mentions',
          type: 'switch',
          value: true
        },
        {
          id: 'email_notifications',
          label: 'Email Notifications',
          description: 'Receive email updates about your account activity',
          type: 'switch',
          value: false
        },
        {
          id: 'privacy',
          label: 'Private Account',
          description: 'Only approved followers can see your content',
          type: 'switch',
          value: false
        }
      ]
    },
    {
      id: 'appearance',
      label: 'Appearance',
      icon: 'palette',
      settings: [
        {
          id: 'theme',
          label: 'Dark Mode',
          description: 'Use dark theme for better visibility in low light',
          type: 'switch',
          value: $themeStore.darkMode
        },
        {
          id: 'reduced_motion',
          label: 'Reduced Motion',
          description: 'Minimize animations and transitions',
          type: 'switch',
          value: false
        }
      ]
    },
    {
      id: 'filters',
      label: 'Filters & Effects',
      icon: 'sparkles',
      settings: [
        {
          id: 'quality',
          label: 'Filter Quality',
          description: 'Higher quality requires more processing power',
          type: 'select',
          value: 'high',
          options: [
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' }
          ]
        },
        {
          id: 'max_faces',
          label: 'Maximum Faces',
          description: 'Number of faces to track simultaneously',
          type: 'range',
          value: 4,
          min: 1,
          max: 8,
          step: 1
        },
        {
          id: 'smoothing',
          label: 'Face Smoothing',
          description: 'Adjust face tracking smoothness',
          type: 'range',
          value: 0.8,
          min: 0,
          max: 1,
          step: 0.1
        }
      ]
    },
    {
      id: 'performance',
      label: 'Performance',
      icon: 'zap',
      settings: [
        {
          id: 'auto_quality',
          label: 'Auto-Adjust Quality',
          description: 'Automatically adjust quality based on device performance',
          type: 'switch',
          value: true
        },
        {
          id: 'preload_filters',
          label: 'Preload Filters',
          description: 'Load filters in advance for faster switching',
          type: 'switch',
          value: true
        },
        {
          id: 'cache_size',
          label: 'Cache Size',
          description: 'Maximum storage space for cached filters',
          type: 'select',
          value: '1gb',
          options: [
            { value: '500mb', label: '500 MB' },
            { value: '1gb', label: '1 GB' },
            { value: '2gb', label: '2 GB' }
          ]
        }
      ]
    },
    {
      id: 'privacy',
      label: 'Privacy & Security',
      icon: 'shield',
      settings: [
        {
          id: 'data_collection',
          label: 'Data Collection',
          description: 'Allow collection of usage data to improve the app',
          type: 'switch',
          value: true
        },
        {
          id: 'face_data',
          label: 'Face Data Storage',
          description: 'Store face tracking data for better performance',
          type: 'switch',
          value: false
        },
        {
          id: 'location',
          label: 'Location Services',
          description: 'Allow access to device location for local filters',
          type: 'switch',
          value: false
        }
      ]
    }
  ];

  let activeSection = sections[0];

  onMount(() => {
    performanceService.optimizeForInteraction();
  });

  async function handleSettingChange(sectionId: string, settingId: string, value: any) {
    try {
      saving = true;
      error = null;
      success = null;

      // Update local state
      const section = sections.find(s => s.id === sectionId);
      const setting = section?.settings.find(s => s.id === settingId);
      if (setting) {
        setting.value = value;
      }

      // Apply settings
      switch (settingId) {
        case 'theme':
          $themeStore.darkMode = value;
          break;

        case 'quality':
          await arFilterService.updateConfig({
            modelQuality: value
          });
          break;

        case 'max_faces':
          await arFilterService.updateConfig({
            maxFaces: value
          });
          break;

        case 'smoothing':
          await arFilterService.updateConfig({
            smoothingFactor: value
          });
          break;

        case 'auto_quality':
          performanceService.setAutoQuality(value);
          break;

        case 'preload_filters':
          performanceService.setPreloadFilters(value);
          break;

        // Simulate API call for other settings
        default:
          await new Promise(resolve => setTimeout(resolve, 500));
      }

      success = 'Settings updated successfully';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to update settings';
    } finally {
      saving = false;

      // Clear success message after 3 seconds
      if (success) {
        setTimeout(() => {
          success = null;
        }, 3000);
      }
    }
  }

  function formatValue(setting: any): string {
    switch (setting.type) {
      case 'range':
        return setting.value.toString();
      case 'select':
        return setting.options.find(o => o.value === setting.value)?.label || '';
      case 'switch':
        return setting.value ? 'On' : 'Off';
      default:
        return setting.value.toString();
    }
  }
</script>

<div class="container mx-auto px-4 py-6">
  <div class="flex gap-8">
    <!-- Sidebar -->
    <div class="w-64 shrink-0">
      <h1 class="text-2xl font-bold mb-6">Settings</h1>
      <nav class="space-y-1">
        {#each sections as section}
          <button
            class="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors"
            class:bg-primary-500={activeSection.id === section.id}
            class:text-white={activeSection.id === section.id}
            class:hover:bg-gray-100={activeSection.id !== section.id}
            class:dark:hover:bg-gray-800={activeSection.id !== section.id}
            on:click={() => activeSection = section}
          >
            <Icon name={section.icon} class="w-5 h-5" />
            <span>{section.label}</span>
          </button>
        {/each}
      </nav>
    </div>

    <!-- Content -->
    <div class="flex-1 max-w-2xl">
      <div class="bg-white dark:bg-gray-900 rounded-lg shadow-lg">
        <div class="p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 class="text-xl font-semibold">{activeSection.label}</h2>
        </div>

        <div class="divide-y divide-gray-200 dark:divide-gray-800">
          {#each activeSection.settings as setting}
            <div class="p-6" transition:fade={{ duration: 150 }}>
              <div class="flex items-start justify-between">
                <div class="flex-1 mr-8">
                  <label
                    for={setting.id}
                    class="block font-medium mb-1"
                  >
                    {setting.label}
                  </label>
                  <p class="text-sm text-gray-500">
                    {setting.description}
                  </p>
                </div>

                <!-- Controls -->
                <div class="flex items-center">
                  {#if setting.type === 'switch'}
                    <Switch
                      id={setting.id}
                      checked={setting.value}
                      on:change={(e) => handleSettingChange(
                        activeSection.id,
                        setting.id,
                        e.detail
                      )}
                    />
                  {:else if setting.type === 'select'}
                    <select
                      id={setting.id}
                      class="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2"
                      value={setting.value}
                      on:change={(e) => handleSettingChange(
                        activeSection.id,
                        setting.id,
                        e.currentTarget.value
                      )}
                    >
                      {#each setting.options as option}
                        <option value={option.value}>
                          {option.label}
                        </option>
                      {/each}
                    </select>
                  {:else if setting.type === 'range'}
                    <div class="flex items-center gap-4 w-48">
                      <Slider
                        id={setting.id}
                        min={setting.min}
                        max={setting.max}
                        step={setting.step}
                        value={setting.value}
                        on:change={(e) => handleSettingChange(
                          activeSection.id,
                          setting.id,
                          e.detail
                        )}
                      />
                      <span class="text-sm w-8 text-right">
                        {formatValue(setting)}
                      </span>
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Status Messages -->
      {#if error}
        <div
          class="mt-4 p-4 bg-red-500 text-white rounded-lg"
          transition:fade
        >
          {error}
        </div>
      {/if}

      {#if success}
        <div
          class="mt-4 p-4 bg-green-500 text-white rounded-lg"
          transition:fade
        >
          {success}
        </div>
      {/if}

      {#if saving}
        <div
          class="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center gap-3"
          transition:fade
        >
          <div class="animate-spin rounded-full h-5 w-5 border-2 border-primary-500 border-t-transparent" />
          <span>Saving changes...</span>
        </div>
      {/if}
    </div>
  </div>
</div> 