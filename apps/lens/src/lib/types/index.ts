// User Types
export interface UserProfile {
  id: string;
  userId: string;
  username: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  websiteUrl?: string;
  locationName?: string;
  locationPoint?: {
    latitude: number;
    longitude: number;
  };
  isVerified: boolean;
  isPrivate: boolean;
  followerCount: number;
  followingCount: number;
  postCount: number;
  createdAt: string;
  updatedAt: string;
  settings: UserSettings;
  metadata: Record<string, any>;
}

export interface UserSettings {
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  theme: ThemeSettings;
  language: string;
  timezone: string;
}

export interface NotificationSettings {
  likes: boolean;
  comments: boolean;
  follows: boolean;
  mentions: boolean;
  directMessages: boolean;
  stories: boolean;
  posts: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
}

export interface PrivacySettings {
  accountPrivacy: 'public' | 'private';
  showActivity: boolean;
  allowMentions: 'everyone' | 'following' | 'none';
  allowMessages: 'everyone' | 'following' | 'none';
  showOnlineStatus: boolean;
  blockList: string[];
}

export interface ThemeSettings {
  mode: 'light' | 'dark' | 'system';
  primaryColor: string;
  fontSize: 'small' | 'medium' | 'large';
}

// Post Types
export type PostType = 'photo' | 'gallery' | 'story' | 'reel' | 'highlight';
export type PostStatus = 'draft' | 'published' | 'archived' | 'deleted';
export type PrivacyLevel = 'public' | 'followers' | 'close_friends' | 'private';
export type MonetizationType = 'free' | 'premium' | 'pay_per_view' | 'subscription';

export interface Post {
  id: string;
  userId: string;
  type: PostType;
  caption?: string;
  locationName?: string;
  locationPoint?: {
    latitude: number;
    longitude: number;
  };
  privacy: PrivacyLevel;
  status: PostStatus;
  monetization: MonetizationType;
  price?: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  saveCount: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  archivedAt?: string;
  deletedAt?: string;
  metadata: Record<string, any>;
  media: Media[];
  user: UserProfile;
  hashtags: string[];
  mentions: string[];
}

// Media Types
export type FilterType = 'preset' | 'custom' | 'ai_enhanced';

export interface Media {
  id: string;
  postId: string;
  type: string;
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  duration?: number;
  size?: number;
  position: number;
  filterType?: FilterType;
  filterSettings?: Record<string, any>;
  metadata: Record<string, any>;
  createdAt: string;
}

// Comment Types
export interface Comment {
  id: string;
  postId: string;
  userId: string;
  parentId?: string;
  content: string;
  likeCount: number;
  replyCount: number;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  user: UserProfile;
  replies?: Comment[];
}

// Story Types
export interface Story {
  id: string;
  userId: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  type: string;
  duration?: number;
  viewCount: number;
  privacy: PrivacyLevel;
  expiresAt: string;
  createdAt: string;
  metadata: Record<string, any>;
  user: UserProfile;
  viewers: StoryView[];
}

export interface StoryView {
  id: string;
  storyId: string;
  userId: string;
  createdAt: string;
  user: UserProfile;
}

// Collection Types
export interface Collection {
  id: string;
  userId: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
  items: CollectionItem[];
}

export interface CollectionItem {
  id: string;
  collectionId: string;
  postId: string;
  createdAt: string;
  post: Post;
}

// Analytics Types
export interface PostAnalytics {
  id: string;
  postId: string;
  views: number;
  uniqueViews: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
  engagementRate: number;
  demographics: Demographics;
  date: string;
  createdAt: string;
}

export interface UserAnalytics {
  id: string;
  userId: string;
  profileViews: number;
  uniqueProfileViews: number;
  newFollowers: number;
  lostFollowers: number;
  postImpressions: number;
  storyImpressions: number;
  engagementRate: number;
  reach: number;
  demographics: Demographics;
  date: string;
  createdAt: string;
}

export interface Demographics {
  ageRanges: Record<string, number>;
  genders: Record<string, number>;
  locations: Record<string, number>;
  devices: Record<string, number>;
  languages: Record<string, number>;
}

// Monetization Types
export interface CreatorEarnings {
  id: string;
  userId: string;
  postId?: string;
  amount: number;
  currency: string;
  type: string;
  status: string;
  transactionId?: string;
  createdAt: string;
  paidAt?: string;
}

// Filter Types
export interface Filter {
  id: string;
  name: string;
  type: FilterType;
  settings: Record<string, any>;
  previewUrl?: string;
  isPremium: boolean;
  price?: number;
  createdAt: string;
  updatedAt: string;
}

// Notification Types
export interface Notification {
  id: string;
  userId: string;
  type: string;
  actorId?: string;
  postId?: string;
  commentId?: string;
  message?: string;
  isRead: boolean;
  createdAt: string;
  actor?: UserProfile;
  post?: Post;
  comment?: Comment;
}

// Report Types
export type ReportType = 'spam' | 'inappropriate' | 'copyright' | 'harassment' | 'other';

export interface Report {
  id: string;
  reporterId: string;
  postId?: string;
  commentId?: string;
  userId?: string;
  type: ReportType;
  reason?: string;
  status: string;
  createdAt: string;
  resolvedAt?: string;
  resolverId?: string;
  reporter: UserProfile;
  resolver?: UserProfile;
  post?: Post;
  comment?: Comment;
  reportedUser?: UserProfile;
}

// API Response Types
export interface ApiResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    page?: number;
    perPage?: number;
    total?: number;
    hasMore?: boolean;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  perPage: number;
  total: number;
  hasMore: boolean;
} 