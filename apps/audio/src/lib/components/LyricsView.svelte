<!-- LyricsView.svelte -->
<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { Button, Icon, Tabs } from '@lena/ui';

  export let currentTime = 0;
  export let lyrics: Array<{
    id: string;
    startTime: number;
    endTime: number;
    text: string;
    translation?: string;
    romanization?: string;
    isVerified?: boolean;
    contributor?: {
      id: string;
      username: string;
      avatar?: string;
    };
  }> = [];

  export let languages: Array<{
    code: string;
    name: string;
    isOriginal?: boolean;
  }> = [];

  export let autoScroll = true;
  export let showRomanization = false;
  export let showTranslation = false;

  const dispatch = createEventDispatcher();
  let selectedLanguage = languages.find(l => l.isOriginal)?.code || languages[0]?.code;
  let containerElement: HTMLElement;
  let activeLineIndex = -1;
  let isEditing = false;
  let editingLine: typeof lyrics[0] | null = null;
  let editText = '';
  let editTranslation = '';
  let editRomanization = '';

  $: {
    // Find active line based on current time
    activeLineIndex = lyrics.findIndex((line, index) => {
      const nextLine = lyrics[index + 1];
      return currentTime >= line.startTime && 
             (!nextLine || currentTime < nextLine.startTime);
    });

    // Auto-scroll to active line
    if (autoScroll && activeLineIndex >= 0 && containerElement) {
      const activeLine = containerElement.querySelector(`[data-line="${activeLineIndex}"]`);
      if (activeLine) {
        activeLine.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  }

  function handleLineClick(line: typeof lyrics[0], index: number) {
    dispatch('seek', { time: line.startTime });
  }

  function toggleEdit(line: typeof lyrics[0] | null = null) {
    if (line) {
      editingLine = line;
      editText = line.text;
      editTranslation = line.translation || '';
      editRomanization = line.romanization || '';
    } else {
      editingLine = null;
      editText = '';
      editTranslation = '';
      editRomanization = '';
    }
    isEditing = !!line;
  }

  function saveLyricEdit() {
    if (!editingLine) return;
    
    const updatedLine = {
      ...editingLine,
      text: editText,
      translation: editTranslation || undefined,
      romanization: editRomanization || undefined
    };

    dispatch('update', {
      lineId: editingLine.id,
      updates: updatedLine
    });

    toggleEdit();
  }

  function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
</script>

<div class="rounded-lg bg-gray-800/50 overflow-hidden">
  <!-- Header -->
  <div class="p-4 border-b border-gray-700">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Icon name="message-square-quote" size={24} class="text-primary-400" />
        <h2 class="text-lg font-medium">Lyrics</h2>
      </div>
      <div class="flex items-center gap-2">
        {#if languages.length > 1}
          <select
            bind:value={selectedLanguage}
            class="bg-gray-700/50 border border-gray-600 rounded-lg px-2 py-1 text-sm"
          >
            {#each languages as lang}
              <option value={lang.code}>
                {lang.name} {lang.isOriginal ? '(Original)' : ''}
              </option>
            {/each}
          </select>
        {/if}
        <Button
          variant="ghost"
          size="sm"
          on:click={() => showRomanization = !showRomanization}
          class:text-primary-400={showRomanization}
        >
          <Icon name="type" size={20} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          on:click={() => showTranslation = !showTranslation}
          class:text-primary-400={showTranslation}
        >
          <Icon name="languages" size={20} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          on:click={() => autoScroll = !autoScroll}
          class:text-primary-400={autoScroll}
        >
          <Icon name="scroll" size={20} />
        </Button>
      </div>
    </div>
  </div>

  <!-- Lyrics Content -->
  <div
    bind:this={containerElement}
    class="h-[400px] overflow-y-auto p-4 space-y-6"
  >
    {#each lyrics as line, index (line.id)}
      <div
        data-line={index}
        class="group relative"
        class:opacity-50={activeLineIndex !== -1 && index !== activeLineIndex}
      >
        <!-- Timestamp -->
        <div class="absolute -left-16 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            class="text-sm text-gray-400 hover:text-white"
            on:click={() => handleLineClick(line, index)}
          >
            {formatTime(line.startTime)}
          </button>
        </div>

        <!-- Line Content -->
        {#if isEditing && editingLine?.id === line.id}
          <div class="space-y-4 p-4 bg-gray-700/30 rounded-lg">
            <div class="space-y-2">
              <label class="text-sm text-gray-400">Original Text</label>
              <textarea
                bind:value={editText}
                rows="2"
                class="w-full bg-gray-900/50 border border-gray-600 rounded-lg p-2"
              />
            </div>
            {#if showTranslation}
              <div class="space-y-2">
                <label class="text-sm text-gray-400">Translation</label>
                <textarea
                  bind:value={editTranslation}
                  rows="2"
                  class="w-full bg-gray-900/50 border border-gray-600 rounded-lg p-2"
                />
              </div>
            {/if}
            {#if showRomanization}
              <div class="space-y-2">
                <label class="text-sm text-gray-400">Romanization</label>
                <textarea
                  bind:value={editRomanization}
                  rows="2"
                  class="w-full bg-gray-900/50 border border-gray-600 rounded-lg p-2"
                />
              </div>
            {/if}
            <div class="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                on:click={() => toggleEdit()}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                on:click={saveLyricEdit}
              >
                Save
              </Button>
            </div>
          </div>
        {:else}
          <div
            class="group relative p-4 rounded-lg hover:bg-gray-700/30 transition-colors cursor-pointer"
            on:click={() => handleLineClick(line, index)}
          >
            <p class="text-lg leading-relaxed">
              {line.text}
            </p>
            {#if showRomanization && line.romanization}
              <p class="text-sm text-gray-400 mt-1">
                {line.romanization}
              </p>
            {/if}
            {#if showTranslation && line.translation}
              <p class="text-sm text-primary-400 mt-1">
                {line.translation}
              </p>
            {/if}

            <!-- Edit Button -->
            <button
              class="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-white"
              on:click|stopPropagation={() => toggleEdit(line)}
            >
              <Icon name="edit" size={16} />
            </button>

            <!-- Contributor Badge -->
            {#if line.contributor}
              <div class="absolute bottom-2 right-2 flex items-center gap-1 text-xs text-gray-500">
                <img
                  src={line.contributor.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${line.contributor.username}`}
                  alt={line.contributor.username}
                  class="w-4 h-4 rounded-full"
                />
                <span>{line.contributor.username}</span>
                {#if line.isVerified}
                  <Icon name="check-circle" size={12} class="text-primary-400" />
                {/if}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <!-- Footer -->
  <div class="p-4 border-t border-gray-700">
    <div class="flex items-center justify-between text-sm text-gray-400">
      <span>
        {lyrics.length} lines • {languages.length} languages
      </span>
      <button
        class="text-primary-400 hover:text-primary-300 transition-colors"
        on:click={() => dispatch('contribute')}
      >
        Contribute Lyrics
      </button>
    </div>
  </div>
</div> 