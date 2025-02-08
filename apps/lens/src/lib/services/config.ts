import { api } from './api';
import type { ApiResponse } from '$lib/types';
import { writable, derived } from 'svelte/store';
import { supabase } from '$lib/supabase';

interface AppConfig {
  features: {
    stories: boolean;
    collections: boolean;
    monetization: boolean;
    analytics: boolean;
    notifications: boolean;
    web3Auth: boolean;
    ipfsStorage: boolean;
    decentralizedSocial: boolean;
  };
  limits: {
    maxUploadSize: number;
    maxDuration: number;
    maxCollections: number;
    maxStoriesPerDay: number;
  };
  monetization: {
    currencies: string[];
    minPayoutAmount: number;
    platformFee: number;
    subscriptionTiers: Array<{
      id: string;
      name: string;
      price: number;
      features: string[];
    }>;
  };
  storage: {
    ipfsGateway: string;
    cdnEndpoint: string;
    allowedFileTypes: string[];
  };
  api: {
    endpoints: Record<string, string>;
    rateLimit: number;
    timeout: number;
  };
  ui: {
    theme: {
      primary: string;
      secondary: string;
      accent: string;
      background: string;
      text: string;
    };
    layout: {
      maxWidth: number;
      sidebarWidth: number;
      headerHeight: number;
    };
  };
  analytics: {
    trackingEnabled: boolean;
    privacyPreserving: boolean;
    retentionPeriod: number;
  };
  security: {
    mfaEnabled: boolean;
    passwordPolicy: {
      minLength: number;
      requireNumbers: boolean;
      requireSymbols: boolean;
      requireUppercase: boolean;
    };
    sessionTimeout: number;
  };
}

interface ConfigState {
  config: AppConfig | null;
  environment: 'development' | 'staging' | 'production';
  loading: boolean;
  error: string | null;
}

const DEFAULT_CONFIG: AppConfig = {
  features: {
    stories: true,
    collections: true,
    monetization: true,
    analytics: true,
    notifications: true,
    web3Auth: true,
    ipfsStorage: true,
    decentralizedSocial: true
  },
  limits: {
    maxUploadSize: 100 * 1024 * 1024, // 100MB
    maxDuration: 10 * 60, // 10 minutes
    maxCollections: 50,
    maxStoriesPerDay: 24
  },
  monetization: {
    currencies: ['USD', 'EUR', 'GBP'],
    minPayoutAmount: 100,
    platformFee: 0.05,
    subscriptionTiers: [
      {
        id: 'basic',
        name: 'Basic',
        price: 4.99,
        features: ['HD streaming', 'Ad-free viewing']
      },
      {
        id: 'premium',
        name: 'Premium',
        price: 9.99,
        features: ['4K streaming', 'Offline downloads', 'Exclusive content']
      }
    ]
  },
  storage: {
    ipfsGateway: 'https://ipfs.io/ipfs/',
    cdnEndpoint: 'https://cdn.lens.example.com',
    allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm']
  },
  api: {
    endpoints: {
      graphql: '/graphql',
      rest: '/api/v1'
    },
    rateLimit: 100,
    timeout: 30000
  },
  ui: {
    theme: {
      primary: '#6366F1',
      secondary: '#4F46E5',
      accent: '#EC4899',
      background: '#F9FAFB',
      text: '#111827'
    },
    layout: {
      maxWidth: 1280,
      sidebarWidth: 280,
      headerHeight: 64
    }
  },
  analytics: {
    trackingEnabled: true,
    privacyPreserving: true,
    retentionPeriod: 90
  },
  security: {
    mfaEnabled: true,
    passwordPolicy: {
      minLength: 12,
      requireNumbers: true,
      requireSymbols: true,
      requireUppercase: true
    },
    sessionTimeout: 3600
  }
};

function createConfigStore() {
  const { subscribe, set, update } = writable<ConfigState>({
    config: null,
    environment: 'development',
    loading: false,
    error: null
  });

  let realtimeSubscription: any = null;

  return {
    subscribe,
    set,
    update,

    /**
     * Initialize configuration and subscribe to real-time updates
     */
    initialize: async () => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        // Get environment
        const environment = import.meta.env.MODE as 'development' | 'staging' | 'production';

        // Get initial configuration
        const { data: config, error } = await api.get<AppConfig>('/config');
        if (error) throw error;

        // Subscribe to real-time config updates
        realtimeSubscription = supabase
          .channel('config')
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'app_config'
          }, payload => {
            const newConfig = payload.new as AppConfig;
            update(state => ({
              ...state,
              config: newConfig
            }));
          })
          .subscribe();

        // Set initial state
        set({
          config: config || DEFAULT_CONFIG,
          environment,
          loading: false,
          error: null
        });

        return { error: null };
      } catch (error) {
        console.error('Failed to initialize config:', error);
        update(state => ({ 
          ...state, 
          config: DEFAULT_CONFIG,
          error: error.message,
          loading: false 
        }));
        return { error };
      }
    },

    /**
     * Update configuration
     */
    updateConfig: async (updates: Partial<AppConfig>): Promise<ApiResponse<AppConfig>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const { data: config, error } = await api.put<AppConfig>('/config', updates);
        if (error) throw error;

        if (config) {
          update(state => ({ ...state, config }));
        }

        return { data: config };
      } catch (error) {
        console.error('Failed to update config:', error);
        update(state => ({ ...state, error: error.message }));
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Reset configuration to defaults
     */
    resetConfig: async (): Promise<ApiResponse<AppConfig>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const { data: config, error } = await api.post<AppConfig>('/config/reset');
        if (error) throw error;

        if (config) {
          update(state => ({ ...state, config }));
        }

        return { data: config };
      } catch (error) {
        console.error('Failed to reset config:', error);
        update(state => ({ ...state, error: error.message }));
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Clean up subscriptions
     */
    cleanup: () => {
      if (realtimeSubscription) {
        realtimeSubscription.unsubscribe();
        realtimeSubscription = null;
      }
    }
  };
}

// Create config store instance
export const config = createConfigStore();

// Derived stores
export const features = derived(config, $config => $config.config?.features || DEFAULT_CONFIG.features);
export const limits = derived(config, $config => $config.config?.limits || DEFAULT_CONFIG.limits);
export const monetizationConfig = derived(config, $config => $config.config?.monetization || DEFAULT_CONFIG.monetization);
export const storageConfig = derived(config, $config => $config.config?.storage || DEFAULT_CONFIG.storage);
export const apiConfig = derived(config, $config => $config.config?.api || DEFAULT_CONFIG.api);
export const uiConfig = derived(config, $config => $config.config?.ui || DEFAULT_CONFIG.ui);
export const analyticsConfig = derived(config, $config => $config.config?.analytics || DEFAULT_CONFIG.analytics);
export const securityConfig = derived(config, $config => $config.config?.security || DEFAULT_CONFIG.security);
export const environment = derived(config, $config => $config.environment);
export const isLoading = derived(config, $config => $config.loading);
export const error = derived(config, $config => $config.error);

// Helper functions
export function isFeatureEnabled(feature: keyof AppConfig['features']): boolean {
  return config?.config?.features[feature] || DEFAULT_CONFIG.features[feature];
}

export function getLimit(limit: keyof AppConfig['limits']): number {
  return config?.config?.limits[limit] || DEFAULT_CONFIG.limits[limit];
}

export function getEndpoint(endpoint: keyof AppConfig['api']['endpoints']): string {
  return config?.config?.api.endpoints[endpoint] || DEFAULT_CONFIG.api.endpoints[endpoint];
}

export function getThemeColor(color: keyof AppConfig['ui']['theme']): string {
  return config?.config?.ui.theme[color] || DEFAULT_CONFIG.ui.theme[color];
} 