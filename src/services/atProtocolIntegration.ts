import { BskyAgent, RichText, AppBskyFeedPost, AppBskyFeedDefs } from '@atproto/api';
import { AtpSessionData } from '@atproto/api/dist/client/types';

interface Record {
  $type: string;
  [key: string]: any;
}

interface Response {
  uri: string;
  cid: string;
  value: Record;
}

interface QueryParams {
  collection: string;
  limit?: number;
  cursor?: string;
  [key: string]: any;
}

export interface ContentFilter {
  type: 'keyword' | 'user' | 'domain' | 'hashtag';
  value: string;
}

export class ATProtoService {
  private agent: BskyAgent;
  private session: AtpSessionData | null = null;

  constructor() {
    this.agent = new BskyAgent({
      service: 'https://bsky.social',
    });
  }

  async login(identifier: string, password: string): Promise<void> {
    try {
      const { success, data } = await this.agent.login({
        identifier,
        password,
      });
      if (success) {
        this.session = data;
      }
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  async createPost(
    text: string,
    reply?: {
      root: { uri: string; cid: string };
      parent: { uri: string; cid: string };
    }
  ): Promise<Response> {
    if (!this.session) {
      throw new Error('Not logged in');
    }

    const rt = new RichText({ text });
    await rt.detectFacets(this.agent);

    const post = {
      $type: 'app.bsky.feed.post',
      text: rt.text,
      facets: rt.facets,
      createdAt: new Date().toISOString(),
    };

    if (reply) {
      Object.assign(post, { reply });
    }

    try {
      const response = await this.agent.post(post);
      return response;
    } catch (error) {
      console.error('Failed to create post:', error);
      throw error;
    }
  }

  async getProfile(handle: string): Promise<Record> {
    try {
      const response = await this.agent.getProfile({ actor: handle });
      return response.data;
    } catch (error) {
      console.error('Failed to get profile:', error);
      throw error;
    }
  }

  async updateProfile(profile: {
    displayName?: string;
    description?: string;
  }): Promise<void> {
    if (!this.session) {
      throw new Error('Not logged in');
    }

    try {
      await this.agent.updateProfile(profile);
    } catch (error) {
      console.error('Failed to update profile:', error);
      throw error;
    }
  }

  async follow(did: string): Promise<Response> {
    if (!this.session) {
      throw new Error('Not logged in');
    }

    try {
      const response = await this.agent.follow(did);
      return response;
    } catch (error) {
      console.error('Failed to follow:', error);
      throw error;
    }
  }

  async unfollow(did: string): Promise<void> {
    if (!this.session) {
      throw new Error('Not logged in');
    }

    try {
      await this.agent.deleteFollow(did);
    } catch (error) {
      console.error('Failed to unfollow:', error);
      throw error;
    }
  }

  async getFollowers(did: string): Promise<Record[]> {
    try {
      const response = await this.agent.getFollowers({ actor: did });
      return response.data.followers;
    } catch (error) {
      console.error('Failed to get followers:', error);
      throw error;
    }
  }

  async getFollowing(did: string): Promise<Record[]> {
    try {
      const response = await this.agent.getFollows({ actor: did });
      return response.data.follows;
    } catch (error) {
      console.error('Failed to get following:', error);
      throw error;
    }
  }

  async getTimeline(
    params: { limit?: number; cursor?: string } = {}
  ): Promise<AppBskyFeedDefs.FeedViewPost[]> {
    if (!this.session) {
      throw new Error('Not logged in');
    }

    try {
      const response = await this.agent.getTimeline(params);
      return response.data.feed;
    } catch (error) {
      console.error('Failed to get timeline:', error);
      throw error;
    }
  }

  async searchUsers(term: string): Promise<Record[]> {
    try {
      const response = await this.agent.searchActors({ term });
      return response.data.actors;
    } catch (error) {
      console.error('Failed to search users:', error);
      throw error;
    }
  }

  async searchPosts(term: string): Promise<AppBskyFeedDefs.FeedViewPost[]> {
    try {
      const response = await this.agent.searchPosts({ q: term });
      return response.data.posts;
    } catch (error) {
      console.error('Failed to search posts:', error);
      throw error;
    }
  }

  async getNotifications(params: { limit?: number; cursor?: string } = {}): Promise<Record[]> {
    if (!this.session) {
      throw new Error('Not logged in');
    }

    try {
      const response = await this.agent.listNotifications(params);
      return response.data.notifications;
    } catch (error) {
      console.error('Failed to get notifications:', error);
      throw error;
    }
  }

  async markNotificationsRead(seenAt?: string): Promise<void> {
    if (!this.session) {
      throw new Error('Not logged in');
    }

    try {
      await this.agent.updateSeenNotifications(seenAt || new Date().toISOString());
    } catch (error) {
      console.error('Failed to mark notifications as read:', error);
      throw error;
    }
  }

  getSession(): AtpSessionData | null {
    return this.session;
  }

  logout(): void {
    this.session = null;
  }
}
