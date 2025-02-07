import { describe, it, expect, beforeEach, vi } from 'vitest';
import { analyticsService } from './analytics';
import { mockSupabase } from '../../test/utils';
import { get } from 'svelte/store';

// Mock Supabase client
vi.mock('$lib/supabaseClient', () => ({
  supabase: mockSupabase
}));

// Mock PostHog
vi.mock('posthog-js', () => ({
  PostHog: vi.fn().mockImplementation(() => ({
    capture: vi.fn(),
    reset: vi.fn()
  }))
}));

// Mock Plausible
const mockPlausible = vi.fn();
Object.defineProperty(window, 'plausible', {
  value: mockPlausible,
  writable: true
});

describe('Analytics Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    analyticsService.clearData();
  });

  describe('event tracking', () => {
    const mockEvent = {
      name: 'test_event',
      properties: { key: 'value' },
      userId: 'user-123'
    };

    it('should track event in Supabase', async () => {
      await analyticsService.track(mockEvent);

      expect(mockSupabase.from).toHaveBeenCalledWith('analytics_events');
      expect(mockSupabase.from().insert).toHaveBeenCalledWith({
        event_type: mockEvent.name,
        user_id: expect.any(String),
        metadata: expect.objectContaining({
          key: 'value',
          anonymous_id: expect.any(String),
          timestamp: expect.any(String)
        })
      });
    });

    it('should track event in PostHog when enabled', async () => {
      analyticsService.updateConfig({
        enabled: true,
        providers: { posthog: true, supabase: false, plausible: false }
      });

      await analyticsService.track(mockEvent);

      const posthogInstance = require('posthog-js').PostHog.mock.results[0].value;
      expect(posthogInstance.capture).toHaveBeenCalledWith(
        mockEvent.name,
        expect.objectContaining({
          ...mockEvent.properties,
          timestamp: expect.any(Date),
          distinct_id: expect.any(String)
        })
      );
    });

    it('should track event in Plausible when enabled', async () => {
      analyticsService.updateConfig({
        enabled: true,
        providers: { plausible: true, supabase: false, posthog: false }
      });

      await analyticsService.track(mockEvent);

      expect(mockPlausible).toHaveBeenCalledWith(mockEvent.name, {
        props: mockEvent.properties
      });
    });

    it('should not track events when disabled', async () => {
      analyticsService.updateConfig({ enabled: false });

      await analyticsService.track(mockEvent);

      expect(mockSupabase.from).not.toHaveBeenCalled();
      expect(mockPlausible).not.toHaveBeenCalled();
    });
  });

  describe('page views', () => {
    it('should track page views', async () => {
      const path = '/test-page';
      await analyticsService.trackPageView(path);

      expect(mockSupabase.from).toHaveBeenCalledWith('analytics_events');
      expect(mockSupabase.from().insert).toHaveBeenCalledWith(expect.objectContaining({
        event_type: 'pageview',
        metadata: expect.objectContaining({
          path,
          title: document.title,
          referrer: document.referrer
        })
      }));
    });
  });

  describe('engagement tracking', () => {
    it('should track content engagement', async () => {
      const contentId = 'content-123';
      await analyticsService.trackEngagement('view', contentId);

      expect(mockSupabase.from).toHaveBeenCalledWith('analytics_events');
      expect(mockSupabase.from().insert).toHaveBeenCalledWith(expect.objectContaining({
        event_type: 'content_view',
        metadata: expect.objectContaining({
          content_id: contentId
        })
      }));
    });
  });

  describe('user metrics', () => {
    const mockMetrics = {
      totalPosts: 10,
      totalLikes: 50,
      totalComments: 20,
      totalShares: 5,
      averageEngagement: 0.75
    };

    it('should get user metrics', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: mockMetrics, error: null });

      const metrics = await analyticsService.getUserMetrics('user-123');

      expect(metrics).toEqual(mockMetrics);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_user_metrics', {
        user_id: 'user-123'
      });
    });

    it('should handle user metrics errors', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: new Error('Database error')
      });

      await expect(analyticsService.getUserMetrics('user-123')).rejects.toThrow(
        'Failed to get user metrics'
      );
    });
  });

  describe('engagement metrics', () => {
    const mockEngagement = {
      views: 100,
      likes: 50,
      comments: 20,
      shares: 10,
      timeSpent: 300
    };

    it('should get content engagement metrics', async () => {
      mockSupabase.from().select.mockResolvedValueOnce({
        data: { engagement_metrics: mockEngagement },
        error: null
      });

      const metrics = await analyticsService.getEngagementMetrics('content-123');

      expect(metrics).toEqual(mockEngagement);
      expect(mockSupabase.from).toHaveBeenCalledWith('posts');
      expect(mockSupabase.from().select).toHaveBeenCalledWith('engagement_metrics');
    });

    it('should handle engagement metrics errors', async () => {
      mockSupabase.from().select.mockResolvedValueOnce({
        data: null,
        error: new Error('Database error')
      });

      await expect(analyticsService.getEngagementMetrics('content-123')).rejects.toThrow(
        'Failed to get engagement metrics'
      );
    });
  });

  describe('configuration', () => {
    it('should update analytics configuration', () => {
      const newConfig = {
        enabled: false,
        anonymize: true,
        providers: {
          supabase: false,
          posthog: false,
          plausible: false
        }
      };

      analyticsService.updateConfig(newConfig);
      const config = analyticsService.getConfig();

      expect(config).toEqual(expect.objectContaining(newConfig));
    });
  });

  describe('event subscription', () => {
    it('should notify subscribers of new events', async () => {
      const mockCallback = vi.fn();
      const unsubscribe = analyticsService.subscribe(mockCallback);

      const event = {
        name: 'test_event',
        properties: { key: 'value' }
      };

      await analyticsService.track(event);

      expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
        name: event.name,
        properties: event.properties
      }));

      unsubscribe();
    });
  });

  describe('derived metrics', () => {
    it('should calculate total events', async () => {
      await analyticsService.track({ name: 'event1' });
      await analyticsService.track({ name: 'event2' });

      const totalEvents = get(analyticsService.metrics.totalEvents);
      expect(totalEvents).toBe(2);
    });

    it('should calculate events by type', async () => {
      await analyticsService.track({ name: 'type1' });
      await analyticsService.track({ name: 'type1' });
      await analyticsService.track({ name: 'type2' });

      const eventsByType = get(analyticsService.metrics.eventsByType);
      expect(eventsByType).toEqual({
        type1: 2,
        type2: 1
      });
    });
  });
}); 