import { Magic } from 'magic-sdk';
import { ethers } from 'ethers';

// Magic.link configuration
export const magic = typeof window !== 'undefined'
  ? new Magic(import.meta.env.VITE_MAGIC_PUBLISHABLE_KEY)
  : null;

// Web3 configuration
export const web3Config = {
  network: import.meta.env.VITE_WEB3_NETWORK || 'mainnet',
  infuraId: import.meta.env.VITE_INFURA_PROJECT_ID,
  provider: typeof window !== 'undefined'
    ? new ethers.providers.Web3Provider(window.ethereum)
    : null
};

// Authentication providers configuration
export const authProviders = {
  email: {
    enabled: true,
    requiresVerification: true
  },
  magic: {
    enabled: true,
    networks: ['ethereum', 'polygon']
  },
  web3: {
    enabled: import.meta.env.VITE_ENABLE_WEB3 === 'true',
    networks: ['ethereum', 'polygon', 'optimism', 'arbitrum']
  },
  oauth: {
    enabled: true,
    providers: ['github', 'google', 'discord']
  }
};

// Authentication settings
export const authSettings = {
  redirectUrl: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '',
  requireUsername: true,
  requireVerification: true,
  mfa: {
    enabled: true,
    required: false,
    methods: ['totp', 'sms']
  },
  session: {
    persistSession: true,
    timeoutSeconds: 3600,
    refreshIntervalSeconds: 300
  },
  security: {
    captchaEnabled: true,
    rateLimiting: {
      maxAttempts: 5,
      windowSeconds: 300
    }
  }
}; 