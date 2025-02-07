import type { ModerationResult, ModerationStatus, ModerationReason } from '../types';

const STATUS_LABELS: Record<ModerationStatus, string> = {
  pending: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  flagged: 'Flagged for Review',
  under_review: 'Under Review'
};

const REASON_LABELS: Record<ModerationReason, string> = {
  hate_speech: 'Hate Speech',
  harassment: 'Harassment',
  violence: 'Violence',
  adult: 'Adult Content',
  spam: 'Spam',
  copyright: 'Copyright Violation',
  misinformation: 'Misinformation',
  other: 'Other'
};

export interface FormattedModerationResult {
  id: string;
  contentId: string;
  status: {
    code: ModerationStatus;
    label: string;
    color: string;
  };
  reason?: {
    code: ModerationReason;
    label: string;
  };
  confidence: {
    value: number;
    percentage: string;
    level: 'low' | 'medium' | 'high';
  };
  moderatedBy: string;
  timing: {
    created: string;
    updated: string;
    duration?: string;
  };
}

export function formatModerationResult(result: ModerationResult): FormattedModerationResult {
  return {
    id: result.id,
    contentId: result.contentId,
    status: {
      code: result.status,
      label: STATUS_LABELS[result.status],
      color: getStatusColor(result.status)
    },
    ...(result.reason && {
      reason: {
        code: result.reason,
        label: REASON_LABELS[result.reason]
      }
    }),
    confidence: {
      value: result.confidence,
      percentage: `${Math.round(result.confidence * 100)}%`,
      level: getConfidenceLevel(result.confidence)
    },
    moderatedBy: formatModeratorType(result.moderatedBy),
    timing: {
      created: formatDate(result.createdAt),
      updated: formatDate(result.updatedAt),
      duration: calculateDuration(result.createdAt, result.updatedAt)
    }
  };
}

function getStatusColor(status: ModerationStatus): string {
  switch (status) {
    case 'approved':
      return '#4CAF50';
    case 'rejected':
      return '#F44336';
    case 'flagged':
      return '#FFC107';
    case 'under_review':
      return '#2196F3';
    default:
      return '#9E9E9E';
  }
}

function getConfidenceLevel(confidence: number): 'low' | 'medium' | 'high' {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

function formatModeratorType(type: 'ai' | 'human' | 'community'): string {
  switch (type) {
    case 'ai':
      return 'AI System';
    case 'human':
      return 'Human Moderator';
    case 'community':
      return 'Community';
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function calculateDuration(start: Date, end: Date): string {
  const duration = end.getTime() - start.getTime();
  const seconds = Math.floor(duration / 1000);

  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export function formatStats(stats: {
  totalContent: number;
  pendingReviews: number;
  approvedContent: number;
  rejectedContent: number;
  flaggedContent: number;
  averageReviewTime: number;
  appealRate: number;
  appealSuccessRate: number;
}): Record<string, string> {
  return {
    totalContent: formatNumber(stats.totalContent),
    pendingReviews: formatNumber(stats.pendingReviews),
    approvedContent: formatNumber(stats.approvedContent),
    rejectedContent: formatNumber(stats.rejectedContent),
    flaggedContent: formatNumber(stats.flaggedContent),
    averageReviewTime: formatDuration(stats.averageReviewTime),
    appealRate: formatPercentage(stats.appealRate),
    appealSuccessRate: formatPercentage(stats.appealSuccessRate)
  };
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(num);
}

function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
} 