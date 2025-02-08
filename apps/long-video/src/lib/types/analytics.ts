export interface AnalyticsEvent {
  type: 'play' | 'pause' | 'seek' | 'end';
  currentTime: number;
  timestamp?: string;
}

export interface ViewerEngagement {
  totalViews: number;
  uniqueViewers: number;
  averageWatchTime: number;
  completionRate: number;
  likes: number;
  shares: number;
  comments: number;
  clickThroughRate: number;
}

export interface VideoMetrics {
  id: string;
  videoId: string;
  viewCount: number;
  uniqueViewers: number;
  totalWatchTime: number;
  averageWatchTime: number;
  completionRate: number;
  engagementRate: number;
  retentionCurve: number[];
  chapterMetrics: ChapterMetrics[];
  updatedAt: string;
}

export interface ChapterMetrics {
  chapterId: string;
  viewCount: number;
  averageWatchTime: number;
  skipRate: number;
  replayRate: number;
}

export interface RetentionPoint {
  timePoint: number;
  viewerCount: number;
  percentage: number;
}

export interface ThumbnailTest {
  id: string;
  videoId: string;
  variants: ThumbnailVariant[];
  targetImpressions: number;
  durationHours: number;
  startedAt: string;
  completedAt?: string;
  winnerId?: string;
}

export interface ThumbnailVariant {
  id: string;
  imageUrl: string;
  impressions: number;
  clicks: number;
  ctr: number;
  isWinner: boolean;
  confidence?: number;
} 