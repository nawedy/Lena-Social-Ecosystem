<!-- +page.svelte -->
<script lang="ts">
  import { fade } from 'svelte/transition';
  import { goto } from '$app/navigation';
  import VideoUpload from '$lib/components/upload/VideoUpload.svelte';
  import VideoForm from '$lib/components/upload/VideoForm.svelte';

  let uploadStep: 'upload' | 'details' = 'upload';
  let uploadData: {
    ipfsHash: string;
    filename: string;
    size: number;
    type: string;
  } | null = null;

  $: videoUrl = uploadData?.ipfsHash 
    ? `https://ipfs.io/ipfs/${uploadData.ipfsHash}`
    : '';

  function handleUploadSuccess(event: CustomEvent) {
    uploadData = event.detail;
    uploadStep = 'details';
  }

  function handleFormSuccess(event: CustomEvent) {
    const { video } = event.detail;
    goto(`/studio/video/${video.id}/edit`);
  }
</script>

<div class="upload-page">
  <header class="page-header">
    <h1>Upload Video</h1>
    <p class="subtitle">Share your videos with the world</p>
  </header>

  <div class="upload-container">
    {#if uploadStep === 'upload'}
      <div class="upload-step" transition:fade>
        <VideoUpload
          on:success={handleUploadSuccess}
        />
      </div>
    {:else if uploadStep === 'details' && uploadData}
      <div class="details-step" transition:fade>
        <VideoForm
          ipfsHash={uploadData.ipfsHash}
          filename={uploadData.filename}
          filesize={uploadData.size}
          filetype={uploadData.type}
          videoUrl={videoUrl}
          on:success={handleFormSuccess}
        />
      </div>
    {/if}
  </div>
</div>

<style lang="postcss">
  .upload-page {
    max-width: 1200px;
    margin: 0 auto;
    padding: 40px 20px;
  }

  .page-header {
    text-align: center;
    margin-bottom: 40px;

    h1 {
      font-size: 32px;
      font-weight: 600;
      color: white;
      margin: 0 0 8px;
    }

    .subtitle {
      font-size: 16px;
      color: rgba(255, 255, 255, 0.7);
      margin: 0;
    }
  }

  .upload-container {
    background: var(--surface-color-light, #2a2a2a);
    border-radius: 8px;
    padding: 40px;
  }

  .upload-step,
  .details-step {
    min-height: 400px;
  }
</style> 