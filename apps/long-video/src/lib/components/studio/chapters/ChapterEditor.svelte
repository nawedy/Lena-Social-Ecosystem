<!-- ChapterEditor.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  import type { Chapter } from '$lib/types';
  import { formatTime } from '$lib/utils/video';
  import { generateThumbnail } from '$lib/utils/video';

  const dispatch = createEventDispatcher();

  // Props
  export let chapters: Chapter[] = [];
  export let currentTime = 0;
  export let duration = 0;

  // State
  let newChapterTitle = '';
  let isGeneratingThumbnail = false;
  let selectedChapterId: string | null = null;

  $: sortedChapters = [...chapters].sort((a, b) => a.startTime - b.startTime);
  $: currentChapter = chapters.find((chapter, index) => {
    const nextChapter = chapters[index + 1];
    return currentTime >= chapter.startTime && 
           (!nextChapter || currentTime < nextChapter.startTime);
  });

  async function handleAddChapter() {
    if (!newChapterTitle.trim()) return;

    isGeneratingThumbnail = true;
    let thumbnailUrl: string | null = null;

    try {
      thumbnailUrl = await generateThumbnail(
        `https://ipfs.io/ipfs/${ipfsHash}`,
        currentTime
      );
    } catch (error) {
      console.error('Failed to generate thumbnail:', error);
    }

    const chapter: Chapter = {
      id: crypto.randomUUID(),
      title: newChapterTitle.trim(),
      startTime: currentTime,
      thumbnailUrl: thumbnailUrl || undefined
    };

    dispatch('add', { chapter });
    newChapterTitle = '';
    isGeneratingThumbnail = false;
  }

  function handleDeleteChapter(chapterId: string) {
    dispatch('delete', { chapterId });
    if (selectedChapterId === chapterId) {
      selectedChapterId = null;
    }
  }

  function handleChapterClick(chapter: Chapter) {
    selectedChapterId = chapter.id;
    dispatch('seek', { time: chapter.startTime });
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleAddChapter();
    }
  }
</script>

<div class="chapter-editor">
  <div class="add-chapter">
    <input
      type="text"
      class="chapter-input"
      placeholder="Chapter title"
      bind:value={newChapterTitle}
      on:keydown={handleKeydown}
    />
    <button
      class="add-button"
      disabled={!newChapterTitle.trim() || isGeneratingThumbnail}
      on:click={handleAddChapter}
    >
      {#if isGeneratingThumbnail}
        <svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2"
            d="M12 6v4m0 4v4m-4-8h8M6 12h12"
          />
        </svg>
      {:else}
        Add at {formatTime(currentTime)}
      {/if}
    </button>
  </div>

  <div class="chapters-list">
    {#if chapters.length === 0}
      <div class="empty-state" transition:fade>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2"
            d="M9 17l6-6-6-6m4 12h7M4 12h7"
          />
        </svg>
        <p>No chapters added yet</p>
        <p class="hint">Add chapters to help viewers navigate through your video</p>
      </div>
    {:else}
      {#each sortedChapters as chapter, index}
        {@const isSelected = selectedChapterId === chapter.id}
        {@const isCurrent = chapter === currentChapter}
        {@const duration = index < chapters.length - 1 
          ? chapters[index + 1].startTime - chapter.startTime
          : duration - chapter.startTime
        }

        <div 
          class="chapter-item"
          class:selected={isSelected}
          class:current={isCurrent}
          transition:fade
          on:click={() => handleChapterClick(chapter)}
        >
          <div class="chapter-preview">
            {#if chapter.thumbnailUrl}
              <img 
                src={chapter.thumbnailUrl} 
                alt={chapter.title}
                class="preview-image"
              />
            {:else}
              <div class="preview-placeholder" />
            {/if}
            <div class="chapter-time">{formatTime(chapter.startTime)}</div>
          </div>

          <div class="chapter-info">
            <div class="chapter-title">{chapter.title}</div>
            <div class="chapter-duration">{formatTime(duration)}</div>
          </div>

          <button
            class="delete-button"
            on:click|stopPropagation={() => handleDeleteChapter(chapter.id)}
            title="Delete chapter"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path 
                stroke-linecap="round" 
                stroke-linejoin="round" 
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style lang="postcss">
  .chapter-editor {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .add-chapter {
    display: flex;
    gap: 8px;
  }

  .chapter-input {
    flex: 1;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    color: white;
    font-size: 14px;

    &:focus {
      outline: none;
      border-color: var(--primary-color, #00a8ff);
    }

    &::placeholder {
      color: rgba(255, 255, 255, 0.5);
    }
  }

  .add-button {
    padding: 8px 16px;
    background: var(--primary-color, #00a8ff);
    border: none;
    border-radius: 4px;
    color: white;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      filter: brightness(1.1);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .spinner {
    width: 20px;
    height: 20px;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .chapters-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 400px;
    overflow-y: auto;
    padding-right: 8px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 40px 20px;
    text-align: center;
    color: rgba(255, 255, 255, 0.5);

    svg {
      width: 48px;
      height: 48px;
      opacity: 0.5;
    }

    p {
      margin: 0;
      font-size: 14px;

      &.hint {
        font-size: 12px;
        opacity: 0.7;
      }
    }
  }

  .chapter-item {
    display: flex;
    gap: 12px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.1);

      .delete-button {
        opacity: 1;
      }
    }

    &.selected {
      background: rgba(var(--primary-color-rgb, 0, 168, 255), 0.2);
    }

    &.current {
      border-left: 2px solid var(--primary-color, #00a8ff);
    }
  }

  .chapter-preview {
    position: relative;
    width: 80px;
    height: 45px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 2px;
    overflow: hidden;
  }

  .preview-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .preview-placeholder {
    width: 100%;
    height: 100%;
    background: rgba(255, 255, 255, 0.1);
  }

  .chapter-time {
    position: absolute;
    bottom: 4px;
    right: 4px;
    padding: 2px 4px;
    background: rgba(0, 0, 0, 0.8);
    border-radius: 2px;
    font-size: 10px;
    color: white;
  }

  .chapter-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
  }

  .chapter-title {
    font-size: 14px;
    font-weight: 500;
    color: white;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chapter-duration {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
  }

  .delete-button {
    align-self: center;
    padding: 4px;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    opacity: 0;
    transition: all 0.2s;

    &:hover {
      color: #ff4444;
    }

    svg {
      width: 16px;
      height: 16px;
    }
  }
</style> 