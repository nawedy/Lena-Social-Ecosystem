export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type NotificationChannel = 'inApp' | 'email' | 'webPush' | 'all';
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'delivered' | 'read';

export interface NotificationConfig {
  id?: string;
  user_id?: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  priority: NotificationPriority;
  channel: NotificationChannel;
  status?: NotificationStatus;
  error?: string;
  read?: boolean;
  read_at?: string;
  created_at?: string;
}

export interface NotificationPreferences {
  id?: string;
  user_id?: string;
  channels: {
    inApp: boolean;
    email: boolean;
    webPush: boolean;
  };
  types: Record<string, {
    enabled: boolean;
    priority?: NotificationPriority;
    channels?: NotificationChannel[];
  }>;
  quiet_hours: {
    enabled: boolean;
    start: string; // HH:mm format
    end: string; // HH:mm format
    timezone: string;
  };
  created_at?: string;
  updated_at?: string;
}

export interface PushSubscription {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationTemplate {
  id?: string;
  type: string;
  title_template: string;
  body_template: string;
  data_template?: Record<string, any>;
  priority: NotificationPriority;
  channel: NotificationChannel;
  created_at?: string;
  updated_at?: string;
}

export interface NotificationListResponse {
  notifications: NotificationConfig[];
  total: number;
  page: number;
  limit: number;
} 