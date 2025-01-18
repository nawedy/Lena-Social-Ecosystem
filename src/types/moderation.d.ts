export interface ModerationResult {
  id: string;
  contentId: string;
  contentType: 'post' | 'comment' | 'message' | 'profile' | 'media';
  userId: string;
  timestamp: Date;
  status: 'approved' | 'rejected' | 'pending' | 'flagged';
  scores: {
    hate: number;
    'hate/threatening': number;
    'self-harm': number;
    sexual: number;
    'sexual/minors': number;
    violence: number;
    'violence/graphic': number;
  };
  categories: {
    hate: boolean;
    'hate/threatening': boolean;
    'self-harm': boolean;
    sexual: boolean;
    'sexual/minors': boolean;
    violence: boolean;
    'violence/graphic': boolean;
  };
  flaggedContent?: {
    text?: string[];
    media?: string[];
  };
  moderatorId?: string;
  reviewNotes?: string;
  appealStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  metadata?: Record<string, any>;
}

export interface ModerationRule {
  id: string;
  name: string;
  description?: string;
  type: 'text' | 'media' | 'behavior';
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'flag' | 'reject' | 'delete' | 'ban';
  conditions: {
    category?: string[];
    scoreThreshold?: number;
    keywords?: string[];
    patterns?: string[];
  };
  metadata?: Record<string, any>;
}

export interface ModerationStats {
  totalContent: number;
  approved: number;
  rejected: number;
  pending: number;
  flagged: number;
  appeals: number;
  averageResponseTime: number;
  categoryBreakdown: Record<string, number>;
  moderatorPerformance?: Record<
    string,
    {
      reviewed: number;
      approved: number;
      rejected: number;
      averageResponseTime: number;
    }
  >;
}

export interface ModerationFilter {
  contentType?: 'post' | 'comment' | 'message' | 'profile' | 'media';
  status?: 'approved' | 'rejected' | 'pending' | 'flagged';
  userId?: string;
  moderatorId?: string;
  startDate?: Date;
  endDate?: Date;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  category?: string;
  limit?: number;
  offset?: number;
}

export interface ModerationAppeal {
  id: string;
  moderationResultId: string;
  userId: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
  reviewerId?: string;
  reviewNotes?: string;
  metadata?: Record<string, any>;
}

export interface ModerationConfig {
  enabled: boolean;
  autoModeration: boolean;
  appealEnabled: boolean;
  moderatorRoles: string[];
  thresholds: {
    flag: number;
    reject: number;
    ban: number;
  };
  customRules: ModerationRule[];
  notifications: {
    email: boolean;
    inApp: boolean;
    webhook?: string;
  };
}

export interface ModerationAction {
  id: string;
  type: 'flag' | 'reject' | 'delete' | 'ban';
  contentId: string;
  contentType: string;
  userId: string;
  moderatorId: string;
  reason: string;
  timestamp: Date;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface ModerationQueue {
  id: string;
  name: string;
  priority: 'low' | 'medium' | 'high';
  contentTypes: string[];
  moderators: string[];
  rules: string[];
  status: 'active' | 'paused';
  metadata?: Record<string, any>;
}
