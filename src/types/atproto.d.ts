import { BskyAgent } from '@atproto/api';

declare module '@atproto/api' {
  export class BskyAgent {
    constructor(serviceUri?: string);
    login(params: {
      identifier: string;
      password: string;
    }): Promise<ATProtoSession>;
    resumeSession(params: { refreshJwt: string }): Promise<ATProtoSession>;
    getProfile(params: { actor: string }): Promise<ATProtoProfile>;
    post(params: {
      text: string;
      embed?: {
        $type: string;
        images?: {
          image: {
            $type: string;
            ref: { $link: string };
            mimeType: string;
            size: number;
          };
          alt?: string;
        }[];
        external?: {
          uri: string;
          title?: string;
          description?: string;
          thumb?: {
            $type: string;
            ref: { $link: string };
            mimeType: string;
          };
        };
      };
    }): Promise<ATProtoPost>;
    deletePost(params: { uri: string }): Promise<void>;
    like(params: { uri: string; cid: string }): Promise<ATProtoPost>;
    unlike(params: { uri: string }): Promise<void>;
    repost(params: { uri: string; cid: string }): Promise<ATProtoPost>;
    unrepost(params: { uri: string }): Promise<void>;
    follow(params: { subject: string }): Promise<ATProtoProfile>;
    unfollow(params: { subject: string }): Promise<void>;
    uploadBlob(
      data: Uint8Array,
      opts?: { encoding?: string }
    ): Promise<BlobRef>;
  }

  export interface ATProtoSession {
    did: string;
    handle: string;
    email?: string;
    accessJwt: string;
    refreshJwt: string;
  }

  export interface ATProtoProfile {
    did: string;
    handle: string;
    displayName?: string;
    description?: string;
    avatar?: string;
    banner?: string;
    followersCount: number;
    followsCount: number;
    postsCount: number;
    indexedAt: string;
    viewer?: {
      muted: boolean;
      blockedBy: boolean;
      following?: string;
      followedBy?: string;
    };
    labels?: Array<{
      src: string;
      uri: string;
      val: string;
      cts: string;
    }>;
  }

  export interface ATProtoPost {
    uri: string;
    cid: string;
    author: ATProtoProfile;
    record: {
      text: string;
      $type: string;
      createdAt: string;
      embed?: {
        $type: string;
        images?: Array<{
          image: {
            $type: string;
            ref: { $link: string };
            mimeType: string;
            size: number;
          };
          alt?: string;
        }>;
        external?: {
          uri: string;
          title?: string;
          description?: string;
          thumb?: {
            $type: string;
            ref: { $link: string };
            mimeType: string;
            size: number;
          };
        };
      };
    };
    replyCount: number;
    repostCount: number;
    likeCount: number;
    indexedAt: string;
    viewer?: {
      like?: string;
      repost?: string;
    };
    labels?: Array<{
      src: string;
      uri: string;
      val: string;
      cts: string;
    }>;
  }

  export interface ATProtoFeed {
    uri: string;
    cid: string;
    creator: ATProtoProfile;
    name: string;
    description?: string;
    avatar?: string;
    likeCount: number;
    viewer?: {
      like?: string;
    };
    indexedAt: string;
    labels?: Array<{
      src: string;
      uri: string;
      val: string;
      cts: string;
    }>;
  }

  export interface ATProtoNotification {
    uri: string;
    cid: string;
    author: ATProtoProfile;
    reason: string;
    reasonSubject?: string;
    record: {
      text?: string;
      $type: string;
      createdAt: string;
    };
    isRead: boolean;
    indexedAt: string;
    labels?: Array<{
      src: string;
      uri: string;
      val: string;
      cts: string;
    }>;
  }

  export interface ATProtoList {
    uri: string;
    cid: string;
    creator: ATProtoProfile;
    name: string;
    purpose: string;
    description?: string;
    avatar?: string;
    viewer?: {
      muted?: boolean;
      blocked?: string;
    };
    indexedAt: string;
    labels?: Array<{
      src: string;
      uri: string;
      val: string;
      cts: string;
    }>;
  }

  export interface ATProtoInviteCode {
    code: string;
    available: number;
    disabled: boolean;
    forAccount: string;
    createdBy: string;
    createdAt: string;
    uses: Array<{
      usedBy: string;
      usedAt: string;
    }>;
  }

  export interface ATProtoAgent {
    api: BskyAgent;
    session: ATProtoSession | null;
  }

  export interface BlobRef {
    cid: string;
    mimeType: string;
  }

  export interface Response {
    uri: string;
    cid: string;
    records?: Record[];
  }

  export interface AppBskyFeedPost {
    text: string;
    facets?: {
      index: { start: number; end: number };
      features: PostFeature[];
    }[];
  }

  export class RichText {
    constructor(text: string);
    detectFacets(): void;
    text: string;
    facets?: {
      index: { start: number; end: number };
      features: PostFeature[];
    }[];
  }

  export interface PostFeature {
    type: 'mention' | 'link' | 'tag';
    value: string;
    did?: string;
    uri?: string;
  }

  export interface AppBskyFeedDefs {
    postView: PostView;
  }

  export interface ProfileViewBasic {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
    viewer?: {
      muted: boolean;
      blockedBy: boolean;
      following?: string;
      followedBy?: string;
    };
    labels?: Array<{
      src: string;
      uri: string;
      val: string;
      cts: string;
    }>;
  }

  export interface PostParams {
    text: string;
    embed?: {
      $type: string;
      images?: {
        image: {
          $type: string;
          ref: { $link: string };
          mimeType: string;
          size: number;
        };
        alt?: string;
      }[];
      external?: {
        uri: string;
        title?: string;
        description?: string;
        thumb?: {
          $type: string;
          ref: { $link: string };
          mimeType: string;
        };
      };
    };
  }

  export interface PostView {
    uri: string;
    cid: string;
    author: ProfileViewBasic;
    record: AppBskyFeedPost;
    embed?: {
      $type: string;
      images?: {
        thumb?: string;
        fullsize?: string;
        alt?: string;
      }[];
      external?: {
        uri: string;
        title?: string;
        description?: string;
        thumb?: string;
      };
    };
    replyCount: number;
    repostCount: number;
    likeCount: number;
    indexedAt: string;
    viewer?: {
      like?: string;
      repost?: string;
    };
    labels?: string[];
  }

  export interface Record {
    uri: string;
    cid: string;
    records?: {
      $type: string;
      [key: string]: unknown;
    }[];
  }

  export interface AppBskyNS {
    commerce: Record<string, unknown>;
    moderation: Record<string, unknown>;
    feed: {
      post: {
        create: (params: PostParams) => Promise<{ uri: string; cid: string }>;
        delete: (params: { uri: string }) => Promise<void>;
      };
      getPosts: (params: { uris: string[] }) => Promise<{ posts: PostView[] }>;
    };
    actor: {
      getProfile: (params: {
        actor: string;
      }) => Promise<{ data: ProfileViewBasic }>;
      searchActors: (params: {
        term: string;
        limit?: number;
      }) => Promise<{ actors: ProfileViewBasic[] }>;
    };
  }

  export interface AppBskyFeedNS {
    getPost: (params: GetPostParams) => Promise<{ data: PostView }>;
    getPosts: (
      params: GetPostsParams
    ) => Promise<{ data: { posts: PostView[] } }>;
  }

  export interface AppBskyNotificationNS {
    create: (params: CreateNotificationParams) => Promise<{ success: boolean }>;
  }

  export interface AppBskyActorNS {
    getSavedFeeds: (params: GetSavedFeedsParams) => Promise<{
      data: {
        feeds: {
          uri: string;
          cid: string;
          creator: ProfileViewBasic;
          name: string;
          description?: string;
        }[];
        cursor?: string;
      };
    }>;
  }

  export interface GetPostParams {
    uri: string;
  }

  export interface GetPostsParams {
    uris: string[];
  }

  export interface CreateNotificationParams {
    type: string;
    recipient: string;
    reason?: string;
    reasonSubject?: string;
  }

  export interface GetSavedFeedsParams {
    limit?: number;
    cursor?: string;
  }
}

declare global {
  interface Window {
    atproto?: BskyAgent;
  }
}
