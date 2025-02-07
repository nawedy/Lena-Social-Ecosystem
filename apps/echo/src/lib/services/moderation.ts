import { supabase } from '$lib/supabaseClient';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// Types
export interface ContentAnalysis {
  toxicity: number;
  spam: number;
  hate: number;
  adult: number;
  violence: number;
  sentiment: number;
  language: string;
  topics: string[];
  entities: string[];
  recommendation: 'approve' | 'review' | 'reject';
  confidence: number;
}

export interface ModerationAction {
  contentId: string;
  contentType: 'post' | 'comment' | 'media';
  action: 'approve' | 'reject' | 'flag';
  reason: string;
  moderatorId: string;
}

export interface ModerationSettings {
  autoModeration: boolean;
  thresholds: {
    toxicity: number;
    spam: number;
    hate: number;
    adult: number;
    violence: number;
  };
  aiConfidenceThreshold: number;
  requireMultipleModerators: boolean;
  minimumModeratorCount: number;
}

// Default settings
const defaultSettings: ModerationSettings = {
  autoModeration: true,
  thresholds: {
    toxicity: 0.8,
    spam: 0.8,
    hate: 0.7,
    adult: 0.8,
    violence: 0.8
  },
  aiConfidenceThreshold: 0.9,
  requireMultipleModerators: true,
  minimumModeratorCount: 2
};

// AI content analysis
async function analyzeContent(content: string): Promise<ContentAnalysis> {
  try {
    // Call AI moderation service (replace with your preferred service)
    const response = await fetch('https://api.moderationservice.com/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_AI_MODERATION_KEY}`
      },
      body: JSON.stringify({ content })
    });

    if (!response.ok) throw new Error('Failed to analyze content');
    const analysis = await response.json();

    // Determine recommendation based on thresholds
    const recommendation = determineRecommendation(analysis);

    return {
      ...analysis,
      recommendation
    };
  } catch (error) {
    console.error('Content analysis error:', error);
    throw new Error('Failed to analyze content');
  }
}

// Determine content recommendation based on analysis
function determineRecommendation(analysis: Partial<ContentAnalysis>): 'approve' | 'review' | 'reject' {
  const settings = defaultSettings;

  // Auto-reject if any threshold is exceeded with high confidence
  if (analysis.confidence && analysis.confidence >= settings.aiConfidenceThreshold) {
    if (
      (analysis.toxicity && analysis.toxicity >= settings.thresholds.toxicity) ||
      (analysis.spam && analysis.spam >= settings.thresholds.spam) ||
      (analysis.hate && analysis.hate >= settings.thresholds.hate) ||
      (analysis.adult && analysis.adult >= settings.thresholds.adult) ||
      (analysis.violence && analysis.violence >= settings.thresholds.violence)
    ) {
      return 'reject';
    }
  }

  // Require review if thresholds are approached
  const reviewThreshold = 0.7;
  if (
    (analysis.toxicity && analysis.toxicity >= reviewThreshold) ||
    (analysis.spam && analysis.spam >= reviewThreshold) ||
    (analysis.hate && analysis.hate >= reviewThreshold) ||
    (analysis.adult && analysis.adult >= reviewThreshold) ||
    (analysis.violence && analysis.violence >= reviewThreshold)
  ) {
    return 'review';
  }

  return 'approve';
}

// Moderation service
export const moderationService = {
  // Analyze and moderate content
  async moderateContent(
    content: string,
    type: 'post' | 'comment' | 'media',
    userId: string
  ): Promise<{ approved: boolean; reason?: string }> {
    try {
      // Analyze content
      const analysis = await analyzeContent(content);

      // Store analysis results
      const { error: analysisError } = await supabase
        .from('ai_content_analysis')
        .insert({
          content_type: type,
          toxicity_score: analysis.toxicity,
          spam_probability: analysis.spam,
          adult_content_score: analysis.adult,
          violence_score: analysis.violence,
          hate_speech_score: analysis.hate,
          detected_languages: [analysis.language],
          detected_entities: analysis.entities,
          content_categories: analysis.topics,
          recommendation: analysis.recommendation,
          confidence: analysis.confidence
        });

      if (analysisError) throw analysisError;

      // Handle recommendation
      switch (analysis.recommendation) {
        case 'approve':
          return { approved: true };

        case 'reject':
          // Add to moderation queue for review
          await supabase
            .from('moderation_queue')
            .insert({
              content_type: type,
              status: 'rejected',
              moderation_notes: 'Automatically rejected by AI moderation'
            });
          return {
            approved: false,
            reason: 'Content violates community guidelines'
          };

        case 'review':
          // Add to moderation queue
          await supabase
            .from('moderation_queue')
            .insert({
              content_type: type,
              status: 'pending'
            });
          return { approved: true }; // Approve but flag for review
      }
    } catch (error) {
      console.error('Content moderation error:', error);
      throw new Error('Failed to moderate content');
    }
  },

  // Submit moderation action
  async submitAction(action: ModerationAction): Promise<void> {
    try {
      const { error } = await supabase
        .from('moderation_actions')
        .insert({
          content_id: action.contentId,
          content_type: action.contentType,
          action: action.action,
          reason: action.reason,
          moderator_id: action.moderatorId
        });

      if (error) throw error;

      // Update content status if needed
      if (action.action === 'reject') {
        await supabase
          .from(action.contentType === 'post' ? 'posts' : 'comments')
          .update({ is_sensitive: true })
          .eq('id', action.contentId);
      }
    } catch (error) {
      console.error('Moderation action error:', error);
      throw new Error('Failed to submit moderation action');
    }
  },

  // Subscribe to moderation queue updates
  subscribeToQueue(callback: (payload: RealtimePostgresChangesPayload<any>) => void) {
    return supabase
      .channel('moderation_queue')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'moderation_queue' },
        callback
      )
      .subscribe();
  },

  // Get moderation queue
  async getQueue(status?: 'pending' | 'approved' | 'rejected') {
    try {
      let query = supabase
        .from('moderation_queue')
        .select('*')
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Get moderation queue error:', error);
      throw new Error('Failed to get moderation queue');
    }
  },

  // Update moderation settings
  async updateSettings(settings: Partial<ModerationSettings>): Promise<void> {
    try {
      const { error } = await supabase
        .from('moderation_settings')
        .update(settings)
        .eq('id', 1); // Assuming single settings row

      if (error) throw error;
    } catch (error) {
      console.error('Update settings error:', error);
      throw new Error('Failed to update moderation settings');
    }
  },

  // Get moderation settings
  async getSettings(): Promise<ModerationSettings> {
    try {
      const { data, error } = await supabase
        .from('moderation_settings')
        .select('*')
        .single();

      if (error) throw error;
      return data || defaultSettings;
    } catch (error) {
      console.error('Get settings error:', error);
      return defaultSettings;
    }
  }
}; 