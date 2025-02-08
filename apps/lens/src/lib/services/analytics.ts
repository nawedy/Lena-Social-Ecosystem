import { api } from './api';
import type { 
  AnalyticsEvent, 
  AnalyticsMetrics, 
  EngagementMetrics, 
  ViewerDemographics,
  RetentionData,
  PaginatedResponse, 
  ApiResponse 
} from '$lib/types';
import { writable, derived } from 'svelte/store';
import { supabase } from '$lib/supabase';

interface AnalyticsState {
  events: Record<string, AnalyticsEvent[]>;
  metrics: Record<string, AnalyticsMetrics>;
  engagement: Record<string, EngagementMetrics>;
  demographics: Record<string, ViewerDemographics>;
  retention: Record<string, RetentionData>;
  loading: boolean;
  error: string | null;
}

function createAnalyticsStore() {
  const { subscribe, set, update } = writable<AnalyticsState>({
    events: {},
    metrics: {},
    engagement: {},
    demographics: {},
    retention: {},
    loading: false,
    error: null
  });

  let realtimeSubscription: any = null;

  return {
    subscribe,
    set,
    update,

    /**
     * Initialize analytics and subscribe to real-time updates
     */
    initialize: async () => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        // Subscribe to real-time analytics events
        realtimeSubscription = supabase
          .channel('analytics')
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'analytics_events'
          }, payload => {
            const event = payload.new as AnalyticsEvent;
            update(state => ({
              ...state,
              events: {
                ...state.events,
                [event.contentId]: [
                  ...(state.events[event.contentId] || []),
                  event
                ]
              }
            }));
          })
          .subscribe();

        return { error: null };
      } catch (error) {
        console.error('Failed to initialize analytics:', error);
        update(state => ({ ...state, error: error.message }));
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Track an analytics event
     */
    trackEvent: async (event: {
      type: string;
      contentId: string;
      contentType: string;
      data?: Record<string, any>;
    }): Promise<ApiResponse<AnalyticsEvent>> => {
      try {
        const { data: analyticsEvent, error } = await api.post<AnalyticsEvent>('/analytics/events', event);
        if (error) throw error;

        if (analyticsEvent) {
          update(state => ({
            ...state,
            events: {
              ...state.events,
              [analyticsEvent.contentId]: [
                ...(state.events[analyticsEvent.contentId] || []),
                analyticsEvent
              ]
            }
          }));
        }

        return { data: analyticsEvent };
      } catch (error) {
        console.error('Failed to track event:', error);
        return { error };
      }
    },

    /**
     * Get analytics metrics for content
     */
    getMetrics: async (contentId: string, params?: {
      startDate?: string;
      endDate?: string;
    }): Promise<ApiResponse<AnalyticsMetrics>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const { data: metrics, error } = await api.get<AnalyticsMetrics>(`/analytics/metrics/${contentId}`, params);
        if (error) throw error;

        if (metrics) {
          update(state => ({
            ...state,
            metrics: { ...state.metrics, [contentId]: metrics }
          }));
        }

        return { data: metrics };
      } catch (error) {
        console.error('Failed to get metrics:', error);
        update(state => ({ ...state, error: error.message }));
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Get engagement metrics for content
     */
    getEngagement: async (contentId: string, params?: {
      startDate?: string;
      endDate?: string;
    }): Promise<ApiResponse<EngagementMetrics>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const { data: engagement, error } = await api.get<EngagementMetrics>(`/analytics/engagement/${contentId}`, params);
        if (error) throw error;

        if (engagement) {
          update(state => ({
            ...state,
            engagement: { ...state.engagement, [contentId]: engagement }
          }));
        }

        return { data: engagement };
      } catch (error) {
        console.error('Failed to get engagement metrics:', error);
        update(state => ({ ...state, error: error.message }));
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Get viewer demographics for content
     */
    getDemographics: async (contentId: string, params?: {
      startDate?: string;
      endDate?: string;
    }): Promise<ApiResponse<ViewerDemographics>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const { data: demographics, error } = await api.get<ViewerDemographics>(`/analytics/demographics/${contentId}`, params);
        if (error) throw error;

        if (demographics) {
          update(state => ({
            ...state,
            demographics: { ...state.demographics, [contentId]: demographics }
          }));
        }

        return { data: demographics };
      } catch (error) {
        console.error('Failed to get demographics:', error);
        update(state => ({ ...state, error: error.message }));
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Get retention data for content
     */
    getRetention: async (contentId: string, params?: {
      startDate?: string;
      endDate?: string;
    }): Promise<ApiResponse<RetentionData>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const { data: retention, error } = await api.get<RetentionData>(`/analytics/retention/${contentId}`, params);
        if (error) throw error;

        if (retention) {
          update(state => ({
            ...state,
            retention: { ...state.retention, [contentId]: retention }
          }));
        }

        return { data: retention };
      } catch (error) {
        console.error('Failed to get retention data:', error);
        update(state => ({ ...state, error: error.message }));
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Get analytics events with pagination
     */
    getEvents: async (contentId: string, params?: {
      page?: number;
      perPage?: number;
      startDate?: string;
      endDate?: string;
      type?: string;
    }): Promise<PaginatedResponse<AnalyticsEvent>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const response = await api.getPaginated<AnalyticsEvent>(`/analytics/events/${contentId}`, params);

        update(state => ({
          ...state,
          events: {
            ...state.events,
            [contentId]: response.items
          }
        }));

        return response;
      } catch (error) {
        console.error('Failed to get events:', error);
        update(state => ({ ...state, error: error.message }));
        throw error;
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Export analytics data
     */
    exportData: async (params: {
      contentId?: string;
      startDate?: string;
      endDate?: string;
      format?: 'csv' | 'json';
    }): Promise<ApiResponse<string>> => {
      try {
        const { data: url, error } = await api.post<string>('/analytics/export', params);
        return { data: url, error };
      } catch (error) {
        console.error('Failed to export analytics data:', error);
        return { error };
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
    },

    /**
     * Clear store state
     */
    clear: () => {
      set({
        events: {},
        metrics: {},
        engagement: {},
        demographics: {},
        retention: {},
        loading: false,
        error: null
      });
    }
  };
}

// Create analytics store instance
export const analytics = createAnalyticsStore();

// Derived stores
export const getContentEvents = (contentId: string) => derived(analytics, $analytics => 
  $analytics.events[contentId] || []
);
export const getContentMetrics = (contentId: string) => derived(analytics, $analytics => 
  $analytics.metrics[contentId]
);
export const getContentEngagement = (contentId: string) => derived(analytics, $analytics => 
  $analytics.engagement[contentId]
);
export const getContentDemographics = (contentId: string) => derived(analytics, $analytics => 
  $analytics.demographics[contentId]
);
export const getContentRetention = (contentId: string) => derived(analytics, $analytics => 
  $analytics.retention[contentId]
);
export const isLoading = derived(analytics, $analytics => $analytics.loading);
export const error = derived(analytics, $analytics => $analytics.error); 