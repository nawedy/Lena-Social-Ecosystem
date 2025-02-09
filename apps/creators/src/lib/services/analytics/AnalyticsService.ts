import { browser } from '$app/environment';
import { writable, derived } from 'svelte/store';
import { supabase } from '$lib/supabaseClient';

interface ContentMetrics {
  id: string;
  contentId: string;
  contentType: 'video' | 'audio' | 'post' | 'stream';
  views: number;
  uniqueViewers: number;
  totalWatchTime: number;
  averageWatchTime: number;
  completionRate: number;
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    saves: number;
  };
  retention: Array<{
    timestamp: number;
    viewers: number;
  }>;
  demographics: {
    age?: Record<string, number>;
    gender?: Record<string, number>;
    location?: Record<string, number>;
    device?: Record<string, number>;
  };
  period: 'day' | 'week' | 'month' | 'year' | 'all';
  updatedAt: string;
}

interface AudienceMetrics {
  id: string;
  creatorId: string;
  totalFollowers: number;
  activeFollowers: number;
  followerGrowth: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  demographics: {
    age?: Record<string, number>;
    gender?: Record<string, number>;
    location?: Record<string, number>;
    interests?: Record<string, number>;
    languages?: Record<string, number>;
  };
  engagement: {
    rate: number;
    distribution: Record<string, number>;
  };
  retention: {
    returningViewers: number;
    churnRate: number;
    watchTime: {
      average: number;
      distribution: Record<string, number>;
    };
  };
  period: 'day' | 'week' | 'month' | 'year' | 'all';
  updatedAt: string;
}

interface RevenueMetrics {
  id: string;
  creatorId: string;
  totalRevenue: number;
  subscriptionRevenue: number;
  donationRevenue: number;
  adRevenue: number;
  merchandiseRevenue: number;
  transactionCount: number;
  averageTransactionValue: number;
  revenueByContent: Record<string, number>;
  revenueByGeography: Record<string, number>;
  revenueByPlatform: Record<string, number>;
  period: 'day' | 'week' | 'month' | 'year' | 'all';
  updatedAt: string;
}

interface PerformanceMetrics {
  id: string;
  creatorId: string;
  uploadSpeed: {
    average: number;
    distribution: Record<string, number>;
  };
  processingTime: {
    average: number;
    distribution: Record<string, number>;
  };
  deliveryLatency: {
    average: number;
    distribution: Record<string, number>;
  };
  qualityMetrics: {
    resolution: Record<string, number>;
    bitrate: Record<string, number>;
    framerate: Record<string, number>;
    buffering: Record<string, number>;
  };
  errorRates: {
    upload: number;
    processing: number;
    playback: number;
  };
  period: 'day' | 'week' | 'month' | 'year' | 'all';
  updatedAt: string;
}

interface AnalyticsTimeRange {
  start: Date;
  end: Date;
  period: 'day' | 'week' | 'month' | 'year' | 'all';
}

export class AnalyticsService {
  private static instance: AnalyticsService;
  private contentMetrics = writable<Record<string, ContentMetrics>>({});
  private audienceMetrics = writable<AudienceMetrics | null>(null);
  private revenueMetrics = writable<RevenueMetrics | null>(null);
  private performanceMetrics = writable<PerformanceMetrics | null>(null);
  private timeRange = writable<AnalyticsTimeRange>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: new Date(),
    period: 'month'
  });
  private loading = writable(false);
  private error = writable<string | null>(null);
  private updateInterval: NodeJS.Timer | null = null;

  private constructor() {
    if (browser) {
      this.init();
    }
  }

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  private async init() {
    try {
      this.loading.set(true);

      // Load initial data
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await this.refreshMetrics();
      }

      // Setup periodic updates
      this.startPeriodicUpdates();

      // Setup realtime subscriptions
      this.setupRealtimeSubscriptions();
    } catch (err) {
      console.error('Analytics service initialization failed:', err);
      this.error.set(err.message);
    } finally {
      this.loading.set(false);
    }
  }

  private startPeriodicUpdates() {
    // Update metrics every 5 minutes
    this.updateInterval = setInterval(() => {
      this.refreshMetrics();
    }, 5 * 60 * 1000);
  }

  private setupRealtimeSubscriptions() {
    const { data: { user } } = supabase.auth.getUser();
    if (!user) return;

    return supabase
      .channel('analytics_updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'content_metrics',
        filter: `creator_id=eq.${user.id}`
      }, this.handleContentMetricsChange.bind(this))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'audience_metrics',
        filter: `creator_id=eq.${user.id}`
      }, this.handleAudienceMetricsChange.bind(this))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'revenue_metrics',
        filter: `creator_id=eq.${user.id}`
      }, this.handleRevenueMetricsChange.bind(this))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'performance_metrics',
        filter: `creator_id=eq.${user.id}`
      }, this.handlePerformanceMetricsChange.bind(this))
      .subscribe();
  }

  private async handleContentMetricsChange(payload: any) {
    await this.loadContentMetrics(payload.new.content_id);
  }

  private async handleAudienceMetricsChange(payload: any) {
    await this.loadAudienceMetrics(payload.new.creator_id);
  }

  private async handleRevenueMetricsChange(payload: any) {
    await this.loadRevenueMetrics(payload.new.creator_id);
  }

  private async handlePerformanceMetricsChange(payload: any) {
    await this.loadPerformanceMetrics(payload.new.creator_id);
  }

  private async refreshMetrics() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const range = this.getTimeRange();
    
    await Promise.all([
      this.loadAudienceMetrics(user.id),
      this.loadRevenueMetrics(user.id),
      this.loadPerformanceMetrics(user.id)
    ]);
  }

  async loadContentMetrics(contentId: string): Promise<void> {
    try {
      const range = this.getTimeRange();
      const { data, error } = await supabase
        .from('content_metrics')
        .select('*')
        .eq('content_id', contentId)
        .eq('period', range.period)
        .single();

      if (error) throw error;

      this.contentMetrics.update(metrics => ({
        ...metrics,
        [contentId]: data
      }));
    } catch (err) {
      console.error('Failed to load content metrics:', err);
      this.error.set(err.message);
    }
  }

  private async loadAudienceMetrics(creatorId: string): Promise<void> {
    try {
      const range = this.getTimeRange();
      const { data, error } = await supabase
        .from('audience_metrics')
        .select('*')
        .eq('creator_id', creatorId)
        .eq('period', range.period)
        .single();

      if (error) throw error;
      this.audienceMetrics.set(data);
    } catch (err) {
      console.error('Failed to load audience metrics:', err);
      this.error.set(err.message);
    }
  }

  private async loadRevenueMetrics(creatorId: string): Promise<void> {
    try {
      const range = this.getTimeRange();
      const { data, error } = await supabase
        .from('revenue_metrics')
        .select('*')
        .eq('creator_id', creatorId)
        .eq('period', range.period)
        .single();

      if (error) throw error;
      this.revenueMetrics.set(data);
    } catch (err) {
      console.error('Failed to load revenue metrics:', err);
      this.error.set(err.message);
    }
  }

  private async loadPerformanceMetrics(creatorId: string): Promise<void> {
    try {
      const range = this.getTimeRange();
      const { data, error } = await supabase
        .from('performance_metrics')
        .select('*')
        .eq('creator_id', creatorId)
        .eq('period', range.period)
        .single();

      if (error) throw error;
      this.performanceMetrics.set(data);
    } catch (err) {
      console.error('Failed to load performance metrics:', err);
      this.error.set(err.message);
    }
  }

  async trackEvent(event: {
    type: string;
    contentId?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('analytics_events')
        .insert({
          creator_id: user.id,
          ...event,
          timestamp: new Date().toISOString()
        });

      if (error) throw error;
    } catch (err) {
      console.error('Failed to track event:', err);
      this.error.set(err.message);
    }
  }

  setTimeRange(range: AnalyticsTimeRange): void {
    this.timeRange.set(range);
    this.refreshMetrics();
  }

  getTimeRange(): AnalyticsTimeRange {
    let result: AnalyticsTimeRange | null = null;
    this.timeRange.subscribe(value => {
      result = value;
    })();
    return result!;
  }

  getContentMetrics(contentId: string): ContentMetrics | null {
    let result: ContentMetrics | null = null;
    this.contentMetrics.subscribe(metrics => {
      result = metrics[contentId] || null;
    })();
    return result;
  }

  getAudienceMetrics(): AudienceMetrics | null {
    let result: AudienceMetrics | null = null;
    this.audienceMetrics.subscribe(value => {
      result = value;
    })();
    return result;
  }

  getRevenueMetrics(): RevenueMetrics | null {
    let result: RevenueMetrics | null = null;
    this.revenueMetrics.subscribe(value => {
      result = value;
    })();
    return result;
  }

  getPerformanceMetrics(): PerformanceMetrics | null {
    let result: PerformanceMetrics | null = null;
    this.performanceMetrics.subscribe(value => {
      result = value;
    })();
    return result;
  }

  isLoading(): boolean {
    let result = false;
    this.loading.subscribe(value => {
      result = value;
    })();
    return result;
  }

  getError(): string | null {
    let result: string | null = null;
    this.error.subscribe(value => {
      result = value;
    })();
    return result;
  }

  // Derived stores
  totalViews = derived(this.contentMetrics, $metrics =>
    Object.values($metrics).reduce((sum, m) => sum + m.views, 0)
  );

  totalEngagement = derived(this.contentMetrics, $metrics =>
    Object.values($metrics).reduce((sum, m) => 
      sum + m.engagement.likes + m.engagement.comments + m.engagement.shares + m.engagement.saves, 0
    )
  );

  averageWatchTime = derived(this.contentMetrics, $metrics => {
    const metrics = Object.values($metrics);
    if (metrics.length === 0) return 0;
    return metrics.reduce((sum, m) => sum + m.averageWatchTime, 0) / metrics.length;
  });

  topPerformingContent = derived(this.contentMetrics, $metrics =>
    Object.values($metrics)
      .sort((a, b) => b.views - a.views)
      .slice(0, 10)
  );

  revenueGrowth = derived(this.revenueMetrics, $metrics => {
    if (!$metrics) return 0;
    // Calculate revenue growth based on previous period
    return 0; // Implement growth calculation logic
  });

  cleanup() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    this.contentMetrics.set({});
    this.audienceMetrics.set(null);
    this.revenueMetrics.set(null);
    this.performanceMetrics.set(null);
    this.error.set(null);
  }
}

export const analyticsService = AnalyticsService.getInstance(); 