import React, { createContext, useContext, useState, useEffect } from 'react';

import { betaConfig } from '../config/beta';

import { useATProto } from './ATProtoContext';

interface BetaContextType {
  isBetaUser: boolean;
  betaUserCount: number;
  submitFeedback: (feedback: BetaFeedback) => Promise<void>;
  reportIssue: (issue: BetaIssue) => Promise<void>;
  requestFeature: (feature: FeatureRequest) => Promise<void>;
}

interface BetaFeedback {
  type: 'bug' | 'feature' | 'general';
  content: string;
  rating?: number;
  metadata?: Record<string, string | number | boolean>;
}

interface BetaIssue {
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  steps?: string[];
  metadata?: Record<string, string | number | boolean>;
}

interface FeatureRequest {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  useCase?: string;
  metadata?: Record<string, string | number | boolean>;
}

const BetaContext = createContext<BetaContextType | null>(null);

export const useBeta = () => {
  const context = useContext(BetaContext);
  if (!context) {
    throw new Error('useBeta must be used within a BetaProvider');
  }
  return context;
};

interface BetaProviderProps {
  children: React.ReactNode;
}

export const BetaProvider: React.FC<BetaProviderProps> = ({ children }) => {
  const { agent } = useATProto();
  const [isBetaUser, setIsBetaUser] = useState(false);
  const [betaUserCount, setBetaUserCount] = useState(0);

  useEffect(() => {
    const checkBetaStatus = async () => {
      try {
        const response = await fetch('/api/beta/status', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        const data = await response.json();
        setIsBetaUser(data.isBetaUser);
        setBetaUserCount(data.betaUserCount);
      } catch (error) {
        console.error('Failed to check beta status:', error);
      }
    };

    checkBetaStatus();
  }, []);

  const submitFeedback = async (feedback: BetaFeedback) => {
    if (!agent?.session?.did || !betaConfig.feedbackEnabled) {
      throw new Error('Feedback submission is not available');
    }

    try {
      const response = await fetch('/api/beta/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.session.accessJwt}`,
        },
        body: JSON.stringify({
          ...feedback,
          timestamp: new Date().toISOString(),
          userId: agent.session.did,
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      throw error;
    }
  };

  const reportIssue = async (issue: BetaIssue) => {
    if (!agent?.session?.did || !betaConfig.feedbackEnabled) {
      throw new Error('Issue reporting is not available');
    }

    try {
      const response = await fetch('/api/beta/issues', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.session.accessJwt}`,
        },
        body: JSON.stringify({
          ...issue,
          timestamp: new Date().toISOString(),
          userId: agent.session.did,
          userAgent: navigator.userAgent,
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to report issue');
      }
    } catch (error) {
      console.error('Failed to report issue:', error);
      throw error;
    }
  };

  const requestFeature = async (feature: FeatureRequest) => {
    if (!agent?.session?.did || !betaConfig.feedbackEnabled) {
      throw new Error('Feature requests are not available');
    }

    try {
      const response = await fetch('/api/beta/features', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agent.session.accessJwt}`,
        },
        body: JSON.stringify({
          ...feature,
          timestamp: new Date().toISOString(),
          userId: agent.session.did,
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to request feature');
      }
    } catch (error) {
      console.error('Failed to request feature:', error);
      throw error;
    }
  };

  const value: BetaContextType = {
    isBetaUser,
    betaUserCount,
    submitFeedback,
    reportIssue,
    requestFeature,
  };

  return <BetaContext.Provider value={value}>{children}</BetaContext.Provider>;
};
