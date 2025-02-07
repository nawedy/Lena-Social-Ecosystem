export { AnalyticsService } from './lib/analytics-service';
export type {
  AnalyticsConfig,
  AnalyticsProvider,
  EventProperties,
  UserProperties,
  ContentEngagement,
  ContentAnalytics,
  UserAnalytics,
  AnalyticsReport,
  RealtimeAnalytics
} from './types';

// Default configuration
export const DEFAULT_ANALYTICS_CONFIG = {
  provider: 'plausible' as const,
  options: {
    debug: false,
    disableInDevelopment: true,
    anonymizeIp: true,
    respectDoNotTrack: true
  }
};

// Event names
export const ANALYTICS_EVENTS = {
  // Content events
  CONTENT_VIEW: 'content_view',
  CONTENT_LIKE: 'content_like',
  CONTENT_SHARE: 'content_share',
  CONTENT_COMMENT: 'content_comment',
  CONTENT_WATCH: 'content_watch',
  
  // User events
  USER_SIGNUP: 'user_signup',
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  USER_UPDATE: 'user_update',
  
  // Session events
  SESSION_START: 'session_start',
  SESSION_END: 'session_end',
  
  // Error events
  ERROR: 'error',
  API_ERROR: 'api_error',
  VALIDATION_ERROR: 'validation_error'
} as const;

// Re-export utility functions
export { generateSessionId } from './lib/utils/session';
export { anonymizeIp } from './lib/utils/privacy';
export { calculateEngagementScore } from './lib/utils/metrics'; 