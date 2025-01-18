export interface FollowEvent {
  id: string;
  userId: string;
  targetId: string;
  timestamp: Date;
  metadata?: Record<string, string | number | boolean>;
}

export interface FollowRelation {
  id: string;
  followerId: string;
  followingId: string;
  status: 'active' | 'blocked' | 'muted';
  createdAt: Date;
  updatedAt: Date;
}

export interface FollowBulkAction {
  userId: string;
  userIds: string[];
  action: 'follow' | 'unfollow' | 'block' | 'unblock';
  metadata?: Record<string, string | number | boolean>;
}

export interface FollowStats {
  userId: string;
  followersCount: number;
  followingCount: number;
  blockedCount: number;
  mutedCount: number;
  lastUpdated: Date;
}

export interface FollowSuggestion {
  userId: string;
  suggestedUserId: string;
  score: number;
  reason: string;
  timestamp: Date;
}

export interface FollowNotification {
  id: string;
  userId: string;
  actorId: string;
  type: 'follow' | 'unfollow' | 'block' | 'unblock';
  read: boolean;
  timestamp: Date;
}

export interface FollowFilter {
  userId?: string;
  targetId?: string;
  status?: 'active' | 'blocked' | 'muted';
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface FollowBatch {
  id: string;
  userId: string;
  action: 'follow' | 'unfollow' | 'block' | 'unblock';
  targetIds: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FollowGraph {
  nodes: Array<{
    id: string;
    type: 'user';
    data: {
      userId: string;
      handle: string;
      displayName?: string;
      avatar?: string;
    };
  }>;
  edges: Array<{
    source: string;
    target: string;
    type: 'follows' | 'blocks' | 'mutes';
    data: {
      createdAt: Date;
    };
  }>;
}
