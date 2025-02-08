import type { 
  VideoAnalytics, 
  VideoInteraction, 
  QualityChange, 
  BufferingEvent 
} from '$lib/types';
import { supabase } from '$lib/supabase';

export function createVideoAnalytics(videoId: string) {
  let analytics: VideoAnalytics = {
    videoId,
    watchTime: 0,
    startTime: Date.now(),
    endTime: 0,
    interactions: [],
    qualityChanges: [],
    bufferingEvents: []
  };

  let bufferingStart = 0;
  let lastQuality = 'auto';
  let isBuffering = false;

  async function saveAnalytics() {
    try {
      const { error } = await supabase
        .from('video_analytics')
        .upsert({
          video_id: videoId,
          date: new Date().toISOString().split('T')[0],
          watch_time: Math.floor(analytics.watchTime / 1000), // Convert to seconds
          views: 1,
          unique_viewers: 1, // This should be handled by the backend
          interactions: analytics.interactions,
          quality_changes: analytics.qualityChanges,
          buffering_events: analytics.bufferingEvents
        });

      if (error) {
        console.error('Failed to save analytics:', error);
      }
    } catch (error) {
      console.error('Analytics error:', error);
    }
  }

  // Save analytics periodically and on page unload
  const saveInterval = setInterval(saveAnalytics, 60000); // Every minute
  window.addEventListener('beforeunload', () => {
    clearInterval(saveInterval);
    analytics.endTime = Date.now();
    saveAnalytics();
  });

  return {
    /**
     * Update watch time
     */
    updateWatchTime(seconds: number) {
      analytics.watchTime += seconds * 1000; // Convert to milliseconds
    },

    /**
     * Track video interaction
     */
    trackInteraction(type: VideoInteraction['type'], value?: any) {
      const interaction: VideoInteraction = {
        type,
        timestamp: Date.now(),
        value
      };
      analytics.interactions.push(interaction);
    },

    /**
     * Track quality change
     */
    trackQualityChange(newQuality: string, automatic: boolean = false) {
      const change: QualityChange = {
        timestamp: Date.now(),
        from: lastQuality,
        to: newQuality,
        automatic
      };
      lastQuality = newQuality;
      analytics.qualityChanges.push(change);
    },

    /**
     * Start tracking buffering
     */
    startBuffering(reason?: string) {
      if (!isBuffering) {
        isBuffering = true;
        bufferingStart = Date.now();
        this.trackInteraction('pause', { reason: 'buffering' });
      }
    },

    /**
     * End tracking buffering
     */
    endBuffering() {
      if (isBuffering) {
        const event: BufferingEvent = {
          timestamp: bufferingStart,
          duration: Date.now() - bufferingStart,
          reason: 'buffering'
        };
        analytics.bufferingEvents.push(event);
        isBuffering = false;
        this.trackInteraction('play', { reason: 'buffering_complete' });
      }
    },

    /**
     * Track video ended
     */
    videoEnded() {
      analytics.endTime = Date.now();
      this.trackInteraction('ended');
      saveAnalytics();
    },

    /**
     * Get current analytics data
     */
    getAnalytics(): VideoAnalytics {
      return { ...analytics };
    }
  };
} 