<!-- AdvancedChapterEditor.svelte -->
<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { spring } from 'svelte/motion';
  import type { Chapter } from '$lib/types';
  import { formatTime, generateThumbnail } from '$lib/utils/video';

  const dispatch = createEventDispatcher();

  // Props
  export let chapters: Chapter[] = [];
  export let currentTime = 0;
  export let duration = 0;
  export let videoUrl: string;

  // State
  let selectedChapterId: string | null = null;
  let editingChapter: Partial<Chapter> | null = null;
  let timelineElement: HTMLElement;
  let isDragging = false;
  let dragStartX = 0;
  let draggedChapterId: string | null = null;
  let zoom = 1;
  let scrollPosition = 0;
  let isGeneratingThumbnail = false;

  // Animated values
  const playhead = spring(0, {
    stiffness: 0.2,
    damping: 0.8
  });

  $: {
    if (!isDragging) {
      playhead.set((currentTime / duration) * getTimelineWidth());
    }
  }

  $: sortedChapters = [...chapters].sort((a, b) => a.startTime - b.startTime);
  $: currentChapter = chapters.find((chapter, index) => {
    const nextChapter = chapters[index + 1];
    return currentTime >= chapter.startTime && 
           (!nextChapter || currentTime < nextChapter.startTime);
  });

  function getTimelineWidth() {
    return timelineElement?.clientWidth || 0;
  }

  function handleTimelineClick(event: MouseEvent) {
    const rect = timelineElement.getBoundingClientRect();
    const x = event.clientX - rect.left + scrollPosition;
    const time = (x / getTimelineWidth()) * duration;
    dispatch('seek', { time: Math.max(0, Math.min(time, duration)) });
  }

  function handleChapterDragStart(event: DragEvent, chapter: Chapter) {
    draggedChapterId = chapter.id;
    dragStartX = event.clientX;
    isDragging = true;
  }

  function handleChapterDragEnd() {
    isDragging = false;
    draggedChapterId = null;
  }

  function handleChapterDrag(event: DragEvent, chapter: Chapter) {
    if (!isDragging || !draggedChapterId) return;

    const deltaX = event.clientX - dragStartX;
    const deltaTime = (deltaX / getTimelineWidth()) * duration;
    const newStartTime = Math.max(0, Math.min(chapter.startTime + deltaTime, duration));

    const updatedChapter = {
      ...chapter,
      startTime: newStartTime
    };

    dispatch('update', { chapter: updatedChapter });
    dragStartX = event.clientX;
  }

  async function handleAddChapter() {
    isGeneratingThumbnail = true;

    try {
      const thumbnail = await generateThumbnail(videoUrl, currentTime);
      
      const chapter: Chapter = {
        id: crypto.randomUUID(),
        title: 'New Chapter',
        startTime: currentTime,
        thumbnailUrl: thumbnail
      };

      dispatch('add', { chapter });
      selectedChapterId = chapter.id;
      editingChapter = { ...chapter };
    } catch (error) {
      console.error('Failed to generate thumbnail:', error);
    } finally {
      isGeneratingThumbnail = false;
    }
  }

  function handleDeleteChapter(chapterId: string) {
    if (selectedChapterId === chapterId) {
      selectedChapterId = null;
      editingChapter = null;
    }
    dispatch('delete', { chapterId });
  }

  function handleChapterSelect(chapter: Chapter) {
    selectedChapterId = chapter.id;
    editingChapter = { ...chapter };
  }

  function handleSaveChapter() {
    if (!editingChapter || !selectedChapterId) return;

    const chapter = {
      ...editingChapter,
      id: selectedChapterId
    } as Chapter;

    dispatch('update', { chapter });
    editingChapter = null;
    selectedChapterId = null;
  }

  function handleWheel(event: WheelEvent) {
    if (event.ctrlKey || event.metaKey) {
      // Zoom
      event.preventDefault();
      const oldZoom = zoom;
      zoom = Math.max(1, Math.min(10, zoom + event.deltaY * -0.001));
      
      // Adjust scroll to keep the current time position stable
      const timelineRect = timelineElement.getBoundingClientRect();
      const mouseX = event.clientX - timelineRect.left;
      const timelineX = mouseX + scrollPosition;
      const newScrollPosition = (timelineX * (zoom / oldZoom)) - mouseX;
      
      scrollPosition = Math.max(0, Math.min(newScrollPosition, getTimelineWidth() * (zoom - 1)));
    } else {
      // Scroll
      scrollPosition = Math.max(0, Math.min(scrollPosition + event.deltaX, getTimelineWidth() * (zoom - 1)));
    }
  }
</script>

<div class="chapter-editor">
  <div class="timeline-section">
    <div 
      class="timeline"
      bind:this={timelineElement}
      on:click={handleTimelineClick}
      on:wheel={handleWheel}
    >
      <div 
        class="timeline-content"
        style="
          width: {100 * zoom}%;
          transform: translateX({-scrollPosition}px)
        "
      >
        <!-- Time markers -->
        {#each Array(Math.ceil(duration)) as _, i}
          {@const left = (i / duration) * 100}
          {#if i % 5 === 0}
            <div 
              class="time-marker major"
              style="left: {left}%"
            >
              <span class="marker-time">{formatTime(i)}</span>
            </div>
          {:else}
            <div 
              class="time-marker minor"
              style="left: {left}%"
            />
          {/if}
        {/each}

        <!-- Chapter markers -->
        {#each sortedChapters as chapter, i}
          {@const left = (chapter.startTime / duration) * 100}
          {@const width = i < chapters.length - 1
            ? ((chapters[i + 1].startTime - chapter.startTime) / duration) * 100
            : (100 - left)
          }

          <div 
            class="chapter-marker"
            class:selected={chapter.id === selectedChapterId}
            class:current={chapter === currentChapter}
            style="left: {left}%; width: {width}%"
            draggable="true"
            on:dragstart={(e) => handleChapterDragStart(e, chapter)}
            on:dragend={handleChapterDragEnd}
            on:drag={(e) => handleChapterDrag(e, chapter)}
            on:click|stopPropagation={() => handleChapterSelect(chapter)}
          >
            {#if chapter.thumbnailUrl}
              <img 
                src={chapter.thumbnailUrl} 
                alt={chapter.title}
                class="chapter-thumbnail"
              />
            {/if}
            <div class="chapter-info">
              <span class="chapter-title">{chapter.title}</span>
              <span class="chapter-time">{formatTime(chapter.startTime)}</span>
            </div>
          </div>
        {/each}

        <!-- Playhead -->
        <div 
          class="playhead"
          style="transform: translateX({$playhead}px)"
        >
          <div class="playhead-line" />
          <div class="playhead-time">{formatTime(currentTime)}</div>
        </div>
      </div>
    </div>

    <div class="timeline-controls">
      <button
        class="add-chapter"
        on:click={handleAddChapter}
        disabled={isGeneratingThumbnail}
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
          Add Chapter at {formatTime(currentTime)}
        {/if}
      </button>

      <div class="zoom-controls">
        <button
          class="zoom-button"
          on:click={() => zoom = Math.max(1, zoom - 0.5)}
          disabled={zoom <= 1}
        >
          -
        </button>
        <span class="zoom-level">{Math.round(zoom * 100)}%</span>
        <button
          class="zoom-button"
          on:click={() => zoom = Math.min(10, zoom + 0.5)}
          disabled={zoom >= 10}
        >
          +
        </button>
      </div>
    </div>
  </div>

  {#if editingChapter}
    <div class="chapter-form" transition:fade>
      <div class="form-group">
        <label for="chapterTitle">Title</label>
        <input
          id="chapterTitle"
          type="text"
          bind:value={editingChapter.title}
          placeholder="Enter chapter title"
        />
      </div>

      <div class="form-group">
        <label for="chapterTime">Start Time</label>
        <input
          id="chapterTime"
          type="number"
          min="0"
          max={duration}
          step="0.1"
          bind:value={editingChapter.startTime}
        />
      </div>

      <div class="form-actions">
        <button
          class="cancel-button"
          on:click={() => {
            editingChapter = null;
            selectedChapterId = null;
          }}
        >
          Cancel
        </button>
        <button
          class="delete-button"
          on:click={() => selectedChapterId && handleDeleteChapter(selectedChapterId)}
        >
          Delete
        </button>
        <button
          class="save-button"
          on:click={handleSaveChapter}
        >
          Save
        </button>
      </div>
    </div>
  {/if}
</div>

<style lang="postcss">
  .chapter-editor {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .timeline-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .timeline {
    position: relative;
    height: 120px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    overflow: hidden;
  }

  .timeline-content {
    position: relative;
    height: 100%;
    will-change: transform;
  }

  .time-marker {
    position: absolute;
    top: 0;
    width: 1px;
    background: rgba(255, 255, 255, 0.2);

    &.major {
      height: 12px;
      background: rgba(255, 255, 255, 0.4);

      .marker-time {
        position: absolute;
        top: 16px;
        left: 4px;
        font-size: 10px;
        color: rgba(255, 255, 255, 0.6);
        white-space: nowrap;
      }
    }

    &.minor {
      height: 6px;
    }
  }

  .chapter-marker {
    position: absolute;
    top: 24px;
    height: calc(100% - 24px);
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.15);
    }

    &.selected {
      background: rgba(var(--primary-color-rgb, 0, 168, 255), 0.3);
    }

    &.current {
      border: 2px solid var(--primary-color, #00a8ff);
    }
  }

  .chapter-thumbnail {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0.5;
    pointer-events: none;
  }

  .chapter-info {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 8px;
    background: rgba(0, 0, 0, 0.8);
    font-size: 12px;
  }

  .chapter-title {
    display: block;
    color: white;
    font-weight: 500;
    margin-bottom: 2px;
  }

  .chapter-time {
    color: rgba(255, 255, 255, 0.7);
  }

  .playhead {
    position: absolute;
    top: 0;
    height: 100%;
    z-index: 2;
    pointer-events: none;
    will-change: transform;
  }

  .playhead-line {
    width: 2px;
    height: 100%;
    background: #ff0000;
    box-shadow: 0 0 4px rgba(255, 0, 0, 0.5);
  }

  .playhead-time {
    position: absolute;
    top: -24px;
    left: 50%;
    transform: translateX(-50%);
    padding: 2px 6px;
    background: #ff0000;
    border-radius: 4px;
    color: white;
    font-size: 12px;
    white-space: nowrap;
  }

  .timeline-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .add-chapter {
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

    .spinner {
      width: 20px;
      height: 20px;
      animation: spin 1s linear infinite;
    }
  }

  .zoom-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .zoom-button {
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 4px;
    color: white;
    font-size: 14px;
    cursor: pointer;

    &:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.2);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .zoom-level {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
    min-width: 48px;
    text-align: center;
  }

  .chapter-form {
    padding: 16px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;

    label {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.7);
    }

    input {
      padding: 8px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      color: white;
      font-size: 14px;

      &:focus {
        outline: none;
        border-color: var(--primary-color, #00a8ff);
      }
    }
  }

  .form-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .cancel-button,
  .delete-button,
  .save-button {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .cancel-button {
    background: rgba(255, 255, 255, 0.1);
    color: white;

    &:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  }

  .delete-button {
    background: rgba(255, 68, 68, 0.1);
    color: #ff4444;

    &:hover {
      background: rgba(255, 68, 68, 0.2);
    }
  }

  .save-button {
    background: var(--primary-color, #00a8ff);
    color: white;

    &:hover {
      filter: brightness(1.1);
    }
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style> 