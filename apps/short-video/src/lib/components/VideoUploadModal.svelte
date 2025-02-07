<!-- VideoUploadModal.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Modal, FileUpload } from '@lena/ui';

  export let isOpen = false;

  const dispatch = createEventDispatcher<{
    upload: { file: File; caption: string };
    close: void;
  }>();

  let caption = '';
  let uploading = false;
  let progress = 0;

  function handleFileSelect(event: CustomEvent) {
    const [file] = event.detail.files;
    if (file) {
      dispatch('upload', { file, caption });
      uploading = true;
    }
  }

  function handleFileError(event: CustomEvent) {
    console.error('File upload error:', event.detail.message);
  }

  function handleClose() {
    isOpen = false;
    caption = '';
    uploading = false;
    progress = 0;
    dispatch('close');
  }
</script>

<Modal
  bind:open={isOpen}
  title="Upload Video"
  size="md"
  on:close={handleClose}
>
  <div class="space-y-6">
    <!-- File Upload -->
    <FileUpload
      accept="video/*"
      maxSize={100 * 1024 * 1024} // 100MB
      {uploading}
      {progress}
      on:select={handleFileSelect}
      on:error={handleFileError}
    />

    <!-- Caption Input -->
    <div class="space-y-2">
      <label for="caption" class="block text-sm font-medium">
        Caption
      </label>
      <textarea
        id="caption"
        bind:value={caption}
        rows="3"
        class="w-full px-4 py-2 bg-black/50 border border-primary-900/50 rounded-lg focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
        placeholder="Write a caption for your video..."
      />
    </div>

    <!-- Privacy Settings -->
    <div class="space-y-2">
      <h3 class="text-sm font-medium">Privacy Settings</h3>
      <div class="flex items-center gap-4">
        <label class="flex items-center gap-2">
          <input type="radio" name="privacy" value="public" checked />
          <span>Public</span>
        </label>
        <label class="flex items-center gap-2">
          <input type="radio" name="privacy" value="friends" />
          <span>Friends</span>
        </label>
        <label class="flex items-center gap-2">
          <input type="radio" name="privacy" value="private" />
          <span>Private</span>
        </label>
      </div>
    </div>

    <!-- Token Settings -->
    <div class="space-y-2">
      <h3 class="text-sm font-medium">Token Settings</h3>
      <div class="flex items-center gap-4">
        <label class="flex items-center gap-2">
          <input type="checkbox" checked />
          <span>Enable token rewards</span>
        </label>
      </div>
      <p class="text-xs text-gray-400">
        Earn tokens when viewers engage with your content
      </p>
    </div>
  </div>

  <svelte:fragment slot="footer">
    <button
      class="px-4 py-2 text-gray-400 hover:text-white transition-colors"
      on:click={handleClose}
    >
      Cancel
    </button>
    <button
      class="px-4 py-2 bg-primary-500 text-black rounded-lg hover:bg-primary-400 transition-colors"
      disabled={!caption || uploading}
      on:click={() => {
        if (!uploading) {
          const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
          const file = fileInput?.files?.[0];
          if (file) {
            dispatch('upload', { file, caption });
            uploading = true;
          }
        }
      }}
    >
      {uploading ? 'Uploading...' : 'Upload'}
    </button>
  </svelte:fragment>
</Modal> 