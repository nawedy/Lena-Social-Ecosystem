export { ModerationService } from './services/moderation-service';
export type {
  ContentType,
  ModerationStatus,
  ModerationReason,
  ModerationResult,
  ModerationConfig,
  ModerationAppeal,
  CommunityFlag,
  ModerationStats
} from './types';

// Re-export utility functions
export { isToxicContent } from './utils/content-analysis';
export { validateContent } from './utils/validation';
export { formatModerationResult } from './utils/formatting';

// Constants
export const DEFAULT_CONFIG: ModerationConfig = {
  aiThreshold: 0.8,
  requireHumanReview: true,
  autoRejectThreshold: 0.95,
  communityFlagsThreshold: 3,
  appealEnabled: true,
  appealWaitingPeriod: 24 * 60 * 60 * 1000 // 24 hours
}; 