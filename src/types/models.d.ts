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
  variables: FieldDefinition[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  isPublic: boolean;
  usageCount: number;
  rating: number;
  tags: string[];
}

export interface FieldDefinition {
  name: string;
  type: 'text' | 'number' | 'boolean' | 'date' | 'select';
  required: boolean;
  defaultValue?: string | number | boolean | Date | null;
  options?: string[];
  description?: string;
}

export interface AITestCase {
  id: string;
  name: string;
  description: string;
  input: Record<string, string | number | boolean | null>;
  expectedOutput: Record<string, string | number | boolean | null>;
  timeout: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TestResult {
  testId: string;
  passed: boolean;
  error?: string;
  duration: number;
  output?: Record<string, string | number | boolean | null>;
  timestamp: Date;
  metadata?: Record<string, string | number | boolean | null>;
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
  metadata?: Record<string, string | number | boolean | null>;
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

export interface ModelField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'date' | 'select';
  required: boolean;
  defaultValue?: string | number | boolean | Date;
  options?: string[];
  description?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

export interface ModelSchema {
  name: string;
  version: string;
  fields: ModelField[];
  description?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ModelInstance {
  id: string;
  schemaId: string;
  version: string;
  data: Record<string, string | number | boolean | Date>;
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    createdBy?: string;
    updatedBy?: string;
    source?: string;
    tags?: string[];
  };
}

export interface ModelTestCase {
  name: string;
  description: string;
  input: Record<string, string | number | boolean | null>;
  expectedOutput: Record<string, string | number | boolean | null>;
  timeout: number;
  tags: string[];
  metadata?: {
    priority?: 'low' | 'medium' | 'high';
    dependencies?: string[];
    notes?: string;
  };
}

export interface ModelTestResult {
  testId: string;
  modelId: string;
  version: string;
  status: 'passed' | 'failed' | 'error';
  error?: string;
  duration: number;
  output?: Record<string, string | number | boolean | null>;
  timestamp: Date;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface ModelValidation {
  modelId: string;
  version: string;
  validatedAt: Date;
  status: 'valid' | 'invalid';
  errors?: Array<{
    field: string;
    message: string;
    code: string;
  }>;
  warnings?: Array<{
    field: string;
    message: string;
    code: string;
  }>;
}

export interface ModelDeployment {
  id: string;
  modelId: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  status: 'pending' | 'deployed' | 'failed';
  deployedAt: Date;
  statusCode: number;
  errorMessage?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode: number;
  errorMessage?: string;
  metadata?: Record<string, string | number | boolean | null>;
}
