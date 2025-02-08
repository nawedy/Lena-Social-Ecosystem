<!-- VideoEditor.svelte -->
<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  import Timeline from './timeline/Timeline.svelte';
  import Preview from './preview/Preview.svelte';
  import ToolPanel from './tools/ToolPanel.svelte';
  import ChapterEditor from './chapters/ChapterEditor.svelte';
  import CaptionEditor from './captions/CaptionEditor.svelte';
  import ThumbnailGenerator from './thumbnails/ThumbnailGenerator.svelte';
  import type { VideoMetadata, Chapter, Caption, VideoQuality } from '$lib/types';
  import { generateThumbnail, extractFrames } from '$lib/utils/video';

  const dispatch = createEventDispatcher();

  // Props
  export let videoId: string;
  export let ipfsHash: string;
  export let metadata: VideoMetadata;

  // Editor state
  let currentTime = 0;
  let duration = 0;
  let isPlaying = false;
  let selectedTool: 'trim' | 'chapters' | 'captions' | 'thumbnails' = 'trim';
  let chapters: Chapter[] = [];
  let captions: Caption[] = [];
  let thumbnails: string[] = [];
  let previewThumbnail: string | null = null;
  let isProcessing = false;

  // Timeline markers
  let inPoint = 0;
  let outPoint = duration;
  let markers: { time: number; label: string }[] = [];

  // History
  let history: any[] = [];
  let currentHistoryIndex = -1;

  onMount(async () => {
    // Generate thumbnails for the timeline
    isProcessing = true;
    try {
      thumbnails = await extractFrames(`https://ipfs.io/ipfs/${ipfsHash}`, 50);
      previewThumbnail = thumbnails[0];
    } catch (error) {
      console.error('Failed to generate thumbnails:', error);
    }
    isProcessing = false;
  });

  // Editor actions
  function handleTimeUpdate(event: CustomEvent) {
    currentTime = event.detail.time;
  }

  function handleDurationChange(event: CustomEvent) {
    duration = event.detail.duration;
    outPoint = duration;
  }

  function handleToolChange(tool: typeof selectedTool) {
    selectedTool = tool;
  }

  function handleTrim() {
    if (inPoint >= outPoint) return;

    const edit = {
      type: 'trim',
      inPoint,
      outPoint,
      timestamp: Date.now()
    };

    addToHistory(edit);
    dispatch('trim', { inPoint, outPoint });
  }

  function handleChapterAdd(event: CustomEvent) {
    const chapter = event.detail.chapter;
    chapters = [...chapters, chapter].sort((a, b) => a.startTime - b.startTime);
    
    const edit = {
      type: 'add_chapter',
      chapter,
      timestamp: Date.now()
    };

    addToHistory(edit);
    dispatch('chapters', { chapters });
  }

  function handleChapterDelete(event: CustomEvent) {
    const chapterId = event.detail.chapterId;
    chapters = chapters.filter(c => c.id !== chapterId);

    const edit = {
      type: 'delete_chapter',
      chapterId,
      timestamp: Date.now()
    };

    addToHistory(edit);
    dispatch('chapters', { chapters });
  }

  function handleCaptionAdd(event: CustomEvent) {
    const caption = event.detail.caption;
    captions = [...captions, caption];

    const edit = {
      type: 'add_caption',
      caption,
      timestamp: Date.now()
    };

    addToHistory(edit);
    dispatch('captions', { captions });
  }

  function handleThumbnailSelect(event: CustomEvent) {
    const { thumbnail, time } = event.detail;
    previewThumbnail = thumbnail;
    dispatch('thumbnail', { thumbnail, time });
  }

  // History management
  function addToHistory(edit: any) {
    // Remove any future history if we're not at the latest edit
    if (currentHistoryIndex < history.length - 1) {
      history = history.slice(0, currentHistoryIndex + 1);
    }

    history = [...history, edit];
    currentHistoryIndex = history.length - 1;
  }

  function undo() {
    if (currentHistoryIndex < 0) return;

    const edit = history[currentHistoryIndex];
    revertEdit(edit);
    currentHistoryIndex--;
  }

  function redo() {
    if (currentHistoryIndex >= history.length - 1) return;

    currentHistoryIndex++;
    const edit = history[currentHistoryIndex];
    applyEdit(edit);
  }

  function revertEdit(edit: any) {
    switch (edit.type) {
      case 'trim':
        inPoint = 0;
        outPoint = duration;
        dispatch('trim', { inPoint: 0, outPoint: duration });
        break;
      case 'add_chapter':
        chapters = chapters.filter(c => c.id !== edit.chapter.id);
        dispatch('chapters', { chapters });
        break;
      case 'delete_chapter':
        const chapter = history.find(h => h.type === 'add_chapter' && h.chapter.id === edit.chapterId)?.chapter;
        if (chapter) {
          chapters = [...chapters, chapter].sort((a, b) => a.startTime - b.startTime);
          dispatch('chapters', { chapters });
        }
        break;
      // Add more cases as needed
    }
  }

  function applyEdit(edit: any) {
    switch (edit.type) {
      case 'trim':
        inPoint = edit.inPoint;
        outPoint = edit.outPoint;
        dispatch('trim', { inPoint, outPoint });
        break;
      case 'add_chapter':
        chapters = [...chapters, edit.chapter].sort((a, b) => a.startTime - b.startTime);
        dispatch('chapters', { chapters });
        break;
      case 'delete_chapter':
        chapters = chapters.filter(c => c.id !== edit.chapterId);
        dispatch('chapters', { chapters });
        break;
      // Add more cases as needed
    }
  }
</script>

<div class="video-editor">
  <div class="editor-main">
    <div class="preview-panel">
      <Preview
        {ipfsHash}
        {currentTime}
        {duration}
        bind:isPlaying
        on:timeupdate={handleTimeUpdate}
        on:durationchange={handleDurationChange}
      />
    </div>

    <div class="timeline-panel">
      <Timeline
        {thumbnails}
        {currentTime}
        {duration}
        {inPoint}
        {outPoint}
        {chapters}
        {markers}
        on:timeupdate={handleTimeUpdate}
        on:inpointchange={(e) => inPoint = e.detail.time}
        on:outpointchange={(e) => outPoint = e.detail.time}
      />
    </div>
  </div>

  <div class="editor-sidebar">
    <ToolPanel
      {selectedTool}
      canUndo={currentHistoryIndex >= 0}
      canRedo={currentHistoryIndex < history.length - 1}
      on:toolchange={(e) => handleToolChange(e.detail.tool)}
      on:undo={undo}
      on:redo={redo}
      on:trim={handleTrim}
    />

    {#if selectedTool === 'chapters'}
      <ChapterEditor
        {chapters}
        {currentTime}
        {duration}
        on:add={handleChapterAdd}
        on:delete={handleChapterDelete}
      />
    {:else if selectedTool === 'captions'}
      <CaptionEditor
        {captions}
        {currentTime}
        {duration}
        on:add={handleCaptionAdd}
      />
    {:else if selectedTool === 'thumbnails'}
      <ThumbnailGenerator
        {thumbnails}
        {currentTime}
        {previewThumbnail}
        on:select={handleThumbnailSelect}
      />
    {/if}
  </div>
</div>

<style lang="postcss">
  .video-editor {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 20px;
    height: 100%;
    background: var(--surface-color, #1a1a1a);
    color: var(--text-color, #fff);
  }

  .editor-main {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 20px;
  }

  .preview-panel {
    flex: 1;
    min-height: 0;
    background: var(--surface-color-dark, #000);
    border-radius: 8px;
    overflow: hidden;
  }

  .timeline-panel {
    height: 200px;
    background: var(--surface-color-light, #2a2a2a);
    border-radius: 8px;
    overflow: hidden;
  }

  .editor-sidebar {
    background: var(--surface-color-light, #2a2a2a);
    border-left: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
    padding: 20px;
    overflow-y: auto;
  }
</style> 