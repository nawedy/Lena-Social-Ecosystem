import { api } from './api';
import type { Post, Media, Comment, PaginatedResponse, ApiResponse } from '$lib/types';
import { writable, derived } from 'svelte/store';

interface PostsState {
  posts: Record<string, Post>;
  feedPosts: string[];
  explorePosts: string[];
  userPosts: Record<string, string[]>;
  loading: boolean;
  error: string | null;
}

function createPostsStore() {
  const { subscribe, set, update } = writable<PostsState>({
    posts: {},
    feedPosts: [],
    explorePosts: [],
    userPosts: {},
    loading: false,
    error: null
  });

  return {
    subscribe,
    set,
    update,

    /**
     * Create a new post
     */
    create: async (data: {
      type: Post['type'];
      caption?: string;
      media: File[];
      locationName?: string;
      locationPoint?: { latitude: number; longitude: number };
      privacy?: Post['privacy'];
      monetization?: Post['monetization'];
      price?: number;
    }): Promise<ApiResponse<Post>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        // Upload media files
        const mediaUrls = await Promise.all(
          data.media.map(file => api.uploadFile(file, { path: 'posts' }))
        );

        // Create post
        const { data: post, error } = await api.post<Post>('/posts', {
          ...data,
          media: mediaUrls.map((url, index) => ({
            url,
            type: data.media[index].type,
            position: index
          }))
        });

        if (error) throw error;

        if (post) {
          update(state => ({
            ...state,
            posts: { ...state.posts, [post.id]: post },
            userPosts: {
              ...state.userPosts,
              [post.userId]: [
                ...(state.userPosts[post.userId] || []),
                post.id
              ]
            }
          }));
        }

        return { data: post };
      } catch (error) {
        console.error('Failed to create post:', error);
        update(state => ({ ...state, error: error.message }));
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Get a single post by ID
     */
    get: async (id: string): Promise<ApiResponse<Post>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const { data: post, error } = await api.get<Post>(`/posts/${id}`);
        if (error) throw error;

        if (post) {
          update(state => ({
            ...state,
            posts: { ...state.posts, [post.id]: post }
          }));
        }

        return { data: post };
      } catch (error) {
        console.error('Failed to get post:', error);
        update(state => ({ ...state, error: error.message }));
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Update a post
     */
    update: async (id: string, updates: Partial<Post>): Promise<ApiResponse<Post>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const { data: post, error } = await api.put<Post>(`/posts/${id}`, updates);
        if (error) throw error;

        if (post) {
          update(state => ({
            ...state,
            posts: { ...state.posts, [post.id]: post }
          }));
        }

        return { data: post };
      } catch (error) {
        console.error('Failed to update post:', error);
        update(state => ({ ...state, error: error.message }));
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Delete a post
     */
    delete: async (id: string): Promise<ApiResponse<void>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const { error } = await api.delete<void>(`/posts/${id}`);
        if (error) throw error;

        update(state => {
          const { [id]: deletedPost, ...remainingPosts } = state.posts;
          const userId = deletedPost?.userId;

          return {
            ...state,
            posts: remainingPosts,
            userPosts: userId ? {
              ...state.userPosts,
              [userId]: state.userPosts[userId]?.filter(postId => postId !== id) || []
            } : state.userPosts
          };
        });

        return { error: null };
      } catch (error) {
        console.error('Failed to delete post:', error);
        update(state => ({ ...state, error: error.message }));
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Get user feed
     */
    getFeed: async (params?: {
      page?: number;
      perPage?: number;
    }): Promise<PaginatedResponse<Post>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const response = await api.getPaginated<Post>('/posts/feed', params);

        update(state => ({
          ...state,
          posts: {
            ...state.posts,
            ...Object.fromEntries(response.items.map(post => [post.id, post]))
          },
          feedPosts: response.items.map(post => post.id)
        }));

        return response;
      } catch (error) {
        console.error('Failed to get feed:', error);
        update(state => ({ ...state, error: error.message }));
        throw error;
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Get explore posts
     */
    getExplore: async (params?: {
      page?: number;
      perPage?: number;
    }): Promise<PaginatedResponse<Post>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const response = await api.getPaginated<Post>('/posts/explore', params);

        update(state => ({
          ...state,
          posts: {
            ...state.posts,
            ...Object.fromEntries(response.items.map(post => [post.id, post]))
          },
          explorePosts: response.items.map(post => post.id)
        }));

        return response;
      } catch (error) {
        console.error('Failed to get explore posts:', error);
        update(state => ({ ...state, error: error.message }));
        throw error;
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Get user posts
     */
    getUserPosts: async (userId: string, params?: {
      page?: number;
      perPage?: number;
    }): Promise<PaginatedResponse<Post>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const response = await api.getPaginated<Post>(`/users/${userId}/posts`, params);

        update(state => ({
          ...state,
          posts: {
            ...state.posts,
            ...Object.fromEntries(response.items.map(post => [post.id, post]))
          },
          userPosts: {
            ...state.userPosts,
            [userId]: response.items.map(post => post.id)
          }
        }));

        return response;
      } catch (error) {
        console.error('Failed to get user posts:', error);
        update(state => ({ ...state, error: error.message }));
        throw error;
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Like a post
     */
    like: async (id: string): Promise<ApiResponse<void>> => {
      try {
        const { error } = await api.post<void>(`/posts/${id}/like`);
        if (error) throw error;

        update(state => ({
          ...state,
          posts: {
            ...state.posts,
            [id]: {
              ...state.posts[id],
              likeCount: (state.posts[id]?.likeCount || 0) + 1
            }
          }
        }));

        return { error: null };
      } catch (error) {
        console.error('Failed to like post:', error);
        return { error };
      }
    },

    /**
     * Unlike a post
     */
    unlike: async (id: string): Promise<ApiResponse<void>> => {
      try {
        const { error } = await api.delete<void>(`/posts/${id}/like`);
        if (error) throw error;

        update(state => ({
          ...state,
          posts: {
            ...state.posts,
            [id]: {
              ...state.posts[id],
              likeCount: Math.max(0, (state.posts[id]?.likeCount || 1) - 1)
            }
          }
        }));

        return { error: null };
      } catch (error) {
        console.error('Failed to unlike post:', error);
        return { error };
      }
    },

    /**
     * Add a comment to a post
     */
    comment: async (id: string, content: string): Promise<ApiResponse<Comment>> => {
      try {
        const { data: comment, error } = await api.post<Comment>(`/posts/${id}/comments`, {
          content
        });

        if (error) throw error;

        if (comment) {
          update(state => ({
            ...state,
            posts: {
              ...state.posts,
              [id]: {
                ...state.posts[id],
                commentCount: (state.posts[id]?.commentCount || 0) + 1
              }
            }
          }));
        }

        return { data: comment };
      } catch (error) {
        console.error('Failed to add comment:', error);
        return { error };
      }
    },

    /**
     * Get post comments
     */
    getComments: async (id: string, params?: {
      page?: number;
      perPage?: number;
    }): Promise<PaginatedResponse<Comment>> => {
      try {
        return await api.getPaginated<Comment>(`/posts/${id}/comments`, params);
      } catch (error) {
        console.error('Failed to get comments:', error);
        throw error;
      }
    },

    /**
     * Clear store state
     */
    clear: () => {
      set({
        posts: {},
        feedPosts: [],
        explorePosts: [],
        userPosts: {},
        loading: false,
        error: null
      });
    }
  };
}

// Create posts store instance
export const posts = createPostsStore();

// Derived stores
export const allPosts = derived(posts, $posts => Object.values($posts.posts));
export const feedPosts = derived(posts, $posts => 
  $posts.feedPosts.map(id => $posts.posts[id]).filter(Boolean)
);
export const explorePosts = derived(posts, $posts => 
  $posts.explorePosts.map(id => $posts.posts[id]).filter(Boolean)
);
export const getUserPosts = (userId: string) => derived(posts, $posts => 
  ($posts.userPosts[userId] || []).map(id => $posts.posts[id]).filter(Boolean)
);
export const isLoading = derived(posts, $posts => $posts.loading);
export const error = derived(posts, $posts => $posts.error); 