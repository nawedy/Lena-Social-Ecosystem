import { supabase } from '$lib/supabase';
import type { Database } from '$lib/types/supabase';
import { auth } from '$lib/stores/auth';
import { get } from 'svelte/store';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Post = Database['public']['Tables']['posts']['Row'];
type PostLike = Database['public']['Tables']['post_likes']['Row'];
type PostComment = Database['public']['Tables']['post_comments']['Row'];
type Follow = Database['public']['Tables']['follows']['Row'];
type Message = Database['public']['Tables']['messages']['Row'];

export class DatabaseService {
  // Profile methods
  static async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  }

  static async updateProfile(profile: Partial<Profile>): Promise<Profile> {
    const user = get(auth).user;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('profiles')
      .update(profile)
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Post methods
  static async createPost(content: string, mediaUrl?: string, mediaType?: string): Promise<Post> {
    const user = get(auth).user;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('posts')
      .insert({
        author_id: user.id,
        content,
        media_url: mediaUrl,
        media_type: mediaType
      })
      .select(`
        *,
        profiles:author_id (
          username,
          avatar_url
        ),
        post_likes (count),
        post_comments (count)
      `)
      .single();

    if (error) throw error;
    return data;
  }

  static async getFeedPosts(limit = 10, offset = 0): Promise<Post[]> {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles:author_id (
          username,
          avatar_url
        ),
        post_likes (count),
        post_comments (count)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data.map(post => ({
      ...post,
      likes: post.post_likes?.[0]?.count || 0,
      comments: post.post_comments?.[0]?.count || 0
    }));
  }

  static async getTrendingPosts(limit = 10): Promise<Post[]> {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles:author_id (
          username,
          avatar_url
        ),
        post_likes (count),
        post_comments (count)
      `)
      .order('post_likes(count)', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data.map(post => ({
      ...post,
      likes: post.post_likes?.[0]?.count || 0,
      comments: post.post_comments?.[0]?.count || 0
    }));
  }

  static async getUserPosts(userId: string, limit = 10, offset = 0): Promise<Post[]> {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles:author_id (
          username,
          avatar_url
        ),
        post_likes (count),
        post_comments (count)
      `)
      .eq('author_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data.map(post => ({
      ...post,
      likes: post.post_likes?.[0]?.count || 0,
      comments: post.post_comments?.[0]?.count || 0
    }));
  }

  // Like methods
  static async likePost(postId: string): Promise<PostLike> {
    const user = get(auth).user;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('post_likes')
      .insert({
        post_id: postId,
        user_id: user.id
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async unlikePost(postId: string): Promise<void> {
    const user = get(auth).user;
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('post_likes')
      .delete()
      .match({ post_id: postId, user_id: user.id });

    if (error) throw error;
  }

  // Comment methods
  static async createComment(postId: string, content: string): Promise<PostComment> {
    const user = get(auth).user;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('post_comments')
      .insert({
        post_id: postId,
        author_id: user.id,
        content
      })
      .select(`
        *,
        profiles:author_id (
          username,
          avatar_url
        )
      `)
      .single();

    if (error) throw error;
    return data;
  }

  static async getPostComments(postId: string, limit = 10, offset = 0): Promise<PostComment[]> {
    const { data, error } = await supabase
      .from('post_comments')
      .select(`
        *,
        profiles:author_id (
          username,
          avatar_url
        )
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data;
  }

  // Follow methods
  static async followUser(userId: string): Promise<void> {
    const user = get(auth).user;
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('follows')
      .insert({
        follower_id: user.id,
        following_id: userId
      });

    if (error) throw error;
  }

  static async unfollowUser(userId: string): Promise<void> {
    const user = get(auth).user;
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('follows')
      .delete()
      .match({ follower_id: user.id, following_id: userId });

    if (error) throw error;
  }

  static async getFollowers(userId: string, limit = 10, offset = 0): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('follows')
      .select('profiles:follower_id (*)')
      .eq('following_id', userId)
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data.map((d: any) => d.profiles);
  }

  static async getFollowing(userId: string, limit = 10, offset = 0): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('follows')
      .select('profiles:following_id (*)')
      .eq('follower_id', userId)
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data.map((d: any) => d.profiles);
  }

  // Message methods
  static async getRecentMessages(limit = 50): Promise<Message[]> {
    const user = get(auth).user;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  static async getConversationProfiles(): Promise<Profile[]> {
    const user = get(auth).user;
    if (!user) throw new Error('User not authenticated');

    // Get unique users from messages
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('sender_id, receiver_id')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

    if (messagesError) throw messagesError;

    // Get unique user IDs excluding current user
    const userIds = new Set(
      messages.flatMap(m => [m.sender_id, m.receiver_id]).filter(id => id !== user.id)
    );

    // Get profiles for these users
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', Array.from(userIds));

    if (profilesError) throw profilesError;
    return profiles;
  }

  static async getConversation(
    otherUserId: string,
    limit = 20,
    offset = 0
  ): Promise<Message[]> {
    const user = get(auth).user;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),` +
        `and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data;
  }

  static async sendMessage(receiverId: string, content: string): Promise<Message> {
    const user = get(auth).user;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id: user.id,
        receiver_id: receiverId,
        content
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async markMessageAsRead(messageId: string): Promise<void> {
    const user = get(auth).user;
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('id', messageId)
      .eq('receiver_id', user.id);

    if (error) throw error;
  }

  // Explore methods
  static async getSuggestedUsers(limit = 10): Promise<Profile[]> {
    const user = get(auth).user;
    if (!user) throw new Error('User not authenticated');

    // Get users that the current user is not following
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        *,
        followers:follows!follower_id (count)
      `)
      .neq('id', user.id)
      .not('id', 'in', (select) =>
        select
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id)
      )
      .order('followers(count)', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data.map(profile => ({
      ...profile,
      followers: profile.followers?.[0]?.count || 0
    }));
  }

  export interface SearchFilters {
    query?: string;
    type?: 'user' | 'post' | 'tag';
    sortBy?: 'recent' | 'popular';
    limit?: number;
    offset?: number;
  }

  static async extractHashtags(content: string): Promise<string[]> {
    const hashtagRegex = /#[\w\u0590-\u05ff]+/g;
    return content.match(hashtagRegex) || [];
  }

  static async searchHashtags(query: string): Promise<{ tag: string; count: number }[]> {
    const { data, error } = await supabase
      .rpc('search_hashtags', { search_query: query })
      .limit(10);

    if (error) throw error;
    return data || [];
  }

  static async getTrendingHashtags(): Promise<{ tag: string; count: number }[]> {
    const { data, error } = await supabase
      .rpc('get_trending_hashtags')
      .limit(10);

    if (error) throw error;
    return data || [];
  }

  static async getPostsByHashtag(
    hashtag: string,
    limit = 20,
    offset = 0
  ): Promise<Post[]> {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles:author_id (
          username,
          avatar_url
        ),
        post_likes (count),
        post_comments (count)
      `)
      .textSearch('content', hashtag)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data.map(post => ({
      ...post,
      likes: post.post_likes?.[0]?.count || 0,
      comments: post.post_comments?.[0]?.count || 0
    }));
  }

  static async searchNearby(
    latitude: number,
    longitude: number,
    radius: number = 10, // kilometers
    limit = 20
  ): Promise<Post[]> {
    const { data, error } = await supabase
      .rpc('search_posts_by_location', {
        lat: latitude,
        long: longitude,
        radius_km: radius
      })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  static async search(
    query: string,
    filters: SearchFilters
  ): Promise<(Post | Profile | { tag: string; count: number })[]> {
    const results: (Post | Profile | { tag: string; count: number })[] = [];

    // Search hashtags if type is 'all' or 'hashtags'
    if (filters.type === 'all' || filters.type === 'hashtags') {
      const hashtagResults = await this.searchHashtags(query);
      results.push(...hashtagResults);
    }

    // Search posts if type is 'all' or 'posts'
    if (filters.type === 'all' || filters.type === 'posts') {
      const postsQuery = supabase
        .from('posts')
        .select(`
          *,
          profiles:author_id (
            username,
            avatar_url,
            eth_address,
            created_at
          ),
          post_likes (count),
          post_comments (count)
        `)
        .or(`content.ilike.%${query}%,content.ilike.%#${query}%`);

      // Apply filters
      if (filters.timeRange !== 'all') {
        const timeFilter = this.getTimeFilter(filters.timeRange);
        postsQuery.filter(timeFilter);
      }

      if (filters.mediaType !== 'all') {
        const mediaFilter = this.getMediaFilter(filters.mediaType);
        postsQuery.filter(mediaFilter);
      }

      if (filters.verified) {
        postsQuery.eq('profiles.verified', true);
      }

      if (filters.location) {
        const { latitude, longitude, radius } = filters.location;
        postsQuery.filter(
          `ST_DWithin(location, ST_MakePoint(${longitude}, ${latitude}), ${radius * 1000})`
        );
      }

      // Apply sorting
      switch (filters.sortBy) {
        case 'recent':
          postsQuery.order('created_at', { ascending: false });
          break;
        case 'popular':
          postsQuery.order('post_likes(count)', { ascending: false });
          break;
      }

      const { data: posts, error: postsError } = await postsQuery.limit(20);
      if (postsError) throw postsError;

      results.push(...(posts || []).map(post => ({
        ...post,
        likes: post.post_likes?.[0]?.count || 0,
        comments: post.post_comments?.[0]?.count || 0
      })));
    }

    // Search profiles if type is 'all' or 'users'
    if (filters.type === 'all' || filters.type === 'users') {
      const profilesQuery = supabase
        .from('profiles')
        .select(`
          *,
          followers:follows!follower_id (count)
        `)
        .or(`username.ilike.%${query}%,eth_address.ilike.%${query}%`);

      if (filters.timeRange !== 'all') {
        const timeFilter = this.getTimeFilter(filters.timeRange);
        profilesQuery.filter(timeFilter);
      }

      if (filters.verified) {
        profilesQuery.eq('verified', true);
      }

      switch (filters.sortBy) {
        case 'recent':
          profilesQuery.order('created_at', { ascending: false });
          break;
        case 'popular':
          profilesQuery.order('followers(count)', { ascending: false });
          break;
      }

      const { data: profiles, error: profilesError } = await profilesQuery.limit(20);
      if (profilesError) throw profilesError;

      results.push(...(profiles || []).map(profile => ({
        ...profile,
        followers: profile.followers?.[0]?.count || 0
      })));
    }

    // Sort combined results if type is 'all'
    if (filters.type === 'all') {
      this.sortResults(results, filters.sortBy);
    }

    return results;
  }

  private static getTimeFilter(timeRange: SearchFilters['timeRange']): string {
    const now = new Date();
    switch (timeRange) {
      case 'day':
        return `created_at > '${new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()}'`;
      case 'week':
        return `created_at > '${new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()}'`;
      case 'month':
        return `created_at > '${new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()}'`;
      case 'year':
        return `created_at > '${new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString()}'`;
      default:
        return '';
    }
  }

  private static getMediaFilter(mediaType: SearchFilters['mediaType']): string {
    switch (mediaType) {
      case 'image':
        return "media_type LIKE 'image/%'";
      case 'video':
        return "media_type LIKE 'video/%'";
      case 'text':
        return 'media_url IS NULL';
      default:
        return '';
    }
  }

  private static sortResults(
    results: (Post | Profile | { tag: string; count: number })[],
    sortBy: SearchFilters['sortBy']
  ): void {
    switch (sortBy) {
      case 'recent':
        results.sort((a, b) => {
          if ('created_at' in a && 'created_at' in b) {
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          }
          return 0;
        });
        break;
      case 'popular':
        results.sort((a, b) => {
          const aPopularity = this.getPopularityScore(a);
          const bPopularity = this.getPopularityScore(b);
          return bPopularity - aPopularity;
        });
        break;
    }
  }

  private static getPopularityScore(
    item: Post | Profile | { tag: string; count: number }
  ): number {
    if ('count' in item) {
      return item.count;
    } else if ('content' in item) {
      return (item.likes || 0) + (item.comments || 0);
    } else {
      return item.followers || 0;
    }
  }

  // Real-time subscriptions
  static subscribeToNewPosts(callback: (payload: any) => void) {
    return supabase
      .channel('public:posts')
      .on('INSERT', callback)
      .subscribe();
  }

  static subscribeToNewMessages(callback: (payload: any) => void) {
    const user = get(auth).user;
    if (!user) throw new Error('User not authenticated');

    return supabase
      .channel('private:messages')
      .on('INSERT', (payload) => {
        if (payload.new.receiver_id === user.id) {
          callback(payload);
        }
      })
      .subscribe();
  }

  static subscribeToNewComments(postId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`post:${postId}:comments`)
      .on('INSERT', callback)
      .subscribe();
  }

  // Notification methods
  static async getRecentLikes(): Promise<PostLike[]> {
    const user = get(auth).user;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('post_likes')
      .select(`
        *,
        profiles:user_id (*),
        posts:post_id (*)
      `)
      .eq('posts.author_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return data;
  }

  static async getRecentComments(): Promise<PostComment[]> {
    const user = get(auth).user;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('post_comments')
      .select(`
        *,
        profiles:author_id (*),
        posts:post_id (*)
      `)
      .eq('posts.author_id', user.id)
      .neq('author_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return data;
  }

  static async getRecentFollows(): Promise<Follow[]> {
    const user = get(auth).user;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('follows')
      .select(`
        *,
        profiles:follower_id (*)
      `)
      .eq('following_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return data;
  }

  static async markNotificationAsRead(notificationId: string): Promise<void> {
    const user = get(auth).user;
    if (!user) throw new Error('User not authenticated');

    // Since we don't have a dedicated notifications table,
    // we'll handle this client-side for now
    // In a production app, you'd want to store notification states in the database
  }

  static subscribeToNotifications(callback: (payload: any) => void) {
    const user = get(auth).user;
    if (!user) throw new Error('User not authenticated');

    // Subscribe to likes, comments, and follows
    return supabase
      .channel('notifications')
      .on(
        'INSERT',
        { event: '*', schema: 'public', table: 'post_likes', filter: `posts.author_id=eq.${user.id}` },
        (payload) => callback({ type: 'like', data: payload.new })
      )
      .on(
        'INSERT',
        { event: '*', schema: 'public', table: 'post_comments', filter: `posts.author_id=eq.${user.id}` },
        (payload) => callback({ type: 'comment', data: payload.new })
      )
      .on(
        'INSERT',
        { event: '*', schema: 'public', table: 'follows', filter: `following_id=eq.${user.id}` },
        (payload) => callback({ type: 'follow', data: payload.new })
      )
      .subscribe();
  }

  // Account management methods
  static async deleteAccount(): Promise<void> {
    const user = get(auth).user;
    if (!user) throw new Error('User not authenticated');

    // Delete all user data
    const { error: deleteError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', user.id);

    if (deleteError) throw deleteError;

    // Delete auth user
    const { error: authError } = await supabase.auth.admin.deleteUser(user.id);
    if (authError) throw authError;
  }

  static async updateNotificationSettings(settings: {
    email_likes: boolean;
    email_comments: boolean;
    email_follows: boolean;
    push_likes: boolean;
    push_comments: boolean;
    push_follows: boolean;
  }): Promise<void> {
    const user = get(auth).user;
    if (!user) throw new Error('User not authenticated');

    // TODO: Add notification_settings table and implement this
    // For now, we'll just store it in local storage
    localStorage.setItem(`notification_settings_${user.id}`, JSON.stringify(settings));
  }

  static async updatePrivacySettings(settings: {
    private_account: boolean;
    show_activity: boolean;
    allow_mentions: boolean;
    allow_messages: boolean;
  }): Promise<void> {
    const user = get(auth).user;
    if (!user) throw new Error('User not authenticated');

    // TODO: Add privacy_settings table and implement this
    // For now, we'll just store it in local storage
    localStorage.setItem(`privacy_settings_${user.id}`, JSON.stringify(settings));
  }
} 