import { browser } from '$app/environment';
import { writable, derived } from 'svelte/store';
import { supabase } from '$lib/supabaseClient';

interface CommunityPost {
  id: string;
  creatorId: string;
  type: 'announcement' | 'poll' | 'discussion' | 'qa' | 'event';
  title: string;
  content: string;
  attachments?: Array<{
    type: 'image' | 'video' | 'link';
    url: string;
    thumbnail?: string;
  }>;
  tags: string[];
  isPinned: boolean;
  isLocked: boolean;
  engagement: {
    likes: number;
    comments: number;
    shares: number;
  };
  pollOptions?: Array<{
    id: string;
    text: string;
    votes: number;
  }>;
  eventDetails?: {
    startDate: string;
    endDate: string;
    timezone: string;
    location?: string;
    maxAttendees?: number;
    currentAttendees: number;
  };
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
}

interface Comment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  attachments?: Array<{
    type: 'image' | 'link';
    url: string;
  }>;
  parentId?: string;
  likes: number;
  replies: number;
  isPinned: boolean;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
  user: {
    username: string;
    displayName: string;
    avatarUrl: string;
    role: 'creator' | 'moderator' | 'member';
  };
}

interface CommunityMember {
  id: string;
  userId: string;
  role: 'creator' | 'moderator' | 'member';
  status: 'active' | 'muted' | 'banned';
  joinDate: string;
  lastActive: string;
  reputation: number;
  badges: string[];
  contributions: {
    posts: number;
    comments: number;
    likes: number;
    reports: number;
  };
  preferences: {
    notifications: {
      posts: boolean;
      comments: boolean;
      mentions: boolean;
      events: boolean;
    };
    privacy: {
      showActivity: boolean;
      showStatus: boolean;
    };
  };
}

interface CommunitySettings {
  id: string;
  creatorId: string;
  guidelines: string;
  moderation: {
    autoModeration: boolean;
    requireApproval: boolean;
    restrictNewMembers: boolean;
    wordFilter: string[];
    spamProtection: boolean;
  };
  permissions: {
    whoCanPost: 'everyone' | 'members' | 'moderators';
    whoCanComment: 'everyone' | 'members' | 'moderators';
    whoCanCreatePolls: 'everyone' | 'members' | 'moderators';
    whoCanCreateEvents: 'everyone' | 'members' | 'moderators';
  };
  features: {
    polls: boolean;
    events: boolean;
    qa: boolean;
    fileSharing: boolean;
    memberDirectory: boolean;
  };
}

interface Report {
  id: string;
  type: 'post' | 'comment' | 'user';
  targetId: string;
  reporterId: string;
  reason: string;
  description?: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  createdAt: string;
  updatedAt: string;
}

export class CommunityService {
  private static instance: CommunityService;
  private posts = writable<CommunityPost[]>([]);
  private comments = writable<Record<string, Comment[]>>({});
  private members = writable<CommunityMember[]>([]);
  private settings = writable<CommunitySettings | null>(null);
  private reports = writable<Report[]>([]);
  private loading = writable(false);
  private error = writable<string | null>(null);

  private constructor() {
    if (browser) {
      this.init();
    }
  }

  static getInstance(): CommunityService {
    if (!CommunityService.instance) {
      CommunityService.instance = new CommunityService();
    }
    return CommunityService.instance;
  }

  private async init() {
    try {
      this.loading.set(true);

      // Load initial data
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await Promise.all([
          this.loadPosts(),
          this.loadMembers(),
          this.loadSettings(),
          this.loadReports()
        ]);
      }

      // Setup realtime subscriptions
      this.setupRealtimeSubscriptions();
    } catch (err) {
      console.error('Community service initialization failed:', err);
      this.error.set(err.message);
    } finally {
      this.loading.set(false);
    }
  }

  private setupRealtimeSubscriptions() {
    const { data: { user } } = supabase.auth.getUser();
    if (!user) return;

    return supabase
      .channel('community_updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'community_posts'
      }, this.handlePostChange.bind(this))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'comments'
      }, this.handleCommentChange.bind(this))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'community_members'
      }, this.handleMemberChange.bind(this))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'reports'
      }, this.handleReportChange.bind(this))
      .subscribe();
  }

  private async handlePostChange(payload: any) {
    await this.loadPosts();
  }

  private async handleCommentChange(payload: any) {
    await this.loadComments(payload.new.post_id);
  }

  private async handleMemberChange(payload: any) {
    await this.loadMembers();
  }

  private async handleReportChange(payload: any) {
    await this.loadReports();
  }

  private async loadPosts(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('community_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      this.posts.set(data);
    } catch (err) {
      console.error('Failed to load posts:', err);
      this.error.set(err.message);
    }
  }

  private async loadComments(postId: string): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          user:user_profiles (
            username,
            displayName,
            avatarUrl,
            role
          )
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      this.comments.update(comments => ({
        ...comments,
        [postId]: data
      }));
    } catch (err) {
      console.error('Failed to load comments:', err);
      this.error.set(err.message);
    }
  }

  private async loadMembers(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('community_members')
        .select('*')
        .order('join_date', { ascending: false });

      if (error) throw error;
      this.members.set(data);
    } catch (err) {
      console.error('Failed to load members:', err);
      this.error.set(err.message);
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('community_settings')
        .select('*')
        .eq('creator_id', user.id)
        .single();

      if (error) throw error;
      this.settings.set(data);
    } catch (err) {
      console.error('Failed to load settings:', err);
      this.error.set(err.message);
    }
  }

  private async loadReports(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      this.reports.set(data);
    } catch (err) {
      console.error('Failed to load reports:', err);
      this.error.set(err.message);
    }
  }

  async createPost(post: Omit<CommunityPost, 'id' | 'creatorId' | 'engagement' | 'createdAt' | 'updatedAt'>): Promise<void> {
    try {
      this.loading.set(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('community_posts')
        .insert({
          ...post,
          creator_id: user.id,
          engagement: { likes: 0, comments: 0, shares: 0 },
          created_at: new Date().toISOString()
        });

      if (error) throw error;
      await this.loadPosts();
    } catch (err) {
      console.error('Failed to create post:', err);
      this.error.set(err.message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async updatePost(postId: string, updates: Partial<CommunityPost>): Promise<void> {
    try {
      this.loading.set(true);
      const { error } = await supabase
        .from('community_posts')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', postId);

      if (error) throw error;
      await this.loadPosts();
    } catch (err) {
      console.error('Failed to update post:', err);
      this.error.set(err.message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async deletePost(postId: string): Promise<void> {
    try {
      this.loading.set(true);
      const { error } = await supabase
        .from('community_posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;
      await this.loadPosts();
    } catch (err) {
      console.error('Failed to delete post:', err);
      this.error.set(err.message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async addComment(postId: string, content: string, parentId?: string): Promise<void> {
    try {
      this.loading.set(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          user_id: user.id,
          content,
          parent_id: parentId,
          created_at: new Date().toISOString()
        });

      if (error) throw error;
      await this.loadComments(postId);
    } catch (err) {
      console.error('Failed to add comment:', err);
      this.error.set(err.message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async updateComment(commentId: string, content: string): Promise<void> {
    try {
      this.loading.set(true);
      const { error } = await supabase
        .from('comments')
        .update({
          content,
          is_edited: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', commentId);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to update comment:', err);
      this.error.set(err.message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async deleteComment(commentId: string): Promise<void> {
    try {
      this.loading.set(true);
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to delete comment:', err);
      this.error.set(err.message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async updateSettings(updates: Partial<CommunitySettings>): Promise<void> {
    try {
      this.loading.set(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('community_settings')
        .update(updates)
        .eq('creator_id', user.id);

      if (error) throw error;
      await this.loadSettings();
    } catch (err) {
      console.error('Failed to update settings:', err);
      this.error.set(err.message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async updateMemberRole(memberId: string, role: CommunityMember['role']): Promise<void> {
    try {
      this.loading.set(true);
      const { error } = await supabase
        .from('community_members')
        .update({ role })
        .eq('id', memberId);

      if (error) throw error;
      await this.loadMembers();
    } catch (err) {
      console.error('Failed to update member role:', err);
      this.error.set(err.message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async updateMemberStatus(memberId: string, status: CommunityMember['status']): Promise<void> {
    try {
      this.loading.set(true);
      const { error } = await supabase
        .from('community_members')
        .update({ status })
        .eq('id', memberId);

      if (error) throw error;
      await this.loadMembers();
    } catch (err) {
      console.error('Failed to update member status:', err);
      this.error.set(err.message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async createReport(report: Omit<Report, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<void> {
    try {
      this.loading.set(true);
      const { error } = await supabase
        .from('reports')
        .insert({
          ...report,
          status: 'pending',
          created_at: new Date().toISOString()
        });

      if (error) throw error;
      await this.loadReports();
    } catch (err) {
      console.error('Failed to create report:', err);
      this.error.set(err.message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async updateReportStatus(reportId: string, status: Report['status']): Promise<void> {
    try {
      this.loading.set(true);
      const { error } = await supabase
        .from('reports')
        .update({
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', reportId);

      if (error) throw error;
      await this.loadReports();
    } catch (err) {
      console.error('Failed to update report status:', err);
      this.error.set(err.message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  getPosts(): CommunityPost[] {
    let result: CommunityPost[] = [];
    this.posts.subscribe(value => {
      result = value;
    })();
    return result;
  }

  getComments(postId: string): Comment[] {
    let result: Comment[] = [];
    this.comments.subscribe(comments => {
      result = comments[postId] || [];
    })();
    return result;
  }

  getMembers(): CommunityMember[] {
    let result: CommunityMember[] = [];
    this.members.subscribe(value => {
      result = value;
    })();
    return result;
  }

  getSettings(): CommunitySettings | null {
    let result: CommunitySettings | null = null;
    this.settings.subscribe(value => {
      result = value;
    })();
    return result;
  }

  getReports(): Report[] {
    let result: Report[] = [];
    this.reports.subscribe(value => {
      result = value;
    })();
    return result;
  }

  isLoading(): boolean {
    let result = false;
    this.loading.subscribe(value => {
      result = value;
    })();
    return result;
  }

  getError(): string | null {
    let result: string | null = null;
    this.error.subscribe(value => {
      result = value;
    })();
    return result;
  }

  // Derived stores
  activeMemberCount = derived(this.members, $members =>
    $members.filter(m => m.status === 'active').length
  );

  moderatorCount = derived(this.members, $members =>
    $members.filter(m => m.role === 'moderator').length
  );

  pinnedPosts = derived(this.posts, $posts =>
    $posts.filter(p => p.isPinned)
  );

  pendingReports = derived(this.reports, $reports =>
    $reports.filter(r => r.status === 'pending')
  );

  cleanup() {
    this.posts.set([]);
    this.comments.set({});
    this.members.set([]);
    this.settings.set(null);
    this.reports.set([]);
    this.error.set(null);
  }
}

export const communityService = CommunityService.getInstance(); 