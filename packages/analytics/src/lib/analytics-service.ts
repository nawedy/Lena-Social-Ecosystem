import Plausible from '@plausible/tracker';
import PostHog from 'posthog-js';
import * as ackeeTracker from 'ackee-tracker';
import mixpanel from 'mixpanel-browser';
import * as amplitude from '@amplitude/analytics-browser';
import { createClient } from '@supabase/supabase-js';
import type {
  AnalyticsConfig,
  EventProperties,
  UserProperties,
  ContentEngagement,
  ContentAnalytics,
  UserAnalytics,
  AnalyticsReport,
  RealtimeAnalytics
} from '../types';

export class AnalyticsService {
  private config: AnalyticsConfig;
  private initialized = false;
  private trackers: Record<string, any> = {};

  constructor(config: AnalyticsConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const { provider, options } = this.config;

    // Skip initialization in development if configured
    if (options?.disableInDevelopment && process.env.NODE_ENV === 'development') {
      console.warn('Analytics disabled in development mode');
      return;
    }

    try {
      switch (provider) {
        case 'plausible':
          if (!this.config.plausible) throw new Error('Plausible configuration missing');
          this.trackers.plausible = Plausible({
            domain: this.config.plausible.domain,
            apiHost: this.config.plausible.apiHost,
            trackLocalhost: true
          });
          break;

        case 'posthog':
          if (!this.config.posthog) throw new Error('PostHog configuration missing');
          PostHog.init(this.config.posthog.apiKey, {
            api_host: this.config.posthog.host || 'https://app.posthog.com',
            autocapture: true,
            capture_pageview: true,
            capture_pageleave: true,
            disable_session_recording: options?.anonymizeIp || false,
            respect_dnt: options?.respectDoNotTrack || false
          });
          this.trackers.posthog = PostHog;
          break;

        case 'ackee':
          if (!this.config.ackee) throw new Error('Ackee configuration missing');
          this.trackers.ackee = ackeeTracker.create(
            this.config.ackee.server,
            {
              detailed: true,
              ignoreLocalhost: false
            }
          );
          this.trackers.ackee.record(this.config.ackee.domainId);
          break;

        case 'mixpanel':
          if (!this.config.mixpanel) throw new Error('Mixpanel configuration missing');
          mixpanel.init(this.config.mixpanel.token, {
            debug: options?.debug || false,
            ignore_dnt: !options?.respectDoNotTrack
          });
          this.trackers.mixpanel = mixpanel;
          break;

        case 'amplitude':
          if (!this.config.amplitude) throw new Error('Amplitude configuration missing');
          amplitude.init(this.config.amplitude.apiKey, {
            logLevel: options?.debug ? amplitude.Types.LogLevel.Debug : amplitude.Types.LogLevel.None
          });
          this.trackers.amplitude = amplitude;
          break;

        case 'supabase':
          if (!this.config.supabase) throw new Error('Supabase configuration missing');
          this.trackers.supabase = createClient(
            this.config.supabase.url,
            this.config.supabase.key
          );
          break;

        default:
          throw new Error(`Unsupported analytics provider: ${provider}`);
      }

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize analytics:', error);
      throw error;
    }
  }

  async trackEvent(
    eventName: string,
    properties: EventProperties = {},
    userId?: string
  ): Promise<void> {
    if (!this.initialized) throw new Error('Analytics not initialized');

    const { provider } = this.config;
    const timestamp = new Date();

    try {
      switch (provider) {
        case 'plausible':
          this.trackers.plausible.trackEvent(eventName, { props: properties });
          break;

        case 'posthog':
          this.trackers.posthog.capture(eventName, {
            ...properties,
            timestamp,
            distinct_id: userId
          });
          break;

        case 'ackee':
          this.trackers.ackee.action(this.config.ackee!.domainId, {
            key: eventName,
            value: JSON.stringify(properties)
          });
          break;

        case 'mixpanel':
          if (userId) {
            this.trackers.mixpanel.identify(userId);
          }
          this.trackers.mixpanel.track(eventName, {
            ...properties,
            timestamp
          });
          break;

        case 'amplitude':
          this.trackers.amplitude.track(eventName, {
            ...properties,
            user_id: userId
          });
          break;

        case 'supabase':
          await this.trackers.supabase
            .from('analytics_events')
            .insert({
              event_name: eventName,
              properties,
              user_id: userId,
              timestamp
            });
          break;
      }
    } catch (error) {
      console.error('Failed to track event:', error);
      throw error;
    }
  }

  async identifyUser(properties: UserProperties): Promise<void> {
    if (!this.initialized) throw new Error('Analytics not initialized');

    const { provider } = this.config;
    const { id, ...traits } = properties;

    try {
      switch (provider) {
        case 'posthog':
          this.trackers.posthog.identify(id, traits);
          break;

        case 'mixpanel':
          this.trackers.mixpanel.identify(id);
          this.trackers.mixpanel.people.set(traits);
          break;

        case 'amplitude':
          this.trackers.amplitude.setUserId(id);
          this.trackers.amplitude.setUserProperties(traits);
          break;

        case 'supabase':
          await this.trackers.supabase
            .from('analytics_users')
            .upsert({
              user_id: id,
              properties: traits,
              updated_at: new Date()
            });
          break;
      }
    } catch (error) {
      console.error('Failed to identify user:', error);
      throw error;
    }
  }

  async trackContentEngagement(engagement: ContentEngagement): Promise<void> {
    if (!this.initialized) throw new Error('Analytics not initialized');

    const eventName = `content_${engagement.type}`;
    const properties = {
      content_id: engagement.contentId,
      session_id: engagement.sessionId,
      duration: engagement.duration,
      progress: engagement.progress,
      ...engagement.metadata
    };

    await this.trackEvent(eventName, properties, engagement.userId);

    // If using Supabase, also store in analytics tables
    if (this.config.provider === 'supabase') {
      await this.trackers.supabase
        .from('content_engagements')
        .insert({
          content_id: engagement.contentId,
          user_id: engagement.userId,
          session_id: engagement.sessionId,
          type: engagement.type,
          duration: engagement.duration,
          progress: engagement.progress,
          metadata: engagement.metadata,
          timestamp: engagement.timestamp
        });

      // Update aggregated metrics
      await this.trackers.supabase.rpc('update_content_analytics', {
        p_content_id: engagement.contentId,
        p_engagement_type: engagement.type,
        p_duration: engagement.duration
      });
    }
  }

  async getContentAnalytics(contentId: string): Promise<ContentAnalytics> {
    if (!this.initialized) throw new Error('Analytics not initialized');

    if (this.config.provider !== 'supabase') {
      throw new Error('Content analytics are only available with Supabase provider');
    }

    const { data, error } = await this.trackers.supabase
      .from('content_analytics')
      .select('*')
      .eq('content_id', contentId)
      .single();

    if (error) throw error;
    return data;
  }

  async getUserAnalytics(userId: string): Promise<UserAnalytics> {
    if (!this.initialized) throw new Error('Analytics not initialized');

    if (this.config.provider !== 'supabase') {
      throw new Error('User analytics are only available with Supabase provider');
    }

    const { data, error } = await this.trackers.supabase
      .from('user_analytics')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data;
  }

  async generateReport(
    startDate: Date,
    endDate: Date,
    period: AnalyticsReport['period'] = 'day'
  ): Promise<AnalyticsReport> {
    if (!this.initialized) throw new Error('Analytics not initialized');

    if (this.config.provider !== 'supabase') {
      throw new Error('Analytics reports are only available with Supabase provider');
    }

    const { data, error } = await this.trackers.supabase.rpc(
      'generate_analytics_report',
      {
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString(),
        p_period: period
      }
    );

    if (error) throw error;
    return data;
  }

  async getRealtimeAnalytics(): Promise<RealtimeAnalytics> {
    if (!this.initialized) throw new Error('Analytics not initialized');

    if (this.config.provider !== 'supabase') {
      throw new Error('Realtime analytics are only available with Supabase provider');
    }

    const { data, error } = await this.trackers.supabase.rpc('get_realtime_analytics');

    if (error) throw error;
    return data;
  }
} 