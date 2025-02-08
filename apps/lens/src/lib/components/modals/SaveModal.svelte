<!-- SaveModal.svelte -->
<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { clickOutside } from '$lib/actions/clickOutside';
  import type { Post, Collection } from '$lib/types';
  import { collections } from '$lib/services/collections';
  import { analytics } from '$lib/services/analytics';

  const dispatch = createEventDispatcher();

  // Props
  export let post: Post;

  // State
  let isLoading = false;
  let error: string | null = null;
  let userCollections: Collection[] = [];
  let newCollectionName = '';
  let showNewCollectionInput = false;

  // Lifecycle
  onMount(async () => {
    await loadCollections();
  });

  // Methods
  async function loadCollections() {
    isLoading = true;
    error = null;

    try {
      userCollections = await collections.getUserCollections();
    } catch (err) {
      console.error('Failed to load collections:', err);
      error = 'Failed to load collections. Please try again.';
    } finally {
      isLoading = false;
    }
  }

  async function handleSave(collectionId: string) {
    isLoading = true;
    error = null;

    try {
      await collections.addToCollection(post.id, collectionId);

      analytics.trackEvent({
        type: 'post_save',
        contentId: post.id,
        contentType: 'post',
        data: {
          collectionId,
          timestamp: Date.now()
        }
      });

      dispatch('close');
    } catch (err) {
      console.error('Failed to save post:', err);
      error = 'Failed to save post. Please try again.';
    } finally {
      isLoading = false;
    }
  }

  async function createCollection() {
    if (!newCollectionName.trim()) return;

    isLoading = true;
    error = null;

    try {
      const collection = await collections.createCollection({
        name: newCollectionName.trim(),
        description: '',
        isPrivate: false
      });

      await handleSave(collection.id);

      analytics.trackEvent({
        type: 'collection_create',
        contentId: collection.id,
        contentType: 'collection',
        data: {
          name: collection.name,
          timestamp: Date.now()
        }
      });
    } catch (err) {
      console.error('Failed to create collection:', err);
      error = 'Failed to create collection. Please try again.';
    } finally {
      isLoading = false;
      newCollectionName = '';
      showNewCollectionInput = false;
    }
  }
</script>

<div class="modal-backdrop" transition:fade>
  <div 
    class="modal"
    use:clickOutside
    on:clickoutside={() => dispatch('close')}
  >
    <header class="modal-header">
      <h2>Save Post</h2>
      <button
        class="close-button"
        on:click={() => dispatch('close')}
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
    </header>

    {#if error}
      <div class="error-message" transition:fade>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span>{error}</span>
      </div>
    {/if}

    <div class="collections-list">
      {#if isLoading}
        <div class="loading-state">
          <svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path 
              stroke-linecap="round" 
              stroke-linejoin="round" 
              stroke-width="2"
              d="M12 6v4m0 2v4m0 2v4M4 12h4m2 0h4m2 0h4"
            />
          </svg>
          <span>Loading collections...</span>
        </div>
      {:else if userCollections.length === 0 && !showNewCollectionInput}
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path 
              stroke-linecap="round" 
              stroke-linejoin="round" 
              stroke-width="2"
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <p>You don't have any collections yet.</p>
          <button
            class="primary-button"
            on:click={() => showNewCollectionInput = true}
          >
            Create Collection
          </button>
        </div>
      {:else}
        {#each userCollections as collection}
          <button
            class="collection-button"
            disabled={isLoading}
            on:click={() => handleSave(collection.id)}
          >
            <div class="collection-info">
              <div class="collection-preview">
                {#if collection.posts.length > 0}
                  <img
                    src={collection.posts[0].thumbnail}
                    alt={collection.name}
                  />
                {:else}
                  <div class="empty-preview">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path 
                        stroke-linecap="round" 
                        stroke-linejoin="round" 
                        stroke-width="2"
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                {/if}
              </div>
              <div class="collection-details">
                <h3>{collection.name}</h3>
                <p>{collection.posts.length} posts</p>
              </div>
            </div>
            <svg class="arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path 
                stroke-linecap="round" 
                stroke-linejoin="round" 
                stroke-width="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        {/each}
      {/if}

      {#if showNewCollectionInput}
        <form
          class="new-collection-form"
          on:submit|preventDefault={createCollection}
        >
          <input
            type="text"
            bind:value={newCollectionName}
            placeholder="Collection name"
            maxlength="50"
            disabled={isLoading}
            autofocus
          />
          <div class="form-actions">
            <button
              type="button"
              class="secondary-button"
              on:click={() => {
                showNewCollectionInput = false;
                newCollectionName = '';
              }}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              class="primary-button"
              disabled={!newCollectionName.trim() || isLoading}
            >
              Create
            </button>
          </div>
        </form>
      {:else if userCollections.length > 0}
        <button
          class="new-collection-button"
          on:click={() => showNewCollectionInput = true}
          disabled={isLoading}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path 
              stroke-linecap="round" 
              stroke-linejoin="round" 
              stroke-width="2"
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
          Create New Collection
        </button>
      {/if}
    </div>
  </div>
</div>

<style lang="postcss">
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .modal {
    width: 100%;
    max-width: 480px;
    max-height: 90vh;
    background: var(--surface-color, #1a1a1a);
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);

    h2 {
      font-size: 18px;
      font-weight: 600;
      color: white;
      margin: 0;
    }
  }

  .close-button {
    padding: 8px;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    transition: color 0.2s;

    &:hover {
      color: white;
    }

    svg {
      width: 20px;
      height: 20px;
    }
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: rgba(255, 68, 68, 0.1);
    color: #ff4444;
    margin: 16px;
    border-radius: 8px;

    svg {
      width: 20px;
      height: 20px;
    }
  }

  .collections-list {
    flex: 1;
    padding: 16px;
    overflow-y: auto;
  }

  .loading-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 32px;
    text-align: center;
    color: rgba(255, 255, 255, 0.7);

    svg {
      width: 32px;
      height: 32px;
    }
  }

  .spinner {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .collection-button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 12px;
    background: rgba(255, 255, 255, 0.05);
    border: none;
    border-radius: 8px;
    color: white;
    cursor: pointer;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.1);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    & + & {
      margin-top: 8px;
    }
  }

  .collection-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .collection-preview {
    width: 48px;
    height: 48px;
    border-radius: 4px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.1);

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .empty-preview {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;

    svg {
      width: 24px;
      height: 24px;
      color: rgba(255, 255, 255, 0.5);
    }
  }

  .collection-details {
    text-align: left;

    h3 {
      font-size: 16px;
      font-weight: 500;
      margin: 0;
    }

    p {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.5);
      margin: 4px 0 0;
    }
  }

  .arrow-icon {
    width: 20px;
    height: 20px;
    color: rgba(255, 255, 255, 0.5);
  }

  .new-collection-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 12px;
    margin-top: 16px;
    background: transparent;
    border: 2px dashed rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      border-color: rgba(255, 255, 255, 0.2);
      color: white;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    svg {
      width: 20px;
      height: 20px;
    }
  }

  .new-collection-form {
    margin-top: 16px;
    padding: 16px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;

    input {
      width: 100%;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.1);
      border: none;
      border-radius: 4px;
      color: white;
      font-size: 14px;

      &:focus {
        outline: none;
        background: rgba(255, 255, 255, 0.15);
      }

      &::placeholder {
        color: rgba(255, 255, 255, 0.5);
      }
    }
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 12px;
  }

  .primary-button,
  .secondary-button {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .primary-button {
    background: var(--primary-color, #00a8ff);
    color: white;

    &:hover:not(:disabled) {
      filter: brightness(1.1);
    }
  }

  .secondary-button {
    background: rgba(255, 255, 255, 0.1);
    color: white;

    &:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.15);
    }
  }
</style> 