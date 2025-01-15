export interface PrivacySettings {
  dataSharing: 'public' | 'followers' | 'private';
  activityTracking: boolean;
  encryptionEnabled: boolean;
}

export interface MonetizationRules {
  contentPricing?: {
    amount: number;
    currency: string;
  };
  subscriptionTiers?: {
    name: string;
    price: number;
    benefits: string[];
  }[];
}

export interface Connection {
  did: string;
  handle: string;
  followedAt: Date;
  following: boolean;
  followedBy: boolean;
}

export interface SocialGraph {
  connections: Connection[];
  lastSync: Date;
}

export interface FilterConfig {
  contentTypes: string[];
  languages: string[];
  minimumRating?: number;
  blockedKeywords: string[];
}
