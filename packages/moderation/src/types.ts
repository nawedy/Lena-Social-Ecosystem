export type ContentType = 'text' | 'image' | 'video' | 'audio';

export type ModerationStatus = 'pending' | 'approved' | 'rejected' | 'flagged' | 'under_review';

export type ModerationReason =
  | 'hate_speech'
  | 'harassment'
  | 'violence'
  | 'adult'
  | 'spam'
  | 'copyright'
  | 'misinformation'
  | 'other';

export interface ModerationResult {
  id: string;
  contentId: string;
  contentType: ContentType;
  status: ModerationStatus;
  reason?: ModerationReason;
  confidence: number;
  moderatedBy: 'ai' | 'human' | 'community';
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModerationConfig {
  aiThreshold: number;
  requireHumanReview: boolean;
  autoRejectThreshold: number;
  communityFlagsThreshold: number;
  appealEnabled: boolean;
  appealWaitingPeriod: number;
}

export interface ModerationAppeal {
  id: string;
  moderationId: string;
  userId: string;
  reason: string;
  evidence?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommunityFlag {
  id: string;
  contentId: string;
  userId: string;
  reason: ModerationReason;
  description?: string;
  status: 'pending' | 'resolved';
  createdAt: Date;
}

export interface ModerationStats {
  totalContent: number;
  pendingReviews: number;
  approvedContent: number;
  rejectedContent: number;
  flaggedContent: number;
  averageReviewTime: number;
  appealRate: number;
  appealSuccessRate: number;
} 