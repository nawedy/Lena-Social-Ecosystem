import { browser } from '$app/environment';
import { writable, derived } from 'svelte/store';
import { supabase } from '$lib/supabaseClient';
import { userProfileService } from '../profile/UserProfileService';

interface Comment {
  id: string;
  userId: string;
  contentId: string;
  contentType: 'track' | 'podcast' | 'playlist' | 'album';
  text: string;
  timestamp?: number;
  parentId?: string;
  likes: number;
  replies: number;
  isEdited: boolean;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  user: {
    username: string;
    displayName: string;
    avatarUrl: string;
  };
}

interface Like {
  id: string;
  userId: string;
  contentId: string;
  contentType: 'track' | 'podcast' | 'playlist' | 'album' | 'comment';
  createdAt: string;
}

interface Share {
  id: string;
  userId: string;
  contentId: string;
  contentType: 'track' | 'podcast' | 'playlist' | 'album';
  platform: 'internal' | 'twitter' | 'facebook' | 'whatsapp' | 'copy';
  createdAt: string;
}

interface Playlist {
  id: string;
  userId: string;
  title: string;
  description: string;
  coverUrl: string;
  isPrivate: boolean;
  isCollaborative: boolean;
  collaborators: string[];
  followers: number;
  tracks: string[];
  duration: number;
  createdAt: string;
  updatedAt: string;
}

interface Activity {
  id: string;
  userId: string;
  type: 'like' | 'comment' | 'share' | 'follow' | 'playlist' | 'listen';
  contentId: string;
  contentType: 'track' | 'podcast' | 'playlist' | 'album' | 'user';
  metadata?: Record<string, any>;
  createdAt: string;
}

export class SocialService {
  private static instance: SocialService;
  private comments = writable<Record<string, Comment[]>>({});
  private likes = writable<Record<string, Like[]>>({});
  private shares = writable<Record<string, Share[]>>({});
  private playlists = writable<Record<string, Playlist>>({});
  private activities = writable<Activity[]>([]);
  private loading = writable(false);
  private error = writable<string | null>(null);
  private realtimeSubscription: any = null;

  private constructor() {
    if (browser) {
      this.init();
    }
  }

  static getInstance(): SocialService {
    if (!SocialService.instance) {
      SocialService.instance = new SocialService();
    }
    return SocialService.instance;
  }

  private async init() {
    try {
      // Setup realtime subscriptions
      this.setupRealtimeSubscription();

      // Load initial data for current user
      const profile = userProfileService.getProfile();
      if (profile) {
        await this.loadUserPlaylists(profile.id);
        await this.loadUserActivities(profile.id);
      }
    } catch (error) {
      console.error('Social service initialization failed:', error);
      this.error.set('Failed to initialize social features');
    }
  }

  private setupRealtimeSubscription() {
    this.realtimeSubscription = supabase
      .channel('social_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'comments'
      }, payload => this.handleCommentChange(payload))
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'likes'
      }, payload => this.handleLikeChange(payload))
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'playlists'
      }, payload => this.handlePlaylistChange(payload))
      .subscribe();
  }

  private async handleCommentChange(payload: any) {
    const { eventType, new: newComment, old: oldComment } = payload;
    
    this.comments.update(comments => {
      const contentId = newComment?.contentId || oldComment?.contentId;
      const contentComments = [...(comments[contentId] || [])];

      switch (eventType) {
        case 'INSERT':
          contentComments.push(newComment);
          break;
        case 'UPDATE':
          const index = contentComments.findIndex(c => c.id === newComment.id);
          if (index !== -1) {
            contentComments[index] = newComment;
          }
          break;
        case 'DELETE':
          const deleteIndex = contentComments.findIndex(c => c.id === oldComment.id);
          if (deleteIndex !== -1) {
            contentComments.splice(deleteIndex, 1);
          }
          break;
      }

      return {
        ...comments,
        [contentId]: contentComments
      };
    });
  }

  private async handleLikeChange(payload: any) {
    const { eventType, new: newLike, old: oldLike } = payload;
    
    this.likes.update(likes => {
      const contentId = newLike?.contentId || oldLike?.contentId;
      const contentLikes = [...(likes[contentId] || [])];

      switch (eventType) {
        case 'INSERT':
          contentLikes.push(newLike);
          break;
        case 'DELETE':
          const deleteIndex = contentLikes.findIndex(l => l.id === oldLike.id);
          if (deleteIndex !== -1) {
            contentLikes.splice(deleteIndex, 1);
          }
          break;
      }

      return {
        ...likes,
        [contentId]: contentLikes
      };
    });
  }

  private async handlePlaylistChange(payload: any) {
    const { eventType, new: newPlaylist, old: oldPlaylist } = payload;
    
    this.playlists.update(playlists => {
      switch (eventType) {
        case 'INSERT':
        case 'UPDATE':
          return {
            ...playlists,
            [newPlaylist.id]: newPlaylist
          };
        case 'DELETE':
          const { [oldPlaylist.id]: _, ...rest } = playlists;
          return rest;
      }
      return playlists;
    });
  }

  // Comments
  async loadComments(contentId: string, contentType: string): Promise<void> {
    try {
      this.loading.set(true);
      this.error.set(null);

      const { data: comments, error } = await supabase
        .from('comments')
        .select(`
          *,
          user:user_profiles (
            username,
            displayName,
            avatarUrl
          )
        `)
        .eq('content_id', contentId)
        .eq('content_type', contentType)
        .order('created_at', { ascending: false });

      if (error) throw error;

      this.comments.update(state => ({
        ...state,
        [contentId]: comments
      }));
    } catch (error) {
      console.error('Failed to load comments:', error);
      this.error.set('Failed to load comments');
    } finally {
      this.loading.set(false);
    }
  }

  async addComment(contentId: string, contentType: string, text: string, timestamp?: number): Promise<Comment> {
    const profile = userProfileService.getProfile();
    if (!profile) throw new Error('User not authenticated');

    try {
      this.loading.set(true);
      this.error.set(null);

      const { data: comment, error } = await supabase
        .from('comments')
        .insert({
          user_id: profile.id,
          content_id: contentId,
          content_type: contentType,
          text,
          timestamp,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Track activity
      await this.trackActivity({
        type: 'comment',
        contentId,
        contentType,
        metadata: { commentId: comment.id }
      });

      return comment;
    } catch (error) {
      console.error('Failed to add comment:', error);
      this.error.set('Failed to add comment');
      throw error;
    } finally {
      this.loading.set(false);
    }
  }

  async updateComment(commentId: string, text: string): Promise<void> {
    try {
      this.loading.set(true);
      this.error.set(null);

      const { error } = await supabase
        .from('comments')
        .update({
          text,
          is_edited: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', commentId);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to update comment:', error);
      this.error.set('Failed to update comment');
      throw error;
    } finally {
      this.loading.set(false);
    }
  }

  async deleteComment(commentId: string): Promise<void> {
    try {
      this.loading.set(true);
      this.error.set(null);

      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to delete comment:', error);
      this.error.set('Failed to delete comment');
      throw error;
    } finally {
      this.loading.set(false);
    }
  }

  // Likes
  async loadLikes(contentId: string, contentType: string): Promise<void> {
    try {
      this.loading.set(true);
      this.error.set(null);

      const { data: likes, error } = await supabase
        .from('likes')
        .select('*')
        .eq('content_id', contentId)
        .eq('content_type', contentType);

      if (error) throw error;

      this.likes.update(state => ({
        ...state,
        [contentId]: likes
      }));
    } catch (error) {
      console.error('Failed to load likes:', error);
      this.error.set('Failed to load likes');
    } finally {
      this.loading.set(false);
    }
  }

  async toggleLike(contentId: string, contentType: string): Promise<void> {
    const profile = userProfileService.getProfile();
    if (!profile) throw new Error('User not authenticated');

    try {
      this.loading.set(true);
      this.error.set(null);

      const { data: existingLike } = await supabase
        .from('likes')
        .select('id')
        .eq('user_id', profile.id)
        .eq('content_id', contentId)
        .eq('content_type', contentType)
        .single();

      if (existingLike) {
        // Unlike
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('id', existingLike.id);

        if (error) throw error;
      } else {
        // Like
        const { error } = await supabase
          .from('likes')
          .insert({
            user_id: profile.id,
            content_id: contentId,
            content_type: contentType,
            created_at: new Date().toISOString()
          });

        if (error) throw error;

        // Track activity
        await this.trackActivity({
          type: 'like',
          contentId,
          contentType
        });
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);
      this.error.set('Failed to toggle like');
      throw error;
    } finally {
      this.loading.set(false);
    }
  }

  // Shares
  async shareContent(contentId: string, contentType: string, platform: Share['platform']): Promise<void> {
    const profile = userProfileService.getProfile();
    if (!profile) throw new Error('User not authenticated');

    try {
      this.loading.set(true);
      this.error.set(null);

      // Record share
      const { error } = await supabase
        .from('shares')
        .insert({
          user_id: profile.id,
          content_id: contentId,
          content_type: contentType,
          platform,
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      // Track activity
      await this.trackActivity({
        type: 'share',
        contentId,
        contentType,
        metadata: { platform }
      });
    } catch (error) {
      console.error('Failed to record share:', error);
      this.error.set('Failed to record share');
      throw error;
    } finally {
      this.loading.set(false);
    }
  }

  // Playlists
  async loadUserPlaylists(userId: string): Promise<void> {
    try {
      this.loading.set(true);
      this.error.set(null);

      const { data: playlists, error } = await supabase
        .from('playlists')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      const playlistsMap = playlists.reduce((acc, playlist) => ({
        ...acc,
        [playlist.id]: playlist
      }), {});

      this.playlists.set(playlistsMap);
    } catch (error) {
      console.error('Failed to load playlists:', error);
      this.error.set('Failed to load playlists');
    } finally {
      this.loading.set(false);
    }
  }

  async createPlaylist(data: Partial<Playlist>): Promise<Playlist> {
    const profile = userProfileService.getProfile();
    if (!profile) throw new Error('User not authenticated');

    try {
      this.loading.set(true);
      this.error.set(null);

      const { data: playlist, error } = await supabase
        .from('playlists')
        .insert({
          user_id: profile.id,
          ...data,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Track activity
      await this.trackActivity({
        type: 'playlist',
        contentId: playlist.id,
        contentType: 'playlist',
        metadata: { action: 'create' }
      });

      return playlist;
    } catch (error) {
      console.error('Failed to create playlist:', error);
      this.error.set('Failed to create playlist');
      throw error;
    } finally {
      this.loading.set(false);
    }
  }

  async updatePlaylist(playlistId: string, updates: Partial<Playlist>): Promise<void> {
    try {
      this.loading.set(true);
      this.error.set(null);

      const { error } = await supabase
        .from('playlists')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', playlistId);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to update playlist:', error);
      this.error.set('Failed to update playlist');
      throw error;
    } finally {
      this.loading.set(false);
    }
  }

  async deletePlaylist(playlistId: string): Promise<void> {
    try {
      this.loading.set(true);
      this.error.set(null);

      const { error } = await supabase
        .from('playlists')
        .delete()
        .eq('id', playlistId);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to delete playlist:', error);
      this.error.set('Failed to delete playlist');
      throw error;
    } finally {
      this.loading.set(false);
    }
  }

  async addToPlaylist(playlistId: string, trackId: string): Promise<void> {
    try {
      this.loading.set(true);
      this.error.set(null);

      const playlist = await this.getPlaylist(playlistId);
      if (!playlist) throw new Error('Playlist not found');

      const { error } = await supabase
        .from('playlists')
        .update({
          tracks: [...playlist.tracks, trackId],
          updated_at: new Date().toISOString()
        })
        .eq('id', playlistId);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to add to playlist:', error);
      this.error.set('Failed to add to playlist');
      throw error;
    } finally {
      this.loading.set(false);
    }
  }

  async removeFromPlaylist(playlistId: string, trackId: string): Promise<void> {
    try {
      this.loading.set(true);
      this.error.set(null);

      const playlist = await this.getPlaylist(playlistId);
      if (!playlist) throw new Error('Playlist not found');

      const { error } = await supabase
        .from('playlists')
        .update({
          tracks: playlist.tracks.filter(id => id !== trackId),
          updated_at: new Date().toISOString()
        })
        .eq('id', playlistId);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to remove from playlist:', error);
      this.error.set('Failed to remove from playlist');
      throw error;
    } finally {
      this.loading.set(false);
    }
  }

  // Activities
  private async loadUserActivities(userId: string): Promise<void> {
    try {
      const { data: activities, error } = await supabase
        .from('activities')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      this.activities.set(activities);
    } catch (error) {
      console.error('Failed to load activities:', error);
    }
  }

  private async trackActivity(activity: Omit<Activity, 'id' | 'userId' | 'createdAt'>): Promise<void> {
    const profile = userProfileService.getProfile();
    if (!profile) return;

    try {
      const { error } = await supabase
        .from('activities')
        .insert({
          user_id: profile.id,
          ...activity,
          created_at: new Date().toISOString()
        });

      if (error) throw error;
    } catch (error) {
      console.error('Failed to track activity:', error);
    }
  }

  // Store accessors
  getComments(contentId: string): Comment[] {
    let contentComments: Comment[] = [];
    this.comments.subscribe(comments => {
      contentComments = comments[contentId] || [];
    })();
    return contentComments;
  }

  getLikes(contentId: string): Like[] {
    let contentLikes: Like[] = [];
    this.likes.subscribe(likes => {
      contentLikes = likes[contentId] || [];
    })();
    return contentLikes;
  }

  async getPlaylist(playlistId: string): Promise<Playlist | null> {
    let playlist: Playlist | null = null;
    this.playlists.subscribe(playlists => {
      playlist = playlists[playlistId] || null;
    })();
    return playlist;
  }

  getUserPlaylists(): Playlist[] {
    let userPlaylists: Playlist[] = [];
    this.playlists.subscribe(playlists => {
      userPlaylists = Object.values(playlists);
    })();
    return userPlaylists;
  }

  getActivities(): Activity[] {
    let userActivities: Activity[] = [];
    this.activities.subscribe(activities => {
      userActivities = activities;
    })();
    return userActivities;
  }

  isLoading() {
    return this.loading;
  }

  getError() {
    return this.error;
  }

  // Derived stores
  commentCount = derived(this.comments, comments => 
    Object.values(comments).reduce((total, contentComments) => total + contentComments.length, 0)
  );

  likeCount = derived(this.likes, likes =>
    Object.values(likes).reduce((total, contentLikes) => total + contentLikes.length, 0)
  );

  playlistCount = derived(this.playlists, playlists => Object.keys(playlists).length);

  cleanup() {
    if (this.realtimeSubscription) {
      this.realtimeSubscription.unsubscribe();
    }
  }
}

export const socialService = SocialService.getInstance(); 