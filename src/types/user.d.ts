export interface User {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  bio?: string;
  avatar?: string;
  phoneNumber?: string;
  createdAt: Date;
  updatedAt: Date;
  lastActive?: Date;
  status: 'active' | 'inactive' | 'banned' | 'deleted';
  roles: string[];
  preferences: {
    theme?: 'light' | 'dark' | 'system';
    language?: string;
    notifications?: {
      email: boolean;
      push: boolean;
      inApp: boolean;
    };
    privacy?: {
      profileVisibility: 'public' | 'private' | 'followers';
      messagePermission: 'everyone' | 'followers' | 'none';
      activityVisibility: 'public' | 'followers' | 'private';
    };
  };
  stats?: {
    posts: number;
    followers: number;
    following: number;
    likes: number;
    views: number;
  };
  verification?: {
    email: boolean;
    phone: boolean;
    identity: boolean;
    badges: string[];
  };
  metadata?: {
    location?: {
      country?: string;
      city?: string;
      timezone?: string;
    };
    devices?: {
      id: string;
      type: string;
      lastUsed: Date;
    }[];
    customData?: Record<string, any>;
  };
}

export interface UserFilter {
  status?: 'active' | 'inactive' | 'banned' | 'deleted';
  roles?: string[];
  verified?: boolean;
  startDate?: Date;
  endDate?: Date;
  searchTerm?: string;
  limit?: number;
  offset?: number;
}

export interface UserActivity {
  id: string;
  userId: string;
  type:
    | 'login'
    | 'logout'
    | 'post'
    | 'like'
    | 'comment'
    | 'follow'
    | 'unfollow';
  timestamp: Date;
  metadata?: {
    ip?: string;
    device?: string;
    location?: {
      country?: string;
      city?: string;
    };
    details?: Record<string, any>;
  };
}

export interface UserSession {
  id: string;
  userId: string;
  token: string;
  device: {
    type: string;
    os: string;
    browser?: string;
    ip: string;
  };
  createdAt: Date;
  expiresAt: Date;
  lastActive: Date;
  status: 'active' | 'expired' | 'revoked';
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  notifications: {
    email: boolean;
    push: boolean;
    inApp: boolean;
    types: {
      likes: boolean;
      comments: boolean;
      follows: boolean;
      mentions: boolean;
      directMessages: boolean;
    };
  };
  privacy: {
    profileVisibility: 'public' | 'private' | 'followers';
    messagePermission: 'everyone' | 'followers' | 'none';
    activityVisibility: 'public' | 'followers' | 'private';
    showOnlineStatus: boolean;
    allowTagging: boolean;
  };
  content: {
    autoplay: boolean;
    quality: 'auto' | 'low' | 'medium' | 'high';
    saveData: boolean;
    adultContent: boolean;
  };
}

export interface UserStats {
  posts: {
    total: number;
    views: number;
    likes: number;
    comments: number;
    shares: number;
  };
  social: {
    followers: number;
    following: number;
    blocked: number;
  };
  engagement: {
    rate: number;
    avgLikesPerPost: number;
    avgCommentsPerPost: number;
    avgViewsPerPost: number;
  };
  activity: {
    lastPost: Date;
    lastLogin: Date;
    totalSessions: number;
    averageSessionDuration: number;
  };
}
