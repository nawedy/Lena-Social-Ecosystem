import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import { useATProto } from './ATProtoContext';
import { betaConfig } from '../config/beta';

interface BetaContextType {
  isBetaUser: boolean;
  canAccessBeta: boolean;
  submitFeedback: (feedback: FeedbackData) => Promise<void>;
  reportBug: (bug: BugReport) => Promise<void>;
  requestFeature: (feature: FeatureRequest) => Promise<void>;
  featureEnabled: (featureName: string) => boolean;
}

interface FeedbackData {
  type: 'general' | 'ux' | 'performance' | 'other';
  content: string;
  rating?: number;
  metadata?: Record<string, any>;
}

interface BugReport {
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  steps?: string[];
  metadata?: Record<string, any>;
}

interface FeatureRequest {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  useCase?: string;
  metadata?: Record<string, any>;
}

const _BetaContext = createContext<BetaContextType | null>(null);

export const _useBeta = () => {
  const _context = useContext(BetaContext);
  if (!context) {
    throw new Error('useBeta must be used within a BetaProvider');
  }
  return context;
};

export const BetaProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { session } = useATProto();
  const [isBetaUser, setIsBetaUser] = useState(false);
  const [betaUserCount, setBetaUserCount] = useState(0);

  useEffect(() => {
    const _checkBetaStatus = async () => {
      if (session?.did) {
        try {
          const _response = await fetch('/api/beta/status', {
            headers: {
              Authorization: `Bearer ${session.accessJwt}`,
            },
          });
          const _data = await response.json();
          setIsBetaUser(data.isBetaUser);
          setBetaUserCount(data.betaUserCount);
        } catch (error) {
          console.error('Failed to check beta status:', error);
          setIsBetaUser(false);
        }
      }
    };

    checkBetaStatus();
  }, [session]);

  const _canAccessBeta = isBetaUser && betaUserCount < betaConfig.maxBetaUsers;

  const _submitFeedback = useCallback(
    async (feedback: FeedbackData) => {
      if (!session?.did || !betaConfig.feedbackEnabled) {
        throw new Error('Feedback submission is not available');
      }

      const _response = await fetch('/api/beta/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessJwt}`,
        },
        body: JSON.stringify({
          ...feedback,
          timestamp: new Date().toISOString(),
          userId: session.did,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }
    },
    [session]
  );

  const _reportBug = useCallback(
    async (bug: BugReport) => {
      if (!session?.did || !betaConfig.feedbackEnabled) {
        throw new Error('Bug reporting is not available');
      }

      const _response = await fetch('/api/beta/bugs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessJwt}`,
        },
        body: JSON.stringify({
          ...bug,
          timestamp: new Date().toISOString(),
          userId: session.did,
          userAgent: navigator.userAgent,
          version: process.env.REACT_APP_VERSION,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to report bug');
      }
    },
    [session]
  );

  const _requestFeature = useCallback(
    async (feature: FeatureRequest) => {
      if (!session?.did || !betaConfig.feedbackEnabled) {
        throw new Error('Feature requests are not available');
      }

      const _response = await fetch('/api/beta/features', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessJwt}`,
        },
        body: JSON.stringify({
          ...feature,
          timestamp: new Date().toISOString(),
          userId: session.did,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit feature request');
      }
    },
    [session]
  );

  const _featureEnabled = useCallback((featureName: string) => {
    return betaConfig.featureFlags[featureName] ?? false;
  }, []);

  return (
    <BetaContext.Provider
      value={{
        isBetaUser,
        canAccessBeta,
        submitFeedback,
        reportBug,
        requestFeature,
        featureEnabled,
      }}
    >
      {children}
    </BetaContext.Provider>
  );
};
