import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { supabase } from '$lib/supabaseClient';
import { performanceOptimizationService } from '../optimization/PerformanceOptimizationService';

interface EngagementMetrics {
  views: number;
  participants: number;
  discussions: number;
  comments: number;
  reactions: number;
  shares: number;
  averageSessionDuration: number;
  bounceRate: number;
}

interface ContentMetrics {
  topDiscussions: Array<{
    id: string;
    title: string;
    views: number;
    participants: number;
    comments: number;
    quality: number;
  }>;
  categoryDistribution: Record<string, number>;
  tagDistribution: Record<string, number>;
  contentQualityTrend: Array<{
    date: string;
    averageQuality: number;
  }>;
}

interface UserMetrics {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  retentionRate: number;
  userGrowth: Array<{
    date: string;
    total: number;
    new: number;
    active: number;
  }>;
  topContributors: Array<{
    id: string;
    username: string;
    discussions: number;
    comments: number;
    reputation: number;
  }>;
}

interface ReputationMetrics {
  reputationDistribution: Array<{
    range: string;
    count: number;
  }>;
  topEarners: Array<{
    id: string;
    username: string;
    reputation: number;
    change: number;
  }>;
  reputationSources: Record<string, number>;
}

interface TimeRange {
  start: Date;
  end: Date;
}

export class AnalyticsService {
  private static instance: AnalyticsService;
  private engagement = writable<EngagementMetrics | null>(null);
  private content = writable<ContentMetrics | null>(null);
  private users = writable<UserMetrics | null>(null);
  private reputation = writable<ReputationMetrics | null>(null);
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
    await this.refreshMetrics();
    this.startPeriodicUpdates();
  }

  private startPeriodicUpdates() {
    this.updateInterval = setInterval(() => {
      this.refreshMetrics();
    }, 300000); // Every 5 minutes
  }

  private async refreshMetrics() {
    const timeRanges = {
      day: this.getTimeRange('day'),
      week: this.getTimeRange('week'),
      month: this.getTimeRange('month')
    };

    await Promise.all([
      this.updateEngagementMetrics(timeRanges.day),
      this.updateContentMetrics(timeRanges.week),
      this.updateUserMetrics(timeRanges.month),
      this.updateReputationMetrics(timeRanges.week)
    ]);
  }

  private getTimeRange(period: 'day' | 'week' | 'month'): TimeRange {
    const end = new Date();
    const start = new Date();

    switch (period) {
      case 'day':
        start.setDate(start.getDate() - 1);
        break;
      case 'week':
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start.setMonth(start.getMonth() - 1);
        break;
    }

    return { start, end };
  }

  private async updateEngagementMetrics(timeRange: TimeRange) {
    try {
      // Get views
      const { data: viewsData, error: viewsError } = await supabase
        .from('analytics_views')
        .select('*')
        .gte('timestamp', timeRange.start.toISOString())
        .lte('timestamp', timeRange.end.toISOString());

      if (viewsError) throw viewsError;

      // Get sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('analytics_sessions')
        .select('*')
        .gte('start_time', timeRange.start.toISOString())
        .lte('end_time', timeRange.end.toISOString());

      if (sessionsError) throw sessionsError;

      // Calculate metrics
      const totalSessions = sessionsData.length;
      const totalSessionDuration = sessionsData.reduce((sum, session) => 
        sum + (new Date(session.end_time).getTime() - new Date(session.start_time).getTime()),
        0
      );

      const metrics: EngagementMetrics = {
        views: viewsData.length,
        participants: new Set(viewsData.map(v => v.user_id)).size,
        discussions: new Set(viewsData.map(v => v.discussion_id)).size,
        comments: viewsData.filter(v => v.type === 'comment').length,
        reactions: viewsData.filter(v => v.type === 'reaction').length,
        shares: viewsData.filter(v => v.type === 'share').length,
        averageSessionDuration: totalSessions > 0 ? totalSessionDuration / totalSessions : 0,
        bounceRate: sessionsData.filter(s => 
          new Date(s.end_time).getTime() - new Date(s.start_time).getTime() < 30000
        ).length / totalSessions
      };

      this.engagement.set(metrics);
    } catch (error) {
      console.error('Error updating engagement metrics:', error);
    }
  }

  private async updateContentMetrics(timeRange: TimeRange) {
    try {
      // Get discussions with their metrics
      const { data: discussions, error: discussionsError } = await supabase
        .from('discussions')
        .select(`
          id,
          title,
          category,
          tags,
          quality_score,
          views_count,
          participants_count,
          comments_count,
          created_at
        `)
        .gte('created_at', timeRange.start.toISOString())
        .lte('created_at', timeRange.end.toISOString());

      if (discussionsError) throw discussionsError;

      // Calculate category distribution
      const categoryDistribution: Record<string, number> = {};
      discussions.forEach(d => {
        categoryDistribution[d.category] = (categoryDistribution[d.category] || 0) + 1;
      });

      // Calculate tag distribution
      const tagDistribution: Record<string, number> = {};
      discussions.forEach(d => {
        d.tags.forEach((tag: string) => {
          tagDistribution[tag] = (tagDistribution[tag] || 0) + 1;
        });
      });

      // Calculate quality trend
      const qualityByDate = discussions.reduce((acc: Record<string, number[]>, d) => {
        const date = new Date(d.created_at).toISOString().split('T')[0];
        if (!acc[date]) acc[date] = [];
        acc[date].push(d.quality_score);
        return acc;
      }, {});

      const contentQualityTrend = Object.entries(qualityByDate).map(([date, scores]) => ({
        date,
        averageQuality: scores.reduce((a, b) => a + b, 0) / scores.length
      }));

      const metrics: ContentMetrics = {
        topDiscussions: discussions
          .sort((a, b) => b.views_count - a.views_count)
          .slice(0, 10)
          .map(d => ({
            id: d.id,
            title: d.title,
            views: d.views_count,
            participants: d.participants_count,
            comments: d.comments_count,
            quality: d.quality_score
          })),
        categoryDistribution,
        tagDistribution,
        contentQualityTrend
      };

      this.content.set(metrics);
    } catch (error) {
      console.error('Error updating content metrics:', error);
    }
  }

  private async updateUserMetrics(timeRange: TimeRange) {
    try {
      // Get user activity
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select(`
          id,
          username,
          created_at,
          last_active_at,
          discussions_count,
          comments_count,
          reputation
        `);

      if (usersError) throw usersError;

      const now = new Date();
      const activeThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days

      const metrics: UserMetrics = {
        totalUsers: users.length,
        activeUsers: users.filter(u => new Date(u.last_active_at) > activeThreshold).length,
        newUsers: users.filter(u => new Date(u.created_at) > timeRange.start).length,
        retentionRate: 0, // Calculate based on cohort analysis
        userGrowth: [], // Calculate daily/weekly growth
        topContributors: users
          .sort((a, b) => (b.discussions_count + b.comments_count) - (a.discussions_count + a.comments_count))
          .slice(0, 10)
          .map(u => ({
            id: u.id,
            username: u.username,
            discussions: u.discussions_count,
            comments: u.comments_count,
            reputation: u.reputation
          }))
      };

      // Calculate user growth trend
      const growth = new Map<string, { total: number; new: number; active: number }>();
      const days = (timeRange.end.getTime() - timeRange.start.getTime()) / (24 * 60 * 60 * 1000);

      for (let i = 0; i <= days; i++) {
        const date = new Date(timeRange.start);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];

        growth.set(dateStr, {
          total: users.filter(u => new Date(u.created_at) <= date).length,
          new: users.filter(u => new Date(u.created_at).toISOString().startsWith(dateStr)).length,
          active: users.filter(u => new Date(u.last_active_at).toISOString().startsWith(dateStr)).length
        });
      }

      metrics.userGrowth = Array.from(growth.entries()).map(([date, data]) => ({
        date,
        ...data
      }));

      this.users.set(metrics);
    } catch (error) {
      console.error('Error updating user metrics:', error);
    }
  }

  private async updateReputationMetrics(timeRange: TimeRange) {
    try {
      // Get reputation data
      const { data: reputationData, error: reputationError } = await supabase
        .from('reputation_events')
        .select(`
          user_id,
          amount,
          reason,
          created_at,
          users (
            id,
            username,
            reputation
          )
        `)
        .gte('created_at', timeRange.start.toISOString())
        .lte('created_at', timeRange.end.toISOString());

      if (reputationError) throw reputationError;

      // Calculate reputation distribution
      const ranges = [
        { min: 0, max: 100, label: '0-100' },
        { min: 101, max: 500, label: '101-500' },
        { min: 501, max: 1000, label: '501-1000' },
        { min: 1001, max: 5000, label: '1001-5000' },
        { min: 5001, max: Infinity, label: '5000+' }
      ];

      const distribution = ranges.map(range => ({
        range: range.label,
        count: reputationData.filter(d => 
          d.users.reputation >= range.min && d.users.reputation <= range.max
        ).length
      }));

      // Calculate top earners
      const earnerMap = new Map<string, {
        username: string;
        reputation: number;
        change: number;
      }>();

      reputationData.forEach(event => {
        const user = event.users;
        const current = earnerMap.get(user.id) || {
          username: user.username,
          reputation: user.reputation,
          change: 0
        };
        current.change += event.amount;
        earnerMap.set(user.id, current);
      });

      const topEarners = Array.from(earnerMap.entries())
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.change - a.change)
        .slice(0, 10);

      // Calculate reputation sources
      const sources: Record<string, number> = {};
      reputationData.forEach(event => {
        sources[event.reason] = (sources[event.reason] || 0) + event.amount;
      });

      const metrics: ReputationMetrics = {
        reputationDistribution: distribution,
        topEarners,
        reputationSources: sources
      };

      this.reputation.set(metrics);
    } catch (error) {
      console.error('Error updating reputation metrics:', error);
    }
  }

  // Public methods
  getEngagementMetrics() {
    return this.engagement;
  }

  getContentMetrics() {
    return this.content;
  }

  getUserMetrics() {
    return this.users;
  }

  getReputationMetrics() {
    return this.reputation;
  }

  async trackEvent(event: {
    type: string;
    userId: string;
    targetId?: string;
    metadata?: Record<string, any>;
  }) {
    try {
      const { error } = await supabase
        .from('analytics_events')
        .insert([{
          type: event.type,
          user_id: event.userId,
          target_id: event.targetId,
          metadata: event.metadata,
          created_at: new Date().toISOString()
        }]);

      if (error) throw error;
    } catch (error) {
      console.error('Error tracking event:', error);
    }
  }

  cleanup() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}

// Create service instance
export const analyticsService = AnalyticsService.getInstance(); 