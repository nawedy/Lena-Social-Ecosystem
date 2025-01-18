declare module '@atproto/api' {
  export class BskyAgent {
    constructor(serviceUri?: string);
    login(params: {
      identifier: string;
      password: string;
    }): Promise<LoginResponse>;
    resumeSession(params: { refreshJwt: string }): Promise<LoginResponse>;
    getProfile(params: { actor: string }): Promise<ProfileViewDetailed>;
    post(params: { text: string; embed?: any }): Promise<Response>;
    deletePost(params: { uri: string }): Promise<void>;
    like(params: { uri: string; cid: string }): Promise<Response>;
    unlike(params: { uri: string }): Promise<void>;
    repost(params: { uri: string; cid: string }): Promise<Response>;
    unrepost(params: { uri: string }): Promise<void>;
    follow(params: { subject: string }): Promise<Response>;
    unfollow(params: { subject: string }): Promise<void>;
    uploadBlob(
      data: Uint8Array,
      opts?: { encoding?: string }
    ): Promise<BlobRef>;
  }

  export interface LoginResponse {
    success: boolean;
    data?: {
      accessJwt: string;
      refreshJwt: string;
      handle: string;
      did: string;
      email?: string;
    };
    error?: string;
  }

  export interface ProfileViewDetailed {
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
    labels?: Label[];
  }

  export interface Label {
    src: string;
    uri: string;
    val: string;
    cts: string;
  }

  export interface BlobRef {
    cid: string;
    mimeType: string;
  }

  export interface Response {
    uri: string;
    cid: string;
    records?: any[];
  }

  export interface AppBskyFeedPost {
    text: string;
    entities?: {
      index: { start: number; end: number };
      type: string;
      value: string;
    }[];
    reply?: {
      root: { uri: string; cid: string };
      parent: { uri: string; cid: string };
    };
    embed?: {
      $type: string;
      images?: {
        alt: string;
        image: BlobRef;
      }[];
      external?: {
        uri: string;
        title: string;
        description: string;
        thumb?: BlobRef;
      };
      record?: {
        uri: string;
        cid: string;
      };
    };
  }

  export class RichText {
    constructor(text: string);
    detectFacets(): void;
    text: string;
    facets?: {
      index: { start: number; end: number };
      features: any[];
    }[];
  }

  export interface AppBskyFeedDefs {
    postView: {
      uri: string;
      cid: string;
      author: ProfileViewBasic;
      record: AppBskyFeedPost;
      embed?: any;
      replyCount: number;
      repostCount: number;
      likeCount: number;
      indexedAt: string;
      viewer?: {
        repost?: string;
        like?: string;
      };
    };
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
    labels?: Label[];
  }

  export interface ComAtprotoRepoUploadBlob {
    blob: BlobRef;
  }

  export interface PaymentTransaction {
    type: 'payout' | 'order_payment' | 'affiliate_commission' | 'platform_fee';
    amount: number;
    currency: string;
    status: 'pending' | 'completed' | 'failed';
    createdAt: string;
    completedAt?: string;
    failureReason?: string;
  }

  export interface AppBskyNS {
    commerce: any;
    moderation: any;
  }

  export interface AppBskyFeedNS {
    getPost: (params: any) => Promise<any>;
    getPosts: (params: any) => Promise<any>;
  }

  export interface AppBskyNotificationNS {
    create: (params: any) => Promise<any>;
  }

  export interface AppBskyActorNS {
    getSavedFeeds: (params: any) => Promise<any>;
  }
}
