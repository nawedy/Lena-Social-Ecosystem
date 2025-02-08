import { api } from './api';
import type { Story, StoryView, PaginatedResponse, ApiResponse } from '$lib/types';
import { writable, derived } from 'svelte/store';

interface StoriesState {
  stories: Record<string, Story>;
  userStories: Record<string, string[]>;
  activeStories: string[];
  loading: boolean;
  error: string | null;
}

function createStoriesStore() {
  const { subscribe, set, update } = writable<StoriesState>({
    stories: {},
    userStories: {},
    activeStories: [],
    loading: false,
    error: null
  });

  return {
    subscribe,
    set,
    update,

    /**
     * Create a new story
     */
    create: async (data: {
      media: File;
      duration?: number;
      locationName?: string;
      locationPoint?: { latitude: number; longitude: number };
      privacy?: Story['privacy'];
      filters?: string[];
    }): Promise<ApiResponse<Story>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        // Upload media file
        const mediaUrl = await api.uploadFile(data.media, { path: 'stories' });

        // Create story
        const { data: story, error } = await api.post<Story>('/stories', {
          ...data,
          media: {
            url: mediaUrl,
            type: data.media.type
          }
        });

        if (error) throw error;

        if (story) {
          update(state => ({
            ...state,
            stories: { ...state.stories, [story.id]: story },
            userStories: {
              ...state.userStories,
              [story.userId]: [
                ...(state.userStories[story.userId] || []),
                story.id
              ]
            },
            activeStories: [...state.activeStories, story.id]
          }));
        }

        return { data: story };
      } catch (error) {
        console.error('Failed to create story:', error);
        update(state => ({ ...state, error: error.message }));
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Get a single story by ID
     */
    get: async (id: string): Promise<ApiResponse<Story>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const { data: story, error } = await api.get<Story>(`/stories/${id}`);
        if (error) throw error;

        if (story) {
          update(state => ({
            ...state,
            stories: { ...state.stories, [story.id]: story }
          }));
        }

        return { data: story };
      } catch (error) {
        console.error('Failed to get story:', error);
        update(state => ({ ...state, error: error.message }));
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Delete a story
     */
    delete: async (id: string): Promise<ApiResponse<void>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const { error } = await api.delete<void>(`/stories/${id}`);
        if (error) throw error;

        update(state => {
          const { [id]: deletedStory, ...remainingStories } = state.stories;
          const userId = deletedStory?.userId;

          return {
            ...state,
            stories: remainingStories,
            userStories: userId ? {
              ...state.userStories,
              [userId]: state.userStories[userId]?.filter(storyId => storyId !== id) || []
            } : state.userStories,
            activeStories: state.activeStories.filter(storyId => storyId !== id)
          };
        });

        return { error: null };
      } catch (error) {
        console.error('Failed to delete story:', error);
        update(state => ({ ...state, error: error.message }));
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Get active stories for followed users
     */
    getActiveStories: async (): Promise<PaginatedResponse<Story>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const response = await api.getPaginated<Story>('/stories/active');

        update(state => ({
          ...state,
          stories: {
            ...state.stories,
            ...Object.fromEntries(response.items.map(story => [story.id, story]))
          },
          activeStories: response.items.map(story => story.id)
        }));

        return response;
      } catch (error) {
        console.error('Failed to get active stories:', error);
        update(state => ({ ...state, error: error.message }));
        throw error;
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Get user stories
     */
    getUserStories: async (userId: string): Promise<PaginatedResponse<Story>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const response = await api.getPaginated<Story>(`/users/${userId}/stories`);

        update(state => ({
          ...state,
          stories: {
            ...state.stories,
            ...Object.fromEntries(response.items.map(story => [story.id, story]))
          },
          userStories: {
            ...state.userStories,
            [userId]: response.items.map(story => story.id)
          }
        }));

        return response;
      } catch (error) {
        console.error('Failed to get user stories:', error);
        update(state => ({ ...state, error: error.message }));
        throw error;
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Mark story as viewed
     */
    markViewed: async (id: string): Promise<ApiResponse<StoryView>> => {
      try {
        const { data: view, error } = await api.post<StoryView>(`/stories/${id}/view`);
        if (error) throw error;

        if (view) {
          update(state => ({
            ...state,
            stories: {
              ...state.stories,
              [id]: {
                ...state.stories[id],
                viewCount: (state.stories[id]?.viewCount || 0) + 1,
                viewed: true
              }
            }
          }));
        }

        return { data: view };
      } catch (error) {
        console.error('Failed to mark story as viewed:', error);
        return { error };
      }
    },

    /**
     * Get story views
     */
    getViews: async (id: string, params?: {
      page?: number;
      perPage?: number;
    }): Promise<PaginatedResponse<StoryView>> => {
      try {
        return await api.getPaginated<StoryView>(`/stories/${id}/views`, params);
      } catch (error) {
        console.error('Failed to get story views:', error);
        throw error;
      }
    },

    /**
     * Clear store state
     */
    clear: () => {
      set({
        stories: {},
        userStories: {},
        activeStories: [],
        loading: false,
        error: null
      });
    }
  };
}

// Create stories store instance
export const stories = createStoriesStore();

// Derived stores
export const allStories = derived(stories, $stories => Object.values($stories.stories));
export const activeStories = derived(stories, $stories => 
  $stories.activeStories.map(id => $stories.stories[id]).filter(Boolean)
);
export const getUserStories = (userId: string) => derived(stories, $stories => 
  ($stories.userStories[userId] || []).map(id => $stories.stories[id]).filter(Boolean)
);
export const isLoading = derived(stories, $stories => $stories.loading);
export const error = derived(stories, $stories => $stories.error); 