export interface BetaConfig {
  maxBetaUsers: number;
  feedbackEnabled: boolean;
  analyticsEnabled: boolean;
  featureFlags: Record<string, boolean>;
  betaEndDate: string;
}

export const betaConfig: BetaConfig = {
  maxBetaUsers: 1000,
  feedbackEnabled: true,
  analyticsEnabled: true,
  featureFlags: {
    contentCreation: true,
    socialFeatures: true,
    commerce: false,
    advancedAnalytics: false,
  },
  betaEndDate: '2025-02-17',
};
