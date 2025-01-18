import {
  BskyAgent,
  AtpSessionEvent,
  AtpSessionData,
  RichText,
  AppBskyFeedPost,
  ComAtprotoRepoPutRecord,
} from '@atproto/api';
import { config } from '../config';

class ATProtoService {
  private agent: BskyAgent;
  private static instance: ATProtoService;
  private sessionListeners: ((
    evt: AtpSessionEvent,
    session?: AtpSessionData
  ) => void)[] = [];

  private constructor() {
    this.agent = new BskyAgent({
      service: config.atproto.service,
      persistSession: true,
    });

    this.agent.addEventListener('session', evt => {
      this.sessionListeners.forEach(listener =>
        listener(evt.type, this.agent.session)
      );
    });
  }

  public static getInstance(): ATProtoService {
    if (!ATProtoService.instance) {
      ATProtoService.instance = new ATProtoService();
    }
    return ATProtoService.instance;
  }

  // Session Management
  addSessionListener(
    listener: (evt: AtpSessionEvent, session?: AtpSessionData) => void
  ) {
    this.sessionListeners.push(listener);
  }

  removeSessionListener(
    listener: (evt: AtpSessionEvent, session?: AtpSessionData) => void
  ) {
    this.sessionListeners = this.sessionListeners.filter(l => l !== listener);
  }

  async login(identifier: string, password: string) {
    try {
      return await this.agent.login({ identifier, password });
    } catch (error) {
      console.error('AT Protocol login error:', error);
      throw error;
    }
  }

  // Posts and Content
  async createPost(
    text: string,
    opts?: {
      media?: { type: 'image' | 'video'; data: Blob }[];
      reply?: { uri: string; cid: string };
      quote?: { uri: string; cid: string };
      labels?: string[];
      languageTags?: string[];
      facets?: AppBskyFeedPost.Facet[];
    }
  ) {
    try {
      const richText = new RichText({ text });
      await richText.detectFacets(this.agent);

      const post: AppBskyFeedPost.Record = {
        text: richText.text,
        facets: [...(richText.facets || []), ...(opts?.facets || [])],
        reply: opts?.reply,
        embed: opts?.media
          ? {
              $type: 'app.bsky.embed.images',
              images: await Promise.all(
                opts.media.map(async m => {
                  const upload = await this.agent.uploadBlob(m.data, {
                    encoding: m.type === 'image' ? 'image/jpeg' : 'video/mp4',
                  });
                  return { alt: text, image: upload.blob };
                })
              ),
            }
          : opts?.quote
            ? {
                $type: 'app.bsky.embed.record',
                record: { uri: opts.quote.uri, cid: opts.quote.cid },
              }
            : undefined,
        labels: opts?.labels,
        langs: opts?.languageTags,
        createdAt: new Date().toISOString(),
      };

      return await this.agent.post(post);
    } catch (error) {
      console.error('AT Protocol post creation error:', error);
      throw error;
    }
  }

  // Timeline and Feeds
  async getTimeline(params?: {
    limit?: number;
    cursor?: string;
    algorithm?: string;
    filter?: 'posts_with_media' | 'posts_no_media' | 'all';
  }) {
    try {
      return await this.agent.getTimeline({
        ...params,
        algorithm: params?.algorithm || 'reverse-chronological',
      });
    } catch (error) {
      console.error('AT Protocol timeline fetch error:', error);
      throw error;
    }
  }

  async getCustomFeed(
    feedUri: string,
    params?: { limit?: number; cursor?: string }
  ) {
    try {
      return await this.agent.app.bsky.feed.getFeed({
        feed: feedUri,
        ...params,
      });
    } catch (error) {
      console.error('AT Protocol custom feed fetch error:', error);
      throw error;
    }
  }

  // Social Graph
  async follow(did: string) {
    try {
      return await this.agent.follow(did);
    } catch (error) {
      console.error('AT Protocol follow error:', error);
      throw error;
    }
  }

  async unfollow(did: string) {
    try {
      return await this.agent.deleteFollow(did);
    } catch (error) {
      console.error('AT Protocol unfollow error:', error);
      throw error;
    }
  }

  // Likes and Interactions
  async likePost(uri: string, cid: string) {
    try {
      return await this.agent.like(uri, cid);
    } catch (error) {
      console.error('AT Protocol like error:', error);
      throw error;
    }
  }

  async unlikePost(uri: string) {
    try {
      return await this.agent.deleteLike(uri);
    } catch (error) {
      console.error('AT Protocol unlike error:', error);
      throw error;
    }
  }

  async repost(uri: string, cid: string) {
    try {
      return await this.agent.repost(uri, cid);
    } catch (error) {
      console.error('AT Protocol repost error:', error);
      throw error;
    }
  }

  async unrepost(uri: string) {
    try {
      return await this.agent.deleteRepost(uri);
    } catch (error) {
      console.error('AT Protocol unrepost error:', error);
      throw error;
    }
  }

  // Muting and Blocking
  async muteActor(did: string) {
    try {
      return await this.agent.mute(did);
    } catch (error) {
      console.error('AT Protocol mute error:', error);
      throw error;
    }
  }

  async unmuteActor(did: string) {
    try {
      return await this.agent.unmute(did);
    } catch (error) {
      console.error('AT Protocol unmute error:', error);
      throw error;
    }
  }

  async blockActor(did: string) {
    try {
      return await this.agent.app.bsky.graph.block.create({ did });
    } catch (error) {
      console.error('AT Protocol block error:', error);
      throw error;
    }
  }

  async unblockActor(did: string) {
    try {
      return await this.agent.app.bsky.graph.block.delete({ did });
    } catch (error) {
      console.error('AT Protocol unblock error:', error);
      throw error;
    }
  }

  // Profile Management
  async updateProfile(params: {
    displayName?: string;
    description?: string;
    avatar?: Blob;
    banner?: Blob;
  }) {
    try {
      const [avatarBlob, bannerBlob] = await Promise.all([
        params.avatar
          ? this.agent.uploadBlob(params.avatar, { encoding: 'image/jpeg' })
          : null,
        params.banner
          ? this.agent.uploadBlob(params.banner, { encoding: 'image/jpeg' })
          : null,
      ]);

      const profile = {
        displayName: params.displayName,
        description: params.description,
        avatar: avatarBlob?.data.blob,
        banner: bannerBlob?.data.blob,
      };

      return await this.agent.api.com.atproto.repo.putRecord({
        repo: this.agent.session?.did ?? '',
        collection: 'app.bsky.actor.profile',
        rkey: 'self',
        record: profile,
      });
    } catch (error) {
      console.error('AT Protocol profile update error:', error);
      throw error;
    }
  }

  // Lists and Custom Feeds
  async createList(params: {
    name: string;
    description?: string;
    purpose: 'mod' | 'curate';
    avatar?: Blob;
  }) {
    try {
      const avatarBlob = params.avatar
        ? await this.agent.uploadBlob(params.avatar, { encoding: 'image/jpeg' })
        : null;

      const record = {
        name: params.name,
        description: params.description,
        purpose: params.purpose,
        avatar: avatarBlob?.data.blob,
        createdAt: new Date().toISOString(),
      };

      return await this.agent.api.com.atproto.repo.createRecord({
        repo: this.agent.session?.did ?? '',
        collection: 'app.bsky.graph.list',
        record,
      });
    } catch (error) {
      console.error('AT Protocol list creation error:', error);
      throw error;
    }
  }

  // Content Moderation
  async reportContent(params: {
    reasonType:
      | 'spam'
      | 'violation'
      | 'misleading'
      | 'sexual'
      | 'rude'
      | 'other';
    subject: { uri: string; cid: string };
    reason?: string;
  }) {
    try {
      return await this.agent.api.com.atproto.moderation.createReport({
        reasonType: params.reasonType,
        subject: params.subject,
        reason: params.reason,
      });
    } catch (error) {
      console.error('AT Protocol report content error:', error);
      throw error;
    }
  }
}

export const atproto = ATProtoService.getInstance();
