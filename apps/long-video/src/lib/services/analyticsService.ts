import { supabase } from '$lib/supabase';
import type { 
  AnalyticsEvent, 
  ViewerEngagement, 
  VideoMetrics,
  ChapterMetrics,
  RetentionPoint 
} from '$lib/types/analytics';

export class AnalyticsService {
  private videoId: string;
  private sessionId: string;
  private startTime: number;
  private lastUpdateTime: number;
  private watchedSegments: Set<number>;
  private isActive: boolean;

  constructor(videoId: string) {
    this.videoId = videoId;
    this.sessionId = crypto.randomUUID();
    this.startTime = Date.now();
    this.lastUpdateTime = this.startTime;
    this.watchedSegments = new Set();
    this.isActive = true;

    // Setup cleanup on page unload
    window.addEventListener('beforeunload', () => this.endSession());
  }

  /**
   * Track video playback events
   */
  async trackPlaybackEvent(event: AnalyticsEvent) {
    if (!this.isActive) return;

    try {
      const timestamp = event.timestamp || new Date().toISOString();
      
      await supabase.from('video_events').insert({
        video_id: this.videoId,
        session_id: this.sessionId,
        event_type: event.type,
        current_time: event.currentTime,
        timestamp
      });

      // Update watch time on pause/end
      if (event.type === 'pause' || event.type === 'end') {
        await this.updateWatchTime();
      }

      // Track completion on end
      if (event.type === 'end') {
        await this.trackCompletion();
      }
    } catch (error) {
      console.error('Failed to track playback event:', error);
    }
  }

  /**
   * Track viewer engagement
   */
  async trackEngagement(type: 'like' | 'share' | 'comment' | 'click', metadata?: any) {
    if (!this.isActive) return;

    try {
      await supabase.from('engagement_events').insert({
        video_id: this.videoId,
        session_id: this.sessionId,
        engagement_type: type,
        metadata,
        timestamp: new Date().toISOString()
      });

      // Update engagement metrics
      await this.updateEngagementMetrics(type);
    } catch (error) {
      console.error('Failed to track engagement:', error);
    }
  }

  /**
   * Track chapter interaction
   */
  async trackChapterInteraction(chapterId: string, type: 'view' | 'skip' | 'replay', duration?: number) {
    if (!this.isActive) return;

    try {
      await supabase.from('chapter_events').insert({
        video_id: this.videoId,
        chapter_id: chapterId,
        session_id: this.sessionId,
        event_type: type,
        duration,
        timestamp: new Date().toISOString()
      });

      // Update chapter metrics
      await this.updateChapterMetrics(chapterId, type);
    } catch (error) {
      console.error('Failed to track chapter interaction:', error);
    }
  }

  /**
   * Track retention at specific time point
   */
  async trackRetentionPoint(timePoint: number) {
    if (!this.isActive || this.watchedSegments.has(timePoint)) return;

    try {
      this.watchedSegments.add(timePoint);

      await supabase.from('retention_points').insert({
        video_id: this.videoId,
        session_id: this.sessionId,
        time_point: timePoint,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to track retention point:', error);
    }
  }

  /**
   * Get real-time video metrics
   */
  async getMetrics(): Promise<VideoMetrics> {
    const { data, error } = await supabase
      .from('video_metrics')
      .select(`
        *,
        chapter_metrics:video_chapter_metrics(*)
      `)
      .eq('video_id', this.videoId)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get viewer engagement metrics
   */
  async getEngagement(): Promise<ViewerEngagement> {
    const { data, error } = await supabase
      .rpc('get_video_engagement', {
        video_id: this.videoId
      });

    if (error) throw error;
    return data;
  }

  /**
   * Get chapter performance metrics
   */
  async getChapterMetrics(): Promise<ChapterMetrics[]> {
    const { data, error } = await supabase
      .from('video_chapter_metrics')
      .select('*')
      .eq('video_id', this.videoId);

    if (error) throw error;
    return data;
  }

  /**
   * Get retention curve data
   */
  async getRetentionCurve(): Promise<RetentionPoint[]> {
    const { data, error } = await supabase
      .rpc('get_retention_curve', {
        video_id: this.videoId
      });

    if (error) throw error;
    return data;
  }

  /**
   * Subscribe to real-time metric updates
   */
  subscribeToMetrics(callback: (metrics: VideoMetrics) => void) {
    return supabase
      .channel(`video-metrics-${this.videoId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'video_metrics',
          filter: `video_id=eq.${this.videoId}`
        },
        (payload) => callback(payload.new as VideoMetrics)
      )
      .subscribe();
  }

  /**
   * End analytics session
   */
  private async endSession() {
    if (!this.isActive) return;

    this.isActive = false;
    await Promise.all([
      this.updateWatchTime(),
      supabase.from('video_sessions').update({
        ended_at: new Date().toISOString()
      }).eq('session_id', this.sessionId)
    ]);
  }

  /**
   * Update total watch time
   */
  private async updateWatchTime() {
    const currentTime = Date.now();
    const watchTime = currentTime - this.lastUpdateTime;
    this.lastUpdateTime = currentTime;

    await supabase.rpc('update_watch_time', {
      video_id: this.videoId,
      session_id: this.sessionId,
      watch_time: watchTime
    });
  }

  /**
   * Track video completion
   */
  private async trackCompletion() {
    await supabase.rpc('increment_video_completion', {
      video_id: this.videoId,
      session_id: this.sessionId
    });
  }

  /**
   * Update engagement metrics
   */
  private async updateEngagementMetrics(type: string) {
    await supabase.rpc('update_engagement_metrics', {
      video_id: this.videoId,
      engagement_type: type
    });
  }

  /**
   * Update chapter metrics
   */
  private async updateChapterMetrics(chapterId: string, type: string) {
    await supabase.rpc('update_chapter_metrics', {
      video_id: this.videoId,
      chapter_id: chapterId,
      event_type: type
    });
  }
}

// Create analytics service instance
export function createAnalyticsService(videoId: string) {
  return new AnalyticsService(videoId);
} 