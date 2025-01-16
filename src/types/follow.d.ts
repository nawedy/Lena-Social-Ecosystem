export interface Follow {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: Date;
  status: 'active' | 'blocked' | 'pending';
  metadata?: {
    source?: string;
    mutualFriend?: string;
    notes?: string;
  };
}

export interface FollowStats {
  followersCount: number;
  followingCount: number;
  mutualCount: number;
  blockedCount: number;
  pendingCount: number;
}

export interface FollowRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
  message?: string;
}

export interface FollowSuggestion {
  userId: string;
  score: number;
  reason: string;
  mutualFriends: string[];
  lastActive: Date;
  commonInterests?: string[];
}

export interface FollowActivity {
  id: string;
  type: 'follow' | 'unfollow' | 'block' | 'unblock';
  actorId: string;
  targetId: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface FollowFilter {
  status?: 'active' | 'blocked' | 'pending';
  startDate?: Date;
  endDate?: Date;
  source?: string;
  hasMutualFriends?: boolean;
  limit?: number;
  offset?: number;
}

export interface FollowBatch {
  userIds: string[];
  action: 'follow' | 'unfollow' | 'block' | 'unblock';
  metadata?: Record<string, any>;
}
