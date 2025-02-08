import { api } from './api';
import type { Collection, CollectionItem, Post, PaginatedResponse, ApiResponse } from '$lib/types';
import { writable, derived } from 'svelte/store';

interface CollectionsState {
  collections: Record<string, Collection>;
  userCollections: Record<string, string[]>;
  collectionItems: Record<string, string[]>;
  loading: boolean;
  error: string | null;
}

function createCollectionsStore() {
  const { subscribe, set, update } = writable<CollectionsState>({
    collections: {},
    userCollections: {},
    collectionItems: {},
    loading: false,
    error: null
  });

  return {
    subscribe,
    set,
    update,

    /**
     * Create a new collection
     */
    create: async (data: {
      name: string;
      description?: string;
      privacy?: Collection['privacy'];
      thumbnail?: File;
    }): Promise<ApiResponse<Collection>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        let thumbnailUrl: string | undefined;
        if (data.thumbnail) {
          thumbnailUrl = await api.uploadFile(data.thumbnail, { path: 'collections' });
        }

        const { data: collection, error } = await api.post<Collection>('/collections', {
          ...data,
          thumbnailUrl
        });

        if (error) throw error;

        if (collection) {
          update(state => ({
            ...state,
            collections: { ...state.collections, [collection.id]: collection },
            userCollections: {
              ...state.userCollections,
              [collection.userId]: [
                ...(state.userCollections[collection.userId] || []),
                collection.id
              ]
            }
          }));
        }

        return { data: collection };
      } catch (error) {
        console.error('Failed to create collection:', error);
        update(state => ({ ...state, error: error.message }));
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Get a single collection by ID
     */
    get: async (id: string): Promise<ApiResponse<Collection>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const { data: collection, error } = await api.get<Collection>(`/collections/${id}`);
        if (error) throw error;

        if (collection) {
          update(state => ({
            ...state,
            collections: { ...state.collections, [collection.id]: collection }
          }));
        }

        return { data: collection };
      } catch (error) {
        console.error('Failed to get collection:', error);
        update(state => ({ ...state, error: error.message }));
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Update a collection
     */
    update: async (id: string, updates: {
      name?: string;
      description?: string;
      privacy?: Collection['privacy'];
      thumbnail?: File;
    }): Promise<ApiResponse<Collection>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        let thumbnailUrl: string | undefined;
        if (updates.thumbnail) {
          thumbnailUrl = await api.uploadFile(updates.thumbnail, { path: 'collections' });
        }

        const { data: collection, error } = await api.put<Collection>(`/collections/${id}`, {
          ...updates,
          thumbnailUrl
        });

        if (error) throw error;

        if (collection) {
          update(state => ({
            ...state,
            collections: { ...state.collections, [collection.id]: collection }
          }));
        }

        return { data: collection };
      } catch (error) {
        console.error('Failed to update collection:', error);
        update(state => ({ ...state, error: error.message }));
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Delete a collection
     */
    delete: async (id: string): Promise<ApiResponse<void>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const { error } = await api.delete<void>(`/collections/${id}`);
        if (error) throw error;

        update(state => {
          const { [id]: deletedCollection, ...remainingCollections } = state.collections;
          const userId = deletedCollection?.userId;

          return {
            ...state,
            collections: remainingCollections,
            userCollections: userId ? {
              ...state.userCollections,
              [userId]: state.userCollections[userId]?.filter(collectionId => collectionId !== id) || []
            } : state.userCollections,
            collectionItems: {
              ...state.collectionItems,
              [id]: []
            }
          };
        });

        return { error: null };
      } catch (error) {
        console.error('Failed to delete collection:', error);
        update(state => ({ ...state, error: error.message }));
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Get user collections
     */
    getUserCollections: async (userId: string): Promise<PaginatedResponse<Collection>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const response = await api.getPaginated<Collection>(`/users/${userId}/collections`);

        update(state => ({
          ...state,
          collections: {
            ...state.collections,
            ...Object.fromEntries(response.items.map(collection => [collection.id, collection]))
          },
          userCollections: {
            ...state.userCollections,
            [userId]: response.items.map(collection => collection.id)
          }
        }));

        return response;
      } catch (error) {
        console.error('Failed to get user collections:', error);
        update(state => ({ ...state, error: error.message }));
        throw error;
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Add post to collection
     */
    addPost: async (collectionId: string, postId: string): Promise<ApiResponse<CollectionItem>> => {
      try {
        const { data: item, error } = await api.post<CollectionItem>(`/collections/${collectionId}/items`, {
          postId
        });

        if (error) throw error;

        if (item) {
          update(state => ({
            ...state,
            collectionItems: {
              ...state.collectionItems,
              [collectionId]: [
                ...(state.collectionItems[collectionId] || []),
                item.postId
              ]
            }
          }));
        }

        return { data: item };
      } catch (error) {
        console.error('Failed to add post to collection:', error);
        return { error };
      }
    },

    /**
     * Remove post from collection
     */
    removePost: async (collectionId: string, postId: string): Promise<ApiResponse<void>> => {
      try {
        const { error } = await api.delete<void>(`/collections/${collectionId}/items/${postId}`);
        if (error) throw error;

        update(state => ({
          ...state,
          collectionItems: {
            ...state.collectionItems,
            [collectionId]: state.collectionItems[collectionId]?.filter(id => id !== postId) || []
          }
        }));

        return { error: null };
      } catch (error) {
        console.error('Failed to remove post from collection:', error);
        return { error };
      }
    },

    /**
     * Get collection posts
     */
    getPosts: async (collectionId: string, params?: {
      page?: number;
      perPage?: number;
    }): Promise<PaginatedResponse<Post>> => {
      try {
        const response = await api.getPaginated<Post>(`/collections/${collectionId}/posts`, params);

        update(state => ({
          ...state,
          collectionItems: {
            ...state.collectionItems,
            [collectionId]: response.items.map(post => post.id)
          }
        }));

        return response;
      } catch (error) {
        console.error('Failed to get collection posts:', error);
        throw error;
      }
    },

    /**
     * Clear store state
     */
    clear: () => {
      set({
        collections: {},
        userCollections: {},
        collectionItems: {},
        loading: false,
        error: null
      });
    }
  };
}

// Create collections store instance
export const collections = createCollectionsStore();

// Derived stores
export const allCollections = derived(collections, $collections => Object.values($collections.collections));
export const getUserCollections = (userId: string) => derived(collections, $collections => 
  ($collections.userCollections[userId] || []).map(id => $collections.collections[id]).filter(Boolean)
);
export const getCollectionPosts = (collectionId: string) => derived(collections, $collections => 
  ($collections.collectionItems[collectionId] || [])
);
export const isLoading = derived(collections, $collections => $collections.loading);
export const error = derived(collections, $collections => $collections.error); 