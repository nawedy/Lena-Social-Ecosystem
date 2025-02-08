<!-- ChaptersControl.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Chapter } from '$lib/types';
  import { formatTime } from '$lib/utils/video';

  export let chapters: Chapter[] = [];
  export let currentTime: number = 0;
  export let duration: number = 0;

  const dispatch = createEventDispatcher();

  $: currentChapter = chapters.find((chapter, index) => {
    const nextChapter = chapters[index + 1];
    return currentTime >= chapter.startTime && 
           (!nextChapter || currentTime < nextChapter.startTime);
  });

  $: progress = (currentTime / duration) * 100;

  function handleChapterClick(startTime: number) {
    dispatch('seek', { time: startTime });
  }

  function getChapterProgress(chapter: Chapter, nextChapter: Chapter | undefined) {
    const start = chapter.startTime;
    const end = nextChapter ? nextChapter.startTime : duration;
    const current = Math.min(Math.max(currentTime, start), end);
    return ((current - start) / (end - start)) * 100;
  }
</script>

<div class="chapters-control">
  {#if chapters.length > 0}
    <div class="chapters-timeline">
      {#each chapters as chapter, i}
        {@const nextChapter = chapters[i + 1]}
        {@const width = nextChapter 
          ? ((nextChapter.startTime - chapter.startTime) / duration) * 100
          : ((duration - chapter.startTime) / duration) * 100}
        
        <div 
          class="chapter-segment"
          style="width: {width}%"
          class:active={chapter === currentChapter}
          on:click={() => handleChapterClick(chapter.startTime)}
        >
          <div 
            class="chapter-progress"
            style="width: {getChapterProgress(chapter, nextChapter)}%"
          />
          <div class="chapter-tooltip">
            <span class="chapter-title">{chapter.title}</span>
            <span class="chapter-time">{formatTime(chapter.startTime)}</span>
          </div>
        </div>
      {/each}
    </div>

    <div class="chapters-list">
      {#each chapters as chapter, i}
        <button
          class="chapter-item"
          class:active={chapter === currentChapter}
          on:click={() => handleChapterClick(chapter.startTime)}
        >
          <span class="chapter-number">{i + 1}</span>
          <span class="chapter-title">{chapter.title}</span>
          <span class="chapter-time">{formatTime(chapter.startTime)}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style lang="postcss">
  .chapters-control {
    width: 100%;
    color: white;
    font-size: 14px;
  }

  .chapters-timeline {
    display: flex;
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.2);
    margin-bottom: 10px;
    border-radius: 2px;
    overflow: hidden;
  }

  .chapter-segment {
    position: relative;
    height: 100%;
    background: rgba(255, 255, 255, 0.3);
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.4);

      .chapter-tooltip {
        opacity: 1;
        transform: translateY(0);
      }
    }

    &.active {
      background: rgba(255, 255, 255, 0.5);
    }
  }

  .chapter-progress {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background: var(--primary-color, #00a8ff);
    transition: width 0.1s linear;
  }

  .chapter-tooltip {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%) translateY(10px);
    background: rgba(0, 0, 0, 0.9);
    padding: 4px 8px;
    border-radius: 4px;
    white-space: nowrap;
    opacity: 0;
    transition: all 0.2s;
    pointer-events: none;
    margin-bottom: 8px;

    &::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border: 4px solid transparent;
      border-top-color: rgba(0, 0, 0, 0.9);
    }
  }

  .chapters-list {
    display: none;
    flex-direction: column;
    gap: 4px;
    max-height: 200px;
    overflow-y: auto;
    padding-right: 10px;

    &:hover {
      display: flex;
    }
  }

  .chapter-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 4px;
    color: white;
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    &.active {
      background: rgba(var(--primary-color-rgb, 0, 168, 255), 0.3);
    }
  }

  .chapter-number {
    font-weight: bold;
    min-width: 24px;
  }

  .chapter-title {
    flex: 1;
    text-align: left;
  }

  .chapter-time {
    color: rgba(255, 255, 255, 0.7);
  }

  /* Show chapters list on timeline hover */
  .chapters-timeline:hover + .chapters-list {
    display: flex;
  }
</style> 