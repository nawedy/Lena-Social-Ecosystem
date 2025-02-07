<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { supabase } from '$lib/supabaseClient';
  import { Button, Badge, Alert } from '$lib/components/ui';
  import { user } from '$lib/stores/auth';

  export let pathId: string;

  let path: any = null;
  let loading = true;
  let error: string | null = null;
  let currentModule = 0;
  let progress: Record<string, any> = {};

  async function loadPath() {
    try {
      loading = true;
      error = null;

      const { data, error: fetchError } = await supabase
        .from('learning_paths')
        .select(`
          *,
          creator:creator_id (
            id,
            full_name,
            avatar_url
          ),
          modules:learning_modules (
            id,
            title,
            description,
            type,
            content,
            duration,
            order,
            required_modules,
            assessment_id
          ),
          skills:path_skills (
            skill_id (*)
          )
        `)
        .eq('id', pathId)
        .single();

      if (fetchError) throw fetchError;
      path = data;

      // Load user progress if authenticated
      if ($user) {
        const { data: progressData } = await supabase
          .from('user_progress')
          .select('*')
          .eq('user_id', $user.id)
          .eq('path_id', pathId);

        progress = progressData?.reduce((acc: any, curr: any) => {
          acc[curr.module_id] = curr;
          return acc;
        }, {}) || {};
      }
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function markComplete(moduleId: string) {
    if (!$user) return;

    try {
      const { error: progressError } = await supabase
        .from('user_progress')
        .upsert({
          user_id: $user.id,
          path_id: pathId,
          module_id: moduleId,
          completed: true,
          completed_at: new Date().toISOString()
        });

      if (progressError) throw progressError;

      // Check if all modules are complete
      const allModulesComplete = path.modules.every((module: any) => 
        progress[module.id]?.completed
      );

      if (allModulesComplete) {
        // Award completion badge
        const { error: badgeError } = await supabase
          .from('user_badges')
          .insert({
            user_id: $user.id,
            badge_id: path.completion_badge_id,
            earned_through: 'learning_path',
            path_id: pathId
          });

        if (badgeError) throw badgeError;
      }

      await loadPath();
    } catch (e) {
      error = e.message;
    }
  }

  function isModuleAvailable(module: any): boolean {
    if (!module.required_modules?.length) return true;
    return module.required_modules.every((requiredId: string) => 
      progress[requiredId]?.completed
    );
  }

  function getModuleProgress(module: any): number {
    if (!$user) return 0;
    if (progress[module.id]?.completed) return 100;
    // Add more granular progress tracking here
    return 0;
  }

  onMount(loadPath);
</script>

<div class="max-w-4xl mx-auto">
  {#if loading}
    <div class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
    </div>
  {:else if error}
    <Alert variant="error" title="Error" message={error} />
  {:else if path}
    <div class="space-y-6">
      <!-- Path Header -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <div class="p-6">
          <div class="flex items-start justify-between">
            <div>
              <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
                {path.title}
              </h1>
              <p class="mt-2 text-gray-600 dark:text-gray-400">
                {path.description}
              </p>
              <div class="mt-4 flex items-center space-x-4">
                <Badge variant="secondary">
                  {path.modules.length} Modules
                </Badge>
                <Badge variant="secondary">
                  {path.estimated_hours} Hours
                </Badge>
                <Badge variant="secondary">
                  {path.difficulty}
                </Badge>
              </div>
            </div>
            <div class="flex items-center space-x-4">
              <div class="text-right">
                <div class="text-sm text-gray-500 dark:text-gray-400">
                  Created by
                </div>
                <div class="flex items-center mt-1">
                  <img
                    src={path.creator.avatar_url || '/default-avatar.png'}
                    alt={path.creator.full_name}
                    class="w-6 h-6 rounded-full mr-2"
                  />
                  <span class="text-gray-900 dark:text-white">
                    {path.creator.full_name}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Skills -->
      {#if path.skills.length > 0}
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 class="text-lg font-semibold mb-4">Skills You'll Learn</h2>
          <div class="flex flex-wrap gap-2">
            {#each path.skills as { skill_id: skill }}
              <Badge variant="primary">
                {skill.name}
              </Badge>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Modules -->
      <div class="space-y-4">
        {#each path.modules as module (module.id)}
          <div
            class="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden"
            class:opacity-75={!isModuleAvailable(module)}
          >
            <div class="p-6">
              <div class="flex items-start justify-between">
                <div>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                    {module.title}
                  </h3>
                  <p class="mt-1 text-gray-600 dark:text-gray-400">
                    {module.description}
                  </p>
                  <div class="mt-2 flex items-center space-x-4">
                    <Badge variant="secondary">
                      {module.type}
                    </Badge>
                    <span class="text-sm text-gray-500 dark:text-gray-400">
                      {module.duration} minutes
                    </span>
                  </div>
                </div>

                <div class="flex items-center space-x-4">
                  {#if progress[module.id]?.completed}
                    <Badge variant="success">Completed</Badge>
                  {:else if isModuleAvailable(module)}
                    <Button
                      variant="primary"
                      href={`/learning/modules/${module.id}`}
                    >
                      Start Module
                    </Button>
                  {:else}
                    <Badge variant="secondary">Locked</Badge>
                  {/if}
                </div>
              </div>

              <!-- Progress Bar -->
              <div class="mt-4 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  class="h-full bg-blue-500 transition-all duration-300"
                  style="width: {getModuleProgress(module)}%"
                ></div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {:else}
    <div class="text-center py-12">
      <p class="text-gray-500 dark:text-gray-400">Learning path not found</p>
    </div>
  {/if}
</div>

<style>
  /* Add any component-specific styles here */
</style> 