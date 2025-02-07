<!-- VideoNotes.svelte -->
<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { Button, Icon, TextArea } from '@lena/ui';
  import { auth } from '$lib/stores/auth';

  export let videoId: string;
  export let currentTime = 0;

  interface Note {
    id: string;
    timestamp: number;
    content: string;
    isBookmark: boolean;
    createdAt: Date;
    updatedAt: Date;
  }

  const dispatch = createEventDispatcher();
  let notes: Note[] = [];
  let newNoteContent = '';
  let isExpanded = false;
  let isEditing: string | null = null;
  let editContent = '';

  onMount(async () => {
    if ($auth.user) {
      // TODO: Load notes from API
      notes = [];
    }
  });

  function addNote(isBookmark = false) {
    if (!$auth.user) return;
    
    const note: Note = {
      id: crypto.randomUUID(),
      timestamp: currentTime,
      content: isBookmark ? 'Bookmark' : newNoteContent.trim(),
      isBookmark,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    notes = [...notes, note].sort((a, b) => a.timestamp - b.timestamp);
    newNoteContent = '';

    // TODO: Save note to API
    dispatch('add', { note });
  }

  function updateNote(id: string) {
    if (!editContent.trim()) {
      deleteNote(id);
      return;
    }

    notes = notes.map(note => 
      note.id === id
        ? { ...note, content: editContent.trim(), updatedAt: new Date() }
        : note
    );

    isEditing = null;
    editContent = '';

    // TODO: Update note in API
    dispatch('update', { note: notes.find(n => n.id === id) });
  }

  function deleteNote(id: string) {
    notes = notes.filter(note => note.id !== id);
    isEditing = null;

    // TODO: Delete note from API
    dispatch('delete', { id });
  }

  function handleSeek(timestamp: number) {
    dispatch('seek', { timestamp });
  }

  function startEditing(note: Note) {
    isEditing = note.id;
    editContent = note.content;
  }

  function formatTimestamp(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function exportNotes() {
    const text = notes
      .map(note => 
        `[${formatTimestamp(note.timestamp)}] ${note.isBookmark ? '🔖 ' : ''}${note.content}`
      )
      .join('\n\n');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notes-${videoId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<div class="rounded-lg bg-gray-800/50 overflow-hidden">
  <button
    class="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-700/50 transition-colors"
    on:click={() => isExpanded = !isExpanded}
  >
    <div class="flex items-center gap-2">
      <Icon name="edit" size={20} />
      <span class="font-medium">Notes & Bookmarks</span>
      {#if notes.length > 0}
        <span class="px-1.5 py-0.5 text-xs bg-primary-500/20 text-primary-400 rounded">
          {notes.length}
        </span>
      {/if}
    </div>
    <Icon 
      name="chevron-down"
      size={20}
      class="transform transition-transform duration-200"
      class:rotate-180={isExpanded}
    />
  </button>

  {#if isExpanded}
    <div class="p-4 space-y-4">
      {#if $auth.user}
        <!-- Quick Actions -->
        <div class="flex gap-2">
          <Button
            variant="secondary"
            class="flex-1"
            on:click={() => addNote(true)}
          >
            <Icon name="bookmark" size={16} class="mr-2" />
            Add Bookmark
          </Button>
          {#if notes.length > 0}
            <Button
              variant="ghost"
              on:click={exportNotes}
              aria-label="Export notes"
            >
              <Icon name="download" size={16} />
            </Button>
          {/if}
        </div>

        <!-- New Note Input -->
        <form 
          class="flex gap-2"
          on:submit|preventDefault={() => {
            if (newNoteContent.trim()) addNote();
          }}
        >
          <div class="flex-1">
            <TextArea
              bind:value={newNoteContent}
              placeholder="Add a note at {formatTimestamp(currentTime)}..."
              rows={1}
              maxRows={3}
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            disabled={!newNoteContent.trim()}
          >
            Add
          </Button>
        </form>
      {:else}
        <div class="text-center text-gray-400 py-4">
          Sign in to take notes and add bookmarks
        </div>
      {/if}

      <!-- Notes List -->
      {#if notes.length > 0}
        <div class="space-y-3 mt-6">
          {#each notes as note (note.id)}
            <div class="flex gap-3">
              <!-- Timestamp -->
              <button
                class="flex-shrink-0 px-2 py-1 text-xs font-medium bg-gray-700/50 
                       hover:bg-gray-700 rounded transition-colors"
                on:click={() => handleSeek(note.timestamp)}
              >
                {formatTimestamp(note.timestamp)}
              </button>

              <!-- Note Content -->
              <div class="flex-1">
                {#if isEditing === note.id}
                  <form 
                    class="flex gap-2"
                    on:submit|preventDefault={() => updateNote(note.id)}
                  >
                    <TextArea
                      bind:value={editContent}
                      rows={1}
                      maxRows={3}
                      class="flex-1"
                      autofocus
                    />
                    <div class="flex flex-col gap-1">
                      <Button
                        type="submit"
                        variant="primary"
                        class="!p-1"
                        disabled={!editContent.trim()}
                      >
                        <Icon name="check" size={16} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        class="!p-1"
                        on:click={() => {
                          isEditing = null;
                          editContent = '';
                        }}
                      >
                        <Icon name="x" size={16} />
                      </Button>
                    </div>
                  </form>
                {:else}
                  <div class="group relative">
                    <p class="text-sm pr-16">
                      {#if note.isBookmark}
                        <Icon name="bookmark" size={16} class="inline-block mr-1 text-primary-400" />
                      {/if}
                      {note.content}
                    </p>

                    <!-- Actions -->
                    <div class="absolute right-0 top-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        class="p-1 text-gray-400 hover:text-white transition-colors"
                        on:click={() => startEditing(note)}
                      >
                        <Icon name="edit-2" size={14} />
                      </button>
                      <button
                        class="p-1 text-gray-400 hover:text-red-400 transition-colors"
                        on:click={() => deleteNote(note.id)}
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div> 