<!-- ChapterImportExport.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  import type { Chapter } from '$lib/types';
  import { formatTime } from '$lib/utils/video';

  const dispatch = createEventDispatcher();

  // Props
  export let chapters: Chapter[] = [];
  export let videoUrl: string;

  // State
  let importFormat: 'csv' | 'json' = 'csv';
  let isImporting = false;
  let error: string | null = null;

  async function handleFileImport(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    isImporting = true;
    error = null;

    try {
      const text = await file.text();
      let importedChapters: Chapter[] = [];

      if (importFormat === 'csv') {
        importedChapters = parseCSV(text);
      } else {
        importedChapters = parseJSON(text);
      }

      // Generate thumbnails for imported chapters
      const chaptersWithThumbnails = await Promise.all(
        importedChapters.map(async chapter => ({
          ...chapter,
          thumbnailUrl: await generateThumbnail(videoUrl, chapter.startTime)
        }))
      );

      dispatch('import', { chapters: chaptersWithThumbnails });
    } catch (err) {
      console.error('Failed to import chapters:', err);
      error = 'Failed to import chapters. Please check the file format.';
    } finally {
      isImporting = false;
      input.value = '';
    }
  }

  function parseCSV(text: string): Chapter[] {
    const rows = text.trim().split('\n');
    const chapters: Chapter[] = [];

    for (let i = 1; i < rows.length; i++) { // Skip header row
      const [title, startTime] = rows[i].split(',');
      if (!title || !startTime) continue;

      chapters.push({
        id: crypto.randomUUID(),
        title: title.trim(),
        startTime: parseTimeString(startTime.trim())
      });
    }

    return chapters;
  }

  function parseJSON(text: string): Chapter[] {
    const data = JSON.parse(text);
    return data.map((item: any) => ({
      id: crypto.randomUUID(),
      title: item.title,
      startTime: typeof item.startTime === 'string' 
        ? parseTimeString(item.startTime)
        : item.startTime
    }));
  }

  function parseTimeString(timeStr: string): number {
    // Support multiple formats: HH:MM:SS, MM:SS, SS
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    return Number(timeStr);
  }

  function exportChapters(format: 'csv' | 'json') {
    const sortedChapters = [...chapters].sort((a, b) => a.startTime - b.startTime);
    let content = '';
    let filename = '';

    if (format === 'csv') {
      content = 'Title,Start Time\n' + 
        sortedChapters.map(chapter => 
          `"${chapter.title}",${formatTime(chapter.startTime)}`
        ).join('\n');
      filename = 'chapters.csv';
    } else {
      content = JSON.stringify(
        sortedChapters.map(({ id, thumbnailUrl, ...chapter }) => chapter),
        null,
        2
      );
      filename = 'chapters.json';
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function generateTemplate(format: 'csv' | 'json') {
    let content = '';
    let filename = '';

    if (format === 'csv') {
      content = 'Title,Start Time\nIntro,00:00\nChapter 1,01:30\nChapter 2,05:45';
      filename = 'chapters_template.csv';
    } else {
      content = JSON.stringify([
        { title: 'Intro', startTime: '00:00' },
        { title: 'Chapter 1', startTime: '01:30' },
        { title: 'Chapter 2', startTime: '05:45' }
      ], null, 2);
      filename = 'chapters_template.json';
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
</script>

<div class="chapter-import-export">
  <div class="import-section">
    <h3>Import Chapters</h3>
    
    <div class="format-select">
      <label class="radio-label">
        <input
          type="radio"
          name="format"
          value="csv"
          bind:group={importFormat}
        />
        <span>CSV</span>
      </label>

      <label class="radio-label">
        <input
          type="radio"
          name="format"
          value="json"
          bind:group={importFormat}
        />
        <span>JSON</span>
      </label>
    </div>

    <div class="import-controls">
      <label class="file-input">
        <input
          type="file"
          accept={importFormat === 'csv' ? '.csv' : '.json'}
          on:change={handleFileImport}
          disabled={isImporting}
        />
        <span>
          {#if isImporting}
            <svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path 
                stroke-linecap="round" 
                stroke-linejoin="round" 
                stroke-width="2"
                d="M12 6v4m0 4v4m-4-8h8M6 12h12"
              />
            </svg>
            Importing...
          {:else}
            Import Chapters
          {/if}
        </span>
      </label>

      <button
        class="template-button"
        on:click={() => generateTemplate(importFormat)}
      >
        Download Template
      </button>
    </div>

    {#if error}
      <div class="error-message" transition:fade>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>{error}</span>
      </div>
    {/if}
  </div>

  <div class="export-section">
    <h3>Export Chapters</h3>
    <div class="export-buttons">
      <button
        class="export-button"
        on:click={() => exportChapters('csv')}
        disabled={chapters.length === 0}
      >
        Export as CSV
      </button>

      <button
        class="export-button"
        on:click={() => exportChapters('json')}
        disabled={chapters.length === 0}
      >
        Export as JSON
      </button>
    </div>
  </div>
</div>

<style lang="postcss">
  .chapter-import-export {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 16px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
  }

  h3 {
    font-size: 16px;
    font-weight: 500;
    color: white;
    margin: 0 0 12px;
  }

  .format-select {
    display: flex;
    gap: 16px;
    margin-bottom: 12px;
  }

  .radio-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;

    input {
      width: 16px;
      height: 16px;
      margin: 0;
      cursor: pointer;
    }

    span {
      font-size: 14px;
      color: white;
    }
  }

  .import-controls {
    display: flex;
    gap: 8px;
  }

  .file-input {
    position: relative;
    display: inline-block;

    input {
      position: absolute;
      width: 0;
      height: 0;
      opacity: 0;
    }

    span {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: var(--primary-color, #00a8ff);
      border-radius: 4px;
      color: white;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;

      &:hover:not(:disabled) {
        filter: brightness(1.1);
      }
    }

    .spinner {
      width: 16px;
      height: 16px;
      animation: spin 1s linear infinite;
    }
  }

  .template-button {
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 4px;
    color: white;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: rgba(255, 68, 68, 0.1);
    border-radius: 4px;
    color: #ff4444;
    margin-top: 12px;

    svg {
      width: 20px;
      height: 20px;
    }
  }

  .export-buttons {
    display: flex;
    gap: 8px;
  }

  .export-button {
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 4px;
    color: white;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.2);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style> 