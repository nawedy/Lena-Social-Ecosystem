export interface User {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  isVerified: boolean;
  settings: UserSettings;
}

export interface UserSettings {
  notifications: boolean;
  theme: 'light' | 'dark' | 'system';
  language: string;
  privacy: {
    profileVisibility: 'public' | 'private';
    showOnlineStatus: boolean;
  };
}

export interface Post {
  id: string;
  userId: string;
  text: string;
  media?: {
    type: 'image' | 'video';
    url: string;
    thumbnailUrl?: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
  likes: number;
  reposts: number;
  comments: number;
  tags: string[];
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  text: string;
  createdAt: Date;
  updatedAt: Date;
  likes: number;
  replies: number;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'like' | 'comment' | 'follow' | 'mention' | 'repost';
  sourceUserId: string;
  targetId?: string;
  read: boolean;
  createdAt: Date;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  content: string;
  variables: TemplateVariable[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  isPublic: boolean;
  usageCount: number;
  rating: number;
  tags: string[];
}

export interface TemplateVariable {
  name: string;
  type: 'text' | 'number' | 'boolean' | 'date' | 'select';
  required: boolean;
  defaultValue?: any;
  options?: string[];
  description?: string;
}

export interface AITestCase {
  id: string;
  name: string;
  description: string;
  input: Record<string, any>;
  expectedOutput: Record<string, any>;
  timeout: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TestResult {
  testCaseId: string;
  passed: boolean;
  error?: string;
  duration: number;
  output?: Record<string, any>;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface BlockedUser {
  userId: string;
  blockedUserId: string;
  reason?: string;
  createdAt: Date;
  expiresAt?: Date;
}

export interface APIUsage {
  userId: string;
  endpoint: string;
  method: string;
  timestamp: Date;
  responseTime: number;
  statusCode: number;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface BetaTest {
  id: string;
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  status: 'planned' | 'active' | 'completed' | 'cancelled';
  participants: string[];
  features: string[];
  feedback: BetaFeedback[];
  metrics: Record<string, number>;
}

export interface BetaFeedback {
  id: string;
  userId: string;
  testId: string;
  type: 'bug' | 'feature' | 'improvement' | 'other';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'new' | 'in-progress' | 'resolved' | 'wont-fix';
  createdAt: Date;
  updatedAt: Date;
  attachments?: string[];
}
