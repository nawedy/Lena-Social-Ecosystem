import { api } from './api';
import type { ApiResponse } from '$lib/types';
import { writable, derived } from 'svelte/store';
import { config } from './config';

interface SocialProfile {
  id: string;
  platform: 'atproto' | 'activitypub' | 'nostr';
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  following: number;
  followers: number;
  connected: boolean;
  lastSync?: string;
}

interface SocialPost {
  id: string;
  platform: 'atproto' | 'activitypub' | 'nostr';
  content: string;
  attachments?: Array<{
    type: string;
    url: string;
    alt?: string;
  }>;
  createdAt: string;
  engagement: {
    likes: number;
    reposts: number;
    replies: number;
  };
  originalId: string;
  originalUrl: string;
}

interface SocialState {
  profiles: Record<string, SocialProfile>;
  posts: Record<string, SocialPost[]>;
  loading: boolean;
  error: string | null;
}

function createSocialStore() {
  const { subscribe, set, update } = writable<SocialState>({
    profiles: {},
    posts: {},
    loading: false,
    error: null
  });

  return {
    subscribe,
    set,
    update,

    /**
     * Connect social profile
     */
    connectProfile: async (platform: SocialProfile['platform'], data: {
      handle: string;
      accessToken: string;
    }): Promise<ApiResponse<SocialProfile>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const { data: profile, error } = await api.post<SocialProfile>(`/social/${platform}/connect`, data);
        if (error) throw error;

        if (profile) {
          update(state => ({
            ...state,
            profiles: { ...state.profiles, [profile.id]: profile }
          }));
        }

        return { data: profile };
      } catch (error) {
        console.error('Failed to connect profile:', error);
        update(state => ({ ...state, error: error.message }));
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Disconnect social profile
     */
    disconnectProfile: async (platform: SocialProfile['platform'], profileId: string): Promise<ApiResponse<void>> => {
      try {
        const { error } = await api.delete<void>(`/social/${platform}/disconnect/${profileId}`);
        if (error) throw error;

        update(state => {
          const { [profileId]: removedProfile, ...remainingProfiles } = state.profiles;
          return {
            ...state,
            profiles: remainingProfiles
          };
        });

        return { error: null };
      } catch (error) {
        console.error('Failed to disconnect profile:', error);
        return { error };
      }
    },

    /**
     * Get connected profiles
     */
    getProfiles: async (): Promise<ApiResponse<SocialProfile[]>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const { data: profiles, error } = await api.get<SocialProfile[]>('/social/profiles');
        if (error) throw error;

        if (profiles) {
          update(state => ({
            ...state,
            profiles: Object.fromEntries(profiles.map(profile => [profile.id, profile]))
          }));
        }

        return { data: profiles };
      } catch (error) {
        console.error('Failed to get profiles:', error);
        update(state => ({ ...state, error: error.message }));
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Cross-post content to social platforms
     */
    crossPost: async (data: {
      content: string;
      attachments?: Array<{
        type: string;
        url: string;
        alt?: string;
      }>;
      platforms: SocialProfile['platform'][];
    }): Promise<ApiResponse<SocialPost[]>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const { data: posts, error } = await api.post<SocialPost[]>('/social/cross-post', data);
        if (error) throw error;

        if (posts) {
          update(state => ({
            ...state,
            posts: {
              ...state.posts,
              ...Object.fromEntries(posts.map(post => [post.platform, [post]]))
            }
          }));
        }

        return { data: posts };
      } catch (error) {
        console.error('Failed to cross-post:', error);
        update(state => ({ ...state, error: error.message }));
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Get posts from social platforms
     */
    getPosts: async (platform: SocialProfile['platform'], params?: {
      profileId?: string;
      startDate?: string;
      endDate?: string;
    }): Promise<ApiResponse<SocialPost[]>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const { data: posts, error } = await api.get<SocialPost[]>(`/social/${platform}/posts`, params);
        if (error) throw error;

        if (posts) {
          update(state => ({
            ...state,
            posts: {
              ...state.posts,
              [platform]: posts
            }
          }));
        }

        return { data: posts };
      } catch (error) {
        console.error('Failed to get posts:', error);
        update(state => ({ ...state, error: error.message }));
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Sync social profile data
     */
    syncProfile: async (platform: SocialProfile['platform'], profileId: string): Promise<ApiResponse<SocialProfile>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const { data: profile, error } = await api.post<SocialProfile>(`/social/${platform}/sync/${profileId}`);
        if (error) throw error;

        if (profile) {
          update(state => ({
            ...state,
            profiles: { ...state.profiles, [profile.id]: profile }
          }));
        }

        return { data: profile };
      } catch (error) {
        console.error('Failed to sync profile:', error);
        update(state => ({ ...state, error: error.message }));
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Get engagement metrics for social posts
     */
    getEngagement: async (platform: SocialProfile['platform'], postIds: string[]): Promise<ApiResponse<Record<string, SocialPost['engagement']>>> => {
      try {
        const { data: engagement, error } = await api.post<Record<string, SocialPost['engagement']>>(`/social/${platform}/engagement`, { postIds });
        if (error) throw error;

        if (engagement) {
          update(state => ({
            ...state,
            posts: {
              ...state.posts,
              [platform]: (state.posts[platform] || []).map(post => ({
                ...post,
                engagement: engagement[post.id] || post.engagement
              }))
            }
          }));
        }

        return { data: engagement };
      } catch (error) {
        console.error('Failed to get engagement:', error);
        return { error };
      }
    },

    /**
     * Clear store state
     */
    clear: () => {
      set({
        profiles: {},
        posts: {},
        loading: false,
        error: null
      });
    }
  };
}

// Create social store instance
export const social = createSocialStore();

// Derived stores
export const profiles = derived(social, $social => Object.values($social.profiles));
export const getProfilesByPlatform = (platform: SocialProfile['platform']) => derived(social, $social => 
  Object.values($social.profiles).filter(profile => profile.platform === platform)
);
export const getPostsByPlatform = (platform: SocialProfile['platform']) => derived(social, $social => 
  $social.posts[platform] || []
);
export const isLoading = derived(social, $social => $social.loading);
export const error = derived(social, $social => $social.error);

// Helper functions
export function isProfileConnected(platform: SocialProfile['platform']): boolean {
  return profiles?.some(profile => profile.platform === platform && profile.connected) || false;
}

export function getProfileHandle(platform: SocialProfile['platform']): string | null {
  const profile = profiles?.find(p => p.platform === platform && p.connected);
  return profile?.handle || null;
}

export function getTotalEngagement(platform: SocialProfile['platform']): {
  likes: number;
  reposts: number;
  replies: number;
} {
  const posts = getPostsByPlatform(platform);
  return posts.reduce((total, post) => ({
    likes: total.likes + post.engagement.likes,
    reposts: total.reposts + post.engagement.reposts,
    replies: total.replies + post.engagement.replies
  }), { likes: 0, reposts: 0, replies: 0 });
} 