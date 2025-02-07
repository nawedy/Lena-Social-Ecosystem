export type AnalyticsProvider =
  | 'plausible'
  | 'posthog'
  | 'ackee'
  | 'mixpanel'
  | 'amplitude'
  | 'supabase';

export interface AnalyticsConfig {
  provider: AnalyticsProvider;
  plausible?: {
    domain: string;
    apiHost?: string;
  };
  posthog?: {
    apiKey: string;
    host?: string;
  };
  ackee?: {
    server: string;
    domainId: string;
  };
  mixpanel?: {
    token: string;
  };
  amplitude?: {
    apiKey: string;
  };
  supabase?: {
    url: string;
    key: string;
  };
  options?: {
    debug?: boolean;
    disableInDevelopment?: boolean;
    anonymizeIp?: boolean;
    respectDoNotTrack?: boolean;
  };
}

export interface EventProperties {
  [key: string]: any;
}

export interface UserProperties {
  id?: string;
  email?: string;
  name?: string;
  [key: string]: any;
}

export interface ContentEngagement {
  contentId: string;
  userId?: string;
  sessionId: string;
  type: 'view' | 'like' | 'share' | 'comment' | 'watch';
  duration?: number;
  progress?: number;
  timestamp: Date;
  metadata?: {
    [key: string]: any;
  };
}

export interface ContentAnalytics {
  contentId: string;
  views: number;
  uniqueViews: number;
  likes: number;
  shares: number;
  comments: number;
  totalWatchTime: number;
  averageWatchTime: number;
  completionRate: number;
  engagementRate: number;
  retentionCurve: {
    timestamp: number;
    viewers: number;
  }[];
  demographics?: {
    age?: {
      [range: string]: number;
    };
    gender?: {
      [type: string]: number;
    };
    location?: {
      [country: string]: number;
    };
  };
  devices?: {
    [type: string]: number;
  };
  referrers?: {
    [source: string]: number;
  };
}

export interface UserAnalytics {
  userId: string;
  totalViews: number;
  totalLikes: number;
  totalShares: number;
  totalComments: number;
  totalWatchTime: number;
  averageEngagementRate: number;
  contentPreferences: {
    type: string;
    count: number;
  }[];
  viewingHistory: {
    contentId: string;
    timestamp: Date;
    duration: number;
  }[];
  interactionTimes: {
    hour: number;
    count: number;
  }[];
}

export interface AnalyticsReport {
  period: 'day' | 'week' | 'month' | 'year' | 'custom';
  startDate: Date;
  endDate: Date;
  metrics: {
    [key: string]: number | {
      current: number;
      previous: number;
      change: number;
    };
  };
  trends: {
    [key: string]: {
      data: Array<{
        timestamp: Date;
        value: number;
      }>;
      trend: number;
    };
  };
  segments?: {
    [key: string]: {
      [value: string]: number;
    };
  };
}

export interface RealtimeAnalytics {
  activeUsers: number;
  currentViews: number;
  popularContent: Array<{
    contentId: string;
    activeViews: number;
    engagementRate: number;
  }>;
  recentEvents: Array<{
    type: string;
    contentId: string;
    timestamp: Date;
    metadata?: any;
  }>;
} 