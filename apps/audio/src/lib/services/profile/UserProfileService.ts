import { browser } from '$app/environment';
import { writable, derived } from 'svelte/store';
import { supabase } from '$lib/supabaseClient';

interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  coverUrl: string;
  email: string;
  isVerified: boolean;
  isCreator: boolean;
  createdAt: string;
  updatedAt: string;
  stats: UserStats;
  preferences: UserPreferences;
  social: SocialConnections;
  badges: UserBadge[];
}

interface UserStats {
  followers: number;
  following: number;
  playlists: number;
  favorites: number;
  totalListeningTime: number;
  podcastsPublished: number;
  tracksPublished: number;
  averageRating: number;
}

interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  audioQuality: 'auto' | 'low' | 'medium' | 'high';
  downloadQuality: 'low' | 'medium' | 'high';
  autoplay: boolean;
  crossfade: boolean;
  crossfadeDuration: number;
  notifications: {
    newFollowers: boolean;
    newComments: boolean;
    newLikes: boolean;
    newReleases: boolean;
    recommendations: boolean;
    email: boolean;
    push: boolean;
  };
  privacy: {
    profileVisibility: 'public' | 'private' | 'followers';
    activityVisibility: 'public' | 'private' | 'followers';
    showListeningHistory: boolean;
    showPlaylists: boolean;
  };
  genres: string[];
  blockedUsers: string[];
}

interface SocialConnections {
  followers: string[];
  following: string[];
  blocked: string[];
  collaborators: string[];
}

interface UserBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: string;
  category: 'achievement' | 'creator' | 'supporter' | 'special';
}

interface ProfileUpdate {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  coverUrl?: string;
  preferences?: Partial<UserPreferences>;
}

export class UserProfileService {
  private static instance: UserProfileService;
  private profile = writable<UserProfile | null>(null);
  private loading = writable(true);
  private error = writable<string | null>(null);
  private realtimeSubscription: any = null;

  private constructor() {
    if (browser) {
      this.init();
    }
  }

  static getInstance(): UserProfileService {
    if (!UserProfileService.instance) {
      UserProfileService.instance = new UserProfileService();
    }
    return UserProfileService.instance;
  }

  private async init() {
    try {
      // Get initial session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await this.loadProfile(session.user.id);
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          await this.loadProfile(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          this.profile.set(null);
        }
      });

      // Setup realtime subscription
      this.setupRealtimeSubscription();
    } catch (error) {
      console.error('Profile initialization failed:', error);
      this.error.set('Failed to initialize profile');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadProfile(userId: string) {
    try {
      this.loading.set(true);
      this.error.set(null);

      // Get profile data
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      // Get stats
      const stats = await this.loadUserStats(userId);

      // Get social connections
      const social = await this.loadSocialConnections(userId);

      // Get badges
      const badges = await this.loadUserBadges(userId);

      this.profile.set({
        ...profile,
        stats,
        social,
        badges
      });
    } catch (error) {
      console.error('Failed to load profile:', error);
      this.error.set('Failed to load profile');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadUserStats(userId: string): Promise<UserStats> {
    const { data: stats } = await supabase
      .rpc('get_user_stats', { user_id: userId });

    return stats || {
      followers: 0,
      following: 0,
      playlists: 0,
      favorites: 0,
      totalListeningTime: 0,
      podcastsPublished: 0,
      tracksPublished: 0,
      averageRating: 0
    };
  }

  private async loadSocialConnections(userId: string): Promise<SocialConnections> {
    const { data: social } = await supabase
      .from('social_connections')
      .select('*')
      .eq('user_id', userId)
      .single();

    return social || {
      followers: [],
      following: [],
      blocked: [],
      collaborators: []
    };
  }

  private async loadUserBadges(userId: string): Promise<UserBadge[]> {
    const { data: badges } = await supabase
      .from('user_badges')
      .select('*')
      .eq('user_id', userId);

    return badges || [];
  }

  private setupRealtimeSubscription() {
    const profile = this.getProfile();
    if (!profile) return;

    this.realtimeSubscription = supabase
      .channel(`profile:${profile.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'user_profiles',
        filter: `id=eq.${profile.id}`
      }, async (payload) => {
        await this.loadProfile(profile.id);
      })
      .subscribe();
  }

  // Public methods
  async updateProfile(updates: ProfileUpdate): Promise<void> {
    const profile = this.getProfile();
    if (!profile) throw new Error('No profile loaded');

    try {
      this.loading.set(true);
      this.error.set(null);

      const { error } = await supabase
        .from('user_profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id);

      if (error) throw error;

      // Reload profile to get updated data
      await this.loadProfile(profile.id);
    } catch (error) {
      console.error('Failed to update profile:', error);
      this.error.set('Failed to update profile');
      throw error;
    } finally {
      this.loading.set(false);
    }
  }

  async updatePreferences(preferences: Partial<UserPreferences>): Promise<void> {
    const profile = this.getProfile();
    if (!profile) throw new Error('No profile loaded');

    try {
      this.loading.set(true);
      this.error.set(null);

      const updatedPreferences = {
        ...profile.preferences,
        ...preferences
      };

      const { error } = await supabase
        .from('user_profiles')
        .update({
          preferences: updatedPreferences,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id);

      if (error) throw error;

      // Update local state
      this.profile.update(p => p ? {
        ...p,
        preferences: updatedPreferences
      } : null);
    } catch (error) {
      console.error('Failed to update preferences:', error);
      this.error.set('Failed to update preferences');
      throw error;
    } finally {
      this.loading.set(false);
    }
  }

  async followUser(userId: string): Promise<void> {
    const profile = this.getProfile();
    if (!profile) throw new Error('No profile loaded');

    try {
      this.loading.set(true);
      this.error.set(null);

      const { error } = await supabase
        .from('social_connections')
        .upsert({
          user_id: profile.id,
          following: [...profile.social.following, userId]
        });

      if (error) throw error;

      // Reload social connections
      const social = await this.loadSocialConnections(profile.id);
      this.profile.update(p => p ? { ...p, social } : null);
    } catch (error) {
      console.error('Failed to follow user:', error);
      this.error.set('Failed to follow user');
      throw error;
    } finally {
      this.loading.set(false);
    }
  }

  async unfollowUser(userId: string): Promise<void> {
    const profile = this.getProfile();
    if (!profile) throw new Error('No profile loaded');

    try {
      this.loading.set(true);
      this.error.set(null);

      const { error } = await supabase
        .from('social_connections')
        .upsert({
          user_id: profile.id,
          following: profile.social.following.filter(id => id !== userId)
        });

      if (error) throw error;

      // Reload social connections
      const social = await this.loadSocialConnections(profile.id);
      this.profile.update(p => p ? { ...p, social } : null);
    } catch (error) {
      console.error('Failed to unfollow user:', error);
      this.error.set('Failed to unfollow user');
      throw error;
    } finally {
      this.loading.set(false);
    }
  }

  async blockUser(userId: string): Promise<void> {
    const profile = this.getProfile();
    if (!profile) throw new Error('No profile loaded');

    try {
      this.loading.set(true);
      this.error.set(null);

      // Add to blocked list
      const { error: blockError } = await supabase
        .from('social_connections')
        .upsert({
          user_id: profile.id,
          blocked: [...profile.social.blocked, userId]
        });

      if (blockError) throw blockError;

      // Remove from following/followers if present
      const { error: updateError } = await supabase
        .from('social_connections')
        .upsert({
          user_id: profile.id,
          following: profile.social.following.filter(id => id !== userId),
          followers: profile.social.followers.filter(id => id !== userId)
        });

      if (updateError) throw updateError;

      // Update preferences
      await this.updatePreferences({
        blockedUsers: [...profile.preferences.blockedUsers, userId]
      });

      // Reload social connections
      const social = await this.loadSocialConnections(profile.id);
      this.profile.update(p => p ? { ...p, social } : null);
    } catch (error) {
      console.error('Failed to block user:', error);
      this.error.set('Failed to block user');
      throw error;
    } finally {
      this.loading.set(false);
    }
  }

  async unblockUser(userId: string): Promise<void> {
    const profile = this.getProfile();
    if (!profile) throw new Error('No profile loaded');

    try {
      this.loading.set(true);
      this.error.set(null);

      const { error } = await supabase
        .from('social_connections')
        .upsert({
          user_id: profile.id,
          blocked: profile.social.blocked.filter(id => id !== userId)
        });

      if (error) throw error;

      // Update preferences
      await this.updatePreferences({
        blockedUsers: profile.preferences.blockedUsers.filter(id => id !== userId)
      });

      // Reload social connections
      const social = await this.loadSocialConnections(profile.id);
      this.profile.update(p => p ? { ...p, social } : null);
    } catch (error) {
      console.error('Failed to unblock user:', error);
      this.error.set('Failed to unblock user');
      throw error;
    } finally {
      this.loading.set(false);
    }
  }

  // Store accessors
  getProfile(): UserProfile | null {
    let currentProfile: UserProfile | null = null;
    this.profile.subscribe(value => {
      currentProfile = value;
    })();
    return currentProfile;
  }

  subscribe(callback: (profile: UserProfile | null) => void) {
    return this.profile.subscribe(callback);
  }

  isLoading() {
    return this.loading;
  }

  getError() {
    return this.error;
  }

  // Derived stores
  isAuthenticated = derived(this.profile, $profile => !!$profile);
  isCreator = derived(this.profile, $profile => $profile?.isCreator || false);
  username = derived(this.profile, $profile => $profile?.username || '');
  displayName = derived(this.profile, $profile => $profile?.displayName || '');
  avatarUrl = derived(this.profile, $profile => $profile?.avatarUrl || '');
  preferences = derived(this.profile, $profile => $profile?.preferences);
  stats = derived(this.profile, $profile => $profile?.stats);
  social = derived(this.profile, $profile => $profile?.social);
  badges = derived(this.profile, $profile => $profile?.badges || []);

  cleanup() {
    if (this.realtimeSubscription) {
      this.realtimeSubscription.unsubscribe();
    }
  }
}

export const userProfileService = UserProfileService.getInstance(); 