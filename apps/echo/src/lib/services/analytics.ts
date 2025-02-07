import { supabase } from '$lib/supabaseClient';
import { PostHog } from 'posthog-js';
import { writable, derived } from 'svelte/store';

// Types
export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  userId?: string;
  timestamp?: Date;
}

export interface AnalyticsConfig {
  enabled: boolean;
  anonymize: boolean;
  providers: {
    supabase: boolean;
    posthog: boolean;
    plausible: boolean;
  };
}

export interface EngagementMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  timeSpent: number;
}

export interface UserMetrics {
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  averageEngagement: number;
}

// Configuration
const config: AnalyticsConfig = {
  enabled: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
  anonymize: true,
  providers: {
    supabase: true,
    posthog: import.meta.env.VITE_POSTHOG_TOKEN ? true : false,
    plausible: import.meta.env.VITE_PLAUSIBLE_DOMAIN ? true : false
  }
};

// Initialize PostHog
let posthog: PostHog | null = null;
if (config.providers.posthog && typeof window !== 'undefined') {
  posthog = new PostHog(import.meta.env.VITE_POSTHOG_TOKEN, {
    api_host: 'https://app.posthog.com',
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    disable_persistence: config.anonymize
  });
}

// Initialize Plausible
if (config.providers.plausible && typeof window !== 'undefined') {
  const script = document.createElement('script');
  script.defer = true;
  script.dataset.domain = import.meta.env.VITE_PLAUSIBLE_DOMAIN;
  script.src = 'https://plausible.io/js/script.js';
  document.head.appendChild(script);
}

// Analytics stores
const events = writable<AnalyticsEvent[]>([]);
const userMetrics = writable<UserMetrics>({
  totalPosts: 0,
  totalLikes: 0,
  totalComments: 0,
  totalShares: 0,
  averageEngagement: 0
});

// Derived metrics
const totalEvents = derived(events, $events => $events.length);
const eventsByType = derived(events, $events => {
  const types: Record<string, number> = {};
  $events.forEach(event => {
    types[event.name] = (types[event.name] || 0) + 1;
  });
  return types;
});

// Analytics service
export const analyticsService = {
  // Track event
  async track(event: AnalyticsEvent): Promise<void> {
    if (!config.enabled) return;

    try {
      const timestamp = event.timestamp || new Date();
      const anonymousId = crypto.randomUUID();

      // Track in Supabase
      if (config.providers.supabase) {
        await supabase.from('analytics_events').insert({
          event_type: event.name,
          user_id: config.anonymize ? null : event.userId,
          metadata: {
            ...event.properties,
            anonymous_id: anonymousId,
            timestamp: timestamp.toISOString()
          }
        });
      }

      // Track in PostHog
      if (config.providers.posthog && posthog) {
        posthog.capture(event.name, {
          ...event.properties,
          timestamp,
          distinct_id: config.anonymize ? anonymousId : event.userId
        });
      }

      // Track in Plausible
      if (config.providers.plausible && typeof window !== 'undefined') {
        const plausible = (window as any).plausible;
        if (plausible) {
          plausible(event.name, {
            props: event.properties
          });
        }
      }

      // Update local store
      events.update(current => [...current, { ...event, timestamp }]);
    } catch (error) {
      console.error('Analytics tracking error:', error);
    }
  },

  // Page view
  async trackPageView(path: string, properties?: Record<string, any>): Promise<void> {
    await this.track({
      name: 'pageview',
      properties: {
        path,
        title: document.title,
        referrer: document.referrer,
        ...properties
      }
    });
  },

  // User engagement
  async trackEngagement(
    type: 'view' | 'like' | 'comment' | 'share',
    contentId: string,
    properties?: Record<string, any>
  ): Promise<void> {
    await this.track({
      name: `content_${type}`,
      properties: {
        content_id: contentId,
        ...properties
      }
    });
  },

  // Get user metrics
  async getUserMetrics(userId: string): Promise<UserMetrics> {
    try {
      const { data, error } = await supabase
        .rpc('get_user_metrics', { user_id: userId });

      if (error) throw error;
      userMetrics.set(data);
      return data;
    } catch (error) {
      console.error('Get user metrics error:', error);
      throw new Error('Failed to get user metrics');
    }
  },

  // Get content engagement metrics
  async getEngagementMetrics(contentId: string): Promise<EngagementMetrics> {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('engagement_metrics')
        .eq('id', contentId)
        .single();

      if (error) throw error;
      return {
        views: data.engagement_metrics.views || 0,
        likes: data.engagement_metrics.likes || 0,
        comments: data.engagement_metrics.comments || 0,
        shares: data.engagement_metrics.shares || 0,
        timeSpent: data.engagement_metrics.time_spent || 0
      };
    } catch (error) {
      console.error('Get engagement metrics error:', error);
      throw new Error('Failed to get engagement metrics');
    }
  },

  // Update analytics configuration
  updateConfig(newConfig: Partial<AnalyticsConfig>): void {
    Object.assign(config, newConfig);
  },

  // Clear analytics data
  async clearData(): Promise<void> {
    if (posthog) {
      posthog.reset();
    }
    events.set([]);
  },

  // Get analytics configuration
  getConfig(): AnalyticsConfig {
    return { ...config };
  },

  // Subscribe to analytics events
  subscribe(callback: (event: AnalyticsEvent) => void) {
    return events.subscribe(($events) => {
      const lastEvent = $events[$events.length - 1];
      if (lastEvent) {
        callback(lastEvent);
      }
    });
  },

  // Get derived metrics
  metrics: {
    totalEvents,
    eventsByType
  }
}; 